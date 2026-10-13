import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfileSettings } from '../data/repo'
import { useJournal } from '../hooks/useJournal'
import { supabase } from '../lib/supabase'
import '../ai-chat.css'

const prompts = [
  { label: 'Review recent trades', question: 'Review my recent trades. What process strengths and mistakes stand out?' },
  { label: 'Plan my trading day', question: 'Help me plan a disciplined trading day based on my journal summaries.' },
  { label: 'Show my patterns', question: 'What patterns can you identify in my trade outcomes, sessions, and discipline?' },
]

function buildContext(trades, journal, profile) {
  const safeTrades = Array.isArray(trades) ? trades : []
  const pnlOf = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0
  const winners = safeTrades.filter((trade) => pnlOf(trade) > 0)
  const losers = safeTrades.filter((trade) => pnlOf(trade) < 0)
  const grossWins = winners.reduce((sum, trade) => sum + pnlOf(trade), 0)
  const grossLosses = Math.abs(losers.reduce((sum, trade) => sum + pnlOf(trade), 0))
  const daily = new Map()

  safeTrades.forEach((trade) => {
    if (typeof trade?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) return
    daily.set(trade.date, (daily.get(trade.date) || 0) + pnlOf(trade))
  })
  const days = [...daily.entries()].sort(([left], [right]) => left.localeCompare(right))
  const appSettings = profile?.settings?.appSettings || {}
  const answers = profile?.settings?.onboarding || appSettings.onboarding || {}
  const entries = Object.entries(journal && typeof journal === 'object' ? journal : {})
    .filter(([date]) => {
      const parsed = new Date(`${date}T12:00:00`)
      const today = new Date()
      const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
      return Number.isFinite(parsed.getTime()) && parsed >= cutoff && parsed <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    })
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 7)

  return {
    metrics: {
      totalTrades: safeTrades.length,
      winRate: safeTrades.length ? Number((winners.length / safeTrades.length * 100).toFixed(1)) : 0,
      profitFactor: grossLosses ? Number((grossWins / grossLosses).toFixed(2)) : grossWins ? null : 0,
      averageWin: winners.length ? Number((grossWins / winners.length).toFixed(2)) : 0,
      averageLoss: losers.length ? Number((grossLosses / losers.length).toFixed(2)) : 0,
      netPnl: Number(safeTrades.reduce((sum, trade) => sum + pnlOf(trade), 0).toFixed(2)),
      bestDay: days.length ? (() => {
        const [date, netPnl] = [...days].sort((a, b) => b[1] - a[1])[0]
        return { date, netPnl: Number(netPnl.toFixed(2)) }
      })() : null,
      worstDay: days.length ? (() => {
        const [date, netPnl] = [...days].sort((a, b) => a[1] - b[1])[0]
        return { date, netPnl: Number(netPnl.toFixed(2)) }
      })() : null,
    },
    recentTrades: [...safeTrades]
      .sort((a, b) => String(b.closedAt || b.date || b.openedAt || '').localeCompare(String(a.closedAt || a.date || a.openedAt || '')))
      .slice(0, 20)
      .map((trade) => ({
        followedRules: typeof trade.followedRules === 'boolean'
          ? trade.followedRules
          : typeof trade.followedRules === 'string' && /^yes$/i.test(trade.followedRules)
            ? true
            : typeof trade.followedRules === 'string' && /^no$/i.test(trade.followedRules)
              ? false
              : null,
        symbol: typeof trade.symbol === 'string' ? trade.symbol : '',
        side: typeof trade.side === 'string' ? trade.side : '',
        result: typeof trade.result === 'string' ? trade.result : pnlOf(trade) > 0 ? 'Win' : pnlOf(trade) < 0 ? 'Loss' : 'Breakeven',
        netPnl: Number(pnlOf(trade).toFixed(2)),
        session: typeof trade.session === 'string' ? trade.session : '',
        mistakes: Array.isArray(trade.mistakes)
          ? trade.mistakes.filter((mistake) => typeof mistake === 'string').slice(0, 10).map((mistake) => mistake.slice(0, 80))
          : [],
      })),
    journalEntries: entries.map(([date, entry]) => ({
      date,
      mood: typeof entry?.mood === 'string' ? entry.mood : '',
      followedPlan: entry?.followedPlan === true,
      lesson: typeof entry?.lesson === 'string' ? entry.lesson.slice(0, 300) : '',
    })),
    onboarding: {
      experience: typeof answers.experience === 'string' ? answers.experience : '',
      struggles: Array.isArray(answers.struggles) ? answers.struggles.filter((item) => typeof item === 'string').slice(0, 10).map((item) => item.slice(0, 100)) : [],
      markets: Array.isArray(answers.markets) ? answers.markets.filter((item) => typeof item === 'string').slice(0, 10).map((item) => item.slice(0, 100)) : [],
    },
  }
}

const sharedItems = [
  'Summary metrics: total trades, win rate, profit factor, average win, average loss, and net P&L.',
  'Best and worst trading day by date and net P&L.',
  'The 20 most recent trades: symbol, side, result, net P&L, session, whether rules were followed, and recorded mistakes.',
  'Journal entries from the last 7 days: date, mood, whether the plan was followed, and lesson text (up to 300 characters).',
  'Onboarding answers: trading experience, selected struggles, and markets.',
]

function MessageText({ children }) {
  return <div className="aic-message-text">{children}</div>
}

async function requestErrorMessage(error) {
  const response = error?.context instanceof Response ? error.context : null
  if (response) {
    try {
      const body = await response.clone().json()
      const categoryMessages = {
        configuration_missing: 'TradeJournal AI needs server configuration. Ask the site administrator to set the required Supabase secrets.',
        authentication_required: 'Your sign-in could not be verified. Sign in again, then retry.',
        authentication_unavailable: 'Sign-in verification is temporarily unavailable. Please retry shortly.',
        daily_limit: 'You’ve reached today’s AI request limit. Please come back tomorrow.',
        invalid_request: 'TradeJournal AI could not process that request. Please try a shorter question.',
        provider_credentials: 'TradeJournal AI server credentials need attention. Please contact the site administrator.',
        provider_model: 'The configured AI model is unavailable. Please contact the site administrator.',
        provider_rate_limit: 'The AI service is busy. Please wait a minute and try again.',
        provider_request: 'TradeJournal AI could not process that request. Please try a shorter question.',
        provider_timeout: 'TradeJournal AI took too long to respond. Please retry in a moment.',
        provider_unavailable: 'TradeJournal AI is temporarily unavailable. Please try again shortly.',
      }
      if (typeof body?.category === 'string' && categoryMessages[body.category]) {
        return categoryMessages[body.category]
      }
    } catch {
      // Use the status-based message below when the response has no readable JSON body.
    }
    if (response.status === 401 || response.status === 403) return 'Your sign-in could not be verified. Sign in again, then retry.'
    if (response.status === 429) return 'TradeJournal AI has reached its request limit. Please wait and try again.'
    if (response.status === 503) return 'TradeJournal AI needs server configuration. Please contact the site administrator.'
    if (response.status === 504) return 'TradeJournal AI took too long to respond. Please retry.'
  }

  if (error?.name === 'FunctionsFetchError') {
    return 'TradeJournal AI could not connect. Check that journal-ai is deployed and AI_ALLOWED_ORIGINS includes this site, then retry.'
  }
  return 'TradeJournal AI is temporarily unavailable. Please retry in a moment.'
}

export default function AIChat({ onAvailabilityChange }) {
  const { trades = [], journal = [] } = useJournal()
  const { user, profile, refreshProfile } = useAuth()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [consentDialog, setConsentDialog] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [consent, setConsent] = useState(profile?.settings?.aiConsent ?? null)
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [requestError, setRequestError] = useState(null)
  const controllerRef = useRef(null)
  const dialogRef = useRef(null)
  const context = useMemo(() => buildContext(trades, journal, profile), [trades, journal, profile])

  useEffect(() => {
    setConsent(profile?.settings?.aiConsent ?? null)
  }, [profile?.settings?.aiConsent])

  useEffect(() => {
    if (!consentDialog && !shareDialog) return undefined
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll('button:not(:disabled)')
    focusable?.[0]?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setConsentDialog(false)
        setShareDialog(false)
      }
      if (event.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [consentDialog, shareDialog, consentSaving])

  const saveConsent = async (allowed) => {
    if (!user?.id || !profile) {
      setConsentError('Your profile is still loading. Please try again in a moment.')
      return false
    }
    setConsentSaving(true)
    setConsentError('')
    try {
      const result = await updateProfileSettings(user.id, {
        ...(profile.settings || {}),
        aiConsent: allowed ? 'allowed' : 'declined',
      })
      if (result.error) throw result.error
      setConsent(allowed ? 'allowed' : 'declined')
      setConsentDialog(false)
      await refreshProfile()
      return true
    } catch (error) {
      console.error('Could not save AI data-sharing choice:', error)
      setConsentError('Your choice could not be saved. Please try again.')
      return false
    } finally {
      setConsentSaving(false)
    }
  }

  const requestQuestion = async (question, previousMessages = messages, consentGranted = false, appendUserMessage = true) => {
    const text = question.trim()
    if (!text || loading) return
    if (consent !== 'allowed' && !consentGranted) {
      setPendingQuestion(text)
      setConsentDialog(true)
      return
    }
    setRequestError(null)
    if (!context.metrics.totalTrades) {
      if (appendUserMessage) {
        setMessages((current) => [...current, { role: 'user', content: text }, {
          role: 'assistant',
          content: 'Add or import a few trades first, then I can review them.',
        }])
      }
      return
    }

    const nextMessages = [...previousMessages, { role: 'user', content: text }]
    if (appendUserMessage) setMessages(nextMessages)
    setLoading(true)
    const requestMessages = nextMessages.slice(-10)
    if (requestMessages[0]?.role === 'assistant') requestMessages.shift()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const { data, error } = await supabase.functions.invoke('journal-ai', {
        body: { messages: requestMessages, context },
        signal: controller.signal,
      })
      if (error) throw error
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('The AI response was empty.')
      onAvailabilityChange?.(true)
      setMessages((current) => [...current, { role: 'assistant', content: data.reply.trim() }])
    } catch (error) {
      if (controller.signal.aborted) return
      onAvailabilityChange?.(false)
      const message = await requestErrorMessage(error)
      setRequestError({ message, question: text, history: previousMessages })
      console.warn('TradeJournal AI request failed.', { category: error?.name || 'request_error' })
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      setLoading(false)
    }
  }

  const startPrompt = (question) => {
    setRequestError(null)
    if (consent === 'declined') {
      setConsentDialog(true)
      return
    }
    if (consent !== 'allowed') {
      setPendingQuestion(question)
      setConsentDialog(true)
      return
    }
    void requestQuestion(question, messages, true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    startPrompt(text)
  }

  const allowAndContinue = async () => {
    const saved = await saveConsent(true)
    if (saved && pendingQuestion) {
      const question = pendingQuestion
      setPendingQuestion('')
      void requestQuestion(question, messages, true)
    }
  }

  const stopRequest = () => controllerRef.current?.abort()
  const clearChat = () => {
    stopRequest()
    setMessages([])
    setLoading(false)
    setRequestError(null)
  }

  return <div className="aic">
    <div className="aic-prompts" aria-label="AI questions">
      {prompts.map((prompt) => <button type="button" key={prompt.label} onClick={() => startPrompt(prompt.question)} disabled={consent === 'declined'}>
        {prompt.label}
      </button>)}
    </div>
    {consent === 'declined' && <div className="aic-consent-disabled" role="status">
      <span>AI sharing is turned off.</span>
      <button type="button" onClick={() => { setConsentError(''); setConsentDialog(true) }}>Change choice</button>
    </div>}
    {messages.length > 0 && <section className="aic-chat" aria-label="TradeJournal AI conversation">
      <div className="aic-chat-toolbar">
        <span>Conversation · kept only in this session</span>
        <button type="button" onClick={clearChat} disabled={loading}>Clear chat</button>
      </div>
      <div className="aic-messages" aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => <div className={`aic-message aic-message-${message.role}`} key={`${index}-${message.role}`}>
          <span className="aic-message-author">{message.role === 'assistant' ? 'TradeJournal AI' : 'You'}</span>
          <MessageText>{message.content}</MessageText>
        </div>)}
        {loading && <div className="aic-message aic-message-assistant aic-typing" role="status" aria-label="TradeJournal AI is typing">
          <span className="aic-message-author">TradeJournal AI</span>
          <span className="aic-typing-dots" aria-hidden="true"><i /><i /><i /></span>
          <button type="button" onClick={stopRequest}>Stop</button>
        </div>}
      </div>
      {requestError && <div className="aic-request-error" role="status" aria-live="polite">
        <span>{requestError.message}</span>
        <button type="button" className="aic-retry" onClick={() => requestQuestion(requestError.question, requestError.history, true, false)} disabled={loading}>Retry</button>
      </div>}
    </section>}
    {consent === 'allowed' && <form className="aic-compose" onSubmit={handleSubmit}>
      <label className="aic-visually-hidden" htmlFor="aic-question">Ask TradeJournal AI</label>
      <textarea id="aic-question" rows="2" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your journal..." disabled={loading} />
      {loading
        ? <button type="button" className="aic-send" onClick={stopRequest}>Stop</button>
        : <button type="submit" className="aic-send" disabled={!draft.trim()}>Send</button>}
    </form>}
    <div className="aic-footer">
      <p>AI can make mistakes. Not financial advice.</p>
      <button type="button" className="aic-shared-link" onClick={() => setShareDialog(true)}>What is shared with AI</button>
    </div>
    {consentDialog && <div className="aic-dialog-backdrop">
      <section ref={dialogRef} className="aic-dialog" role="dialog" aria-modal="true" aria-labelledby="aic-consent-title">
        <h3 id="aic-consent-title">Your trade summaries will be sent to an AI provider to generate answers. Allow?</h3>
        <p>Only the summarized items listed under “What is shared with AI” are sent. Your chat history stays in memory and clears when you refresh.</p>
        {consentError && <p className="aic-error" role="alert">{consentError}</p>}
        <div className="aic-dialog-actions">
          <button type="button" onClick={() => { setPendingQuestion(''); void saveConsent(false) }} disabled={consentSaving}>Decline</button>
          <button type="button" className="aic-send" onClick={allowAndContinue} disabled={consentSaving}>{consentSaving ? 'Saving…' : 'Allow'}</button>
        </div>
      </section>
    </div>}
    {shareDialog && <div className="aic-dialog-backdrop">
      <section ref={dialogRef} className="aic-dialog" role="dialog" aria-modal="true" aria-labelledby="aic-shared-title">
        <h3 id="aic-shared-title">What is shared with AI</h3>
        <ul>{sharedItems.map((item) => <li key={item}>{item}</li>)}</ul>
        <p>Not sent: your email, name, screenshots, images, or other users’ data.</p>
        <div className="aic-dialog-actions"><button type="button" className="aic-send" onClick={() => setShareDialog(false)}>Close</button></div>
      </section>
    </div>}
  </div>
}
