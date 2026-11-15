export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey?: string
}

export type SendEmailResult = {
  messageId: string | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function validateEmailAddress(value: string, label: string) {
  if (value.length > 254 || !EMAIL_PATTERN.test(value) || /[\r\n]/.test(value)) {
    throw new Error(`${label} is invalid.`)
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  validateEmailAddress(input.to, 'Recipient email')
  if (!input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject)) {
    throw new Error('Email subject is invalid.')
  }

  const provider = requiredSecret('EMAIL_PROVIDER').toLowerCase()
  const from = requiredSecret('EMAIL_FROM')
  const replyTo = requiredSecret('SUPPORT_EMAIL')
  if (from.length > 320 || /[\r\n]/.test(from)) throw new Error('EMAIL_FROM is invalid.')
  validateEmailAddress(replyTo, 'SUPPORT_EMAIL')

  if (provider === 'resend') {
    const apiKey = requiredSecret('RESEND_API_KEY')
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
    const responseText = await response.text()
    let responseBody: { id?: unknown; message?: unknown; name?: unknown } = {}
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = {}
    }
    if (!response.ok) {
      const reason = String(responseBody.message || responseBody.name || 'email delivery failed').slice(0, 300)
      throw new Error(`Resend returned ${response.status}: ${reason}`)
    }
    return { messageId: typeof responseBody.id === 'string' ? responseBody.id : null }
  }

  if (provider === 'smtp') {
    const host = requiredSecret('SMTP_HOST')
    const port = Number(requiredSecret('SMTP_PORT'))
    const user = requiredSecret('SMTP_USER')
    const pass = requiredSecret('SMTP_PASS')
    if (/[\r\n]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP host or port configuration is invalid.')
    }
    if (port === 25 || port === 587) {
      throw new Error('Supabase Edge Functions block SMTP ports 25 and 587. Use an allowed TLS port such as 465.')
    }

    const nodemailer = await import('npm:nodemailer@6.10.1')
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2' },
    })
    try {
      const result = await transporter.sendMail({
        from,
        to: input.to,
        replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      })
      return { messageId: typeof result.messageId === 'string' ? result.messageId : null }
    } finally {
      transporter.close()
    }
  }

  throw new Error('EMAIL_PROVIDER must be either "resend" or "smtp".')
}
