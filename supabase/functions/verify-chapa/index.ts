import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  try {
    const authorization = request.headers.get('Authorization')
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const chapaSecretKey = Deno.env.get('CHAPA_SECRET_KEY')

    if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
      return jsonResponse(401, { error: 'A valid signed-in session is required.' })
    }

    if (!chapaSecretKey) {
      return jsonResponse(500, { error: 'CHAPA_SECRET_KEY is not configured in Supabase secrets.' })
    }

    const token = authorization.slice('Bearer '.length)
    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: 'The session is invalid or expired.' })
    }

    const user = authData.user
    const body = await request.json()
    const tx_ref = body.tx_ref

    if (!tx_ref) {
      return jsonResponse(400, { error: 'Missing tx_ref.' })
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

    // Find payment record
    const { data: payment, error: fetchError } = await admin
      .from('payments')
      .select('*')
      .eq('tx_ref', tx_ref)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !payment) {
      return jsonResponse(404, { error: 'Payment record not found for this user.' })
    }

    // If already paid, return active
    if (payment.status === 'paid') {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      return jsonResponse(200, { status: 'paid', subscription: sub })
    }

    // Call Chapa verify endpoint
    const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
      },
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok || verifyData.status !== 'success' || verifyData.data?.status !== 'success') {
      return jsonResponse(200, {
        status: 'pending',
        message: 'Transaction is not yet confirmed by Chapa.',
      })
    }

    // Check amount & currency match
    const chapaAmount = Number(verifyData.data.amount)
    const expectedAmount = Number(payment.amount)
    const chapaCurrency = (verifyData.data.currency || '').toUpperCase()
    const expectedCurrency = (payment.currency || '').toUpperCase()

    if (chapaAmount !== expectedAmount || chapaCurrency !== expectedCurrency) {
      return jsonResponse(400, { error: 'Payment amount or currency mismatch.' })
    }

    // Mark paid
    await admin.from('payments').update({ status: 'paid', raw: verifyData }).eq('id', payment.id)

    // Compute duration & update subscription
    const daysToAdd = payment.period === 'yearly' ? 365 : 30
    const now = new Date()

    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    let newPeriodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    if (existingSub?.status === 'active' && new Date(existingSub.current_period_end) > now) {
      const currentEnd = new Date(existingSub.current_period_end)
      newPeriodEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    }

    const { data: updatedSub, error: subError } = await admin
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan: payment.plan,
          period: payment.period,
          status: 'active',
          current_period_end: newPeriodEnd.toISOString(),
          provider: 'chapa',
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()

    if (subError) {
      console.error('Failed to update subscription:', subError)
      return jsonResponse(500, { error: 'Failed to update subscription record.' })
    }

    return jsonResponse(200, {
      status: 'paid',
      subscription: updatedSub,
      message: 'Payment verified and subscription activated!',
    })
  } catch (error) {
    console.error('verify-chapa error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal error.' })
  }
})

