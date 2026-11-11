import { Fragment, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, Clock3, Tag, TrendingUp } from 'lucide-react'
import { endOfMonth, endOfWeek, format, getDay, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { STRATEGIES } from '../data/mockData'
import { useJournal } from '../hooks/useJournal'
import { axisCurrency, calculateStats, currency, percent } from '../utils/trading'
import EdgeReports from '../components/EdgeReports'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/UiElements'
import { FileBarChart } from 'lucide-react'
import PrintableReport from '../components/PrintableReport'
import '../reports-additions.css'

const tabs = [
  'Overview',
  'Day of week',
  'Time of day',
  'Symbol',
  'Tag / strategy',
  'Win rate by session',
  'Win rate by management',
  'Win rate by followed rules',
  'Mistake cost',
  'Mistakes',
  'Psychology',
  'Edge',
]
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const chartAxis = { fill: 'var(--muted)', fontSize: 12, fontFamily: 'Inter' }

function groupedPsychologyTrades(trades, keyFor) {
  const groups = new Map()
  trades.forEach((trade) => {
    const raw = keyFor(trade)
    const name = raw === null || raw === undefined || raw === '' ? 'Not recorded' : String(raw)
    groups.set(name, [...(groups.get(name) || []), trade])
  })
  return [...groups.entries()].map(([name, groupTrades]) => {
    const wins = groupTrades.filter((trade) => Number(trade.pnl) > 0).length
    const pnl = groupTrades.reduce((sum, trade) => sum + (Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0), 0)
    return { name, count: groupTrades.length, wins, pnl, winRate: groupTrades.length ? wins / groupTrades.length * 100 : 0 }
  }).sort((first, second) => second.pnl - first.pnl || second.count - first.count || first.name.localeCompare(second.name))
}

function mostCommonValue(trades, key) {
  const counts = new Map()
  trades.forEach((trade) => {
    const value = trade[key]
    if (value !== null && value !== undefined && String(value).trim()) counts.set(String(value), (counts.get(String(value)) || 0) + 1)
  })
  return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] || '—'
}

function averageSize(trades) {
  if (!trades.length) return '—'
  const values = trades.map((trade) => Number(trade.size ?? trade.quantity)).filter(Number.isFinite)
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : '—'
}

function PsychologyGroupTable({ title, trades, field }) {
  const rows = groupedPsychologyTrades(trades, (trade) => trade[field])
  return <section className="panel psychology-group">
    <div className="panel-heading"><div><h3>{title}</h3><p>Closed-trade win rate and net P&amp;L</p></div></div>
    {rows.length ? <div className="table-scroll"><table className="trades-table report-table"><thead><tr><th>{title}</th><th>Trades</th><th>Win rate</th><th className="align-right">Net P&amp;L</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.name}><tr><td>{row.name}</td><td>{row.count}</td><td>{percent(row.winRate)}</td><td className={`align-right pnl-cell ${row.pnl > 0 ? 'profit' : row.pnl < 0 ? 'loss' : ''}`}>{currency(row.pnl)}</td></tr>{row.count < 20 && <tr className="psychology-sample-row"><td colSpan="4">Small sample: fewer than 20 trades in this group.</td></tr>}</Fragment>)}</tbody></table></div> : <div className="chart-empty">No data yet</div>}
  </section>
}

function PsychologyReport({ trades }) {
  const stats = calculateStats(trades)
  const wins = trades.filter((trade) => Number(trade.pnl) > 0)
  const losses = trades.filter((trade) => Number(trade.pnl) < 0)
  const comparisonRows = [
    ['Average size', averageSize(wins), averageSize(losses)],
    ['Average hold time', wins.length ? `${Math.round(calculateStats(wins).avgHoldMinutes)} min` : '—', losses.length ? `${Math.round(calculateStats(losses).avgHoldMinutes)} min` : '—'],
    ['Most common session', mostCommonValue(wins, 'session'), mostCommonValue(losses, 'session')],
    ['Most common setup grade', mostCommonValue(wins, 'setupGrade'), mostCommonValue(losses, 'setupGrade')],
    ['Most common emotion before', mostCommonValue(wins, 'emotionBefore'), mostCommonValue(losses, 'emotionBefore')],
  ]
  const hourRows = groupedPsychologyTrades(trades.filter((trade) => Number.isFinite(new Date(trade.openedAt).getTime())), (trade) => `${String(new Date(trade.openedAt).getHours()).padStart(2, '0')}:00`)
  const weekdayRows = groupedPsychologyTrades(trades.filter((trade) => Number.isFinite(parseISO(trade.date).getTime())), (trade) => weekdays[getDay(parseISO(trade.date))])

  const compactTable = (title, rows) => <section className="panel psychology-group"><div className="panel-heading"><div><h3>{title}</h3><p>Trade count, win rate, and net P&amp;L</p></div></div>{rows.length ? <div className="table-scroll"><table className="trades-table report-table"><thead><tr><th>{title}</th><th>Trades</th><th>Win rate</th><th className="align-right">Net P&amp;L</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.name}><tr><td>{row.name}</td><td>{row.count}</td><td>{percent(row.winRate)}</td><td className={`align-right pnl-cell ${row.pnl > 0 ? 'profit' : row.pnl < 0 ? 'loss' : ''}`}>{currency(row.pnl)}</td></tr>{row.count < 20 && <tr className="psychology-sample-row"><td colSpan="4">Small sample: fewer than 20 trades in this group.</td></tr>}</Fragment>)}</tbody></table></div> : <div className="chart-empty">No data yet</div>}</section>

  return <div className="psychology-report">
    <section className="psychology-metrics" aria-label="Psychology performance summary">
      {[
        ['Expectancy', currency(stats.expectancy)],
        ['Max drawdown', currency(-stats.maxDrawdown)],
        ['Longest win streak', `${stats.maxWinStreak} trades`],
        ['Longest loss streak', `${stats.maxLossStreak} trades`],
      ].map(([label, value]) => <article className="panel report-stat" key={label}><span>{label}</span><strong>{trades.length ? value : '—'}</strong></article>)}
    </section>
    <div className="psychology-group-grid">
      <PsychologyGroupTable title="Emotion before" trades={trades} field="emotionBefore" />
      <PsychologyGroupTable title="Setup grade" trades={trades} field="setupGrade" />
      <PsychologyGroupTable title="Confidence level" trades={trades} field="confidence" />
      <PsychologyGroupTable title="Market condition" trades={trades} field="marketCondition" />
      <PsychologyGroupTable title="Timeframe" trades={trades} field="timeframe" />
      {compactTable('Performance by hour', hourRows)}
      {compactTable('Performance by weekday', weekdayRows)}
    </div>
    <section className="panel psychology-group"><div className="panel-heading"><div><h3>Wins vs losses</h3><p>Compare execution patterns between profitable and losing trades.</p></div></div><div className="table-scroll"><table className="trades-table report-table"><thead><tr><th>Measure</th><th>Wins</th><th>Losses</th></tr></thead><tbody>{comparisonRows.map(([label, winValue, lossValue]) => <tr key={label}><td>{label}</td><td>{winValue}</td><td>{lossValue}</td></tr>)}</tbody></table></div></section>
  </div>
}

export default function Reports() {
  const { trades: allTrades = [], filteredTrades: trades, stats, setAddTradeOpen, setEditingTrade } = useJournal()
  const [tab, setTab] = useState('Overview')
  const [printPeriod, setPrintPeriod] = useState('week')
  const [printDate, setPrintDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const grouping = useMemo(() => {
    const keyFor = (trade) => {
      if (tab === 'Win rate by session') return trade.session || 'Not recorded'
      if (tab === 'Win rate by management') return trade.management || 'Not recorded'
      if (tab === 'Win rate by followed rules') return trade.followedRules || 'Not recorded'
      if (tab === 'Day of week') return weekdays[getDay(parseISO(trade.date))]
      if (tab === 'Time of day') {
        const hour = new Date(trade.openedAt).getHours()
        return hour < 10 ? 'Morning' : hour < 14 ? 'Midday' : 'Afternoon'
      }
      if (tab === 'Symbol') return trade.symbol
      if (tab === 'Tag / strategy') return trade.strategy
      if (tab === 'Mistake cost') return (trade.mistakes || []).join(', ') || 'No mistake tagged'
      return trade.symbol
    }

    const groups = new Map()
    trades.forEach((trade) => {
      const names = tab === 'Mistake cost' && trade.mistakes?.length ? trade.mistakes : [keyFor(trade)]
      names.forEach((name) => groups.set(name, [...(groups.get(name) || []), trade]))
    })

    return [...groups.entries()].map(([name, values]) => ({ name, pnl: values.reduce((sum, trade) => sum + trade.pnl, 0), ...calculateStats(values) })).sort((a, b) => b.pnl - a.pnl)
  }, [tab, trades])

  const isWinRateReport = tab.startsWith('Win rate by ')
  const actualTabs = tab === 'Overview' ? 'Symbol' : tab
  const breakdownTitle = tab === 'Win rate by session'
    ? 'Session'
    : tab === 'Win rate by management'
      ? 'Management type'
      : tab === 'Win rate by followed rules'
        ? 'Followed rules'
        : tab === 'Tag / strategy'
          ? 'Strategy'
          : tab === 'Day of week'
            ? 'Day'
              : tab === 'Mistake cost'
                ? 'Mistake'
              : 'Category'
  const reportDimension = tab === 'Win rate by session'
    ? 'session'
    : tab === 'Win rate by management'
      ? 'management type'
      : tab === 'Win rate by followed rules'
        ? 'rule-following status'
        : tab.toLowerCase()

  const chartData = useMemo(() => {
    if (isWinRateReport) return grouping
    if (tab === 'Overview') return grouping.slice(0, 5)
    if (tab === 'Day of week') return weekdays.map((name) => grouping.find((item) => item.name === name) || { name, pnl: 0, trades: 0, winRate: 0, avgWin: 0 })
    return grouping
  }, [tab, grouping, isWinRateReport])

  const allWeekdays = useMemo(() => {
    const groups = weekdays.map((name) => ({ name, trades: trades.filter((trade) => weekdays[getDay(parseISO(trade.date))] === name) }))
    return groups.map(({ name, trades: items }) => ({ name, trades: items.length, pnl: items.reduce((sum, item) => sum + item.pnl, 0), ...calculateStats(items) }))
  }, [trades])
  const hourlyHeatmap = useMemo(() => Array.from({ length: 24 }, (_, hour) => {
    const items = trades.filter((trade) => new Date(trade.openedAt).getHours() === hour)
    return { hour, count: items.length, pnl: items.reduce((sum, trade) => sum + trade.pnl, 0) }
  }), [trades])

  const rows = !trades.length ? [] : tab === 'Day of week' ? allWeekdays : grouping
  const strategyCounts = STRATEGIES.map((name) => ({ name, count: trades.filter((trade) => trade.strategy === name).length }))
  const mostUsedStrategy = strategyCounts.sort((a, b) => b.count - a.count)[0] || { name: '—', count: 0 }
  const mistakeRows = useMemo(() => {
    const groups = new Map()
    trades.forEach((trade) => {
      const names = Array.isArray(trade.mistakes)
        ? trade.mistakes
        : typeof trade.mistakes === 'string' && trade.mistakes.trim()
          ? [trade.mistakes.trim()]
          : []
      const pnl = Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0
      new Set(names.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim())).forEach((name) => {
        const row = groups.get(name) || { name, frequency: 0, pnl: 0 }
        row.frequency += 1
        row.pnl += pnl
        groups.set(name, row)
      })
    })
    return [...groups.values()].sort((first, second) => first.pnl - second.pnl || second.frequency - first.frequency)
  }, [trades])
  const printReferenceDate = parseISO(printDate)
  const printStart = printPeriod === 'week'
    ? startOfWeek(printReferenceDate, { weekStartsOn: 1 })
    : startOfMonth(printReferenceDate)
  const printEnd = printPeriod === 'week'
    ? endOfWeek(printReferenceDate, { weekStartsOn: 1 })
    : endOfMonth(printReferenceDate)
  const printTrades = Number.isNaN(printReferenceDate.getTime())
    ? []
    : allTrades.filter((trade) => trade.date >= format(printStart, 'yyyy-MM-dd') && trade.date <= format(printEnd, 'yyyy-MM-dd'))
  const printLabel = Number.isNaN(printReferenceDate.getTime())
    ? 'Choose a valid date'
    : `${printPeriod === 'week' ? 'Week' : 'Month'} · ${format(printStart, 'MMM d')} – ${format(printEnd, 'MMM d, yyyy')}`

  const reportStats = [
    ['Total trades', stats.trades.toLocaleString(), 'All executions in selected range'],
    ['Win rate', percent(stats.winRate), `${stats.wins} winners · ${stats.losses} losers`],
    ['Average win', currency(stats.avgWin), 'Average profitable trade'],
    ['Average loss', currency(-stats.avgLoss), 'Average losing trade'],
    ['Largest win', currency(stats.largestWin), 'Best single trade'],
    ['Largest loss', currency(stats.largestLoss), 'Largest single loss'],
    ['Max drawdown', currency(-stats.maxDrawdown), 'Peak to trough'],
    ['Expectancy', currency(stats.expectancy), 'Average P&L per trade'],
    ['Avg hold time', `${Math.round(stats.avgHoldMinutes)} min`, 'Across all trades'],
    ['Best trading day', stats.bestDay ? `${format(new Date(`${stats.bestDay[0]}T12:00:00`), 'MMM d')} · ${currency(stats.bestDay[1])}` : '—', 'Highest calendar-day net P&L'],
    ['Worst trading day', stats.worstDay ? `${format(new Date(`${stats.worstDay[0]}T12:00:00`), 'MMM d')} · ${currency(stats.worstDay[1])}` : '—', 'Lowest calendar-day net P&L'],
    ['Max win streak', `${stats.maxWinStreak} trades`, 'Consecutive profitable trades'],
    ['Max loss streak', `${stats.maxLossStreak} trades`, 'Consecutive losing trades'],
  ]

  return <div className="page-content">
    <div className="rp-print-controls">
      <label><span>PDF period</span><select value={printPeriod} onChange={(event) => setPrintPeriod(event.target.value)}><option value="week">Week</option><option value="month">Month</option></select></label>
      <label><span>Choose a date in the period</span><input type="date" value={printDate} onChange={(event) => setPrintDate(event.target.value)} /></label>
      <PrintableReport trades={printTrades} periodLabel={printLabel} disabled={Number.isNaN(printReferenceDate.getTime())} />
    </div>
    {trades.length === 0 && <section className="panel page-empty-panel"><EmptyState icon={FileBarChart} title="Reports need a little history" description="Log or import trades to see your performance, patterns, and discipline insights." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => { setEditingTrade(null); setAddTradeOpen(true) }}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link></div>} /></section>}
    <div className="report-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
    <section className="report-summary-grid">{reportStats.map(([label, value, detail], index) => <div className="panel report-stat" key={label}><span>{label}</span><strong className={index === 2 ? 'profit' : index === 3 || index === 6 ? 'loss' : ''}>{stats.trades ? value : 'No data yet'}</strong><small>{stats.trades ? detail : 'Add or import trades to calculate this metric.'}</small></div>)}</section>
    {tab === 'Psychology' ? <PsychologyReport trades={trades} /> : tab === 'Mistakes' ? <section className="panel rp-mistakes">
      <div className="panel-heading"><div><h2>Mistake frequency and net P&amp;L</h2><p>Frequency is counted per tagged trade; net P&amp;L is summed across those trades.</p></div></div>
      {mistakeRows.length ? <>
        <div className="rp-frequency-chart" style={{ height: `${Math.min(420, Math.max(190, mistakeRows.length * 42))}px` }}><ResponsiveContainer width="100%" height="100%"><BarChart data={[...mistakeRows].sort((a, b) => b.frequency - a.frequency)} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={chartAxis} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={125} tick={chartAxis} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} formatter={(value) => [`${value} ${value === 1 ? 'trade' : 'trades'}`, 'Frequency']} /><Bar dataKey="frequency" fill="var(--purple)" radius={[0, 5, 5, 0]} maxBarSize={26} /></BarChart></ResponsiveContainer></div>
        <div className="table-scroll"><table className="trades-table report-table"><thead><tr><th>Mistake</th><th>Frequency</th><th className="align-right">Dollar cost (net P&amp;L)</th></tr></thead><tbody>{mistakeRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.frequency} {row.frequency === 1 ? 'trade' : 'trades'}</td><td className={`align-right pnl-cell ${row.pnl > 0 ? 'profit' : row.pnl < 0 ? 'loss' : ''}`}>{currency(row.pnl)}</td></tr>)}</tbody></table></div>
      </> : <div className="chart-empty">No mistakes have been tagged in this date range.</div>}
    </section> : tab === 'Edge' ? <EdgeReports trades={trades} /> : <>
    <div className="reports-main-grid">
      <section className="panel report-chart-panel"><div className="panel-heading"><div><h2>{isWinRateReport ? `Win rate by ${reportDimension}` : tab === 'Overview' ? 'Performance by symbol' : tab === 'Tag / strategy' ? 'Performance by strategy' : tab === 'Mistake cost' ? 'Net P&L by tagged mistake' : `Performance by ${tab.toLowerCase()}`}</h2><p>{isWinRateReport ? `Closed-trade win rate grouped by ${reportDimension}.` : tab === 'Mistake cost' ? 'Review net P&L associated with each recorded mistake.' : 'Net P&L breakdown for your selected date range'}</p></div><TrendingUp size={17} className="muted-icon" /></div>
        {trades.length && chartData.length ? <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxis} /><YAxis axisLine={false} tickLine={false} tick={chartAxis} tickFormatter={(value) => isWinRateReport ? percent(value) : axisCurrency(value)} domain={isWinRateReport ? [0, 100] : ['auto', 'auto']} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} formatter={(value) => [isWinRateReport ? percent(value) : currency(value), isWinRateReport ? 'Win rate' : 'Net P&L']} /><Bar dataKey={isWinRateReport ? 'winRate' : 'pnl'} fill={isWinRateReport ? 'var(--purple)' : undefined} radius={[5, 5, 0, 0]} maxBarSize={50}>{!isWinRateReport && chartData.map((item) => <Cell key={item.name} fill={item.pnl > 0 ? 'var(--profit)' : item.pnl < 0 ? 'var(--loss)' : 'var(--line)'} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty">No data yet</div>}
      </section>
      <section className="panel report-insight-panel"><div className="panel-heading"><div><h2>At a glance</h2><p>A few useful numbers to keep in view</p></div></div><div className="insight-list"><div><span className="insight-icon purple-stat"><CalendarClock size={17} /></span><span><strong>Best trading day</strong><small>{[...allWeekdays].sort((a, b) => b.pnl - a.pnl)[0]?.name || '—'}</small></span><b className="profit">{currency(Math.max(0, ...allWeekdays.map((item) => item.pnl)))}</b></div><div><span className="insight-icon green-stat"><TrendingUp size={17} /></span><span><strong>Top performing symbol</strong><small>{[...grouping].sort((a, b) => b.pnl - a.pnl)[0]?.name || '—'}</small></span><b className="profit">{currency(Math.max(0, ...grouping.map((item) => item.pnl)))}</b></div><div><span className="insight-icon blue-stat"><Clock3 size={17} /></span><span><strong>Avg hold time</strong><small>Across all closed trades</small></span><b>{Math.round(stats.avgHoldMinutes)} min</b></div><div><span className="insight-icon orange-stat"><Tag size={17} /></span><span><strong>Most used strategy</strong><small>{mostUsedStrategy.name}</small></span><b>{mostUsedStrategy.count} trades</b></div></div></section>
    </div>
    <section className="report-heatmaps">
      <article className="panel report-heatmap"><div className="panel-heading"><div><h2>By day of week</h2><p>Daily net P&amp;L for each weekday</p></div></div>{trades.length ? <div className="weekday-heatmap">{allWeekdays.map((item) => <div key={item.name} className={`heatmap-cell ${item.pnl > 0 ? 'heat-profit' : item.pnl < 0 ? 'heat-loss' : ''}`} title={`${item.name}: ${currency(item.pnl)} · ${item.trades} trades`}><span>{item.name.slice(0, 3)}</span><strong>{currency(item.pnl)}</strong><small>{item.trades} trades</small></div>)}</div> : <div className="chart-empty">No data yet</div>}</article>
      <article className="panel report-heatmap"><div className="panel-heading"><div><h2>By hour</h2><p>Results by local entry hour</p></div></div>{trades.length ? <div className="hour-heatmap">{hourlyHeatmap.map((item) => <div key={item.hour} className={`heatmap-cell ${item.pnl > 0 ? 'heat-profit' : item.pnl < 0 ? 'heat-loss' : ''}`} title={`${String(item.hour).padStart(2, '0')}:00 · ${currency(item.pnl)} · ${item.count} trades`}><span>{String(item.hour).padStart(2, '0')}</span><strong>{item.count ? currency(item.pnl) : '—'}</strong></div>)}</div> : <div className="chart-empty">No data yet</div>}</article>
    </section>
    <section className="panel report-table-panel"><div className="panel-heading"><div><h2>{isWinRateReport ? `Win rate by ${reportDimension}` : tab === 'Mistake cost' ? 'Cost of mistakes' : `${actualTabs} breakdown`}</h2><p>{isWinRateReport ? 'Win rate and supporting trade statistics for each group.' : tab === 'Mistake cost' ? 'Net P&L and losses associated with each tagged mistake.' : 'Detailed stats for each category'}</p></div></div><div className="table-scroll"><table className="trades-table report-table"><thead><tr><th>{breakdownTitle}</th><th>Trades</th><th>Win rate</th><th>Avg win</th><th>Avg loss</th><th>Profit factor</th><th className="align-right">Net P&L</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.trades}</td><td>{percent(row.winRate)}</td><td className={row.avgWin > 0 ? 'profit' : ''}>{currency(row.avgWin)}</td><td className={row.avgLoss > 0 ? 'loss' : ''}>{currency(-row.avgLoss)}</td><td>{Number.isFinite(row.profitFactor) ? row.profitFactor.toFixed(2) : '—'}</td><td className={`align-right pnl-cell ${row.pnl > 0 ? 'profit' : row.pnl < 0 ? 'loss' : ''}`}>{currency(row.pnl)}</td></tr>)}{!rows.length && <tr><td colSpan="7" className="table-empty">No report data in this date range.</td></tr>}</tbody></table></div></section>
    </>}
  </div>
}
