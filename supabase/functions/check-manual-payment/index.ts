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
    if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
      return jsonResponse(401, { error: 'Authentication required.' })
    }

    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(
      authorization.slice('Bearer '.length),
    )
    if (authError || !authData.user) return jsonResponse(401, { error: 'Session invalid or expired.' })

    let requestId: string | null = null
    try {
      const body = await request.json()
      if (body?.requestId !== undefined && body.requestId !== null && body.requestId !== '') {
        if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
          return jsonResponse(400, { error: 'Invalid payment request reference.' })
        }
        requestId = body.requestId
      }
    } catch {
      return jsonResponse(400, { error: 'Invalid request body.' })
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    let paymentQuery = admin
      .from('manual_payment_requests')
      .select('id,user_id,method,plan,period,amount,currency,tx_reference,status,rejection_reason,created_at')
      .eq('user_id', authData.user.id)

    if (requestId) {
      paymentQuery = paymentQuery.eq('id', requestId)
    } else {
      paymentQuery = paymentQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: requests, error: requestError } = await paymentQuery
    if (requestError) {
      console.error('Could not check the signed-in user payment status:', requestError)
      return jsonResponse(500, { error: 'Could not check payment status. Please retry.' })
    }
    const payment = requests?.[0]

    if (!payment) {
      return jsonResponse(200, { hasRequest: false })
    }

    const { data: subscription, error: subscriptionError } = await admin
      .from('subscriptions')
      .select('status,current_period_end,plan,period,provider')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (subscriptionError) {
      console.error('Could not confirm the signed-in user subscription:', subscriptionError)
      return jsonResponse(500, { error: 'Could not confirm subscription activation. Please retry.' })
    }

    const active =
      subscription?.status === 'active' &&
      Number.isFinite(Date.parse(subscription.current_period_end)) &&
      Date.parse(subscription.current_period_end) > Date.now()

    return jsonResponse(200, {
      hasRequest: true,
      status: payment.status,
      method: payment.method,
      plan: payment.plan,
      period: payment.period,
      currency: payment.currency,
      transactionReference: payment.tx_reference,
      rejectionReason: payment.rejection_reason || '',
      submittedAt: payment.created_at,
      subscriptionActive: active,
      subscription: active
        ? {
            plan: subscription.plan,
            period: subscription.period,
            provider: subscription.provider,
            currentPeriodEnd: subscription.current_period_end,
          }
        : null,
    })
  } catch (error) {
    console.error('check-manual-payment error:', error)
    return jsonResponse(500, { error: 'Could not check payment status. Please retry.' })
  }
})
