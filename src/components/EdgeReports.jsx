import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { groupStats, money } from '../utils/edgeStats'
import { EmptyState } from './UiElements'

const tabs = [
  { id: 'session', label: 'By session', field: 'session' },
  { id: 'management', label: 'By management', field: 'management' },
  { id: 'exit', label: 'By exit condition', field: 'exitCondition' },
  { id: 'discipline', label: 'Discipline' },
]

const disciplineQuestions = [
  { field: 'followedRules', label: 'Followed trading rules before entry' },
  { field: 'preAnalysis', label: 'Did pre-analysis and preparation' },
  { field: 'entryConditionMet', label: 'Entry condition fulfilled' },
]

const profitFactor = (value) => Number.isFinite(value) ? value.toFixed(2) : '—'

function GroupView({ trades, field }) {
  const rows = useMemo(() => groupStats(trades, field), [trades, field])
  if (!rows.length) return <EmptyState title="No trades in this range" description="Add or select trades to compare performance by category." />

  return <>
    <div className="edge-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 10, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="key" tick={{ fill: 'var(--text-2)', fontSize: 13 }} />
          <YAxis tickFormatter={money} tick={{ fill: 'var(--text-2)', fontSize: 13 }} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }}
            formatter={(value) => [money(value), 'Net P&L']}
          />
          <Bar dataKey="netPnl" radius={[6, 6, 0, 0]}>
            {rows.map((row) => <Cell key={row.key} fill={row.netPnl > 0 ? 'var(--profit)' : row.netPnl < 0 ? 'var(--loss)' : 'var(--line)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="table-scroll">
      <table className="edge-table">
        <thead>
          <tr><th>Category</th><th>Trades</th><th>Win rate</th><th>Avg win</th><th>Avg loss</th><th>Profit factor</th><th>Net P&L</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td><b>{row.key}</b></td>
              <td>{row.trades}</td>
              <td>{row.winRate.toFixed(1)}%</td>
              <td className={row.avgWin > 0 ? 'profit' : ''}>{money(row.avgWin)}</td>
              <td className={row.avgLoss > 0 ? 'loss' : ''}>{money(row.avgLoss)}</td>
              <td>{profitFactor(row.profitFactor)}</td>
              <td className={row.netPnl > 0 ? 'profit' : row.netPnl < 0 ? 'loss' : ''}>{money(row.netPnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
}

function DisciplineView({ trades }) {
  return <div className="discipline-grid">
    {disciplineQuestions.map(({ field, label }) => {
      const rows = groupStats(trades, field)
      const yes = rows.find((row) => row.key === 'Yes')
      const no = rows.find((row) => row.key === 'No')
      const difference = yes && no ? yes.expectancy - no.expectancy : null

      return <article className="panel discipline-card" key={field}>
        <h3>{label}</h3>
        <div className="yn-row">
          {['Yes', 'No'].map((name) => {
            const row = name === 'Yes' ? yes : no
            return <div className="yn-box" key={name}>
              <span className="eyebrow">{name}</span>
              <strong className={`edge-net-value ${row && row.netPnl > 0 ? 'profit' : row && row.netPnl < 0 ? 'loss' : ''}`}>{row ? money(row.netPnl) : '—'}</strong>
              <small>{row ? `${row.trades} trades · ${row.winRate.toFixed(0)}% win · ${money(row.expectancy)}/trade` : 'No trades'}</small>
            </div>
          })}
        </div>
        {difference !== null && <p className="edge-insight">
          {difference >= 0
            ? `When you said Yes, you earned ${money(difference)} more per trade.`
            : `When you said No, you earned ${money(-difference)} more per trade. Review your process.`}
        </p>}
        {(!yes || yes.trades < 20 || !no || no.trades < 20) && <p className="edge-sample-hint">Small sample (under 20 trades). Treat this as a hint, not proof.</p>}
      </article>
    })}
  </div>
}

export default function EdgeReports({ trades }) {
  const [tab, setTab] = useState('session')
  const currentTab = tabs.find((item) => item.id === tab)

  return <section className="panel edge-reports">
    <div className="edge-tabs" role="tablist" aria-label="Edge report views">
      {tabs.map((item) => <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={tab === item.id}
        className={tab === item.id ? 'selected' : ''}
        onClick={() => setTab(item.id)}
      >{item.label}</button>)}
    </div>
    {tab === 'discipline'
      ? <DisciplineView trades={trades} />
      : <GroupView trades={trades} field={currentTab.field} />}
  </section>
}
