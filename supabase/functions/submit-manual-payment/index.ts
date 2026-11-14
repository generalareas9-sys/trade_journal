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

const VALID_METHODS = ['telebirr', 'cbe_bank']

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  try {
    const authorization = request.headers.get('Authorization')
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
      return jsonResponse(401, { error: 'A valid signed-in session is required.' })
    }

    const token = authorization.slice('Bearer '.length)
    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: 'The session is invalid or expired.' })
    }

    const user = authData.user
    const body = await request.json()

    const method = String(body.method || '').toLowerCase()
    const planId = String(body.plan || 'pro').toLowerCase()
    const period = body.period === 'yearly' ? 'yearly' : 'monthly'
    const tx_reference = String(body.tx_reference || '').trim()
    const screenshot_url = body.screenshot_url ? String(body.screenshot_url).trim() : null
    const notes = String(body.notes || '').trim()

    if (!VALID_METHODS.includes(method)) {
      return jsonResponse(400, { error: `Invalid payment method: ${method}. Supported methods: ${VALID_METHODS.join(', ')}` })
    }

    if (!tx_reference) {
      return jsonResponse(400, { error: 'Transaction reference or receipt number is required.' })
    }

    const planConfig = PLAN_RATES[planId]
    if (!planConfig) {
      return jsonResponse(400, { error: `Invalid plan specified: ${planId}` })
    }

    // Server-computed amount and currency - NEVER trust client price!
    const isCrypto = method === 'binance_pay' || method === 'usdt_onchain'
    const currency = isCrypto ? 'USD' : 'ETB'
    const amount = planConfig[currency][period]

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

    const { data: requestRecord, error: insertError } = await admin
      .from('manual_payment_requests')
      .insert({
        user_id: user.id,
        method,
        plan: planId,
        period,
        amount,
        currency,
        tx_reference,
        screenshot_url,
        notes,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create manual payment request:', insertError)
      return jsonResponse(500, { error: 'Could not submit payment request. Please try again.' })
    }

    return jsonResponse(200, {
      success: true,
      data: requestRecord,
      message: 'Payment request submitted for approval. An administrator will verify your payment and activate your subscription.',
    })
  } catch (error) {
    console.error('submit-manual-payment error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal error.' })
  }
})
