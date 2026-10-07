import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { currency, percent } from '../utils/trading'
import { TradeTable } from '../components/TradesTable'
import TradeDrawer from '../components/TradeDrawer'
import TradeCsvImport from '../components/TradeCsvImport'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/UiElements'

export default function TradeLog() {
  const { trades = [], filteredTrades, stats, setAddTradeOpen, setEditingTrade, deleteTrade, updateTrade, loadDemoData } = useJournal()
  const [symbol, setSymbol] = useState('All symbols')
  const [side, setSide] = useState('All sides')
  const [outcome, setOutcome] = useState('All outcomes')
  const [tag, setTag] = useState('All tags')
  const [selected, setSelected] = useState(null)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const symbols = [...new Set(filteredTrades.map((trade) => trade.symbol))]
  const tags = [...new Set(filteredTrades.map((trade) => trade.tag))]
  const visible = useMemo(() => filteredTrades.filter((trade) => (symbol === 'All symbols' || trade.symbol === symbol) && (side === 'All sides' || trade.side === side) && (outcome === 'All outcomes' || trade.outcome === outcome) && (tag === 'All tags' || trade.tag === tag)), [filteredTrades, symbol, side, outcome, tag])
  const clear = () => { setSymbol('All symbols'); setSide('All sides'); setOutcome('All outcomes'); setTag('All tags') }
  return <div className="page-content">
    <div className="trade-stats-strip"><div><span>Total net P&amp;L</span><strong className={stats.netPnl > 0 ? 'profit' : stats.netPnl < 0 ? 'loss' : ''}>{stats.trades ? currency(stats.netPnl) : 'No data yet'}</strong></div><div><span>Win rate</span><strong>{stats.trades ? percent(stats.winRate) : '—'}</strong></div><div><span>Total trades</span><strong>{stats.trades}</strong></div><div><span>Profit factor</span><strong>{stats.trades && Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '—'}</strong></div><button className="button-primary" onClick={() => setAddTradeOpen(true)}>+ Add trade</button></div>
    <section className="panel full-trade-panel">
      <div className="panel-heading"><div><h2>All trades</h2><p>Search, filter, and review your trade history.</p></div><div className="trade-header-actions"><TradeCsvImport /><button className="button-secondary export-button" onClick={() => { const csv = ['Date,Symbol,Side,Entry,Exit,Size,Fees,PnL,Strategy', ...visible.map((trade) => [trade.date, trade.symbol, trade.side, trade.entry, trade.exit, trade.size, trade.fees, trade.pnl, `"${trade.strategy}"`].join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'trade-log.csv'; link.click(); URL.revokeObjectURL(link.href) }}>Export CSV</button></div></div>
      <div className="filter-row"><label className="table-search"><Search size={15} /><span>Filters</span></label><select value={symbol} onChange={(event) => setSymbol(event.target.value)}><option>All symbols</option>{symbols.map((item) => <option key={item}>{item}</option>)}</select><select value={side} onChange={(event) => setSide(event.target.value)}><option>All sides</option><option>Long</option><option>Short</option></select><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option>All outcomes</option><option>Win</option><option>Loss</option></select><select value={tag} onChange={(event) => setTag(event.target.value)}><option>All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select><button className="clear-filters" onClick={clear}><X size={14} /> Clear</button></div>
      <TradeTable trades={visible} onSelect={setSelected} searchable pageSize={10} showCount={false} />
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
