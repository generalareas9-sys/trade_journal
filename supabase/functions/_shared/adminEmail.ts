import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from './email.ts'

type RegistrationEvent = {
  type: 'registration'
  eventKey: string
  userId: string
  customerEmail: string
  occurredAt: string
}

type PaymentSubmittedEvent = {
  type: 'payment-submitted'
  eventKey: string
  userId: string
  customerEmail: string
  plan: string
  period: 'monthly' | 'yearly'
  method: string
  amount: number
  currency: string
  transactionReference: string
  occurredAt: string
}

type PaymentApprovedEvent = {
  type: 'payment-approved'
  eventKey: string
  userId: string
  customerEmail: string
  plan: string
  method: string
  transactionReference: string
  activatedAt: string
  expiresAt: string
}

type PaymentRejectedEvent = {
  type: 'payment-rejected'
  eventKey: string
  userId: string
  customerEmail: string
  transactionReference: string
  reason?: string
  occurredAt: string
}

export type AdminEmailEvent =
  | RegistrationEvent
  | PaymentSubmittedEvent
  | PaymentApprovedEvent
  | PaymentRejectedEvent

const EVENT_SUBJECTS: Record<AdminEmailEvent['type'], string> = {
  registration: 'New TradeJournal User Registration',
  'payment-submitted': 'New Payment Submission - TradeJournal',
  'payment-approved': 'Payment Approved - TradeJournal',
  'payment-rejected': 'Payment Rejected - TradeJournal',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAYMENT_METHODS: Record<string, string> = {
  telebirr: 'Telebirr',
  cbe_bank: 'CBE Bank Transfer',
  cbe_birr: 'CBE Bank Transfer',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Notification contains an invalid date.')
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Notification contains an invalid payment amount or currency.')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amount)
}

function validateEvent(event: AdminEmailEvent) {
  if (!UUID_PATTERN.test(event.userId) || !EMAIL_PATTERN.test(event.customerEmail) || event.customerEmail.length > 254) {
    throw new Error('Notification contains an invalid customer identity.')
  }
  if (!/^[a-z0-9:_-]{1,256}$/i.test(event.eventKey)) {
    throw new Error('Notification contains an invalid idempotency key.')
  }
  if (!event.eventKey.startsWith(`${event.type}:`)) {
    throw new Error('Notification idempotency key does not match its event type.')
  }
  if (event.type !== 'registration' && (!event.transactionReference || event.transactionReference.length > 200)) {
    throw new Error('Notification is missing its transaction reference.')
  }
  if ('method' in event && !PAYMENT_METHODS[event.method]) {
    throw new Error('Notification contains an unsupported payment method.')
  }
  if ('plan' in event && !['essential', 'pro', 'ultra'].includes(event.plan)) {
    throw new Error('Notification contains an unsupported subscription plan.')
  }
}

function notificationContent(event: AdminEmailEvent) {
  const customer: Array<[string, string]> = [
    ['Customer email', event.customerEmail],
    ['Customer user ID', event.userId],
  ]
  let heading = ''
  let accent = '#635bdb'
  let rows: Array<[string, string]> = customer
  let occurredAt = ''

  if (event.type === 'registration') {
    heading = 'A new customer has registered'
    occurredAt = formatDate(event.occurredAt)
    rows = [...customer, ['Registration date and time', occurredAt]]
  } else if (event.type === 'payment-submitted') {
    heading = 'A manual payment is waiting for review'
    occurredAt = formatDate(event.occurredAt)
    rows = [
      ...customer,
      ['Subscription plan', event.plan.toUpperCase()],
      ['Billing period', event.period === 'yearly' ? 'Annual' : 'Monthly'],
      ['Payment method', PAYMENT_METHODS[event.method] || event.method],
      ['Payment amount', formatAmount(event.amount, event.currency)],
      ['Transaction reference', event.transactionReference],
      ['Submission date and time', occurredAt],
    ]
  } else if (event.type === 'payment-approved') {
    heading = 'Payment approved and subscription activated'
    accent = '#138a63'
    rows = [
      ['Customer email', event.customerEmail],
      ['Subscription plan', event.plan.toUpperCase()],
      ['Payment method', PAYMENT_METHODS[event.method] || event.method],
      ['Transaction reference', event.transactionReference],
      ['Subscription activation', formatDate(event.activatedAt)],
      ['Subscription expiration', formatDate(event.expiresAt)],
    ]
  } else {
    heading = 'Payment request rejected'
    accent = '#c2414b'
    occurredAt = formatDate(event.occurredAt)
    rows = [
      ['Customer email', event.customerEmail],
      ['Transaction reference', event.transactionReference],
      ...(event.reason?.trim() ? [['Rejection reason', event.reason.trim()] as [string, string]] : []),
      ['Rejection date and time', occurredAt],
    ]
  }

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #e8eaf0;color:#657087;font-size:13px;width:40%;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e8eaf0;color:#1c2434;font-size:13px;font-weight:600;overflow-wrap:anywhere;vertical-align:top">${escapeHtml(value)}</td>
    </tr>`).join('')
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  const text = `TradeJournal\n\n${heading}\n\n${textRows}\n\nThis is an automated administrative notification.`
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#1c2434">
  <div style="display:none;max-height:0;overflow:hidden">TradeJournal administrative notification</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e8ef;border-radius:14px;overflow:hidden">
    <tr><td style="padding:22px 26px;background:#151c32;color:#fff">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:#b9c5ff">TRADEJOURNAL</div>
      <div style="padding-top:5px;font-size:12px;color:#d5dbeb">Admin notification</div>
    </td></tr>
    <tr><td style="padding:28px 26px 8px">
      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${accent}18;color:${accent};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">${escapeHtml(event.type.replaceAll('-', ' '))}</div>
      <h1 style="margin:15px 0 8px;font-size:22px;line-height:1.3;color:#171f31">${escapeHtml(heading)}</h1>
      <p style="margin:0;color:#657087;font-size:14px;line-height:1.6">The following event was recorded by TradeJournal.</p>
    </td></tr>
    <tr><td style="padding:15px 18px 22px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e8eaf0;border-radius:10px;border-spacing:0;overflow:hidden">${htmlRows}</table>
    </td></tr>
    <tr><td style="padding:16px 26px;background:#f8f9fc;color:#7a8497;font-size:11px;line-height:1.5">This is an automated administrative notification from TradeJournal. Do not reply with passwords, payment credentials, or authentication codes.</td></tr>
  </table>
</body>
</html>`
  return { heading, text, html }
}

async function claimEvent(admin: SupabaseClient, event: AdminEmailEvent): Promise<boolean> {
  const { error: insertError } = await admin.from('email_notification_events').insert({
    event_key: event.eventKey,
    event_type: event.type,
    status: 'sending',
    attempts: 1,
  })
  if (!insertError) return true
  if (insertError.code !== '23505') throw insertError

  const { data: existing, error: readError } = await admin
    .from('email_notification_events')
    .select('status,attempts')
    .eq('event_key', event.eventKey)
    .maybeSingle()
  if (readError) throw readError
  if (!existing || existing.status !== 'failed') return false

  const { data: claimed, error: claimError } = await admin
    .from('email_notification_events')
    .update({
      status: 'sending',
      attempts: Number(existing.attempts || 0) + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_key', event.eventKey)
    .eq('status', 'failed')
    .select('event_key')
    .maybeSingle()
  if (claimError) throw claimError
  return Boolean(claimed)
}

async function updateEvent(admin: SupabaseClient, eventKey: string, values: Record<string, unknown>) {
  const { error } = await admin
    .from('email_notification_events')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('event_key', eventKey)
  if (error) throw error
}

export async function sendAdminNotification(admin: SupabaseClient, event: AdminEmailEvent): Promise<boolean> {
  let claimed = false
  try {
    validateEvent(event)
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL')
    if (!adminEmail) throw new Error('ADMIN_NOTIFICATION_EMAIL is not configured.')
    if (!EMAIL_PATTERN.test(adminEmail) || adminEmail.length > 254) throw new Error('Admin notification recipient is invalid.')

    claimed = await claimEvent(admin, event)
    if (!claimed) return true

    const content = notificationContent(event)
    const delivery = await sendEmail({
      to: adminEmail,
      subject: EVENT_SUBJECTS[event.type],
      html: content.html,
      text: content.text,
      idempotencyKey: event.eventKey,
    })
    await updateEvent(admin, event.eventKey, {
      status: 'sent',
      provider_message_id: delivery.messageId,
      last_error: null,
    })
    console.info('Admin notification email sent.', { type: event.type, eventKey: event.eventKey })
    return true
  } catch (error) {
    console.error('Admin notification email failed.', {
      type: event.type,
      eventKey: event.eventKey,
      error: error instanceof Error ? error.message : String(error),
    })
    if (claimed) {
      try {
        await updateEvent(admin, event.eventKey, {
          status: 'failed',
          last_error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown notification error.',
        })
      } catch (updateError) {
        console.error('Could not persist the admin notification failure.', updateError)
      }
    }
    return false
  }
}
