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

// Plan prices strictly validated on server
const PLAN_RATES: Record<string, { ETB: { monthly: number; yearly: number }; USD: { monthly: number; yearly: number } }> = {
  essential: {
    ETB: { monthly: 800, yearly: 7680 },
    USD: { monthly: 15, yearly: 144 },
  },
  pro: {
    ETB: { monthly: 1500, yearly: 14400 },
    USD: { monthly: 29, yearly: 279 },
  },
  ultra: {
    ETB: { monthly: 2500, yearly: 24000 },
    USD: { monthly: 49, yearly: 468 },
  },
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

    // Authenticate user
    const token = authorization.slice('Bearer '.length)
    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: 'The session is invalid or expired.' })
    }

    const user = authData.user
    const body = await request.json()
    const planId = (body.plan || 'pro').toLowerCase()
    const period = body.period === 'yearly' ? 'yearly' : 'monthly'
    const requestedCurrency = (body.currency || 'ETB').toUpperCase()
    const currency = requestedCurrency === 'USD' ? 'USD' : 'ETB'

    const planConfig = PLAN_RATES[planId]
    if (!planConfig) {
      return jsonResponse(400, { error: `Invalid plan specified: ${planId}` })
    }

    // Server-computed amount - NEVER trust client price!
    const amount = planConfig[currency][period]
    const tx_ref = `tj_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`

    // Determine return & callback URLs
    const appOrigin = request.headers.get('origin') || Deno.env.get('APP_URL') || 'https://tradejournal.app'
    const returnUrl = `${appOrigin}/payment/success?tx_ref=${tx_ref}`
    const callbackUrl = `${url}/functions/v1/chapa-webhook`

    const userMeta = user.user_metadata || {}
    const fullName = (userMeta.full_name || userMeta.name || '').trim()
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || user.email?.split('@')[0] || 'Trader'
    const lastName = nameParts.slice(1).join(' ') || 'User'

    // Call Chapa initialize API
    const chapaPayload = {
      amount: amount.toString(),
      currency,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      tx_ref,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: `TradeJournal ${planId.toUpperCase()}`,
        description: `TradeJournal ${planId.toUpperCase()} (${period}) subscription`,
      },
    }

    const chapaResponse = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chapaPayload),
    })

    const chapaResult = await chapaResponse.json()

    if (!chapaResponse.ok || chapaResult.status !== 'success' || !chapaResult.data?.checkout_url) {
      console.error('Chapa initialize error:', chapaResult)
      return jsonResponse(400, {
        error: chapaResult.message || 'Could not initialize Chapa payment checkout.',
        details: chapaResult,
      })
    }

    // Record pending payment in payments table using service role
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    const { error: insertError } = await admin.from('payments').insert({
      user_id: user.id,
      plan: planId,
      period,
      amount,
      currency,
      provider: 'chapa',
      status: 'pending',
      tx_ref,
      raw: chapaResult,
    })

    if (insertError) {
      console.error('Failed to record pending payment:', insertError)
      return jsonResponse(500, { error: 'Failed to record pending transaction.' })
    }

    return jsonResponse(200, {
      checkout_url: chapaResult.data.checkout_url,
      tx_ref,
    })
  } catch (error) {
    console.error('create-checkout error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal server error.' })
  }
})

