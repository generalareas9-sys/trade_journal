import { useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, CircleHelp, Flame, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useJournal } from '../hooks/useJournal'
import { dailySeries, currency, percent } from '../utils/trading'
import StatCard, { FactorCard, RatioCard, WinRateCard } from '../components/StatCard'
import { DailyBars, EquityCurve, RadarScore } from '../components/Charts'
import { TradeTable } from '../components/TradesTable'
import PnLCalendar from '../components/PnLCalendar'
import { Link } from 'react-router-dom'
import TradeDrawer from '../components/TradeDrawer'
import { EmptyState } from '../components/UiElements'
import { OnboardingChecklist, WelcomeGuide } from '../components/FirstRunGuide'
import DashboardOnboardingChecklist from '../components/OnboardingChecklist'

export default function Dashboard() {
  const { trades = [], stats, filteredTrades, accountTrades, journal = {}, accounts: userAccounts = [], setAddTradeOpen, settings, setEditingTrade, deleteTrade, updateTrade, loadDemoData } = useJournal()
  const navigate = useNavigate()
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const series = useMemo(() => dailySeries(filteredTrades), [filteredTrades])
  const recent = [...filteredTrades].sort((a, b) => b.date.localeCompare(a.date) || b.openedAt.localeCompare(a.openedAt))
  const daily = new Map()
  filteredTrades.forEach((trade) => daily.set(trade.date, (daily.get(trade.date) || 0) + trade.pnl))
  const currentDayPnl = daily.get(format(new Date(), 'yyyy-MM-dd')) || 0
  const todayWarnings = dayLimitWarnings(accountTrades, settings)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayJournal = journal[today]
  const hasTodayJournal = Boolean(todayJournal && Object.entries(todayJournal).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))))
  const hasTradeToday = accountTrades.some((trade) => trade.date === today && !trade.isDemo)
  const configuredThreshold = Number(settings.riskWarningThreshold ?? 2)
  const riskThreshold = (Number.isFinite(configuredThreshold) ? configuredThreshold : 2) / 100
  const riskWarning = accountTrades.some((trade) => {
    const balance = userAccounts.find((item) => item.id === trade.account)?.balance || 0
    return balance > 0 && trade.riskAmount / balance > riskThreshold
  })

  return <div className="page-content">
    {hasTradeToday && !hasTodayJournal && <div className="dashboard-journal-reminder" role="status"><span>You logged a trade today. Take a moment to record how the session went.</span><Link to="/journal">Write today’s journal entry <ChevronRight size={15} /></Link></div>}
    <DashboardOnboardingChecklist />
    <div className="welcome-strip"><div className="welcome-avatar"><Flame size={18} /></div><div><strong>Keep building your edge.</strong><span>You’ve logged <b>{stats.trades} trades</b> in this view. Every session is a chance to get a little better.</span></div><button onClick={() => navigate('/journal')}>Open journal <ChevronRight size={15} /></button></div>
    <section className="kpi-grid">
      <StatCard title="Net P&L" value={stats.netPnl} count={stats.trades} subtext={stats.trades ? 'in selected range' : 'No data yet'} icon={<span className="stat-icon purple-stat"><TrendingUp size={18} /></span>} />
     <WinRateCard title="Trade win %" value={stats.winRate} count={stats.trades ? `${stats.wins}W · ${stats.losses}L` : 'No data yet'} footer={<><span><i className="legend-dot green-dot" />{stats.wins} wins</span><span><i className="legend-dot red-dot" />{stats.losses} losses</span></>} hasData={stats.trades > 0} />
      <FactorCard value={stats.profitFactor} count={stats.trades} />
      <WinRateCard title="Day win %" value={stats.dayWinRate} count={stats.trades ? 'profitable trading days' : 'No data yet'} footer={<><span><i className="legend-dot green-dot" />{stats.greenDays} green days</span><span><i className="legend-dot red-dot" />{stats.redDays} red days</span></>} hasData={stats.trades > 0} />
      <RatioCard win={stats.avgWin} loss={stats.avgLoss} />
    </section>
    <section className="dashboard-chart-grid">
      <article className="panel equity-panel"><div className="panel-heading"><div><h2>Daily net cumulative P&L</h2><p>Your account’s performance over time</p></div><button className="view-link" onClick={() => navigate('/reports')}>Full report <ChevronRight size={15} /></button></div>
        <div className="equity-quick-stats"><div><strong className={stats.netPnl > 0 ? 'profit' : stats.netPnl < 0 ? 'loss' : ''}>{stats.trades ? currency(stats.netPnl) : 'No data yet'}</strong><span>Total net P&L</span></div><div><strong>{stats.trades}</strong><span>Total trades</span></div><div><strong className={currentDayPnl > 0 ? 'profit' : currentDayPnl < 0 ? 'loss' : ''}>{stats.trades ? currency(currentDayPnl) : 'No data yet'}</strong><span>Today’s P&L</span></div></div>
        {series.length ? <div className="equity-chart"><EquityCurve data={series} /></div> : <div className="chart-empty">No data yet</div>}
      </article>
      <article className="panel radar-panel"><div className="panel-heading"><div><h2>Journal Score</h2><p>A snapshot of your trading health</p></div><button className="subtle-icon" aria-label="Score information"><CircleHelp size={16} /></button></div><RadarScore stats={stats} /><div className="score-footer"><span><i className="legend-dot purple-dot" />Performance profile</span><button onClick={() => navigate('/reports')}>View insights <ChevronRight size={14} /></button></div></article>
    </section>
    <section className="activity-grid">
      <article className="panel daily-pnl-panel"><div className="panel-heading"><div><h2>Net daily P&amp;L</h2><p>Daily results for this period</p></div><span className="panel-pill"><CalendarDays size={13} /> Recent</span></div>{series.length ? <div className="bar-chart"><DailyBars data={series} /></div> : <div className="chart-empty">No data yet</div>}</article>
      <article className="panel recent-panel"><div className="panel-heading"><div><h2>Recent trades</h2><p>Your latest activity</p></div><button className="view-link" onClick={() => navigate('/trades')}>See all <ChevronRight size={15} /></button></div><TradeTable trades={recent} compact onSelect={setSelectedTrade} showCount={false} /></article>
      <article className="panel positions-panel"><div className="panel-heading"><div><h2>Open positions</h2><p>Currently active trades</p></div><span className="open-indicator">● Live</span></div><div className="position-empty"><span className="position-icon"><TrendingUp size={20} /></span><strong>All clear for now</strong><p>No open positions. Your next opportunity is just around the corner.</p><button className="button-secondary" onClick={() => setAddTradeOpen(true)}>Log a trade</button></div></article>
    </section>
    {(todayWarnings.length > 0 || riskWarning) && <div className="warning-banner" role="status">{todayWarnings.map((warning) => <p key={warning}>{warning}</p>)}{riskWarning && <p>Risk of ruin warning: at least one trade risks more than {Number(settings.riskWarningThreshold ?? 2)}% of this account balance.</p>}</div>}
    <PnLCalendar trades={filteredTrades} />
    <section className="goal-grid onb-goals-anchor" id="dashboard-goals">
      {[['Monthly P&L goal', accountTrades.filter((trade) => trade.date.startsWith(format(new Date(), 'yyyy-MM'))).reduce((sum, trade) => sum + trade.pnl, 0), settings.monthlyPnlGoal, 'money'], ['Monthly win-rate goal', (() => { const monthTrades = accountTrades.filter((trade) => trade.date.startsWith(format(new Date(), 'yyyy-MM'))); return monthTrades.length ? monthTrades.filter((trade) => trade.pnl > 0).length / monthTrades.length * 100 : 0 })(), settings.winRateGoal, 'percent']].map(([label, current, goal, type]) => {
        const monthHasTrades = accountTrades.some((trade) => trade.date.startsWith(format(new Date(), 'yyyy-MM')))
        const numericGoal = Number(goal)
        const progress = monthHasTrades && Number.isFinite(numericGoal) && numericGoal > 0 ? Math.min(100, Math.max(0, current / numericGoal * 100)) : 0
        return <article className="panel goal-card" key={label}><div><h2>{label}</h2><strong>{monthHasTrades ? (type === 'money' ? currency(current) : percent(current)) : 'No data yet'}</strong><span>Goal: {type === 'money' ? currency(Number.isFinite(numericGoal) ? numericGoal : 0) : percent(Number.isFinite(numericGoal) ? numericGoal : 0)}</span></div><div className="goal-progress-label"><span>Progress</span><strong>{monthHasTrades ? `${progress.toFixed(0)}%` : '—'}</strong></div><div className="goal-track" role="progressbar" aria-label={`${label} progress`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div><button type="button" className="button-secondary goal-set-button" onClick={() => navigate('/settings')}>Set goal</button></article>
      })}
    </section>
    <div className="dashboard-footnote"><span><i className="legend-dot green-dot" />Profitable</span><span><i className="legend-dot red-dot" />Loss day</span><span>Metrics calculated from {filteredTrades.length} trades in selected range</span><span>Last updated {format(subDays(new Date(), 0), 'MMM d, h:mm a')}</span></div>
    <TradeDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={updateTrade} onEdit={() => { setEditingTrade(selectedTrade); setSelectedTrade(null); navigate('/'); setAddTradeOpen(true) }} onDelete={() => {
      if (window.confirm(`Delete the ${selectedTrade.symbol} trade from ${selectedTrade.date}? This cannot be undone.`)) {
        window.dispatchEvent(new CustomEvent('tradejournal:trade-deleted', { detail: { trade: selectedTrade } }))
        deleteTrade(selectedTrade.id)
        setSelectedTrade(null)
      }
    }} />
    <WelcomeGuide />
    <OnboardingChecklist showShortcuts={trades.length > 0} onAddTrade={() => { setEditingTrade(null); setAddTradeOpen(true) }} />
    {trades.length === 0 && <section className="panel dashboard-first-empty"><EmptyState icon={TrendingUp} title="Your trading story starts here" description="Add a trade or import your history to see your performance take shape." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => { setEditingTrade(null); setAddTradeOpen(true) }}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link><button type="button" className="button-secondary" disabled={loadingDemo} onClick={async () => { setLoadingDemo(true); try { await loadDemoData() } finally { setLoadingDemo(false) } }}>{loadingDemo ? 'Loading…' : 'Load demo data'}</button></div>} /></section>}
  </div>
}

function dayLimitWarnings(trades, settings) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todaysTrades = trades.filter((trade) => trade.date === today)
  const loss = todaysTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  return [
    ...(todaysTrades.length > (Number.isFinite(Number(settings.maxTradesPerDay)) ? Number(settings.maxTradesPerDay) : Infinity) ? [`Today's trade count (${todaysTrades.length}) exceeded the ${settings.maxTradesPerDay}-trade limit.`] : []),
    ...(loss < -(Number.isFinite(Number(settings.dailyLossLimit)) ? Number(settings.dailyLossLimit) : Infinity) ? [`Today's net loss (${currency(loss)}) exceeded the ${currency(-(Number(settings.dailyLossLimit) || 0))} daily loss limit.`] : []),
  ]
}
