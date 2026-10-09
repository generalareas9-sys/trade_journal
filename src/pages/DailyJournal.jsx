import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, isValid, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, ImagePlus, Printer, Search, Settings2, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../context/AuthContext'
import { deleteScreenshot, getSignedUrl, uploadJournalImage } from '../data/storage'
import { axisCurrency, currency, percent } from '../utils/trading'
import { EmptyState } from '../components/UiElements'
import { BookOpenCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import './dailyJournal.css'

const moods = ['😞', '😐', '🙂', '😄', '🔥']
const moodNames = { '😞': 'Low', '😐': 'Okay', '🙂': 'Good', '😄': 'Great', '🔥': 'Energized' }
const tags = ['A+ setup', 'Breakout', 'Reversal', 'Trend following', 'Scalp', 'News']
const mistakes = ['FOMO', 'Revenge trade', 'Moved stop', 'Oversized', 'Early exit', 'No setup']
const blankEntry = () => ({ bias: '', levels: '', news: '', maxRisk: '', maxTrades: '', review: '', lesson: '', rating: 0, mood: '🙂', energy: 3, sleep: '', followedPlan: false, tags: [], mistakes: [], images: [] })
const safeDate = (value) => {
  const parsed = parseISO(value || '')
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value ? parsed : new Date()
}
const finitePnl = (trade) => Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0

function JournalImage({ path, alt }) {
  const [url, setUrl] = useState(path?.startsWith('data:') ? path : '')
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setFailed(false)
    if (!path) {
      setUrl('')
    } else if (path.startsWith('data:')) {
      setUrl(path)
    } else {
      setUrl('')
      void getSignedUrl(path).then(({ url: signedUrl, error }) => {
        if (!active) return
        setFailed(Boolean(error))
        setUrl(error ? '' : signedUrl || '')
      })
    }
    return () => { active = false }
  }, [path, reload])
  return url ? <img src={url} alt={alt} /> : failed
    ? <button type="button" className="dj-image-loading" onClick={() => setReload((value) => value + 1)}>Image unavailable · Retry</button>
    : <span className="dj-image-loading" role="status">Loading image…</span>
}

export default function DailyJournal() {
  const { trades = [], journal = {}, setJournal, saveStatus } = useJournal()
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [params] = useSearchParams()
  const queryDate = params.get('date')
  const initial = queryDate && isValid(parseISO(queryDate)) && format(parseISO(queryDate), 'yyyy-MM-dd') === queryDate ? queryDate : today
  const [selected, setSelected] = useState(initial)
  const [imageStatus, setImageStatus] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [retryImage, setRetryImage] = useState(null)
  const [month, setMonth] = useState(safeDate(initial))
  const [filter, setFilter] = useState({ query: '', tag: '', mood: '', mistake: '', from: '', to: '' })
  const [customTag, setCustomTag] = useState('')
  const [customMistake, setCustomMistake] = useState('')
  const [goalEditor, setGoalEditor] = useState(false)
  const entry = journal[selected] || blankEntry()
  const date = safeDate(selected)
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  const allTrades = useMemo(() => trades.filter((trade) => trade.date), [trades])
  const dayTrades = useMemo(() => allTrades.filter((trade) => trade.date === selected).sort((a, b) => String(a.openedAt || '').localeCompare(String(b.openedAt || ''))), [allTrades, selected])
  const pnl = dayTrades.reduce((total, trade) => total + finitePnl(trade), 0)
  const winners = dayTrades.filter((trade) => finitePnl(trade) > 0).length
  const winRate = dayTrades.length ? winners / dayTrades.length * 100 : 0

  useEffect(() => setImageStatus(''), [selected])

  useEffect(() => {
    const onKey = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      if (event.key === 'ArrowLeft') setSelected((value) => format(addDays(safeDate(value), -1), 'yyyy-MM-dd'))
      if (event.key === 'ArrowRight') setSelected((value) => format(addDays(safeDate(value), 1), 'yyyy-MM-dd'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const updateDate = (date, key, value) => setJournal((current) => {
    const previous = current[date] || blankEntry()
    return {
      ...current,
      [date]: { ...previous, [key]: typeof value === 'function' ? value(previous[key]) : value },
    }
  })
  const update = (key, value) => updateDate(selected, key, value)
  const toggleChoice = (key, value) => {
    const values = entry[key] || []
    update(key, values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }
  const moveDay = (amount) => setSelected(format(addDays(date, amount), 'yyyy-MM-dd'))
  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const days = eachDayOfInterval({ start: first, end: last })
    const offset = (getDay(first) + 6) % 7
    return [...Array(offset).fill(null), ...days]
  }, [month])

  const dayList = useMemo(() => Object.entries(journal).map(([day, item]) => ({ day, ...item })).filter((item) => {
    if (filter.from && item.day < filter.from || filter.to && item.day > filter.to) return false
    if (filter.tag && !(item.tags || []).includes(filter.tag)) return false
    if (filter.mood && item.mood !== filter.mood) return false
    if (filter.mistake && !(item.mistakes || []).includes(filter.mistake)) return false
    if (filter.query && !`${item.bias} ${item.levels} ${item.news} ${item.review} ${item.lesson} ${(item.tags || []).join(' ')} ${(item.mistakes || []).join(' ')}`.toLowerCase().includes(filter.query.toLowerCase())) return false
    return true
  }).sort((a, b) => b.day.localeCompare(a.day)), [journal, filter])

  const weeklyTrades = allTrades.filter((trade) => trade.date >= format(start, 'yyyy-MM-dd') && trade.date <= format(end, 'yyyy-MM-dd'))
  const weeklyPnl = weeklyTrades.reduce((total, trade) => total + finitePnl(trade), 0)
  const weeklyWins = weeklyTrades.filter((trade) => finitePnl(trade) > 0).length
  const weekEntries = Object.entries(journal).filter(([day]) => day >= format(start, 'yyyy-MM-dd') && day <= format(end, 'yyyy-MM-dd')).map(([, item]) => item)
  const weeklyRatings = weekEntries.map((item) => Number(item.rating) || 0).filter(Boolean)
  const weeklyDailyPnl = Object.entries(weeklyTrades.reduce((totals, trade) => ({ ...totals, [trade.date]: (totals[trade.date] || 0) + finitePnl(trade) }), {}))
    .sort(([, first], [, second]) => second - first)
  const mistakeCounts = weekEntries.flatMap((item) => item.mistakes || []).reduce((counts, mistake) => ({ ...counts, [mistake]: (counts[mistake] || 0) + 1 }), {})
  const mostCommonMistake = Object.entries(mistakeCounts).sort(([, first], [, second]) => second - first)[0]
  const disciplineEntries = weekEntries.filter((item) => typeof item.followedPlan === 'boolean')
  const disciplineScore = disciplineEntries.length ? disciplineEntries.filter((item) => item.followedPlan).length / disciplineEntries.length * 100 : null
  const weekKey = format(start, 'yyyy-MM-dd')
  const equity = useMemo(() => {
    const daily = new Map()
    allTrades.forEach((trade) => daily.set(trade.date, (daily.get(trade.date) || 0) + finitePnl(trade)))
    let total = 0
    return [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day: format(safeDate(day), 'MMM d'), balance: total += value }))
  }, [allTrades])
  const taggedTrades = useMemo(() => {
    const result = {}
    Object.entries(journal).forEach(([day, item]) => (item.tags || []).forEach((tag) => {
      const value = allTrades.filter((trade) => trade.date === day).reduce((sum, trade) => sum + finitePnl(trade), 0)
      result[tag] = { count: (result[tag]?.count || 0) + 1, pnl: (result[tag]?.pnl || 0) + value }
    }))
    return result
  }, [allTrades, journal])
  const mistakeTrades = useMemo(() => {
    const result = {}
    Object.entries(journal).forEach(([day, item]) => (item.mistakes || []).forEach((mistake) => {
      const value = allTrades.filter((trade) => trade.date === day).reduce((sum, trade) => sum + finitePnl(trade), 0)
      result[mistake] = { count: (result[mistake]?.count || 0) + 1, pnl: (result[mistake]?.pnl || 0) + value }
    }))
    return result
  }, [allTrades, journal])
  const streak = useMemo(() => {
    let count = 0
    let cursor = safeDate(today)
    while (journal[format(cursor, 'yyyy-MM-dd')]?.followedPlan) {
      count += 1
      cursor = addDays(cursor, -1)
    }
    return count
  }, [journal, today])
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const monthTrades = allTrades.filter((trade) => trade.date >= monthStart && trade.date <= monthEnd)
  const monthPnl = monthTrades.reduce((sum, trade) => sum + finitePnl(trade), 0)
  const monthWinRate = monthTrades.length ? monthTrades.filter((trade) => finitePnl(trade) > 0).length / monthTrades.length * 100 : 0
  const goals = journal[today]?.goals || {}

  const uploadAttachment = async (file, dateForUpload, index) => {
    if (!user?.id) {
      setImageStatus('Sign in before uploading journal images.')
      return false
    }
    setImageBusy(true)
    setImageStatus('Uploading image…')
    const result = await uploadJournalImage(user.id, dateForUpload, index, file)
    if (result.error) {
      setRetryImage({ file, date: dateForUpload, index })
      setImageStatus(result.error.message || 'Image upload failed.')
      setImageBusy(false)
      return false
    }
    updateDate(dateForUpload, 'images', (images = []) => [...images, result.path])
    setRetryImage(null)
    setImageStatus('Image uploaded.')
    setImageBusy(false)
    return true
  }
  const attachImages = async (files) => {
    const selectedFiles = [...files]
    let nextIndex = Math.max(0, ...(journal[selected]?.images || []).map((path) => {
      const match = typeof path === 'string' && path.match(/\/(\d+)\.jpg$/)
      return match ? Number(match[1]) : 0
    })) + 1
    for (const file of selectedFiles) {
      const uploaded = await uploadAttachment(file, selected, nextIndex)
      if (!uploaded) break
      nextIndex += 1
    }
    if (!selectedFiles.length) setImageStatus('Select one or more image files to attach.')
  }

  const removeJournalImage = async (image) => {
    update('images', entry.images.filter((value) => value !== image))
    if (!image.startsWith('data:')) {
      const result = await deleteScreenshot(image)
      if (result.error) console.warn(`Could not delete journal image: ${result.error.message || result.error}`)
    }
  }
  const print = (scope) => {
    document.body.dataset.journalPrint = scope
    window.print()
    window.setTimeout(() => delete document.body.dataset.journalPrint, 500)
  }
  const addCustom = (key, text, setter) => {
    const value = text.trim()
    if (value && !entry[key].includes(value)) update(key, [...entry[key], value])
    setter('')
  }
  const hasAnyTrades = allTrades.some((trade) => trade.date === today && !trade.isDemo)
  const hasJournalEntries = Object.keys(journal).length > 0
  const hasTodayEntry = !!journal[today] && Object.entries(journal[today]).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length : Boolean(value)))
  const saveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Could not save' : 'Saved'

  return <main className="page-content dj">
    {hasAnyTrades && !hasTodayEntry && <div className="dj-reminder" role="status">You’ve traded today—take a moment to journal your session.</div>}
    {!hasJournalEntries && <section className="panel page-empty-panel journal-first-empty"><EmptyState icon={BookOpenCheck} title="Your first journal entry starts here" description="Capture your plan and one honest reflection to turn today’s decisions into tomorrow’s learning." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => { setSelected(today); window.setTimeout(() => document.getElementById('daily-journal-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}>Write today’s entry</button><Link className="button-secondary" to="/trades">Review trades</Link></div>} /></section>}
    <header className="dj-header">
      <div><span className="dj-eyebrow">YOUR TRADING PRACTICE</span><h1>Daily journal</h1><p>Plan with intention. Review with honesty. Improve one session at a time.</p></div>
      <div className="dj-header-actions"><span className="dj-save-status" role="status"><Check size={15} /> {saveLabel}</span><button type="button" onClick={() => print('day')}><Printer size={16} /> Print day</button><button type="button" onClick={() => print('week')}><Printer size={16} /> Print week</button></div>
    </header>
    <div className="dj-layout">
      <aside className="dj-sidebar">
        <section className="dj-card dj-calendar">
          <div className="dj-section-heading"><div><h2>Calendar</h2><p>Choose a session</p></div><div className="dj-calendar-nav"><button aria-label="Previous month" onClick={() => setMonth((value) => subMonths(value, 1))}><ChevronLeft size={16} /></button><button aria-label="Next month" onClick={() => setMonth((value) => addMonths(value, 1))}><ChevronRight size={16} /></button></div></div>
          <strong className="dj-month-label">{format(month, 'MMMM yyyy')}</strong>
          <div className="dj-calendar-grid" role="grid" aria-label={format(month, 'MMMM yyyy')}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="dj-weekday">{day}</span>)}
            {calendarDays.map((day, index) => {
              const key = day && format(day, 'yyyy-MM-dd')
              const hasEntry = key && journal[key]
              const hasTrade = key && allTrades.some((trade) => trade.date === key)
              return day ? <button key={key} className={`dj-calendar-day ${key === selected ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}`} aria-label={`${format(day, 'MMMM d')}${hasEntry ? ', journal entry' : ''}${hasTrade ? ', trades' : ''}`} aria-pressed={key === selected} onClick={() => setSelected(key)}>{format(day, 'd')}{(hasEntry || hasTrade) && <i aria-hidden="true" />}</button> : <span key={`empty-${index}`} />
            })}
          </div><div className="dj-calendar-legend"><span><i className="dj-entry-dot" /> Journal / trade day</span><button onClick={() => setSelected(today)}>Today</button></div>
        </section>
        <section className="dj-card">
          <div className="dj-section-heading"><div><h2>Find an entry</h2><p>Search your journal</p></div><Search size={16} /></div>
          <label className="dj-search"><Search size={15} /><input aria-label="Search entries" placeholder="Search notes, tags…" value={filter.query} onChange={(event) => setFilter({ ...filter, query: event.target.value })} /></label>
          <div className="dj-filter-grid">
            <label>Tag<select value={filter.tag} onChange={(event) => setFilter({ ...filter, tag: event.target.value })}><option value="">All tags</option>{[...new Set([...tags, ...Object.values(journal).flatMap((item) => item.tags || [])])].map((tag) => <option key={tag}>{tag}</option>)}</select></label>
            <label>Mood<select value={filter.mood} onChange={(event) => setFilter({ ...filter, mood: event.target.value })}><option value="">Any mood</option>{moods.map((mood) => <option key={mood} value={mood}>{moodNames[mood]} {mood}</option>)}</select></label>
            <label>Mistake<select value={filter.mistake} onChange={(event) => setFilter({ ...filter, mistake: event.target.value })}><option value="">Any mistake</option>{[...new Set([...mistakes, ...Object.values(journal).flatMap((item) => item.mistakes || [])])].map((mistake) => <option key={mistake}>{mistake}</option>)}</select></label>
            <label>From<input type="date" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} /></label>
            <label>To<input type="date" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} /></label>
          </div>
          <div className="dj-entry-results">{dayList.length ? dayList.slice(0, 8).map((item) => <button key={item.day} className={selected === item.day ? 'active' : ''} onClick={() => setSelected(item.day)}><span>{format(safeDate(item.day), 'MMM d, yyyy')}</span><span>{item.mood || '🙂'} {item.rating ? `${item.rating}/5` : ''}</span></button>) : <p className="dj-empty-small">No entries match these filters.</p>}</div>
        </section>
        <section className="dj-card dj-streak"><span>FOLLOW-PLAN STREAK</span><strong>🔥 {streak} {streak === 1 ? 'day' : 'days'}</strong><p>Consecutive days you followed your plan</p></section>
      </aside>
      <div className="dj-content">
        <section className="dj-card dj-day-card" id="daily-journal-entry">
          <div className="dj-day-heading"><button className="dj-nav-button" aria-label="Previous day" onClick={() => moveDay(-1)}><ArrowLeft size={17} /></button><div><span className="dj-eyebrow">TRADING SESSION</span><h2>{format(date, 'EEEE, MMMM d, yyyy')}</h2></div><button className="dj-nav-button" aria-label="Next day" onClick={() => moveDay(1)}><ArrowRight size={17} /></button><button className="dj-today-button" onClick={() => setSelected(today)}>Today</button></div>
          <div className="dj-kpis"><div><span>Net P&amp;L</span><strong className={pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : ''}>{dayTrades.length ? currency(pnl) : 'No data yet'}</strong></div><div><span>Trades</span><strong>{dayTrades.length}</strong></div><div><span>Wins</span><strong>{dayTrades.length ? winners : '—'}</strong></div><div><span>Win rate</span><strong>{dayTrades.length ? percent(winRate) : '—'}</strong></div></div>
          {!dayTrades.length && <p className="dj-empty-trades">No trades logged for this day. Your plan and reflections still count.</p>}
          {!!dayTrades.length && <div className="dj-trades"><div className="dj-section-heading"><div><h3>Trade list</h3><p>{dayTrades.length} trades · {dayTrades.filter((trade) => finitePnl(trade) < 0).length} losses</p></div></div><div className="dj-table-wrap"><table><thead><tr><th>Symbol</th><th>Side</th><th>Entry time</th><th>P&amp;L</th></tr></thead><tbody>{dayTrades.map((trade) => <tr key={trade.id}><td>{trade.symbol || '—'}</td><td>{trade.side || '—'}</td><td>{trade.openedAt && isValid(new Date(trade.openedAt)) ? format(new Date(trade.openedAt), 'h:mm a') : '—'}</td><td className={finitePnl(trade) > 0 ? 'profit' : finitePnl(trade) < 0 ? 'loss' : ''}>{currency(finitePnl(trade))}</td></tr>)}</tbody></table></div></div>}
          <div className="dj-fields-grid">
            <label className="dj-field"><span>Market bias</span><select value={entry.bias || ''} onChange={(event) => update('bias', event.target.value)}><option value="">Select bias</option><option>Long / bullish</option><option>Short / bearish</option><option>Neutral / wait</option></select></label>
            <label className="dj-field"><span>Key levels</span><input value={entry.levels || ''} onChange={(event) => update('levels', event.target.value)} placeholder="Support, resistance, invalidation…" /></label>
            <label className="dj-field dj-span-2"><span>News &amp; catalysts</span><textarea rows="2" value={entry.news || ''} onChange={(event) => update('news', event.target.value)} placeholder="Events, earnings, macro releases…" /></label>
            <label className="dj-field"><span>Max risk ($)</span><input type="number" min="0" value={entry.maxRisk || ''} onChange={(event) => update('maxRisk', event.target.value)} placeholder="0.00" /></label>
            <label className="dj-field"><span>Max trades</span><input type="number" min="0" step="1" value={entry.maxTrades || ''} onChange={(event) => update('maxTrades', event.target.value)} placeholder="e.g. 3" /></label>
          </div>
          <div className="dj-fields-grid dj-review-grid">
            <label className="dj-field dj-span-2"><span>End-of-day review</span><textarea rows="3" value={entry.review || ''} onChange={(event) => update('review', event.target.value)} placeholder="What went well? What would you change?" /></label>
            <label className="dj-field dj-span-2"><span>Lesson to carry forward</span><textarea rows="2" value={entry.lesson || ''} onChange={(event) => update('lesson', event.target.value)} placeholder="One thing to remember next session…" /></label>
          </div>
          <div className="dj-rating"><strong>Rate this session</strong><div role="radiogroup" aria-label="Session rating">{[1, 2, 3, 4, 5].map((rating) => <button type="button" role="radio" aria-checked={Number(entry.rating) === rating} aria-label={`${rating} out of 5`} key={rating} className={Number(entry.rating) >= rating ? 'filled' : ''} onClick={() => update('rating', rating)}>★</button>)}</div><span>{entry.rating ? `${entry.rating} / 5` : 'Not rated'}</span></div>
        </section>
        <section className="dj-card dj-wellbeing">
          <div className="dj-section-heading"><div><h2>Mind &amp; body</h2><p>Notice the inputs behind your decisions</p></div></div>
          <div className="dj-wellbeing-grid"><div><strong>Mood</strong><div className="dj-moods">{moods.map((mood) => <button key={mood} aria-label={`Mood: ${moodNames[mood]}`} aria-pressed={entry.mood === mood} className={entry.mood === mood ? 'selected' : ''} onClick={() => update('mood', mood)}><span>{mood}</span><small>{moodNames[mood]}</small></button>)}</div></div><label className="dj-field"><span>Energy · {entry.energy || 3} / 5</span><input type="range" min="1" max="5" value={entry.energy || 3} onChange={(event) => update('energy', Number(event.target.value))} /></label><label className="dj-field"><span>Sleep (hours)</span><input type="number" min="0" max="24" step=".5" value={entry.sleep || ''} onChange={(event) => update('sleep', event.target.value)} placeholder="e.g. 7.5" /></label></div>
          <button type="button" className={`dj-follow ${entry.followedPlan ? 'checked' : ''}`} aria-pressed={!!entry.followedPlan} onClick={() => update('followedPlan', !entry.followedPlan)}><span>{entry.followedPlan && <Check size={15} />}</span>I followed my trading plan today</button>
        </section>
        <section className="dj-card dj-label-card">
          <div className="dj-section-heading"><div><h2>Tags &amp; mistakes</h2><p>Spot patterns across your sessions</p></div></div>
          <div className="dj-choice-group"><strong>Setup tags</strong><div className="dj-chips">{[...new Set([...tags, ...(entry.tags || [])])].map((tag) => <button key={tag} className={(entry.tags || []).includes(tag) ? 'selected' : ''} aria-pressed={(entry.tags || []).includes(tag)} onClick={() => toggleChoice('tags', tag)}>{tag}</button>)}</div><div className="dj-add-chip"><input aria-label="Add custom tag" value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addCustom('tags', customTag, setCustomTag)} placeholder="Add a custom tag" /><button onClick={() => addCustom('tags', customTag, setCustomTag)}>Add</button></div></div>
          <div className="dj-choice-group"><strong>Mistakes to learn from</strong><div className="dj-chips dj-mistakes">{[...new Set([...mistakes, ...(entry.mistakes || [])])].map((mistake) => <button key={mistake} className={(entry.mistakes || []).includes(mistake) ? 'selected' : ''} aria-pressed={(entry.mistakes || []).includes(mistake)} onClick={() => toggleChoice('mistakes', mistake)}>{mistake}</button>)}</div><div className="dj-add-chip"><input aria-label="Add custom mistake" value={customMistake} onChange={(event) => setCustomMistake(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addCustom('mistakes', customMistake, setCustomMistake)} placeholder="Add a custom mistake" /><button onClick={() => addCustom('mistakes', customMistake, setCustomMistake)}>Add</button></div></div>
        </section>
        <section className="dj-card dj-attachments">
          <div className="dj-section-heading"><div><h2>Session images</h2><p>Images are resized to 1200px max before saving.</p></div><label className="dj-upload"><ImagePlus size={16} /> Add images<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={imageBusy} onChange={(event) => { void attachImages(event.target.files); event.target.value = '' }} /></label></div>
          {imageStatus && <p className="dj-image-status" role="status">{imageStatus}{retryImage && <button type="button" className="dj-text-button" onClick={() => void uploadAttachment(retryImage.file, retryImage.date, retryImage.index)}>Retry</button>}</p>}
          {imageBusy && <p className="dj-image-status" role="status">Uploading image…</p>}
          {entry.images?.length ? <div className="dj-image-grid">{entry.images.map((image, index) => <figure key={`${selected}-${index}`}><JournalImage path={image} alt={`Journal attachment ${index + 1}`} /><button aria-label={`Remove image ${index + 1}`} onClick={() => void removeJournalImage(image)}><X size={15} /></button></figure>)}</div> : <div className="dj-empty-image"><ImagePlus size={20} /><span>No images attached to this day.</span></div>}
        </section>
        <section className="dj-card dj-equity">
          <div className="dj-section-heading"><div><h2>Equity curve</h2><p>Running P&amp;L across all trade days</p></div></div>
          {equity.length ? <div className="dj-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equity} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><defs><linearGradient id="dj-equity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.25} /><stop offset="100%" stopColor="#6c5ce7" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 14 }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis tickFormatter={axisCurrency} tick={{ fill: 'var(--muted)', fontSize: 14 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [currency(value), 'Equity']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)' }} /><Area type="monotone" dataKey="balance" stroke="#6c5ce7" fill="url(#dj-equity-fill)" /></AreaChart></ResponsiveContainer></div> : <div className="dj-empty-state"><CalendarDays size={22} /><strong>Your equity curve starts with your first trade</strong><span>No trade data to chart yet. No phantom returns here.</span></div>}
        </section>
        <section className="dj-card dj-weekly">
          <div className="dj-section-heading"><div><h2>Weekly review</h2><p>{format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}</p></div><div className="dj-header-actions"><Link className="dj-text-button" to={`/weekly-review?week=${weekKey}`}>Full weekly report</Link><button className="dj-text-button" onClick={() => print('week')}><Printer size={15} /> Print week</button></div></div>
          <div className="dj-week-stats"><div><span>Net P&amp;L</span><strong className={weeklyPnl > 0 ? 'profit' : weeklyPnl < 0 ? 'loss' : ''}>{currency(weeklyPnl)}</strong></div><div><span>Trades</span><strong>{weeklyTrades.length}</strong></div><div><span>Win rate</span><strong>{percent(weeklyTrades.length ? weeklyWins / weeklyTrades.length * 100 : 0)}</strong></div><div><span>Journal days</span><strong>{weekEntries.length}</strong></div><div><span>Avg. rating</span><strong>{weeklyRatings.length ? `${(weeklyRatings.reduce((sum, value) => sum + value, 0) / weeklyRatings.length).toFixed(1)} / 5` : '—'}</strong></div><div><span>Best day</span><strong className="profit">{weeklyDailyPnl.length ? `${format(safeDate(weeklyDailyPnl[0][0]), 'MMM d')} · ${currency(weeklyDailyPnl[0][1])}` : '—'}</strong></div><div><span>Worst day</span><strong className="loss">{weeklyDailyPnl.length ? `${format(safeDate(weeklyDailyPnl[weeklyDailyPnl.length - 1][0]), 'MMM d')} · ${currency(weeklyDailyPnl[weeklyDailyPnl.length - 1][1])}` : '—'}</strong></div><div><span>Most common mistake</span><strong>{mostCommonMistake ? `${mostCommonMistake[0]} · ${mostCommonMistake[1]}` : '—'}</strong></div><div><span>Discipline score</span><strong>{disciplineScore === null ? '—' : percent(disciplineScore)}</strong></div></div>
          <label className="dj-field"><span>Weekly lesson</span><textarea rows="3" value={journal[weekKey]?.weeklyLesson || ''} onChange={(event) => updateDate(weekKey, 'weeklyLesson', event.target.value)} placeholder="What pattern or lesson will shape next week?" /></label>
        </section>
        <section className="dj-card dj-goals">
          <div className="dj-section-heading"><div><h2>Monthly goals</h2><p>Progress for {format(new Date(), 'MMMM yyyy')}</p></div><button className="dj-text-button" onClick={() => setGoalEditor(!goalEditor)}><Settings2 size={15} /> Set goals</button></div>
          {goalEditor && <div className="dj-goal-editor"><label>Monthly P&amp;L target ($)<input type="number" value={goals.pnl || ''} onChange={(event) => updateDate(today, 'goals', { ...goals, pnl: event.target.value })} placeholder="e.g. 2000" /></label><label>Monthly win-rate target (%)<input type="number" min="0" max="100" value={goals.winRate || ''} onChange={(event) => updateDate(today, 'goals', { ...goals, winRate: event.target.value })} placeholder="e.g. 60" /></label><button onClick={() => setGoalEditor(false)}>Done</button></div>}
          <div className="dj-goal-grid">{[['Monthly P&L', monthPnl, Number(goals.pnl) || 0, currency], ['Monthly win rate', monthWinRate, Number(goals.winRate) || 0, (value) => percent(value)]].map(([label, currentValue, target, formatValue]) => <div className="dj-goal-progress" key={label}><div><span>{label}</span><strong>{formatValue(currentValue)} <small>/ {target ? formatValue(target) : 'Set a goal'}</small></strong><small className="dj-goal-percent">{target > 0 ? `${Math.round(Math.min(100, Math.max(0, currentValue / target * 100)))}%` : '0%'} of goal</small></div><div className="dj-progress"><span style={{ width: `${target > 0 ? Math.min(100, Math.max(0, currentValue / target * 100)) : 0}%` }} /></div></div>)}</div>
        </section>
        <section className="dj-card dj-report">
          <div className="dj-section-heading"><div><h2>Pattern cost report</h2><p>Frequency and associated day P&amp;L from your tagged sessions</p></div></div>
          {Object.keys(taggedTrades).length || Object.keys(mistakeTrades).length ? <div className="dj-report-grid"><div><h3>Tags</h3>{Object.entries(taggedTrades).map(([name, item]) => <div className="dj-report-row" key={name}><span>{name}<small>{item.count} {item.count === 1 ? 'day' : 'days'}</small></span><strong className={item.pnl > 0 ? 'profit' : item.pnl < 0 ? 'loss' : ''}>{currency(item.pnl)}</strong></div>)}</div><div><h3>Mistakes</h3>{Object.entries(mistakeTrades).map(([name, item]) => <div className="dj-report-row" key={name}><span>{name}<small>{item.count} {item.count === 1 ? 'day' : 'days'}</small></span><strong className={item.pnl > 0 ? 'profit' : item.pnl < 0 ? 'loss' : ''}>{currency(item.pnl)}</strong></div>)}{Object.keys(mistakeTrades).length > 0 && <div className="dj-mistake-chart-wrap"><h3>Mistake frequency</h3><div className="dj-mistake-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(mistakeTrades).map(([name, item]) => ({ name, count: item.count }))} layout="vertical" margin={{ top: 2, right: 12, left: 4, bottom: 2 }}><CartesianGrid stroke="var(--line)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 14 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={95} tick={{ fill: 'var(--muted)', fontSize: 14 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value} ${value === 1 ? 'day' : 'days'}`, 'Frequency']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }} /><Bar dataKey="count" fill="#e58365" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>}</div></div> : <div className="dj-empty-state"><Search size={22} /><strong>Patterns appear here as you journal</strong><span>Add tags and mistakes to your entries to see frequency and associated P&amp;L.</span></div>}
        </section>
      </div>
    </div>
  </main>
}
