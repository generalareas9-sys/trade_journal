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
  const stats = calculateStats(list)
  return {
    trades: list.length,
    netPnl: num(stats.netPnl),
    winRatePct: num(stats.winRate),
    profitFactor: num(stats.profitFactor),
    expectancyPerTrade: num(stats.expectancy),
    avgWin: num(stats.avgWin),
    avgLoss: num(stats.avgLoss),
    maxDrawdown: num(stats.maxDrawdown),
    bestDay: stats.bestDay ? { date: stats.bestDay[0], pnl: num(stats.bestDay[1]) } : null,
  }
}

function groupBy(list, field) {
  const map = new Map()

  list.forEach((trade) => {
    const raw = trade?.[field]
    const keys = Array.isArray(raw)
      ? raw
      : typeof raw === 'string' && field === 'tags'
        ? raw.split(',').map((s) => s.trim())
        : [raw]

    keys
      .filter((key) => key !== null && key !== undefined && String(key).trim() !== '')
      .forEach((key) => {
        const name = String(key)
        const row = map.get(name) ?? {
          name,
          trades: 0,
          pnl: 0,
          wins: 0,
          losses: 0,
        }

        const pnl = Number(trade.pnl) || 0

        row.trades += 1
        row.pnl += pnl

        if (pnl > 0) row.wins += 1
        if (pnl < 0) row.losses += 1

        map.set(name, row)
      })
  })

  const rows = [...map.values()].sort((a, b) => b.pnl - a.pnl)
  const summarizeGroup = (row) => ({
    name: row.name,
    trades: row.trades,
    pnl: num(row.pnl),
    winRatePct: row.trades ? num((row.wins / row.trades) * 100) : 0,
  })

  return {
    best: rows.slice(0, 3).map(summarizeGroup),
    worst: rows.slice(-3).reverse().map(summarizeGroup),
  }
}


/* ---------- Safe renderer for the assistant's replies ---------- */
const ACTION_RE = /\[\[go:(\/[^\]|]*)\|([^\]]+)\]\]/g
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g

function Inline({ text }) {
  return text.split(INLINE_RE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    return <span key={index}>{part}</span>
  })
}

function RichText({ content, onGo }) {
  const actions = []
  const clean = content.replace(ACTION_RE, (_, route, label) => {
    if (ROUTES.includes(route)) actions.push({ route, label: label.trim() })
    return ''
  })
  const blocks = []
  clean.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/)
    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/)
    const last = blocks[blocks.length - 1]
    if (/^---+$/.test(trimmed)) {
      if (last?.type === 'p') last.type = 'paragraph-end'
      return
    }
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] })
    } else if (bullet) {
      if (last?.type === 'ul') last.items.push(bullet[1])
      else blocks.push({ type: 'ul', items: [bullet[1]] })
    } else if (ordered) {
      if (last?.type === 'ol') last.items.push(ordered[1])
      else blocks.push({ type: 'ol', items: [ordered[1]] })
    } else if (!trimmed) {
      if (last?.type === 'p') last.type = 'paragraph-end'
    } else if (last?.type === 'p') {
      last.text += ` ${trimmed}`
    } else if (last?.type === 'paragraph-end') {
      blocks.push({ type: 'p', text: trimmed })
    } else {
      blocks.push({ type: 'p', text: trimmed })
    }
  })
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type
          return <List key={i}>{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</List>
        }
        if (block.type === 'paragraph-end') return null
        if (block.type === 'heading') return <p key={i}><strong><Inline text={block.text} /></strong></p>
        return <p key={i}><Inline text={block.text} /></p>
      })}
      {actions.length > 0 && (
        <div className="ai-actions">
          {actions.map(({ route, label }, index) => <button type="button" key={`${route}-${label}-${index}`} onClick={() => onGo(route)}>{label}<ArrowUpRight size={13} /></button>)}
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
    return 'The AI service is not connected yet. Please try again after it has been set up.'
  }
  return text || 'Something went wrong. Please try again.'
}

export default function AiAssistant() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { trades = [], journal = {}, accounts = [], settings = {} } = useJournal()
  const storageKey = `tj-ai-chat:${user?.id ?? 'guest'}`
  const [messages, setMessages] = useState([])
  const [loadedStorageKey, setLoadedStorageKey] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatReady = loadedStorageKey === storageKey
  const visibleMessages = chatReady ? messages : []
  const listRef = useRef(null)
  const storageKeyRef = useRef(storageKey)
  const requestIdRef = useRef(0)
  storageKeyRef.current = storageKey

  const firstName = String(profile?.display_name || profile?.displayName || profile?.name || user?.user_metadata?.full_name || '').trim().split(/\s+/)[0]

  /* Compact, privacy-friendly summary of the user's workspace (no notes/screenshots). */
  const context = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayJournal = journal[today]
    const journalWrittenToday = Boolean(todayJournal && Object.entries(todayJournal).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))))
    
const recent = [...trades]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, 20)
  .map((t) => ({
    date: t.date,
    symbol: t.symbol,
    side: t.side,
    pnl: num(t.pnl),
    result: t.result,
    rMultiple: num(t.rMultiple),
    session: t.session || null,
    tags: Array.isArray(t.tags) ? t.tags : t.tags || null,
  }))

    return {
      today,
      userName: firstName || null,
      usingDemoData: trades.length > 0 && trades.every((t) => t.isDemo),
      accountsCount: accounts.length,
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
    let restored = []
    try {
      const parsed = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
      if (Array.isArray(parsed)) {
        restored = parsed.filter((message) =>
          (message?.role === 'user' || message?.role === 'assistant') &&
          typeof message.content === 'string'
        ).slice(-30)
      }
    } catch (error) {
      console.warn('Could not restore the AI chat from this session:', error)
    }
    setMessages(restored)
    setLoadedStorageKey(storageKey)
    setLoading(false)
  }, [storageKey])

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)))
    } catch (error) {
      console.warn('Could not save the AI chat to this session:', error)
    }
  }, [messages, storageKey, loadedStorageKey])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const go = useCallback((route) => navigate(route), [navigate])

  const send = useCallback(async (raw) => {
    if (loadedStorageKey !== storageKey) return
    const text = String(raw ?? input).trim()
    if (!text || loading) return
    setInput('')
    const requestStorageKey = storageKey
    const requestId = ++requestIdRef.current
    const next = [...messages, { role: 'user', content: text }].slice(-30)
    setMessages(next)
    setLoading(true)
    try {
      const apiMessages = next
        .filter((message) => !message.error)
        .slice(-12)
      while (apiMessages.length && apiMessages[0].role !== 'user') apiMessages.shift()
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: apiMessages.map(({ role, content }) => ({ role, content })), context },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const reply = String(data?.reply ?? '').trim()
      if (storageKeyRef.current === requestStorageKey && requestIdRef.current === requestId) {
        setMessages([...next, { role: 'assistant', content: reply || 'Sorry, I could not come up with an answer. Please try again.' }].slice(-30))
      }
    } catch (err) {
      const message = await readError(err)
      if (storageKeyRef.current === requestStorageKey && requestIdRef.current === requestId) {
        setMessages([...next, { role: 'assistant', content: message, error: true }].slice(-30))
      }
    } finally {
      if (storageKeyRef.current === requestStorageKey && requestIdRef.current === requestId) setLoading(false)
    }
  }, [input, loading, messages, context, loadedStorageKey, storageKey])

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
        <button type="button" className="ai-reset" onClick={() => { requestIdRef.current += 1; setLoading(false); setMessages([]); setInput('') }} aria-label="Start a new chat" title="New chat"><RotateCcw size={15} /></button>
      </header>

      <div className="ai-log" ref={listRef} role="log" aria-live="polite">
        <div className="ai-msg ai-msg-bot">
          <p>{firstName ? `Hi ${firstName}! ` : 'Hi! '}I’m your TradeJournal assistant. I can read your journal numbers, explain your stats, suggest what to work on, and take you to the right page.</p>
        </div>
        {visibleMessages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}${m.error ? ' ai-msg-error' : ''}`}>
            {m.role === 'user' ? <p>{m.content}</p> : <RichText content={m.content} onGo={go} />}
          </div>
        ))}
        {loading && <div className="ai-msg ai-msg-bot ai-typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
      </div>

      {visibleMessages.length === 0 && (
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
