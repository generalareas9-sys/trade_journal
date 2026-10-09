import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { calculateStats, currency, percent } from '../utils/trading'
import '../print-report.css'

const safePnl = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0

export default function PrintableReport({ trades = [], periodLabel, disabled = false }) {
  const stats = useMemo(() => calculateStats(trades), [trades])
  const days = useMemo(() => {
    const totals = new Map()
    trades.forEach((trade) => {
      if (typeof trade.date !== 'string' || Number.isNaN(Date.parse(`${trade.date}T12:00:00`))) return
      totals.set(trade.date, (totals.get(trade.date) || 0) + safePnl(trade))
    })
    return [...totals.entries()].sort(([first], [second]) => first.localeCompare(second))
  }, [trades])
  const equity = useMemo(() => {
    let cumulative = 0
    return days.map(([date, pnl]) => {
      cumulative += pnl
      return { date, cumulative }
    })
  }, [days])
  const mistakes = useMemo(() => {
    const totals = new Map()
    trades.forEach((trade) => {
      const values = Array.isArray(trade.mistakes)
        ? trade.mistakes
        : typeof trade.mistakes === 'string' && trade.mistakes.trim()
          ? [trade.mistakes.trim()]
          : []
      const pnl = safePnl(trade)
      new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())).forEach((name) => {
        const current = totals.get(name) || { name, count: 0, pnl: 0 }
        current.count += 1
        current.pnl += pnl
        totals.set(name, current)
      })
    })
    return [...totals.values()].sort((first, second) => second.count - first.count || first.pnl - second.pnl).slice(0, 5)
  }, [trades])
  const bestDay = days.reduce((best, current) => !best || current[1] > best[1] ? current : best, null)
  const worstDay = days.reduce((worst, current) => !worst || current[1] < worst[1] ? current : worst, null)
  const maxAbs = Math.max(1, ...equity.map((point) => Math.abs(point.cumulative)))
  const equityPath = equity.length < 2 ? '' : equity.map((point, index) => {
    const x = (index / (equity.length - 1)) * 100
    const y = 42 - (point.cumulative / maxAbs) * 34
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  function exportPdf() {
    const root = document.documentElement
    const cleanup = () => root.classList.remove('pr-printing')
    root.classList.add('pr-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.requestAnimationFrame(() => window.print())
  }

  return <>
    <button type="button" className="pr-export-button" onClick={exportPdf} disabled={disabled}>
      <Printer size={16} aria-hidden="true" />Export PDF report
    </button>
    <section className="pr-sheet" aria-hidden="true">
      <header className="pr-header">
        <div><span>TRADEJOURNAL · PERFORMANCE SUMMARY</span><h1>Trading report</h1><p>{periodLabel}</p></div>
        <strong>{format(new Date(), 'MMM d, yyyy')}</strong>
      </header>
      <div className="pr-metrics">
        <div><span>Net P&amp;L</span><strong className={stats.netPnl > 0 ? 'pr-positive' : stats.netPnl < 0 ? 'pr-negative' : ''}>{currency(stats.netPnl)}</strong></div>
        <div><span>Win rate</span><strong>{percent(stats.winRate)}</strong></div>
        <div><span>Profit factor</span><strong>{Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—'}</strong></div>
        <div><span>Trades</span><strong>{stats.trades}</strong></div>
      </div>
      <div className="pr-days">
        <div><span>Best day</span><strong>{bestDay ? `${format(parseISO(bestDay[0]), 'MMM d')} · ${currency(bestDay[1])}` : '—'}</strong></div>
        <div><span>Worst day</span><strong>{worstDay ? `${format(parseISO(worstDay[0]), 'MMM d')} · ${currency(worstDay[1])}` : '—'}</strong></div>
      </div>
      <section className="pr-chart-section">
        <div><h2>Equity curve</h2><p>Cumulative net P&amp;L by trading day</p></div>
        {equity.length ? <svg className="pr-equity-chart" viewBox="0 0 100 50" role="img" aria-label="Cumulative net P&L equity curve">
          <path d="M 0 42 H 100" className="pr-zero-line" />
          {equityPath && <path d={equityPath} className="pr-equity-line" />}
          <text x="0" y="49">{format(parseISO(equity[0].date), 'MMM d')}</text>
          <text x="100" y="49" textAnchor="end">{format(parseISO(equity[equity.length - 1].date), 'MMM d')}</text>
        </svg> : <p className="pr-empty">No trades in this period.</p>}
      </section>
      <section className="pr-mistakes-section">
        <div><h2>Top mistakes</h2><p>Ranked by frequency · values show associated net P&amp;L</p></div>
        {mistakes.length ? <ol>{mistakes.map((mistake) => <li key={mistake.name}><span><strong>{mistake.name}</strong><small>{mistake.count} {mistake.count === 1 ? 'trade' : 'trades'}</small></span><b className={mistake.pnl > 0 ? 'pr-positive' : mistake.pnl < 0 ? 'pr-negative' : ''}>{currency(mistake.pnl)}</b></li>)}</ol> : <p className="pr-empty">No mistakes have been tagged.</p>}
      </section>
      <footer>Calculator and report only. Not financial advice.</footer>
    </section>
  </>
}
