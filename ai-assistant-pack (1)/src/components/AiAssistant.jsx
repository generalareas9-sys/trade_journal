import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bot, RotateCcw, Send, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useJournal } from '../hooks/useJournal'
import { calculateStats, filterTrades } from '../utils/trading'
import './ai-assistant.css'

/* Pages the assistant is allowed to send the user to (buttons in replies). */
const ROUTES = ['/home', '/', '/journal', '/trades', '/reports', '/weekly-review', '/progress-tracker', '/notebook', '/playbooks', '/backtesting', '/risk-calculator', '/settings', '/import', '/help', '/changelog']

const SUGGESTIONS = [
  'Summarize my performance',
  'What should I focus on today?',
  'Where am I losing money?',
  'How do I import my trades?',
]

const num = (value, digits = 2) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(digits)))

function summarize(list) {
  try {
    const s = calculateStats(list)
    return {
      trades: list.length,
      netPnl: num(s.netPnl),
      winRatePct: num(s.winRate, 1),
      profitFactor: num(s.profitFactor),
      expectancyPerTrade: num(s.expectancy),
      avgWin: num(s.avgWin),
      avgLoss: num(s.avgLoss),
      maxDrawdown: num(s.maxDrawdown),
      bestDay: s.bestDay ? { date: s.bestDay[0], pnl: num(s.bestDay[1]) } : null,
    }
  } catch {
    return { trades: list.length }
  }
}

function groupBy(list, field) {
  const map = new Map()
  list.forEach((trade) => {
    const raw = trade[field]
    const keys = Array.isArray(raw) ? raw : typeof raw === 'string' && field === 'tags' ? raw.split(',').map((s) => s.trim()) : [raw]
    keys.filter(Boolean).forEach((key) => {
      const row = map.get(key) ?? { name: String(key), trades: 0, pnl: 0 }
      row.trades += 1
      row.pnl += Number(trade.pnl) || 0
      map.set(key, row)
    })
  })
  const rows = [...map.values()].map((row) => ({ ...row, pnl: num(row.pnl) })).sort((a, b) => b.pnl - a.pnl)
  return { best: rows.slice(0, 3), worst: rows.length > 3 ? rows.slice(-3).reverse() : [] }
}

/* ---------- tiny safe renderer for the assistant's replies ---------- */
const ACTION_RE = /\[\[go:(\/[^\]|]*)\|([^\]]+)\]\]/g

function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>))
}

function RichText({ content, onGo }) {
  const actions = []
  const clean = content.replace(ACTION_RE, (_, route, label) => {
    if (ROUTES.includes(route.split('?')[0])) actions.push({ route, label })
    return ''
  })
  const blocks = []
  clean.split('\n').forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const last = blocks[blocks.length - 1]
    if (bullet) {
      if (last?.type === 'ul') last.items.push(bullet[1])
      else blocks.push({ type: 'ul', items: [bullet[1]] })
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line.trim() })
    }
  })
  return (
    <>
      {blocks.map((block, i) => (block.type === 'ul'
        ? <ul key={i}>{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ul>
        : <p key={i}><Inline text={block.text} /></p>))}
      {actions.length > 0 && (
        <div className="ai-actions">
          {actions.map(({ route, label }) => <button type="button" key={route + label} onClick={() => onGo(route)}>{label}<ArrowUpRight size={13} /></button>)}
        </div>
      )}
    </>
  )
}

async function readError(err) {
  try {
    if (err?.context?.json) {
      const body = await err.context.json()
      if (body?.error) return body.error
    }
  } catch { /* ignore */ }
  const text = String(err?.message ?? '')
  if (/Failed to send|Function not found|NetworkError|fetch/i.test(text)) {
    return 'The AI service is not connected yet. Deploy the "ai-assistant" Supabase function (see the setup steps) and try again.'
  }
  return text || 'Something went wrong. Please try again.'
}

export default function AiAssistant() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { trades = [], journal = {}, accounts = [], settings = {} } = useJournal()
  const storageKey = `tj-ai-chat:${user?.id ?? 'guest'}`
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  const firstName = String(profile?.display_name || profile?.displayName || profile?.name || user?.user_metadata?.full_name || '').trim().split(/\s+/)[0]

  /* Compact, privacy-friendly summary of the user's workspace (no notes/screenshots). */
  const context = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayJournal = journal[today]
    const journalWrittenToday = Boolean(todayJournal && Object.entries(todayJournal).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))))
    const recent = [...trades].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8)
      .map((t) => ({ date: t.date, symbol: t.symbol, side: t.side, pnl: num(t.pnl), result: t.result, rMultiple: num(t.rMultiple), session: t.session || null }))
    return {
      today,
      userName: firstName || null,
      usingDemoData: trades.length > 0 && trades.every((t) => t.isDemo),
      accounts: accounts.length,
      monthlyGoalConfigured: Boolean(settings.monthlyGoalConfigured),
      journalWrittenToday,
      allTime: summarize(trades),
      last30Days: summarize(filterTrades(trades, '30D')),
      bySymbol: groupBy(trades, 'symbol'),
      bySession: groupBy(trades, 'session'),
      byTag: groupBy(trades, 'tags'),
      recentTrades: recent,
    }
  }, [trades, journal, accounts.length, settings.monthlyGoalConfigured, firstName])

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages.filter((m) => !m.error).slice(-30))) } catch { /* ignore */ }
  }, [messages, storageKey])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const go = useCallback((route) => navigate(route), [navigate])

  const send = useCallback(async (raw) => {
    const text = String(raw ?? input).trim()
    if (!text || loading) return
    setInput('')
    const next = [...messages.filter((m) => !m.error), { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: next.slice(-12).map(({ role, content }) => ({ role, content })), context },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const reply = String(data?.reply ?? '').trim()
      setMessages([...next, { role: 'assistant', content: reply || 'Sorry, I could not come up with an answer. Please try again.' }])
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: await readError(err), error: true }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, context])

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <section className="ai-assistant" aria-labelledby="ai-assistant-title">
      <header className="ai-head">
        <span className="ai-badge"><Bot size={18} /></span>
        <div className="ai-head-copy">
          <h3 id="ai-assistant-title">TradeJournal AI <span className="ai-live"><i />Online</span></h3>
          <p>Ask about your results, your habits, or how to use any page.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="ai-reset" onClick={() => setMessages([])} aria-label="Start a new chat" title="New chat"><RotateCcw size={15} /></button>
        )}
      </header>

      <div className="ai-log" ref={listRef} role="log" aria-live="polite">
        <div className="ai-msg ai-msg-bot">
          <p>{firstName ? `Hi ${firstName}! ` : 'Hi! '}I’m your TradeJournal assistant. I can read your journal numbers, explain your stats, suggest what to work on, and take you to the right page.</p>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}${m.error ? ' ai-msg-error' : ''}`}>
            {m.role === 'user' ? <p>{m.content}</p> : <RichText content={m.content} onGo={go} />}
          </div>
        ))}
        {loading && <div className="ai-msg ai-msg-bot ai-typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
      </div>

      {messages.length === 0 && (
        <div className="ai-chips">
          {SUGGESTIONS.map((s) => <button type="button" key={s} onClick={() => send(s)} disabled={loading}><Sparkles size={13} />{s}</button>)}
        </div>
      )}

      <form className="ai-input" onSubmit={(event) => { event.preventDefault(); send() }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask me anything about your trading or this app…"
          rows={1}
          maxLength={800}
          aria-label="Message the assistant"
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send message"><Send size={16} /></button>
      </form>
      <p className="ai-note">AI can make mistakes. This is not financial advice.</p>
    </section>
  )
}
