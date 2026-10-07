import { ArrowDownRight, ArrowUpRight, Ellipsis } from 'lucide-react'
import { currency, percent } from '../utils/trading'
import { DonutChart, GaugeChart } from './Charts'

export default function StatCard({ title, value, change, count, kind = 'money', subtext, icon }) {
  const profitable = (typeof value === 'number' ? value : 0) > 0
  return <article className="stat-card">
    <div className="stat-card-top"><span>{title}</span><button className="subtle-icon" aria-label={`${title} options`}><Ellipsis size={17} /></button></div>
    <div className="stat-value-row"><strong className={kind === 'money' ? (profitable ? 'profit' : value < 0 ? 'loss' : '') : ''}>{count === 0 ? 'No data yet' : kind === 'money' ? currency(value) : value}</strong>{icon}</div>
    <div className="stat-card-bottom">{change !== undefined ? <span className={`stat-change ${change > 0 ? 'profit-bg' : change < 0 ? 'loss-bg' : ''}`}>{change > 0 ? <ArrowUpRight size={13} /> : change < 0 ? <ArrowDownRight size={13} /> : null}{Math.abs(change).toFixed(1)}%</span> : null}{count !== undefined && <span className="trade-count-badge">{count} trades</span>}<span>{subtext}</span></div>
  </article>
}

export function WinRateCard({ title, value, count, icon, footer }) {
  return <article className="stat-card gauge-card">
    <div className="stat-card-top"><span>{title}</span>{icon}</div>
    <div className="gauge-content"><div><strong>{count === 'No data yet' ? '—' : percent(value)}</strong><span className="gauge-count">{count}</span></div><GaugeChart value={Number.isFinite(value) ? value : 0} color="#16a34a" /></div>
    <div className="gauge-footer">{footer}</div>
  </article>
}
export function FactorCard({ value, count }) {
  return <article className="stat-card gauge-card">
    <div className="stat-card-top"><span>Profit factor</span><button className="subtle-icon" aria-label="Profit factor information">ⓘ</button></div>
    <div className="factor-content"><DonutChart value={Number.isFinite(value) ? value : 0} /><strong>{count > 0 && Number.isFinite(value) ? value.toFixed(2) : '—'}</strong></div>
    <div className="gauge-footer"><span>{count > 0 ? `${count} trades` : 'No data yet'}</span><span className="legend-dot purple-dot" />Gross profit / loss</div>
  </article>
}
export function RatioCard({ win, loss }) {
  const total = win + loss
  const winWidth = total ? win / total * 100 : 50
  return <article className="stat-card ratio-card">
    <div className="stat-card-top"><span>Avg win / avg loss</span><button className="subtle-icon" aria-label="Average win to average loss information">ⓘ</button></div>
    <div className="ratio-bar"><span style={{ width: `${winWidth}%` }} /><span style={{ width: `${100 - winWidth}%` }} /></div>
    <div className="ratio-values"><div><strong className={win > 0 ? 'profit' : ''}>{total > 0 ? currency(win) : '—'}</strong><span>Avg win</span></div><div><strong className={loss > 0 ? 'loss' : ''}>{total > 0 ? currency(-loss) : '—'}</strong><span>Avg loss</span></div></div>
  </article>
}
