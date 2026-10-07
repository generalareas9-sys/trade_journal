import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisCurrency, currency } from '../utils/trading'

const axis = { fill: 'var(--muted)', fontSize: 12, fontFamily: 'Inter' }
export function GaugeChart({ value = 0, color = '#6c5ce7' }) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  const radius = 32
  const circumference = Math.PI * radius
  return <svg className="gauge-svg" viewBox="0 0 80 48" aria-label={`${clamped.toFixed(0)} percent`}>
    <path d="M 8 40 A 32 32 0 0 1 72 40" fill="none" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
    <path d="M 8 40 A 32 32 0 0 1 72 40" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${circumference * clamped / 100} ${circumference}`} />
  </svg>
}
export function DonutChart({ value = 0, color = '#6c5ce7' }) {
  const radius = 19
  const circumference = 2 * Math.PI * radius
  const ratio = Number.isFinite(value) && value >= 0 ? value / (value + 1) : 0
  return <svg className="donut-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r={radius} fill="none" stroke="var(--line)" strokeWidth="5" /><circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${circumference * ratio} ${circumference}`} strokeLinecap="round" transform="rotate(-90 24 24)" /></svg>
}
export function EquityCurve({ data }) {
  const gradient = useId().replace(/:/g, '')
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.19} /><stop offset="95%" stopColor="#6c5ce7" stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axis} minTickGap={35} />
    <YAxis axisLine={false} tickLine={false} tick={axis} tickFormatter={axisCurrency} />
    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} formatter={(value) => [currency(value), 'Cumulative P&L']} labelStyle={{ color: 'var(--muted)' }} />
    <Area type="monotone" dataKey="cumulative" stroke="#6c5ce7" strokeWidth={2.5} fill={`url(#${gradient})`} activeDot={{ r: 4, fill: '#6c5ce7' }} />
  </AreaChart></ResponsiveContainer>
}
export function DailyBars({ data }) {
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data.slice(-22)} margin={{ top: 9, right: 4, left: -19, bottom: 0 }}>
    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axis} minTickGap={24} />
    <YAxis axisLine={false} tickLine={false} tick={axis} tickFormatter={axisCurrency} />
    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} formatter={(value) => [currency(value), 'Daily P&L']} />
    <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={23}>{data.slice(-22).map((item) => <Cell key={item.date} fill={item.pnl > 0 ? 'var(--profit)' : 'var(--loss)'} />)}</Bar>
  </BarChart></ResponsiveContainer>
}
export function RadarScore({ stats }) {
  if (!stats.trades) return <div className="radar-no-data" role="status"><strong>No data yet</strong><span>Log or import trades to build your journal score.</span></div>
  const scores = [
    { metric: 'Win rate', value: stats.winRate },
    { metric: 'Profit factor', value: Math.min(100, stats.profitFactor * 35) },
    { metric: 'Avg win/loss', value: Math.min(100, stats.winLossRatio * 38) },
    { metric: 'Recovery', value: Math.min(100, stats.maxDrawdown ? stats.netPnl / stats.maxDrawdown * 35 : 75) },
    { metric: 'Drawdown', value: Math.max(15, 100 - Math.min(100, stats.maxDrawdown / 60)) },
    { metric: 'Consistency', value: stats.consistency },
  ]
  const score = Math.round(scores.reduce((sum, item) => sum + Math.max(0, item.value), 0) / scores.length)
  return <div className="radar-wrap"><div className="journal-score"><span>YOUR JOURNAL SCORE</span><strong>{score}<small>/100</small></strong></div><ResponsiveContainer width="100%" height="88%"><RadarChart data={scores} outerRadius="68%">
    <PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="metric" tick={axis} />
    <Radar dataKey="value" stroke="#6c5ce7" fill="#6c5ce7" fillOpacity={0.18} strokeWidth={2} />
    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} />
  </RadarChart></ResponsiveContainer></div>
}
