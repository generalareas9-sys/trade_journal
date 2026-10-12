import { useMemo, useState } from 'react'
import { addDays, eachDayOfInterval, endOfWeek, format, getDay, isValid, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns'
import { ArrowLeft, ArrowRight, Check, Flame, Plus, Target, Trash2 } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { currency, percent } from '../utils/trading'
import './progress-tracker.css'

const DEFAULT_RULES = [
  { id: 'journal-plan', title: 'Write my plan and review' },
  { id: 'trade-playbook', title: 'Trade only my planned setups' },
  { id: 'manage-risk', title: 'Respect my stop-loss and risk limits' },
  { id: 'follow-plan', title: 'Follow my trading plan' },
]
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
const dayKey = (date) => format(date, 'yyyy-MM-dd')
const finitePnl = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0

export default function ProgressTracker() {
  const { trades = [], journal = {}, settings = {}, setSettings, accounts = [], setJournal } = useJournal()
  const [period, setPeriod] = useState(180)
  const [accountId, setAccountId] = useState('all')
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [editingRules, setEditingRules] = useState(false)
  const [draftRules, setDraftRules] = useState([])
  const [newRule, setNewRule] = useState('')
  const today = startOfDay(new Date())
  const todayKey = dayKey(today)
  const activeRules = useMemo(() => {
    const configured = settings.progressTrackerRules
    if (!Array.isArray(configured)) return DEFAULT_RULES
    return configured.filter((rule) => rule && typeof rule.id === 'string' && typeof rule.title === 'string' && rule.title.trim())
  }, [settings.progressTrackerRules])
  const startDate = subDays(today, period - 1)
  const periodDays = useMemo(() => eachDayOfInterval({ start: startDate, end: today }), [startDate, todayKey])
  const calendarStart = startOfWeek(startDate, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(today, { weekStartsOn: 0 })
  const calendarCells = useMemo(() => {
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    return [...Array(getDay(calendarStart)).fill(null), ...days]
  }, [calendarStart, calendarEnd])
  const periodTrades = useMemo(() => trades.filter((trade) => validDate(trade.date)
    && trade.date >= dayKey(startDate)
    && trade.date <= todayKey
    && (accountId === 'all' || trade.account === accountId)), [trades, startDate, todayKey, accountId])
  const pnlByDay = useMemo(() => {
    const totals = new Map()
    periodTrades.forEach((trade) => totals.set(trade.date, (totals.get(trade.date) || 0) + finitePnl(trade)))
    return totals
  }, [periodTrades])
  const trackedDays = useMemo(() => periodDays.filter((date) => {
    const key = dayKey(date)
    return journal[key]?.progressChecks && typeof journal[key].progressChecks === 'object'
  }), [periodDays, journal])
  const todayChecks = journal[todayKey]?.progressChecks || {}
  const todayComplete = activeRules.filter((rule) => todayChecks[rule.id] === true).length
  const periodComplete = periodDays.reduce((total, date) => {
    const checks = journal[dayKey(date)]?.progressChecks || {}
    return total + activeRules.filter((rule) => checks[rule.id] === true).length
  }, 0)
  const completionRate = activeRules.length && trackedDays.length ? periodComplete / (activeRules.length * trackedDays.length) * 100 : 0
  const streak = useMemo(() => {
    let count = 0
    let cursor = today
    while (activeRules.length && activeRules.some((rule) => journal[dayKey(cursor)]?.progressChecks?.[rule.id] === true)) {
      count += 1
      cursor = subDays(cursor, 1)
    }
    return count
  }, [activeRules, journal, todayKey])
  const selectedKey = dayKey(selectedDate)
  const selectedChecks = journal[selectedKey]?.progressChecks || {}
  const selectedTrades = useMemo(() => trades.filter((trade) => trade.date === selectedKey && (accountId === 'all' || trade.account === accountId)), [trades, selectedKey, accountId])
  const selectedPnl = selectedTrades.reduce((total, trade) => total + finitePnl(trade), 0)

  const toggleRule = (ruleId) => {
    const next = selectedChecks[ruleId] !== true
    setJournal((current) => ({
      ...current,
      [selectedKey]: {
        ...(current[selectedKey] || {}),
        progressChecks: { ...(current[selectedKey]?.progressChecks || {}), [ruleId]: next },
      },
    }))
  }
  const beginEditRules = () => {
    setDraftRules(activeRules.map((rule) => ({ ...rule })))
    setEditingRules(true)
  }
  const addDraftRule = () => {
    const title = newRule.trim()
    if (!title || draftRules.length >= 12) return
    setDraftRules((current) => [...current, { id: `custom-${Date.now()}`, title }])
    setNewRule('')
  }
  const saveRules = () => {
    const rules = draftRules.map((rule) => ({ ...rule, title: rule.title.trim() })).filter((rule) => rule.title)
    setSettings((current) => ({ ...current, progressTrackerRules: rules }))
    setEditingRules(false)
  }
  const selectHeatmapDay = (date) => {
    if (!date || date > today || date < startDate) return
    setSelectedDate(date)
  }
  const moveSelectedDate = (amount) => {
    const next = addDays(selectedDate, amount)
    if (next <= today && next >= startDate) setSelectedDate(next)
  }

  return <main className="page-content progress-tracker">
    <header className="pt-header">
      <div><span className="eyebrow">BUILD CONSISTENCY</span><h2>Progress tracker</h2><p>Measure the habits behind your trading results, one day at a time.</p></div>
      <div className="pt-filters">
        <label><span className="sr-only">Tracking period</span><select value={period} onChange={(event) => { setPeriod(Number(event.target.value)); setSelectedDate(today) }}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 6 months</option><option value="365">Last year</option></select></label>
        <label><span className="sr-only">Account filter</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="all">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
    </header>

    <section className="pt-overview" aria-label="Progress summary">
      <article className="pt-summary-card"><span><Flame size={15} /> Current streak</span><strong>{streak} {streak === 1 ? 'day' : 'days'}</strong><small>Days with at least one completed rule</small></article>
      <article className="pt-summary-card"><span><Target size={15} /> Period score</span><strong>{percent(completionRate)}</strong><div className="pt-progress-track"><i style={{ width: `${completionRate}%` }} /></div><small>Completed checks across {trackedDays.length} tracked days</small></article>
      <article className="pt-summary-card pt-today-card"><div><span><Check size={15} /> Today’s checklist</span><strong>{todayComplete}/{activeRules.length}</strong></div><p>{todayComplete === activeRules.length && activeRules.length ? 'All rules complete. Keep it consistent.' : 'Check off each rule as you follow it.'}</p><button type="button" onClick={() => { setSelectedDate(today); document.getElementById('pt-daily-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>Review today <ArrowRight size={14} /></button></article>
    </section>

    <section className="pt-card pt-heatmap-card">
      <div className="pt-card-heading"><div><h3>Daily consistency</h3><p>Select a day to review its checklist and trading results.</p></div><button type="button" className="pt-today-button" onClick={() => setSelectedDate(today)}>Today</button></div>
      <div className="pt-heatmap-scroll">
        <div className="pt-heatmap-layout">
          <div className="pt-weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
          <div className="pt-heatmap-content">
            <div className="pt-months" aria-hidden="true">{calendarCells.map((date, index) => {
              if (!date) return <span className="pt-month-label" key={`pad-${index}`} />
              const isWeekStart = date.getDay() === 0
              const label = date.getDate() <= 7 ? format(date, 'MMM') : ''
              return isWeekStart ? <span className="pt-month-label" key={dayKey(date)}>{label}</span> : null
            })}</div>
            <div className="pt-heatmap-grid" role="grid" aria-label={`Progress for the last ${period} days`}>
              {calendarCells.map((date, index) => {
                if (!date) return <span className="pt-heatmap-cell pt-heatmap-empty" key={`pad-cell-${index}`} />
                const key = dayKey(date)
                const checks = journal[key]?.progressChecks || {}
                const completed = activeRules.filter((rule) => checks[rule.id] === true).length
                const dayTrades = pnlByDay.has(key)
                const ratio = activeRules.length ? completed / activeRules.length : 0
                const inRange = date >= startDate && date <= today
                const cellClass = `pt-heatmap-cell ${!inRange ? 'pt-heatmap-outside' : ''} ${ratio ? `pt-level-${Math.min(4, Math.ceil(ratio * 4))}` : ''} ${dayTrades ? (pnlByDay.get(key) > 0 ? 'pt-has-profit' : pnlByDay.get(key) < 0 ? 'pt-has-loss' : '') : ''} ${key === selectedKey ? 'pt-day-selected' : ''} ${key === todayKey ? 'pt-day-today' : ''}`
                return <button type="button" role="gridcell" key={key} className={cellClass} disabled={!inRange} aria-label={`${format(date, 'EEEE, MMMM d')}: ${completed} of ${activeRules.length} rules complete${dayTrades ? `, ${currency(pnlByDay.get(key))} P&L` : ''}`} aria-pressed={key === selectedKey} title={`${format(date, 'MMM d, yyyy')} · ${completed}/${activeRules.length} rules${dayTrades ? ` · ${currency(pnlByDay.get(key))} P&L` : ''}`} onClick={() => selectHeatmapDay(date)} />
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="pt-heatmap-legend"><span>Less</span><i className="pt-level-0" /><i className="pt-level-1" /><i className="pt-level-2" /><i className="pt-level-3" /><i className="pt-level-4" /><span>More</span><span className="pt-legend-trade"><i /> Trade logged</span></div>
    </section>

    <section className="pt-card pt-daily-card" id="pt-daily-checklist">
      <div className="pt-card-heading">
        <div className="pt-date-heading"><button type="button" aria-label="Previous day" onClick={() => moveSelectedDate(-1)} disabled={selectedDate <= startDate}><ArrowLeft size={16} /></button><div><span className="eyebrow">DAILY CHECKLIST</span><h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3></div><button type="button" aria-label="Next day" onClick={() => moveSelectedDate(1)} disabled={selectedDate >= today}><ArrowRight size={16} /></button></div>
        <div className="pt-day-result"><span>{selectedTrades.length} {selectedTrades.length === 1 ? 'trade' : 'trades'}</span><strong className={selectedPnl > 0 ? 'profit' : selectedPnl < 0 ? 'loss' : ''}>{selectedTrades.length ? currency(selectedPnl) : '—'}</strong></div>
      </div>
      {activeRules.length ? <div className="pt-checklist">{activeRules.map((rule) => <label className={`pt-check-row ${selectedChecks[rule.id] ? 'is-complete' : ''}`} key={rule.id}><input type="checkbox" checked={selectedChecks[rule.id] === true} onChange={() => toggleRule(rule.id)} /><span className="pt-custom-check"><Check size={13} /></span><span>{rule.title}</span></label>)}</div> : <p className="pt-no-rules">No rules yet. Add a few using “Edit rules” below.</p>}
      <p className="pt-save-note">Checklist progress saves with your journal entries.</p>
    </section>

    <section className="pt-card pt-rules-card">
      <div className="pt-card-heading"><div><h3>Current rules</h3><p>See how consistently each habit is followed.</p></div><button type="button" className="pt-edit-button" onClick={editingRules ? saveRules : beginEditRules}>{editingRules ? 'Save rules' : 'Edit rules'}</button></div>
      {editingRules ? <div className="pt-rule-editor">
        {draftRules.map((rule, index) => <div className="pt-rule-edit-row" key={rule.id}><input aria-label={`Rule ${index + 1}`} maxLength={80} value={rule.title} onChange={(event) => setDraftRules((current) => current.map((item) => item.id === rule.id ? { ...item, title: event.target.value } : item))} /><button type="button" aria-label={`Remove rule ${rule.title || index + 1}`} onClick={() => setDraftRules((current) => current.filter((item) => item.id !== rule.id))}><Trash2 size={15} /></button></div>)}
        <div className="pt-add-rule"><input aria-label="New rule" maxLength={80} value={newRule} onChange={(event) => setNewRule(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftRule() } }} placeholder="Add a new rule" /><button type="button" disabled={!newRule.trim() || draftRules.length >= 12} onClick={addDraftRule}><Plus size={15} />Add rule</button></div>
        <p>Keep up to 12 concise rules. Deleting a rule does not erase past journal entries.</p>
      </div> : activeRules.length ? <div className="pt-rules-table-wrap"><table className="pt-rules-table"><thead><tr><th>Rule</th><th>Follow rate</th><th>Rule streak</th><th>Average P&amp;L on checked days</th></tr></thead><tbody>{activeRules.map((rule) => {
        const checkedDays = periodDays.filter((date) => journal[dayKey(date)]?.progressChecks?.[rule.id] === true)
        let ruleStreak = 0
        let cursor = today
        while (journal[dayKey(cursor)]?.progressChecks?.[rule.id] === true) {
          ruleStreak += 1
          cursor = subDays(cursor, 1)
        }
        const averagePnl = checkedDays.length ? checkedDays.reduce((total, date) => total + (pnlByDay.get(dayKey(date)) || 0), 0) / checkedDays.length : null
        const followRate = trackedDays.length ? checkedDays.length / trackedDays.length * 100 : 0
        return <tr key={rule.id}><td>{rule.title}</td><td><span className={`pt-follow-rate ${followRate >= 70 ? 'good' : followRate > 0 ? 'partial' : ''}`}>{percent(followRate)}</span></td><td>{ruleStreak} {ruleStreak === 1 ? 'day' : 'days'}</td><td className={averagePnl > 0 ? 'profit' : averagePnl < 0 ? 'loss' : ''}>{averagePnl === null ? '—' : currency(averagePnl)}</td></tr>
      })}</tbody></table></div> : <p className="pt-no-rules">Add rules to start tracking your consistency.</p>}
    </section>
  </main>
}
