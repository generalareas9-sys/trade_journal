import { useState } from 'react'
import { ArrowRight, BarChart3, FlaskConical, Save, Sparkles, Trash2 } from 'lucide-react'
import { STRATEGIES } from '../data/mockData'
import { useJournal } from '../hooks/useJournal'
import { currency } from '../utils/trading'
import { EmptyState } from '../components/UiElements'
import { Link } from 'react-router-dom'

export function Backtesting() {
  const {
    filteredTrades,
    range,
    customStart,
    customEnd,
    account,
    backtestSnapshots = [],
    featureLoadErrors = {},
    setAddTradeOpen,
    setEditingTrade,
    addBacktestSnapshot,
    deleteBacktestSnapshot,
    notify,
  } = useJournal()
  const [strategy, setStrategy] = useState('Opening Range')
  const [symbol, setSymbol] = useState('All symbols')
  const [saving, setSaving] = useState(false)
  const [recordError, setRecordError] = useState('')
  const matching = filteredTrades.filter((trade) => (symbol === 'All symbols' || trade.symbol === symbol) && trade.strategy === strategy)
  const pnl = matching.reduce((sum, trade) => sum + trade.pnl, 0)
  const wins = matching.filter((trade) => trade.pnl > 0).length
  const losses = matching.filter((trade) => trade.pnl < 0).length
  const winRatePct = matching.length ? wins / matching.length * 100 : 0

  async function saveAnalysis() {
    if (!matching.length || saving) return
    setSaving(true)
    setRecordError('')
    const result = await addBacktestSnapshot({
      strategy,
      symbol,
      snapshot: {
        tradeCount: matching.length,
        netPnl: pnl,
        wins,
        losses,
        winRatePct,
        tradeIds: matching.map((trade) => trade.id).filter(Boolean),
        filters: { range, customStart, customEnd, account: account === 'all' ? null : account },
      },
    })
    setSaving(false)
    if (result?.error) setRecordError(result.error.message || 'Could not save this analysis.')
    else notify('Backtest snapshot saved.')
  }

  async function removeSnapshot(id) {
    if (!window.confirm('Delete this saved analysis snapshot?')) return
    setRecordError('')
    const result = await deleteBacktestSnapshot(id)
    if (result?.error) setRecordError(result.error.message || 'Could not delete this snapshot.')
    else notify('Backtest snapshot deleted.')
  }

  return <div className="page-content">
    <div className="page-intro-row">
      <div><span className="eyebrow">TEST YOUR EDGE</span><h2>Backtesting workspace</h2><p>Explore how a setup performed across your journal history.</p></div>
      <button className="button-primary" type="button" onClick={() => void saveAnalysis()} disabled={!matching.length || saving}><Save size={16} />{saving ? 'Saving...' : 'Save analysis'}</button>
    </div>
    {filteredTrades.length === 0 && <section className="panel page-empty-panel"><EmptyState icon={FlaskConical} title="Start with trade history" description="Add or import trades first; your recorded setups will be ready to review here." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => { setEditingTrade(null); setAddTradeOpen(true) }}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link></div>} /></section>}
    <section className="panel backtest-intro"><div className="backtest-graphic"><FlaskConical size={32} /><span /></div><div><h2>Learn from the data you already have.</h2><p>Filter your recorded executions by setup and symbol to review what is working before you risk capital on what’s next.</p></div><Sparkles size={18} /></section>
    <div className="backtest-filter panel">
      <div><span className="eyebrow">QUICK ANALYSIS</span><h3>Filter your historical trades</h3></div>
      <label>Strategy<select value={strategy} onChange={(event) => setStrategy(event.target.value)}>{STRATEGIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Symbol<select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{['All symbols', 'EURUSD', 'XAUUSD', 'NQ', 'AAPL', 'BTCUSD'].map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    {recordError && <p role="alert">{recordError}</p>}
    {featureLoadErrors.backtestSnapshots && <p role="alert">Saved analyses could not be loaded: {featureLoadErrors.backtestSnapshots}</p>}
    <div className="backtest-metrics">
      {[['Matching trades', matching.length], ['Historical net P&L', matching.length ? currency(pnl) : 'No data yet'], ['Win rate', matching.length ? `${winRatePct.toFixed(1)}%` : 'No data yet']].map(([label, value]) => <div className="panel" key={label}><span>{label}</span><strong className={label.includes('P&L') ? (pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : '') : ''}>{value}</strong></div>)}
    </div>
    <section className="panel backtest-snapshots">
      <div className="backtest-snapshots-heading"><div><h3>Saved analysis snapshots</h3><p>Saved trade-derived metrics; no market-data replay is included.</p></div><span>{backtestSnapshots.length}</span></div>
      {backtestSnapshots.length ? <div className="backtest-snapshot-list">{backtestSnapshots.map((item) => <article className="backtest-snapshot-item" key={item.id}>
        <div><strong>{item.strategy} · {item.symbol}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div>
        <span>{item.snapshot.tradeCount} trades</span>
        <span>{currency(Number(item.snapshot.netPnl) || 0)} · {Number(item.snapshot.winRatePct || 0).toFixed(1)}% wins</span>
        <button type="button" className="button-secondary" aria-label={`Delete ${item.strategy} ${item.symbol} snapshot`} onClick={() => void removeSnapshot(item.id)}><Trash2 size={14} />Delete</button>
      </article>)}</div> : <p>No saved analyses yet.</p>}
    </section>
    <section className="panel backtest-empty"><EmptyState icon={BarChart3} title="Historical replay, coming soon" description={`Your journal’s ${matching.length} matching trades are ready to analyze. Connect a market data source to replay setups candle by candle.`} action={<button className="view-link" onClick={() => window.alert('We’ll let you know when replay is ready.')}>Notify me when it’s ready <ArrowRight size={15} /></button>} /></section>
  </div>
}

export { SettingsPage } from './SettingsPage'
