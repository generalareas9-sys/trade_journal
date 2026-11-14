import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chapa-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function verifyHmacSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const hexHash = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return hexHash.toLowerCase() === signature.toLowerCase()
  } catch (err) {
    console.error('Signature calculation error:', err)
    return false
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const chapaSecretKey = Deno.env.get('CHAPA_SECRET_KEY')
    const chapaWebhookSecret = Deno.env.get('CHAPA_WEBHOOK_SECRET') || chapaSecretKey

    if (!url || !serviceRoleKey || !chapaSecretKey) {
      return jsonResponse(500, { error: 'Server configuration missing.' })
    }

    const rawBody = await request.text()
    const incomingSignature = request.headers.get('x-chapa-signature')

    // Verify webhook signature if secret provided and header present
    if (chapaWebhookSecret && incomingSignature) {
      const isValidSig = await verifyHmacSignature(rawBody, incomingSignature, chapaWebhookSecret)
      if (!isValidSig) {
        console.warn('Invalid Chapa webhook signature received')
        return jsonResponse(401, { error: 'Invalid webhook signature.' })
      }
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      payload = {}
    }

    const tx_ref = (payload.tx_ref || payload.trx_ref || new URL(request.url).searchParams.get('tx_ref')) as string
    if (!tx_ref) {
      return jsonResponse(400, { error: 'Missing tx_ref in webhook.' })
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

    // Find the recorded pending payment
    const { data: payment, error: fetchError } = await admin
      .from('payments')
      .select('*')
      .eq('tx_ref', tx_ref)
      .maybeSingle()

    if (fetchError || !payment) {
      console.warn(`Payment record not found for tx_ref: ${tx_ref}`)
      return jsonResponse(404, { error: 'Payment record not found.' })
    }

    // Idempotency: If already marked paid, return 200 without duplicate action
    if (payment.status === 'paid') {
      return jsonResponse(200, { message: 'Payment already processed and active.' })
    }

    // ALWAYS ALSO verify with Chapa's official verify endpoint
    const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
      },
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok || verifyData.status !== 'success' || verifyData.data?.status !== 'success') {
      console.error('Chapa verification failed:', verifyData)
      await admin.from('payments').update({ status: 'failed', raw: verifyData }).eq('id', payment.id)
      return jsonResponse(400, { error: 'Chapa transaction verification failed.' })
    }

    // Verify amount and currency match
    const chapaAmount = Number(verifyData.data.amount)
    const expectedAmount = Number(payment.amount)
    const chapaCurrency = (verifyData.data.currency || '').toUpperCase()
    const expectedCurrency = (payment.currency || '').toUpperCase()

    if (chapaAmount !== expectedAmount || chapaCurrency !== expectedCurrency) {
      console.error('Amount or currency mismatch:', { chapaAmount, expectedAmount, chapaCurrency, expectedCurrency })
      return jsonResponse(400, { error: 'Payment amount or currency mismatch.' })
    }

    // 1. Mark payment as paid
    const { error: updatePaymentError } = await admin
      .from('payments')
      .update({
        status: 'paid',
        raw: verifyData,
      })
      .eq('id', payment.id)

    if (updatePaymentError) {
      console.error('Failed to update payment status:', updatePaymentError)
      return jsonResponse(500, { error: 'Failed to update payment status.' })
    }

    // 2. Compute subscription expiration (30 days for monthly, 365 days for yearly)
    const daysToAdd = payment.period === 'yearly' ? 365 : 30
    const now = new Date()

    // Check existing subscription to extend if still active
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', payment.user_id)
      .maybeSingle()

    let newPeriodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    if (existingSub?.status === 'active' && new Date(existingSub.current_period_end) > now) {
      const currentEnd = new Date(existingSub.current_period_end)
      newPeriodEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    }

    // 3. Upsert active subscription
    const { error: subError } = await admin.from('subscriptions').upsert(
      {
        user_id: payment.user_id,
        plan: payment.plan,
        period: payment.period,
        status: 'active',
        current_period_end: newPeriodEnd.toISOString(),
        provider: 'chapa',
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (subError) {
      console.error('Failed to upsert subscription:', subError)
      return jsonResponse(500, { error: 'Failed to update user subscription.' })
    }

    return jsonResponse(200, { success: true, message: 'Subscription successfully activated.' })
  } catch (error) {
    console.error('chapa-webhook error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal webhook error.' })
  }
})

