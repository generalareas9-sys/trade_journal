import { useMemo, useState } from 'react'
import { addWeeks, eachDayOfInterval, endOfWeek, format, isValid, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Printer, TrendingUp } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useJournal } from '../hooks/useJournal'
import { calculateStats, currency, percent } from '../utils/trading'
import { EmptyState } from '../components/UiElements'
import PrintableReport from '../components/PrintableReport'
import '../weekly-review.css'

const disciplineFields = [
  { key: 'followedRules', label: 'Followed trading rules' },
  { key: 'preAnalysis', label: 'Preparation completed' },
  { key: 'entryConditionMet', label: 'Entry condition met' },
]
const moodValues = new Map([['😞', 1], ['😐', 2], ['🙂', 3], ['😄', 4], ['🔥', 5]])
const moodLabels = ['😞', '😐', '🙂', '😄', '🔥']
const validDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00`))
const weekFromQuery = (value) => {
  const parsed = parseISO(value || '')
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
    ? startOfWeek(parsed, { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 })
}
const safePnl = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0
const fieldCounts = (trades, field) => {
  const answered = trades.filter((trade) => trade[field] === 'Yes' || trade[field] === 'No')
  return { yes: answered.filter((trade) => trade[field] === 'Yes').length, answered: answered.length }
}
const hasDailyJournalEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return false
  return Object.entries(entry).some(([key, value]) => {
    if (['date', 'weeklyLesson', 'mood', 'energy', 'followedPlan'].includes(key)) return false
    if (Array.isArray(value)) return value.length > 0
    if (key === 'rating') return Number(value) > 0
    return Boolean(value)
  }) || entry.mood && entry.mood !== '🙂' || Number(entry.energy) > 3 || entry.followedPlan === true
}

function MetricCard({ label, value, detail, className = '' }) {
  return <article className="wr-card wr-metric">
    <span>{label}</span>
    <strong className={className}>{value}</strong>
    {detail && <small>{detail}</small>}
  </article>
}

export default function WeeklyReview() {
  const { trades = [], journal = {}, setJournal, notify } = useJournal()
  const [searchParams] = useSearchParams()
  const [weekStart, setWeekStart] = useState(() => weekFromQuery(searchParams.get('week')))
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const startKey = format(weekStart, 'yyyy-MM-dd')
  const endKey = format(weekEnd, 'yyyy-MM-dd')
  const lastWeekStart = subWeeks(weekStart, 1)
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 })
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])
  const weekTrades = useMemo(() => trades.filter((trade) => validDay(trade.date) && trade.date >= startKey && trade.date <= endKey), [trades, startKey, endKey])
  const lastWeekTrades = useMemo(() => trades.filter((trade) => validDay(trade.date) && trade.date >= format(lastWeekStart, 'yyyy-MM-dd') && trade.date <= format(lastWeekEnd, 'yyyy-MM-dd')), [trades, lastWeekStart, lastWeekEnd])
  const stats = useMemo(() => calculateStats(weekTrades), [weekTrades])
  const lastWeekStats = useMemo(() => calculateStats(lastWeekTrades), [lastWeekTrades])
  const weekKey = startKey
  const weekJournal = days.map((day) => journal[format(day, 'yyyy-MM-dd')]).filter(hasDailyJournalEntry)
  const moods = weekJournal.map((entry) => moodValues.get(entry.mood)).filter(Number.isFinite)
  const averageMood = moods.length ? moods.reduce((sum, value) => sum + value, 0) / moods.length : null
  const mistakeCounts = weekTrades.flatMap((trade) => Array.isArray(trade.mistakes) ? trade.mistakes : typeof trade.mistakes === 'string' && trade.mistakes ? [trade.mistakes] : [])
    .reduce((counts, mistake) => ({ ...counts, [mistake]: (counts[mistake] || 0) + 1 }), {})
  const commonMistake = Object.entries(mistakeCounts).sort((first, second) => second[1] - first[1])[0]
  const dailyChart = useMemo(() => {
    const totals = new Map()
    weekTrades.forEach((trade) => totals.set(trade.date, (totals.get(trade.date) || 0) + safePnl(trade)))
    let cumulative = 0
    return days.map((day) => {
      const date = format(day, 'yyyy-MM-dd')
      const pnl = totals.get(date) || 0
      cumulative += pnl
      return { date, day: format(day, 'EEE'), pnl, cumulative }
    })
  }, [days, weekTrades])
  const bestDay = stats.bestDay
  const worstDay = stats.worstDay
  const lesson = journal[weekKey]?.weeklyLesson || ''

  function saveLesson(value) {
    setJournal((current) => ({
      ...current,
      [weekKey]: { ...(current[weekKey] || {}), weeklyLesson: value },
    }))
  }

  function summaryText() {
    const startLabel = format(weekStart, 'MMM d')
    const endLabel = format(weekEnd, 'MMM d, yyyy')
    const lines = [
      `Weekly review · ${startLabel}–${endLabel}`,
      `Net P&L: ${currency(stats.netPnl)}`,
      `Trades: ${stats.trades}`,
      `Win rate: ${percent(stats.winRate)}`,
      `Profit factor: ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—'}`,
      `Average win: ${currency(stats.avgWin)}`,
      `Average loss: ${currency(-stats.avgLoss)}`,
      `Best day: ${bestDay ? `${format(new Date(`${bestDay[0]}T12:00:00`), 'EEEE')} · ${currency(bestDay[1])}` : '—'}`,
      `Worst day: ${worstDay ? `${format(new Date(`${worstDay[0]}T12:00:00`), 'EEEE')} · ${currency(worstDay[1])}` : '—'}`,
      `Journal days: ${weekJournal.length}`,
      `Average mood: ${averageMood === null ? '—' : `${averageMood.toFixed(1)} / 5`}`,
      `Most common mistake: ${commonMistake ? `${commonMistake[0]} (${commonMistake[1]})` : '—'}`,
      `Lesson of the week: ${lesson.trim() || '—'}`,
    ]
    disciplineFields.forEach(({ key, label }) => {
      const counts = fieldCounts(weekTrades, key)
      lines.push(`${label}: ${counts.yes} of ${counts.answered || 0} recorded`)
    })
    return lines.join('\n')
  }

  async function copySummary() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
      await navigator.clipboard.writeText(summaryText())
      notify('Weekly summary copied to clipboard.')
    } catch (error) {
      notify(`Could not copy weekly summary: ${error.message || 'Clipboard access failed.'}`)
    }
  }

  const compareAvailable = lastWeekTrades.length > 0
  const pnlChange = stats.netPnl - lastWeekStats.netPnl
  const winRateChange = stats.winRate - lastWeekStats.winRate

  return <div className="page-content wr-page">
    <header className="wr-header">
      <div>
        <span className="wr-eyebrow">WEEKLY PERFORMANCE</span>
        <h2>Weekly review</h2>
        <p>Review your trades, discipline, and takeaways for the week.</p>
      </div>
      <div className="wr-actions">
        <PrintableReport trades={weekTrades} periodLabel={`Week · ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`} />
        <button type="button" className="wr-button" onClick={() => window.print()}><Printer size={16} />Print / Save as PDF</button>
        <button type="button" className="wr-button wr-primary-button" onClick={() => void copySummary()}><Copy size={16} />Copy summary</button>
      </div>
    </header>

    <section className="wr-week-picker" aria-label="Choose review week">
      <div className="wr-week-arrows">
        <button type="button" className="wr-icon-button" aria-label="Previous week" onClick={() => setWeekStart((current) => subWeeks(current, 1))}><ChevronLeft size={18} /></button>
        <button type="button" className="wr-icon-button" aria-label="Next week" onClick={() => setWeekStart((current) => addWeeks(current, 1))}><ChevronRight size={18} /></button>
      </div>
      <strong><CalendarDays size={17} />{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</strong>
      <button type="button" className="wr-button wr-this-week" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This week</button>
    </section>

    {!weekTrades.length && <section className="wr-empty panel"><EmptyState icon={TrendingUp} title="No trades this week" description="There are no recorded trades for this week. Choose another week or log a trade to see your performance summary." /></section>}

    <section className="wr-metrics" aria-label="Weekly trading summary">
      <MetricCard label="Net P&L" value={currency(stats.netPnl)} detail={`${stats.trades} ${stats.trades === 1 ? 'trade' : 'trades'}`} className={stats.netPnl > 0 ? 'profit' : stats.netPnl < 0 ? 'loss' : ''} />
      <MetricCard label="Trades" value={stats.trades.toLocaleString()} />
      <MetricCard label="Win rate" value={percent(stats.winRate)} detail={`${stats.wins} wins · ${stats.losses} losses`} />
      <MetricCard label="Profit factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—'} />
      <MetricCard label="Average win" value={currency(stats.avgWin)} className={stats.avgWin > 0 ? 'profit' : ''} />
      <MetricCard label="Average loss" value={currency(-stats.avgLoss)} className={stats.avgLoss > 0 ? 'loss' : ''} />
      <MetricCard label="Best day" value={bestDay ? currency(bestDay[1]) : '—'} detail={bestDay ? format(new Date(`${bestDay[0]}T12:00:00`), 'EEEE') : ''} className={bestDay && bestDay[1] > 0 ? 'profit' : ''} />
      <MetricCard label="Worst day" value={worstDay ? currency(worstDay[1]) : '—'} detail={worstDay ? format(new Date(`${worstDay[0]}T12:00:00`), 'EEEE') : ''} className={worstDay && worstDay[1] < 0 ? 'loss' : ''} />
    </section>

    <section className="wr-chart-grid">
      <article className="wr-card wr-chart-card">
        <div className="wr-section-heading"><div><h3>Daily P&amp;L</h3><p>Net results for each day of the week</p></div></div>
        <div className="wr-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChart} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => currency(value)} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)' }} formatter={(value) => [currency(value), 'Net P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{dailyChart.map((day) => <Cell key={day.date} fill={day.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="wr-card wr-chart-card">
        <div className="wr-section-heading"><div><h3>Weekly equity curve</h3><p>Cumulative P&amp;L from Monday onward</p></div></div>
        <div className="wr-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyChart} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => currency(value)} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)' }} formatter={(value) => [currency(value), 'Cumulative P&L']} />
              <Line type="monotone" dataKey="cumulative" stroke="#6c5ce7" strokeWidth={2.5} dot={{ r: 3, fill: '#6c5ce7' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>

    <section className="wr-card wr-discipline">
      <div className="wr-section-heading"><div><h3>Discipline</h3><p>Trade process answers recorded this week</p></div></div>
      <div className="wr-discipline-grid">
        {disciplineFields.map(({ key, label }) => {
          const counts = fieldCounts(weekTrades, key)
          return <div className="wr-discipline-item" key={key}><span>{label}</span><strong>{counts.answered ? `${counts.yes} / ${counts.answered}` : '—'}</strong><small>{counts.answered ? 'trades followed this process' : 'No responses recorded'}</small></div>
        })}
        <div className="wr-discipline-item"><span>Most common mistake</span><strong>{commonMistake?.[0] || '—'}</strong><small>{commonMistake ? `${commonMistake[1]} ${commonMistake[1] === 1 ? 'trade' : 'trades'}` : 'No mistakes recorded'}</small></div>
      </div>
    </section>

    <section className="wr-card wr-journal">
      <div className="wr-section-heading"><div><h3>Journal &amp; reflection</h3><p>Daily entries and your lesson for next week</p></div></div>
      <div className="wr-journal-stats">
        <div><span>Days with an entry</span><strong>{weekJournal.length} / 7</strong></div>
        <div><span>Average mood</span><strong>{averageMood === null ? '—' : `${averageMood.toFixed(1)} / 5`}</strong><small>{averageMood === null ? 'No mood ratings recorded' : `${moodLabels[Math.max(0, Math.min(4, Math.round(averageMood) - 1))]} average mood`}</small></div>
      </div>
      <label className="wr-lesson"><span>Lesson of the week</span><textarea rows="4" value={lesson} onChange={(event) => saveLesson(event.target.value)} placeholder="What pattern or lesson will shape next week?" /></label>
    </section>

    <section className="wr-card wr-compare">
      <div><h3>Compare with last week</h3><p>{format(lastWeekStart, 'MMM d')} – {format(lastWeekEnd, 'MMM d')}</p></div>
      {compareAvailable ? <div className="wr-compare-values">
        <div><span>P&amp;L change</span><strong className={pnlChange > 0 ? 'profit' : pnlChange < 0 ? 'loss' : ''}>{currency(pnlChange)}</strong><small>vs. {currency(lastWeekStats.netPnl)}</small></div>
        <div><span>Win rate change</span><strong className={winRateChange > 0 ? 'profit' : winRateChange < 0 ? 'loss' : ''}>{winRateChange > 0 ? '+' : ''}{winRateChange.toFixed(1)} pp</strong><small>vs. {percent(lastWeekStats.winRate)}</small></div>
      </div> : <p className="wr-no-comparison">No trades recorded last week to compare.</p>}
    </section>
  </div>
}
