import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from './email.ts'

export type PaymentEmailEvent = 'approved' | 'rejected'

export type PaymentEmailRequest = {
  id: string
  user_id: string
  status: string
  plan: string
  period: string
  method: string
  amount: number | string
  currency: string
  tx_reference: string
  rejection_reason?: string | null
  reviewed_at?: string | null
}

type PaymentEmailDetails = {
  payment: PaymentEmailRequest
  event: PaymentEmailEvent
  recipient: string
  customerName: string
  deliveryKey: string
  activatedAt?: string | null
  expiresAt?: string | null
}

type EmailRow = {
  id: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  delivery_key: string
  attempts: number
  recipient: string | null
  subscription_start_at: string | null
  subscription_end_at: string | null
}

const REJECTION_FALLBACK =
  'Your payment could not be verified. Please check that the amount, account and receipt are correct, then try again or contact support.'
const PAYMENT_METHODS: Record<string, string> = {
  telebirr: 'Telebirr',
  cbe_bank: 'CBE Bank Transfer',
  cbe_birr: 'CBE Bank Transfer',
}
const PLAN_NAMES: Record<string, string> = {
  essential: 'Essential',
  pro: 'Pro',
  ultra: 'Ultra',
}

const SUPPORT_PHONE = '+251986446282'
const SUPPORT_PHONE_DISPLAY = '+251 986 446 282'
const SUPPORT_TELEGRAM = '@Vy_kin_g'
const SUPPORT_TELEGRAM_URL = 'https://t.me/Vy_kin_g'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function plainText(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').trim()
}

function formatDate(value: string | null | undefined): string {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) throw new Error('Payment email contains an invalid date.')
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

function formatAmount(amount: number | string, currency: string): string {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount < 0 || !['ETB', 'USD'].includes(currency)) {
    throw new Error('Payment email contains an invalid amount or currency.')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(numericAmount)
}

function validatePayment(payment: PaymentEmailRequest) {
  if (!/^[0-9a-f-]{36}$/i.test(payment.id) || !/^[0-9a-f-]{36}$/i.test(payment.user_id)) {
    throw new Error('Payment email contains an invalid payment or user ID.')
  }
  if (!PLAN_NAMES[payment.plan] || !['monthly', 'yearly'].includes(payment.period)) {
    throw new Error('Payment email contains an unsupported plan or billing period.')
  }
  if (!PAYMENT_METHODS[payment.method] || !['ETB', 'USD'].includes(payment.currency)) {
    throw new Error('Payment email contains an unsupported method or currency.')
  }
  if (!payment.tx_reference || payment.tx_reference.length > 200) {
    throw new Error('Payment email is missing a valid transaction reference.')
  }
}

function getSiteUrls(payment: PaymentEmailRequest) {
  const configuredSiteUrl = Deno.env.get('SITE_URL')?.trim()
  if (!configuredSiteUrl) throw new Error('SITE_URL is not configured.')
  const siteUrl = new URL(configuredSiteUrl)
  if (!['https:', 'http:'].includes(siteUrl.protocol)) throw new Error('SITE_URL must use HTTP or HTTPS.')

  const dashboardUrl = new URL('/login', siteUrl).toString()
  const checkoutUrl = new URL('/checkout', siteUrl)
  checkoutUrl.search = new URLSearchParams({
    plan: payment.plan,
    period: payment.period,
    currency: payment.currency,
  }).toString()
  return { dashboardUrl, checkoutUrl: checkoutUrl.toString() }
}

function renderEmail(
  heading: string,
  intro: string,
  rows: Array<[string, string]>,
  button: { label: string; url: string },
  color: string,
  closing: string,
  indicator?: { label: string; color: string },
) {
  const textRows = rows.map(([label, value]) => `${plainText(label)}: ${plainText(value)}`).join('\n')
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <style>
    @media (prefers-color-scheme: dark) {
      body { background:#111827 !important; color:#e5e7eb !important; }
      .email-card { background:#1f2937 !important; border-color:#374151 !important; }
      .email-content { color:#e5e7eb !important; }
      .email-row { border-color:#374151 !important; }
      .email-label { color:#cbd5e1 !important; }
      .email-value { color:#f9fafb !important; }
      .email-footer { background:#111827 !important; color:#cbd5e1 !important; }
    }
    @media screen and (max-width:600px) {
      .email-shell { padding:12px 8px !important; }
      .email-content { padding:22px 16px !important; }
      .email-header, .email-footer { padding-left:16px !important; padding-right:16px !important; }
      .email-details { padding-left:10px !important; padding-right:10px !important; }
      .email-row td { display:block !important; width:auto !important; }
      .email-row td:last-child { padding-top:2px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#1c2434">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(intro)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-shell" style="max-width:640px;margin:0 auto">
    <tr><td class="email-card" style="background:#fff;border:1px solid #e5e8ef;border-radius:14px;overflow:hidden">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td class="email-header" style="padding:22px 26px;background:#151c32;color:#fff">
          <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:#b9c5ff">TRADEJOURNAL AI</div>
          <div style="padding-top:5px;font-size:12px;color:#d5dbeb">Subscription update</div>
        </td></tr>
        <tr><td class="email-content" style="padding:28px 26px 8px;color:#1c2434">
          ${indicator ? `<span style="display:inline-block;margin-bottom:12px;padding:6px 10px;border-radius:999px;background:#e8f7ef;color:${indicator.color};font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">✓ ${escapeHtml(indicator.label)}</span>` : ''}
          <h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;color:${color}">${escapeHtml(heading)}</h1>
          <p style="margin:0;color:#657087;font-size:14px;line-height:1.65">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td class="email-details" style="padding:18px 18px 10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e8eaf0;border-radius:10px;border-spacing:0;overflow:hidden">
            ${rows.map(([label, value]) => `<tr class="email-row"><td class="email-label" style="padding:12px 14px;border-bottom:1px solid #e8eaf0;color:#657087;font-size:13px;width:40%;vertical-align:top">${escapeHtml(label)}</td><td class="email-value" style="padding:12px 14px;border-bottom:1px solid #e8eaf0;color:#1c2434;font-size:14px;font-weight:600;overflow-wrap:anywhere;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('')}
          </table>
        </td></tr>
        <tr><td class="email-content" style="padding:16px 26px 24px;color:#1c2434">
          <p style="margin:0 0 18px;color:#657087;font-size:14px;line-height:1.6">${escapeHtml(closing)}</p>
          <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:${color};color:#fff;font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(button.label)}</a>
          <p style="margin:22px 0 0;color:#657087;font-size:13px;line-height:1.7">
            Need help? Call <a href="tel:${escapeHtml(SUPPORT_PHONE)}" style="color:#635bdb">${escapeHtml(SUPPORT_PHONE_DISPLAY)}</a>
            or message us on <a href="${escapeHtml(SUPPORT_TELEGRAM_URL)}" style="color:#635bdb">${escapeHtml(SUPPORT_TELEGRAM)}</a>.
          </p>
        </td></tr>
        <tr><td class="email-footer" style="padding:16px 26px;background:#f8f9fc;color:#7a8497;font-size:11px;line-height:1.6">
          This is an automated message about your TradeJournal AI subscription.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  const text = [
    'TradeJournal AI',
    '',
    heading,
    '',
    intro,
    '',
    textRows,
    '',
    closing,
    `${button.label}: ${button.url}`,
    '',
    `Support phone: ${SUPPORT_PHONE_DISPLAY}`,
    `Telegram: ${SUPPORT_TELEGRAM} (${SUPPORT_TELEGRAM_URL})`,
    '',
    'This is an automated message about your TradeJournal AI subscription.',
  ].join('\n')
  return { html, text }
}

function buildCustomerEmail(details: PaymentEmailDetails) {
  const { payment, event } = details
  validatePayment(payment)
  const amount = formatAmount(payment.amount, payment.currency)
  const plan = PLAN_NAMES[payment.plan]
  const period = payment.period === 'yearly' ? 'Yearly' : 'Monthly'
  const method = PAYMENT_METHODS[payment.method]
  const { dashboardUrl, checkoutUrl } = getSiteUrls(payment)

  if (event === 'approved') {
    const activatedAt = formatDate(details.activatedAt)
    const expiresAt = formatDate(details.expiresAt)
    const customerName = plainText(details.customerName).slice(0, 120) || 'Trader'
    const content = renderEmail(
      `Congratulations, ${customerName}!`,
      'Your payment has been verified and approved. Your TradeJournal AI subscription is now active.',
      [
        ['Customer name', customerName],
        ['Plan', plan],
        ['Billing period', period],
        ['Amount paid', amount],
        ['Payment method', method],
        ['Transaction reference', payment.tx_reference],
        ['Subscription starts', activatedAt],
        ['Subscription ends', expiresAt],
      ],
      { label: 'Log in to TradeJournal AI', url: dashboardUrl },
      '#138a63',
      'Thank you for choosing TradeJournal AI. Use your journal, review your trading performance, and discover patterns to keep improving.',
      { label: 'Subscription active', color: '#138a63' },
    )
    return { subject: 'Your TradeJournal AI subscription is active', ...content }
  }

  const reason = payment.rejection_reason?.trim() || REJECTION_FALLBACK
  const content = renderEmail(
    'Your TradeJournal AI payment could not be verified',
    'We could not verify this payment. You can review the details and submit it again.',
    [
      ['Plan', plan],
      ['Billing period', period],
      ['Amount', amount],
      ['Payment method', method],
      ['Transaction reference', payment.tx_reference],
      ['Rejection reason', reason],
    ],
    { label: 'Try again', url: checkoutUrl },
    '#c2414b',
    'Please check the payment details before trying again. Your previous receipt and reference are not included in the checkout link.',
  )
  return { subject: 'Your TradeJournal AI payment could not be verified', ...content }
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : 'Email delivery failed.').slice(0, 1000)
}

async function updateNotification(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin
    .from('payment_email_notifications')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

async function sendWithRetries(admin: SupabaseClient, row: EmailRow, details: Omit<PaymentEmailDetails, 'recipient' | 'deliveryKey'>) {
  const backoffMs = [1000, 3000]
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data: claim, error: claimError } = await admin
      .from('payment_email_notifications')
      .update({
        status: 'sending',
        attempts: attempt,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (claimError) {
      console.error('Could not claim customer payment email attempt.', { requestId: details.payment.id, event: details.event, error: claimError.message })
      return
    }
    if (!claim) return

    try {
      if (!row.recipient) throw new Error('The customer account does not have a valid email address.')
      const email = buildCustomerEmail({ ...details, recipient: row.recipient, deliveryKey: row.delivery_key })
      const result = await sendEmail({
        to: row.recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: `${row.delivery_key}:${details.event}`,
      })
      try {
        await updateNotification(admin, row.id, {
          status: 'sent',
          provider_message_id: result.messageId,
          error: null,
          sent_at: new Date().toISOString(),
        })
      } catch (updateError) {
        console.error('Email was delivered but its sent status could not be saved.', {
          requestId: details.payment.id,
          event: details.event,
          error: safeError(updateError),
        })
      }
      return
    } catch (error) {
      const message = safeError(error)
      const lastAttempt = attempt === 3
      try {
        await updateNotification(admin, row.id, {
          status: lastAttempt ? 'failed' : 'pending',
          error: message,
        })
      } catch (updateError) {
        console.error('Could not save customer payment email attempt status.', {
          requestId: details.payment.id,
          event: details.event,
          error: safeError(updateError),
        })
      }
      console.error('Customer payment email attempt failed.', {
        requestId: details.payment.id,
        event: details.event,
        attempt,
        error: message,
      })
      if (!lastAttempt) await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1]))
    }
  }
}

async function getAccountDetails(admin: SupabaseClient, userId: string): Promise<{ email: string | null; name: string }> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) throw error
  const user = data.user
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (profileError) {
    console.error('Could not load customer display name for payment email.', { code: profileError.code || 'unknown' })
  }

  const email = user?.email?.trim()
  const metadataName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : ''
  const profileName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  const name = plainText(profileName || metadataName || email?.split('@')[0] || 'Trader').slice(0, 120) || 'Trader'

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email: null, name }
  }
  return { email, name }
}

export async function processPaymentEmail(
  admin: SupabaseClient,
  payment: PaymentEmailRequest,
  event: PaymentEmailEvent,
  resend = false,
  activatedAt?: string | null,
  expiresAt?: string | null,
): Promise<void> {
  try {
    const expectedStatus = event === 'approved' ? 'approved' : 'rejected'
    if (payment.status !== expectedStatus) throw new Error('Payment status does not match the email event.')
    let recipient: string | null = null
    let customerName = 'Trader'
    let recipientError: string | null = null
    try {
      const account = await getAccountDetails(admin, payment.user_id)
      recipient = account.email
      customerName = account.name
      if (!recipient) recipientError = 'The customer account does not have a valid email address.'
    } catch (error) {
      recipientError = safeError(error)
    }

    let row: EmailRow | null = null
    const { data: existing, error: readError } = await admin
      .from('payment_email_notifications')
      .select('id,status,delivery_key,attempts,recipient,subscription_start_at,subscription_end_at')
      .eq('payment_request_id', payment.id)
      .eq('event', event)
      .maybeSingle()
    if (readError) throw readError

    let resolvedStartAt = activatedAt || existing?.subscription_start_at || payment.reviewed_at || null
    let resolvedEndAt = expiresAt || existing?.subscription_end_at || null
    if (event === 'approved' && (!resolvedStartAt || !resolvedEndAt)) {
      const { data: subscription, error: subscriptionError } = await admin
        .from('subscriptions')
        .select('created_at,current_period_end')
        .eq('user_id', payment.user_id)
        .maybeSingle()
      if (subscriptionError) throw subscriptionError
      resolvedStartAt ||= subscription?.created_at || null
      resolvedEndAt ||= subscription?.current_period_end || null
    }

    if (existing) {
      if (resend && ['sent', 'failed'].includes(existing.status)) {
        const { data: updated, error: updateError } = await admin
          .from('payment_email_notifications')
          .update({
            recipient,
            status: recipient ? 'pending' : 'failed',
            attempts: 0,
            delivery_key: crypto.randomUUID(),
            provider_message_id: null,
            error: recipientError,
            sent_at: null,
            subscription_start_at: resolvedStartAt,
            subscription_end_at: resolvedEndAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('status', existing.status)
          .select('id,status,delivery_key,attempts,recipient,subscription_start_at,subscription_end_at')
          .maybeSingle()
        if (updateError) throw updateError
        row = updated as EmailRow | null
      } else if (existing.status === 'pending') {
        row = existing as EmailRow
      } else {
        return
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('payment_email_notifications')
        .insert({
          payment_request_id: payment.id,
          event,
          recipient,
          status: recipient ? 'pending' : 'failed',
          attempts: 0,
          error: recipientError,
          subscription_start_at: resolvedStartAt,
          subscription_end_at: resolvedEndAt,
        })
        .select('id,status,delivery_key,attempts,recipient,subscription_start_at,subscription_end_at')
        .maybeSingle()
      if (insertError?.code === '23505') return
      if (insertError) throw insertError
      row = inserted as EmailRow | null
    }

    if (!row || row.status !== 'pending') return
    await sendWithRetries(admin, row, {
      payment,
      event,
      customerName,
      activatedAt: resolvedStartAt,
      expiresAt: resolvedEndAt,
    })
  } catch (error) {
    console.error('Could not process customer payment email.', {
      requestId: payment.id,
      event,
      error: safeError(error),
    })
  }
}
