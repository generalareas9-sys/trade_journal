import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authorization = request.headers.get('Authorization')
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const configuredAdminId = Deno.env.get('ADMIN_USER_ID')
    const configuredAdminEmails = (Deno.env.get('ADMIN_EMAILS') || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (!authorization?.startsWith('Bearer ') || !url || !anonKey || !serviceRoleKey) {
      return jsonResponse(401, { error: 'Authentication required.' })
    }

    const token = authorization.slice('Bearer '.length)
    const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: 'Session invalid or expired.' })
    }

    const adminUser = authData.user
    const userEmail = (adminUser.email || '').toLowerCase()

    // Strict Admin authorization check – only ADMIN_USER_ID is allowed
    if (!configuredAdminId) {
      // Missing secret – configuration error
      return jsonResponse(500, { error: 'SERVER CONFIGURATION ERROR: ADMIN_USER_ID is not set.' })
    }
    const isAuthorizedAdmin = adminUser.id === configuredAdminId

    if (!isAuthorizedAdmin) {
      return jsonResponse(403, { error: 'Access denied. You do not have administrator permissions.' })
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

    // GET: List all manual payment requests with private proof signed URLs
    if (request.method === 'GET') {
      const { data: requests, error: listError } = await admin
        .from('manual_payment_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (listError) {
        return jsonResponse(500, { error: listError.message })
      }

      // Generate signed URLs for private screenshot proofs
      const enrichedRequests = await Promise.all(
        (requests || []).map(async (item) => {
          let signedProofUrl = null
          if (item.screenshot_url) {
            let storagePath = item.screenshot_url
            // If the value was saved as a URL, extract path relative to bucket
            if (storagePath.includes('/payment-proofs/')) {
              storagePath = storagePath.split('/payment-proofs/')[1]?.split('?')[0] || storagePath
            }
            try {
              const { data: signedData } = await admin.storage
                .from('payment-proofs')
                .createSignedUrl(storagePath, 3600) // 1-hour secure link
              signedProofUrl = signedData?.signedUrl || null
            } catch (err) {
              console.warn('Could not generate signed URL for:', storagePath, err)
            }
          }

          return {
            ...item,
            signed_proof_url: signedProofUrl,
          }
        }),
      )

      return jsonResponse(200, { requests: enrichedRequests })
    }

    // POST: Approve or Reject
    if (request.method === 'POST') {
      const body = await request.json()
      const { requestId, action, notes } = body // action: 'approve' | 'reject'

      if (!requestId || !['approve', 'reject'].includes(action)) {
        return jsonResponse(400, { error: 'Valid requestId and action (approve/reject) are required.' })
      }

      const { data: reqRecord, error: getError } = await admin
        .from('manual_payment_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (getError || !reqRecord) {
        return jsonResponse(404, { error: 'Payment request not found.' })
      }

      // Idempotency: Prevent duplicate approvals
      if (action === 'approve' && reqRecord.status === 'approved') {
        return jsonResponse(200, {
          success: true,
          message: 'Payment request is already approved.',
        })
      }

      const now = new Date()

      // Reject action
      if (action === 'reject') {
        const { error: rejectError } = await admin
          .from('manual_payment_requests')
          .update({
            status: 'rejected',
            notes: notes || reqRecord.notes || 'Payment proof could not be verified.',
            reviewed_at: now.toISOString(),
            reviewed_by: adminUser.id,
          })
          .eq('id', requestId)

        if (rejectError) return jsonResponse(500, { error: rejectError.message })
        return jsonResponse(200, {
          success: true,
          message: 'Payment request rejected. Subscription remains inactive.',
        })
      }

      // Approve action: Validate and activate subscription
      const daysToAdd = reqRecord.period === 'yearly' ? 365 : 30

      // Check existing subscription to extend if still active
      const { data: existingSub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', reqRecord.user_id)
        .maybeSingle()

      let newPeriodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
      if (existingSub?.status === 'active' && new Date(existingSub.current_period_end) > now) {
        const currentEnd = new Date(existingSub.current_period_end)
        newPeriodEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
      }

      // 1. Activate/extend subscription
      const { error: subError } = await admin.from('subscriptions').upsert(
        {
          user_id: reqRecord.user_id,
          plan: reqRecord.plan,
          period: reqRecord.period,
          status: 'active',
          current_period_end: newPeriodEnd.toISOString(),
          provider: reqRecord.method,
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' },
      )

      if (subError) {
        console.error('Subscription update failed:', subError)
        return jsonResponse(500, { error: 'Failed to activate user subscription.' })
      }

      // 2. Record payment
      const tx_ref = `manual_${reqRecord.method}_${reqRecord.id.slice(0, 8)}_${Date.now()}`
      await admin.from('payments').insert({
        user_id: reqRecord.user_id,
        plan: reqRecord.plan,
        period: reqRecord.period,
        amount: reqRecord.amount,
        currency: reqRecord.currency,
        provider: reqRecord.method,
        status: 'paid',
        tx_ref,
        raw: {
          manual_request_id: reqRecord.id,
          tx_reference: reqRecord.tx_reference,
          approved_by: adminUser.id,
          approved_by_email: adminUser.email,
          approved_at: now.toISOString(),
        },
      })

      // 3. Mark request as approved
      const { error: approveError } = await admin
        .from('manual_payment_requests')
        .update({
          status: 'approved',
          notes: notes || reqRecord.notes,
          reviewed_at: now.toISOString(),
          reviewed_by: adminUser.id,
        })
        .eq('id', requestId)

      if (approveError) return jsonResponse(500, { error: approveError.message })

      return jsonResponse(200, {
        success: true,
        message: 'Payment approved and subscription successfully activated!',
      })
    }

    return jsonResponse(405, { error: 'Method not allowed.' })
  } catch (error) {
    console.error('admin-payment-action error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal error.' })
  }
})
