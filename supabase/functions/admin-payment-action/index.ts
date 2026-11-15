import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendAdminNotification } from '../_shared/adminEmail.ts'
import { processPaymentEmail, type PaymentEmailEvent } from '../_shared/paymentEmail.ts'

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

function scheduleBackgroundTask(task: Promise<unknown>, requestId: string, event: string) {
  try {
    EdgeRuntime.waitUntil(task)
  } catch (error) {
    console.error('Could not register the customer email background task.', {
      requestId,
      event,
      error: error instanceof Error ? error.message : 'Unknown background task error.',
    })
    void task.catch((taskError) => {
      console.error('Customer email background task failed.', {
        requestId,
        event,
        error: taskError instanceof Error ? taskError.message : 'Unknown email error.',
      })
    })
  }
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

      const requestIds = enrichedRequests.map((item) => item.id)
      let emailNotifications: Array<Record<string, unknown>> = []
      if (requestIds.length > 0) {
        const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        const { error: staleNotificationError } = await admin
          .from('payment_email_notifications')
          .update({
            status: 'failed',
            error: 'Email delivery stopped before a final status was recorded. Please retry.',
            updated_at: new Date().toISOString(),
          })
          .in('payment_request_id', requestIds)
          .in('status', ['pending', 'sending'])
          .lt('updated_at', staleBefore)
        if (staleNotificationError) {
          console.error('Could not recover stale customer payment email statuses:', staleNotificationError)
          return jsonResponse(500, { error: 'Could not load payment email statuses. Retry the request.' })
        }

        const { data: notifications, error: notificationError } = await admin
          .from('payment_email_notifications')
          .select('payment_request_id,event,status,attempts,error')
          .in('payment_request_id', requestIds)
        if (notificationError) {
          console.error('Could not load customer payment email statuses:', notificationError)
          return jsonResponse(500, { error: 'Could not load payment email statuses. Run the customer email migration and retry.' })
        }
        emailNotifications = notifications || []
      }

      const notificationByEvent = new Map(
        emailNotifications.map((item) => [`${item.payment_request_id}:${item.event}`, item]),
      )
      const requestsWithEmailStatus = enrichedRequests.map((item) => {
        const event = item.status === 'approved' || item.status === 'rejected' ? item.status : null
        const notification = event ? notificationByEvent.get(`${item.id}:${event}`) : null
        return {
          ...item,
          email_notification_status: notification?.status || 'not_sent',
          email_notification_attempts: notification?.attempts || 0,
          email_notification_error: notification?.error || null,
        }
      })

      return jsonResponse(200, { requests: requestsWithEmailStatus })
    }

    // POST: Approve or Reject
    if (request.method === 'POST') {
      const body = await request.json()
      const { requestId, action } = body
      const rejectionReason =
        typeof body.rejectionReason === 'string'
          ? body.rejectionReason.trim()
          : typeof body.notes === 'string'
            ? body.notes.trim()
            : ''

      if (!requestId || !['approve', 'reject', 'resend-email'].includes(action)) {
        return jsonResponse(400, { error: 'Valid requestId and action (approve/reject/resend-email) are required.' })
      }
      if (action === 'reject' && !rejectionReason) {
        return jsonResponse(400, { error: 'A rejection reason is required.' })
      }
      if (rejectionReason.length > 1000) {
        return jsonResponse(400, { error: 'Rejection reason must be 1000 characters or fewer.' })
      }

      const { data: reqRecord, error: getError } = await admin
        .from('manual_payment_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (getError || !reqRecord) {
        return jsonResponse(404, { error: 'Payment request not found.' })
      }

      if (action === 'resend-email') {
        if (!['approved', 'rejected'].includes(reqRecord.status)) {
          return jsonResponse(409, { error: 'A customer email can only be resent after the payment is approved or rejected.' })
        }
        const event = reqRecord.status as PaymentEmailEvent
        scheduleBackgroundTask(
          processPaymentEmail(admin, reqRecord, event, true),
          reqRecord.id,
          event,
        )
        return jsonResponse(202, { success: true, message: 'Customer email resend queued.' })
      }

      const { data: resolution, error: resolutionError } = await admin.rpc(
        'resolve_manual_payment_request',
        {
          p_request_id: requestId,
          p_action: action,
          p_admin_id: adminUser.id,
          p_rejection_reason: action === 'reject' ? rejectionReason : null,
        },
      )

      if (resolutionError) {
        console.error('Could not resolve manual payment request:', resolutionError)
        const status = resolutionError.message.includes('already been resolved') ? 409 : 500
        return jsonResponse(status, {
          error: status === 409
            ? 'This payment request has already been resolved with a different action.'
            : 'Could not resolve the payment request.',
        })
      }

      const resolvedPayment = {
        ...reqRecord,
        status: resolution.status,
        rejection_reason: resolution.rejection_reason || reqRecord.rejection_reason,
      }
      const emailEvent = action === 'approve' ? 'approved' : 'rejected'
      scheduleBackgroundTask(
        processPaymentEmail(
          admin,
          resolvedPayment,
          emailEvent,
          false,
          resolution.activated_at || reqRecord.reviewed_at,
          resolution.expires_at,
        ),
        reqRecord.id,
        emailEvent,
      )

      const adminNotificationTask = (async () => {
        try {
          const { data: customer, error: customerError } = await admin.auth.admin.getUserById(reqRecord.user_id)
          if (customerError) {
            console.error('Could not load account email for admin payment notification:', customerError)
          } else if (customer?.user?.email && action === 'approve') {
            await sendAdminNotification(admin, {
              type: 'payment-approved',
              eventKey: `payment-approved:${reqRecord.id}`,
              userId: reqRecord.user_id,
              customerEmail: customer.user.email,
              plan: reqRecord.plan,
              method: reqRecord.method,
              transactionReference: reqRecord.tx_reference,
              activatedAt: resolution.activated_at || reqRecord.reviewed_at,
              expiresAt: resolution.expires_at,
            })
          } else if (customer?.user?.email && action === 'reject') {
            await sendAdminNotification(admin, {
              type: 'payment-rejected',
              eventKey: `payment-rejected:${reqRecord.id}`,
              userId: reqRecord.user_id,
              customerEmail: customer.user.email,
              transactionReference: reqRecord.tx_reference,
              reason: resolution.rejection_reason,
              occurredAt: reqRecord.reviewed_at || new Date().toISOString(),
            })
          } else if (!customerError) {
            console.error('Could not send payment notification: customer email is unavailable.', reqRecord.id)
          }
        } catch (notificationError) {
          console.error('Could not prepare admin payment notification:', notificationError)
        }
      })()
      scheduleBackgroundTask(adminNotificationTask, reqRecord.id, `admin-${emailEvent}`)

      return jsonResponse(200, {
        success: true,
        message: action === 'approve'
          ? resolution.already_resolved
            ? 'Payment request was already approved.'
            : 'Payment approved and subscription successfully activated!'
          : resolution.already_resolved
            ? 'Payment request was already rejected.'
            : 'Payment request rejected.',
      })
    }

    return jsonResponse(405, { error: 'Method not allowed.' })
  } catch (error) {
    console.error('admin-payment-action error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal error.' })
  }
})
