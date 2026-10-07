import { useState } from 'react'
import { ArrowRight, BarChart3, FlaskConical, Plus, Sparkles } from 'lucide-react'
import { STRATEGIES } from '../data/mockData'
import { useJournal } from '../hooks/useJournal'
import { currency } from '../utils/trading'
import { EmptyState } from '../components/UiElements'
import { Link } from 'react-router-dom'

export function Backtesting() {
  const { filteredTrades, setAddTradeOpen, setEditingTrade } = useJournal()
  const [strategy, setStrategy] = useState('Opening Range')
  const [symbol, setSymbol] = useState('All symbols')
  const matching = filteredTrades.filter((trade) => (symbol === 'All symbols' || trade.symbol === symbol) && trade.strategy === strategy)
  const pnl = matching.reduce((sum, trade) => sum + trade.pnl, 0)
  return <div className="page-content"><div className="page-intro-row"><div><span className="eyebrow">TEST YOUR EDGE</span><h2>Backtesting workspace</h2><p>Explore how a setup performed across your journal history.</p></div><button className="button-primary" onClick={() => window.alert('Historical market data can be connected to begin a new backtest.')}><Plus size={16} />New backtest</button></div>{filteredTrades.length === 0 && <section className="panel page-empty-panel"><EmptyState icon={FlaskConical} title="Start with trade history" description="Add or import trades first; your recorded setups will be ready to review here." action={<div className="first-run-empty-actions"><button type="button" className="button-primary" onClick={() => { setEditingTrade(null); setAddTradeOpen(true) }}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link></div>} /></section>}<section className="panel backtest-intro"><div className="backtest-graphic"><FlaskConical size={32} /><span /></div><div><h2>Learn from the data you already have.</h2><p>Filter your recorded executions by setup and symbol to review what is working before you risk capital on what’s next.</p></div><Sparkles size={18} /></section><div className="backtest-filter panel"><div><span className="eyebrow">QUICK ANALYSIS</span><h3>Filter your historical trades</h3></div>  <label>Strategy<select value={strategy} onChange={(event) => setStrategy(event.target.value)}>{STRATEGIES.map((value) => <option key={value}>{value}</option>)}</select></label><label>Symbol<select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{['All symbols', 'EURUSD', 'XAUUSD', 'NQ', 'AAPL', 'BTCUSD'].map((value) => <option key={value}>{value}</option>)}</select></label></div><div className="backtest-metrics">{[['Matching trades', matching.length], ['Historical net P&L', matching.length ? currency(pnl) : 'No data yet'], ['Win rate', matching.length ? `${(matching.filter((trade) => trade.pnl > 0).length / matching.length * 100).toFixed(1)}%` : 'No data yet']].map(([label, value]) => <div className="panel" key={label}><span>{label}</span><strong className={label.includes('P&L') ? (pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : '') : ''}>{value}</strong></div>)}</div><section className="panel backtest-empty"><EmptyState icon={BarChart3} title="Historical replay, coming soon" description={`Your journal’s ${matching.length} matching trades are ready to analyze. Connect a market data source to replay setups candle by candle.`} action={<button className="view-link" onClick={() => window.alert('We’ll let you know when replay is ready.')}>Notify me when it’s ready <ArrowRight size={15} /></button>} /></section></div>
}

export { SettingsPage } from './SettingsPage'
