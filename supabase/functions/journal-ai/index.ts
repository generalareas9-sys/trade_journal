import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const systemPrompt = 'You are TradeJournal AI. You help traders review their own journal data: patterns, mistakes, discipline and process. You are not a financial advisor: never tell the user what to buy or sell, never predict markets, and say when the data is too small to conclude. Be concise and practical. Use only the data provided.'
const requestsPerDay = new Map<string, { day: string; count: number }>()

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin')
  const configuredOrigins = (Deno.env.get('AI_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const isLocalOrigin = origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173'
  const allowedOrigin = origin && (configuredOrigins.includes(origin) || isLocalOrigin) ? origin : ''

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  }
}

function response(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  })
}

function stringValue(value: unknown, maxLength = 160) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function stringList(value: unknown, maxItems = 20, maxLength = 100) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, maxItems).map((item) => item.slice(0, maxLength))
    : []
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function contextStrings(value: unknown): string[] {
  if (typeof value === 'string') return value.length >= 4 ? [value] : []
  if (Array.isArray(value)) return value.flatMap(contextStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(contextStrings)
  return []
}

function sanitizeProviderError(value: unknown, sensitiveValues: string[]) {
  let message = typeof value === 'string' ? value : ''
  for (const sensitiveValue of sensitiveValues.filter(Boolean).sort((left, right) => right.length - left.length)) {
    message = message.replaceAll(sensitiveValue, '[redacted]')
  }
  return message
    .replace(/sk-ant-[A-Za-z0-9_-]+/gi, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b[A-F0-9]{32,}\b/gi, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 240)
}

function sanitizeContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const context = value as Record<string, unknown>
  const metrics = context.metrics && typeof context.metrics === 'object' && !Array.isArray(context.metrics)
    ? context.metrics as Record<string, unknown>
    : {}
  const day = (item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const value = item as Record<string, unknown>
    return { date: stringValue(value.date, 10), netPnl: numberValue(value.netPnl) }
  }

  return {
    metrics: {
      totalTrades: numberValue(metrics.totalTrades),
      winRate: numberValue(metrics.winRate),
      profitFactor: numberValue(metrics.profitFactor),
      averageWin: numberValue(metrics.averageWin),
      averageLoss: numberValue(metrics.averageLoss),
      netPnl: numberValue(metrics.netPnl),
      bestDay: day(metrics.bestDay),
      worstDay: day(metrics.worstDay),
    },
    recentTrades: (Array.isArray(context.recentTrades) ? context.recentTrades : []).slice(0, 20).map((item) => {
      const trade = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
      return {
        date: stringValue(trade.date, 10),
        symbol: stringValue(trade.symbol, 32),
        side: stringValue(trade.side, 16),
        result: stringValue(trade.result, 16),
        netPnl: numberValue(trade.netPnl),
        session: stringValue(trade.session, 40),
        followedRules: typeof trade.followedRules === 'boolean' ? trade.followedRules : null,
        mistakes: stringList(trade.mistakes, 10, 80),
      }
    }),
    journalEntries: (Array.isArray(context.journalEntries) ? context.journalEntries : []).slice(0, 7).map((item) => {
      const entry = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
      return {
        date: stringValue(entry.date, 10),
        mood: stringValue(entry.mood, 40),
        followedPlan: typeof entry.followedPlan === 'boolean' ? entry.followedPlan : null,
        lesson: stringValue(entry.lesson, 300),
      }
    }),
    onboarding: (() => {
      const onboarding = context.onboarding && typeof context.onboarding === 'object' && !Array.isArray(context.onboarding)
        ? context.onboarding as Record<string, unknown>
        : {}
      return {
        experience: stringValue(onboarding.experience, 100),
        struggles: stringList(onboarding.struggles, 10, 100),
        markets: stringList(onboarding.markets, 10, 100),
      }
    })(),
  }
}

function consumeDailyRequest(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  for (const [id, entry] of requestsPerDay) {
    if (entry.day !== today) requestsPerDay.delete(id)
  }
  const current = requestsPerDay.get(userId)
  if (current?.day === today && current.count >= 20) return false
  requestsPerDay.set(userId, { day: today, count: current?.day === today ? current.count + 1 : 1 })
  return true
}

async function callAnthropic(messages: Array<{ role: string; content: string }>, context: unknown) {
  const apiKey = Deno.env.get('AI_API_KEY')
  if (!apiKey) {
    console.error(JSON.stringify({ event: 'journal_ai_configuration_error', category: 'missing_api_key' }))
    return { error: 'TradeJournal AI is not configured yet. Please contact the site administrator.', category: 'configuration_missing', status: 503 }
  }

  const model = Deno.env.get('AI_MODEL') || 'claude-haiku-5-5'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: `${systemPrompt}\n\nUser-provided journal summaries (JSON):\n${JSON.stringify(context)}`,
        messages,
      }),
      signal: controller.signal,
    })
    if (!providerResponse.ok) {
      const status = providerResponse.status
      let providerError: { type: string; message: string } = { type: 'unknown_error', message: '' }
      if (status === 400) {
        try {
          const body = await providerResponse.json()
          const bodyError = body && typeof body === 'object' && 'error' in body
            ? (body as { error?: { type?: unknown; message?: unknown } }).error
            : undefined
          const rawType = typeof bodyError?.type === 'string' ? bodyError.type : 'unknown_error'
          const sensitiveValues = [
            apiKey,
            ...messages.map((message) => message.content),
            ...contextStrings(context),
          ]
          providerError = {
            type: /^[a-z0-9_]{1,64}$/i.test(rawType) ? rawType : 'unknown_error',
            message: sanitizeProviderError(bodyError?.message, sensitiveValues),
          }
        } catch {
          providerError = { type: 'unreadable_error_body', message: '' }
        }
      }
      const category = status === 401 || status === 403
        ? 'provider_credentials'
        : status === 404
          ? 'provider_model'
          : status === 429
            ? 'provider_rate_limit'
            : status >= 500
              ? 'provider_unavailable'
              : 'provider_request'
      console.error(JSON.stringify({
        event: 'journal_ai_provider_error',
        status,
        category,
        ...(status === 400 ? { providerErrorType: providerError.type, providerMessage: providerError.message } : {}),
      }))
      if (category === 'provider_credentials') {
        return { error: 'TradeJournal AI server credentials need attention. Please contact the site administrator.', category, status: 503 }
      }
      if (category === 'provider_model') {
        return { error: 'The configured AI model is unavailable. Please contact the site administrator.', category, status: 503 }
      }
      if (category === 'provider_rate_limit') {
        return { error: 'The AI service is busy. Please wait a minute and try again.', category, status: 429 }
      }
      if (category === 'provider_request') {
        return { error: 'TradeJournal AI could not process that request. Please try a shorter question.', category, status: 502 }
      }
      return { error: 'TradeJournal AI is temporarily unavailable. Please try again shortly.', category, status: 502 }
    }
    let result
    try {
      result = await providerResponse.json()
    } catch {
      console.error(JSON.stringify({ event: 'journal_ai_provider_error', status: providerResponse.status, category: 'invalid_provider_response' }))
      return { error: 'TradeJournal AI received an invalid response. Please try again.', category: 'provider_unavailable', status: 502 }
    }
    const reply = Array.isArray(result?.content)
      ? result.content.filter((item: { type?: string }) => item?.type === 'text').map((item: { text?: string }) => item.text || '').join('\n').trim()
      : ''
    if (!reply) {
      console.error(JSON.stringify({ event: 'journal_ai_provider_error', status: providerResponse.status, category: 'empty_provider_response' }))
      return { error: 'TradeJournal AI returned an empty answer. Please try again.', category: 'provider_unavailable', status: 502 }
    }
    return { reply, status: 200 }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(JSON.stringify({ event: 'journal_ai_provider_error', category: 'timeout' }))
      return { error: 'TradeJournal AI took too long to respond. Please retry in a moment.', category: 'provider_timeout', status: 504 }
    }
    console.error(JSON.stringify({ event: 'journal_ai_provider_error', category: 'network_error' }))
    return { error: 'TradeJournal AI is temporarily unavailable. Please try again shortly.', category: 'provider_unavailable', status: 502 }
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return response(request, 405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    console.error(JSON.stringify({ event: 'journal_ai_configuration_error', category: 'missing_supabase_auth_configuration' }))
    return response(request, 503, { error: 'Sign-in verification is not configured. Please contact the site administrator.', category: 'configuration_missing' })
  }
  if (!authorization?.startsWith('Bearer ')) {
    return response(request, 401, { error: 'A valid signed-in session is required.', category: 'authentication_required' })
  }

  const verifier = createClient(url, anonKey, { auth: { persistSession: false } })
  let userId: string
  try {
    const { data: authData, error: authError } = await verifier.auth.getUser(authorization.slice('Bearer '.length))
    if (authError || !authData.user || authData.user.is_anonymous) {
      return response(request, 401, { error: 'Your sign-in could not be verified. Please sign in again.', category: 'authentication_required' })
    }
    userId = authData.user.id
  } catch {
    console.error(JSON.stringify({ event: 'journal_ai_auth_error', category: 'verification_unavailable' }))
    return response(request, 503, { error: 'Sign-in could not be verified right now. Please retry.', category: 'authentication_unavailable' })
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return response(request, 400, { error: 'Please send a valid chat message.', category: 'invalid_request' })
    body = parsed as Record<string, unknown>
  } catch {
    return response(request, 400, { error: 'Please send a valid chat message.', category: 'invalid_request' })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return response(request, 400, { error: 'Please enter a message to continue.', category: 'invalid_request' })
  }
  const messages = body.messages.slice(-10).filter((item) => (
    item && typeof item === 'object' && !Array.isArray(item)
    && ['user', 'assistant'].includes((item as Record<string, unknown>).role as string)
    && typeof (item as Record<string, unknown>).content === 'string'
    && ((item as Record<string, unknown>).content as string).trim().length > 0
    && ((item as Record<string, unknown>).content as string).length <= 2000
  )).map((item) => {
    const message = item as Record<string, string>
    return { role: message.role, content: message.content.trim() }
  })
  if (messages.length !== body.messages.slice(-10).length) {
    return response(request, 400, { error: 'Messages must be non-empty user or assistant text up to 2,000 characters.', category: 'invalid_request' })
  }

  const context = sanitizeContext(body.context)
  if (JSON.stringify(context).length > 20_000) return response(request, 413, { error: 'The journal summary is too large. Please try again.', category: 'invalid_request' })
  if (!consumeDailyRequest(userId)) {
    return response(request, 429, { error: 'You’ve reached today’s AI limit of 20 requests. Please come back tomorrow.', category: 'daily_limit' })
  }

  const result = await callAnthropic(messages, context)
  if ('error' in result) return response(request, result.status, { error: result.error })
  return response(request, 200, { reply: result.reply })
})
