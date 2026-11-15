import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendAdminNotification } from '../_shared/adminEmail.ts'

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' })

  const expectedSecret = Deno.env.get('REGISTRATION_WEBHOOK_SECRET')
  const suppliedSecret = request.headers.get('x-registration-webhook-secret') || ''
  if (!expectedSecret || !constantTimeEqual(suppliedSecret, expectedSecret)) {
    return jsonResponse(401, { error: 'Webhook authentication failed.' })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    console.error('Registration notification is missing Supabase server configuration.')
    return jsonResponse(500, { error: 'Server configuration is incomplete.' })
  }

  try {
    const payload = await request.json()
    const record = payload?.record
    if (payload?.type !== 'INSERT'
      || payload?.schema !== 'auth'
      || payload?.table !== 'users'
      || !record
      || typeof record.id !== 'string'
      || typeof record.email !== 'string'
      || typeof record.created_at !== 'string') {
      return jsonResponse(400, { error: 'Invalid registration event payload.' })
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    const sent = await sendAdminNotification(admin, {
      type: 'registration',
      eventKey: `registration:${record.id}`,
      userId: record.id,
      customerEmail: record.email,
      occurredAt: record.created_at,
    })
    return sent
      ? jsonResponse(202, { accepted: true })
      : jsonResponse(503, { error: 'Notification delivery failed and has been recorded for retry.' })
  } catch (error) {
    console.error('Registration notification handler failed:', error)
    return jsonResponse(500, { error: 'Could not process the registration notification.' })
  }
})
