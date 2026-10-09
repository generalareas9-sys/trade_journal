import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { currency, percent } from '../utils/trading'
import { TradeTable } from '../components/TradesTable'
import TradeDrawer from '../components/TradeDrawer'
import TradeCsvImport from '../components/TradeCsvImport'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/UiElements'
import '../trade-log-filters.css'

const EMPTY_FILTERS = {
  symbol: 'All symbols',
  side: 'All sides',
  outcome: 'All outcomes',
  tag: 'All tags',
  session: 'All sessions',
  strategy: 'All strategies',
  startDate: '',
  endDate: '',
}

export default function TradeLog() {
  const { trades = [], filteredTrades, stats, settings = {}, setSettings, setAddTradeOpen, setEditingTrade, deleteTrade, updateTrade, loadDemoData } = useJournal()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [viewName, setViewName] = useState('')
  const [selectedView, setSelectedView] = useState('')
  const [viewFeedback, setViewFeedback] = useState('')
  const [selected, setSelected] = useState(null)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const symbols = [...new Set(trades.map((trade) => trade.symbol).filter(Boolean))]
  const tags = [...new Set(trades.flatMap((trade) => Array.isArray(trade.tags) ? trade.tags : [trade.tag]).filter((item) => typeof item === 'string' && item.trim()))]
  const sessions = [...new Set(trades.map((trade) => trade.session).filter(Boolean))]
  const strategies = [...new Set(trades.map((trade) => trade.strategy).filter(Boolean))]
  const savedViews = Array.isArray(settings.tradeLogViews)
    ? settings.tradeLogViews.filter((view) => view && typeof view.name === 'string' && view.filters && typeof view.filters === 'object')
    : []
  const visible = useMemo(() => filteredTrades.filter((trade) => {
    const tradeTags = Array.isArray(trade.tags) ? trade.tags : [trade.tag]
    const result = trade.result || trade.outcome
    return (filters.symbol === 'All symbols' || trade.symbol === filters.symbol)
      && (filters.side === 'All sides' || trade.side === filters.side)
      && (filters.outcome === 'All outcomes' || result === filters.outcome)
      && (filters.tag === 'All tags' || tradeTags.includes(filters.tag))
      && (filters.session === 'All sessions' || trade.session === filters.session)
      && (filters.strategy === 'All strategies' || trade.strategy === filters.strategy)
      && (!filters.startDate || trade.date >= filters.startDate)
      && (!filters.endDate || trade.date <= filters.endDate)
  }), [filteredTrades, filters])
  const clear = () => {
    setFilters(EMPTY_FILTERS)
    setSelectedView('')
    setViewFeedback('')
  }
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setSelectedView('')
  }
  const saveView = () => {
    const name = viewName.trim()
    if (!name) {
      setViewFeedback('Enter a name for this view.')
      return
    }
    const nextViews = [
      ...savedViews.filter((view) => view.name.toLocaleLowerCase() !== name.toLocaleLowerCase()),
      { name, filters: { ...filters } },
    ]
    setSettings((current) => ({ ...current, tradeLogViews: nextViews }))
    setSelectedView(name)
    setViewName('')
    setViewFeedback(`Saved view “${name}”.`)
  }
  const loadView = (name) => {
    setSelectedView(name)
    const view = savedViews.find((item) => item.name === name)
    if (view?.filters) setFilters({ ...EMPTY_FILTERS, ...view.filters })
    setViewFeedback('')
  }
  return <div className="page-content">
    <div className="trade-stats-strip"><div><span>Total net P&amp;L</span><strong className={stats.netPnl > 0 ? 'profit' : stats.netPnl < 0 ? 'loss' : ''}>{stats.trades ? currency(stats.netPnl) : 'No data yet'}</strong></div><div><span>Win rate</span><strong>{stats.trades ? percent(stats.winRate) : '—'}</strong></div><div><span>Total trades</span><strong>{stats.trades}</strong></div><div><span>Profit factor</span><strong>{stats.trades && Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—'}</strong></div><button className="button-primary" onClick={() => setAddTradeOpen(true)}>+ Add trade</button></div>
    <section className="panel full-trade-panel">
      <div className="panel-heading"><div><h2>All trades</h2><p>Search, filter, and review your trade history.</p></div><div className="trade-header-actions"><TradeCsvImport /><button className="button-secondary export-button" onClick={() => { const csv = ['Date,Symbol,Side,Entry,Exit,Size,Fees,PnL,Strategy', ...visible.map((trade) => [trade.date, trade.symbol, trade.side, trade.entry, trade.exit, trade.size, trade.fees, trade.pnl, `"${trade.strategy}"`].join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'trade-log.csv'; link.click(); URL.revokeObjectURL(link.href) }}>Export CSV</button></div></div>
      <div className="filter-row tlx-filter-row"><label className="table-search"><Search size={15} /><span>Filters</span></label><select aria-label="Filter by symbol" value={filters.symbol} onChange={(event) => updateFilter('symbol', event.target.value)}><option>All symbols</option>{symbols.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by side" value={filters.side} onChange={(event) => updateFilter('side', event.target.value)}><option>All sides</option><option>Long</option><option>Short</option></select><select aria-label="Filter by result" value={filters.outcome} onChange={(event) => updateFilter('outcome', event.target.value)}><option>All outcomes</option><option>Win</option><option>Loss</option><option>Breakeven</option></select><select aria-label="Filter by tag" value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)}><option>All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by session" value={filters.session} onChange={(event) => updateFilter('session', event.target.value)}><option>All sessions</option>{sessions.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by strategy" value={filters.strategy} onChange={(event) => updateFilter('strategy', event.target.value)}><option>All strategies</option>{strategies.map((item) => <option key={item}>{item}</option>)}</select><label className="tlx-date-filter"><span>From</span><input aria-label="Filter from date" type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} /></label><label className="tlx-date-filter"><span>To</span><input aria-label="Filter to date" type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} /></label><button type="button" className="clear-filters tlx-clear" onClick={clear}><X size={14} />Clear filters</button></div>
      <div className="tlx-saved-views">
        <label><span>Saved views</span><select aria-label="Load saved filter view" value={selectedView} onChange={(event) => loadView(event.target.value)}><option value="">Choose a saved view</option>{savedViews.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}</select></label>
        <label className="tlx-view-name"><span>Save current filters as</span><input aria-label="Saved view name" value={viewName} onChange={(event) => setViewName(event.target.value)} maxLength={60} placeholder="View name" onKeyDown={(event) => { if (event.key === 'Enter') saveView() }} /></label>
        <button type="button" className="button-secondary tlx-save-view" onClick={saveView}>Save view</button>
        {viewFeedback && <span className="tlx-view-feedback" role="status">{viewFeedback}</span>}
      </div>
      <TradeTable trades={visible} onSelect={setSelected} searchable pageSize={10} showCount={false} pageResetKey={filters} />
      {filteredTrades.length === 0 && <div className="trade-log-first-empty"><EmptyState icon={Search} title="No trades to show yet" description="Add a trade or import your broker history to build your trade log." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => setAddTradeOpen(true)}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link>{trades.length === 0 && <button type="button" className="button-secondary" disabled={loadingDemo} onClick={async () => { setLoadingDemo(true); try { await loadDemoData() } finally { setLoadingDemo(false) } }}>{loadingDemo ? 'Loading…' : 'Load demo data'}</button>}</div>} /></div>}
    </section>
    <TradeDrawer trade={selected} onClose={() => setSelected(null)} onUpdate={updateTrade} onEdit={() => { setEditingTrade(selected); setSelected(null); setAddTradeOpen(true) }} onDelete={() => {
      if (window.confirm(`Delete the ${selected.symbol} trade from ${selected.date}? This cannot be undone.`)) {
        window.dispatchEvent(new CustomEvent('tradejournal:trade-deleted', { detail: { trade: selected } }))
        deleteTrade(selected.id)
        setSelected(null)
      }
    }} />
  </div>
}
