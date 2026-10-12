import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format, getDay, isSameMonth, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { calendarDays, currency } from '../utils/trading'

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target)
  const previous = useRef(target)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previous.current = target
      setValue(target)
      return undefined
    }

    const from = previous.current
    const startedAt = performance.now()
    let frame
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      setValue(from + (target - from) * eased)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
      else previous.current = target
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, target])

  return value
}

export default function PnLCalendar({ trades }) {
  const safeTrades = Array.isArray(trades) ? trades : []
  const [month, setMonth] = useState(new Date())
  const [direction, setDirection] = useState('next')
  const navigate = useNavigate()
  const { days, grouped } = useMemo(() => calendarDays(safeTrades, month), [safeTrades, month])
  const weeks = []
  let current = Array(getDay(days[0])).fill(null)
  days.forEach((day) => {
    current.push(day)
    if (current.length === 7) { weeks.push(current); current = [] }
  })
  if (current.length) weeks.push([...current, ...Array(7 - current.length).fill(null)])
  const weekly = weeks.map((week) => week.reduce((summary, day) => {
    if (!day) return summary
    const tradesForDay = grouped.get(format(day, 'yyyy-MM-dd')) || []
    const wins = tradesForDay.filter((trade) => Number(trade.pnl) > 0).length
    const losses = tradesForDay.filter((trade) => Number(trade.pnl) < 0).length
    return {
      pnl: summary.pnl + tradesForDay.reduce((total, trade) => total + (Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0), 0),
      trades: summary.trades + tradesForDay.length,
      totalTrades: summary.totalTrades + tradesForDay.length,
      days: summary.days + Number(tradesForDay.length > 0),
      wins: summary.wins + wins,
      losses: summary.losses + losses,
    }
  }, { pnl: 0, trades: 0, totalTrades: 0, days: 0, wins: 0, losses: 0 }))
  const monthlyTotal = weekly.reduce((sum, week) => sum + week.pnl, 0)
  const monthlyWins = weekly.reduce((sum, week) => sum + week.wins, 0)
  const monthlyLosses = weekly.reduce((sum, week) => sum + week.losses, 0)
  const monthlyTrades = weekly.reduce((sum, week) => sum + week.totalTrades, 0)
  const tradingDays = weekly.reduce((sum, week) => sum + week.days, 0)
  const profitableDays = days.filter((day) => {
    const dayTrades = grouped.get(format(day, 'yyyy-MM-dd')) || []
    return dayTrades.reduce((sum, trade) => sum + (Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0), 0) > 0
  }).length
  const maxDailyPnl = Math.max(1, ...days.map((day) => Math.abs((grouped.get(format(day, 'yyyy-MM-dd')) || []).reduce((sum, trade) => sum + (Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0), 0))))
  const animatedMonthlyTotal = useCountUp(monthlyTotal)
  const changeMonth = (amount) => {
    setDirection(amount < 0 ? 'previous' : 'next')
    setMonth((value) => addMonths(value, amount))
  }
  return <section className="panel calendar-panel">
    <div className="panel-heading calendar-heading"><div><h2>P&L calendar</h2><p>Your day-by-day performance at a glance</p></div><div className="month-nav"><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><button type="button" className="month-current" onClick={() => { setDirection('next'); setMonth(new Date()) }} title="Jump to this month">{format(month, 'MMMM yyyy')}</button><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div></div>
    <div className="calendar-performance-summary" aria-label={`${format(month, 'MMMM yyyy')} performance summary`}>
      <div><span>Win rate</span><strong>{monthlyTrades ? `${Math.round(monthlyWins / monthlyTrades * 100)}%` : '—'}</strong></div>
      <div><span>Trade results</span><strong>{monthlyTrades ? <>{monthlyWins}W <i>·</i> {monthlyLosses}L</> : '—'}</strong></div>
      <div><span>Profitable days</span><strong>{tradingDays ? <>{profitableDays} <i>/</i> {tradingDays}</> : '—'}</strong></div>
      <div className="calendar-performance-legend"><span><i className="calendar-legend-dot is-profit" />Winning day</span><span><i className="calendar-legend-dot is-loss" />Losing day</span></div>
    </div>
    <div className="calendar-layout"><div key={format(month, 'yyyy-MM')} className={`calendar-main calendar-slide-${direction}`}>
      <div className="calendar-grid calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}<span className="calendar-week-label">Week · Net P&L</span></div>
      {weeks.map((week, weekIndex) => <div className="calendar-grid calendar-week-row" key={weekIndex}>{week.map((day, index) => {
        const tradesForDay = day ? grouped.get(format(day, 'yyyy-MM-dd')) || [] : []
        const pnl = tradesForDay.reduce((sum, trade) => sum + (Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0), 0)
        const profit = pnl > 0
        const loss = pnl < 0
        const wins = tradesForDay.filter((trade) => Number(trade.pnl) > 0).length
        const losses = tradesForDay.filter((trade) => Number(trade.pnl) < 0).length
        const tradeWinRate = tradesForDay.length ? Math.round(wins / tradesForDay.length * 100) : 0
        const intensity = tradesForDay.length ? Math.round(8 + Math.abs(pnl) / maxDailyPnl * 24) : 0
        const dateLabel = day ? format(day, 'EEEE, MMMM d, yyyy') : ''
        return day ? <button
          key={format(day, 'yyyy-MM-dd')}
          type="button"
          className={`calendar-cell calendar-day ${getDay(day) === 0 || getDay(day) === 6 ? 'calendar-weekend' : ''} ${tradesForDay.length ? (profit ? 'calendar-profit' : loss ? 'calendar-loss' : '') : ''} ${!isSameMonth(day, month) ? 'calendar-muted' : ''} ${isToday(day) ? 'calendar-today' : ''}`}
          style={{ '--pnl-tint': `${intensity}%`, '--calendar-delay': `${(weekIndex * 7 + index) * 8}ms` }}
          aria-label={`${dateLabel}${tradesForDay.length ? `, ${currency(pnl)}, ${tradesForDay.length} trades, ${wins} wins, ${losses} losses, ${tradeWinRate}% win rate` : ', no trades'}`}
          onClick={() => navigate(`/journal?date=${format(day, 'yyyy-MM-dd')}`)}
        >
          <span className="calendar-date">{format(day, 'd')}</span>
          {tradesForDay.length > 0 && <><strong className={profit ? 'profit' : loss ? 'loss' : ''}>{currency(pnl)}</strong><small>{tradesForDay.length} {tradesForDay.length === 1 ? 'trade' : 'trades'}</small><small className="calendar-day-win-loss"><span>{wins}W</span><i>·</i><span>{losses}L</span><b>{tradeWinRate}%</b></small></>}
        </button> : <div key={`blank-${weekIndex}-${index}`} className="calendar-cell calendar-blank" aria-hidden="true" />
      })}<div className="calendar-week-total">
        <span>Week {weekIndex + 1}</span>
        <strong className={weekly[weekIndex].pnl > 0 ? 'profit' : weekly[weekIndex].pnl < 0 ? 'loss' : ''}>{safeTrades.length ? currency(weekly[weekIndex].pnl) : '—'}</strong>
        <small>{weekly[weekIndex].trades} {weekly[weekIndex].trades === 1 ? 'trade' : 'trades'}</small>
        <small className="calendar-week-detail">{weekly[weekIndex].days} active {weekly[weekIndex].days === 1 ? 'day' : 'days'}{weekly[weekIndex].trades ? ` · ${Math.round(weekly[weekIndex].wins / weekly[weekIndex].totalTrades * 100)}% wins` : ''}</small>
      </div></div>)}
      <div className="calendar-month-total"><span>Month total</span><strong className={monthlyTotal > 0 ? 'profit' : monthlyTotal < 0 ? 'loss' : ''}>{safeTrades.length ? currency(animatedMonthlyTotal) : 'No data yet'}</strong><small>{monthlyTrades ? `${monthlyWins} wins · ${monthlyLosses} losses across ${tradingDays} trading days` : 'No trades recorded this month'}</small></div>
    </div></div>
  </section>
}
