import { useEffect, useState } from 'react'
import { Check, Circle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJournal } from '../hooks/useJournal'
import '../onboarding.css'

const CHECKLIST_LENGTH = 5
const COMPLETION_MESSAGE_MS = 2200

export default function OnboardingChecklist() {
  const {
    accounts = [],
    trades = [],
    journal = {},
    playbooks = [],
    settings = {},
    setSettings,
    setAddTradeOpen,
    setEditingTrade,
  } = useJournal()
  const [completionState, setCompletionState] = useState('active')

  const hasJournalEntry = Object.values(journal).some((entry) => entry && Object.entries(entry).some(
    ([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value)),
  ))
  const hasRealTrade = trades.some((trade) => !trade.isDemo)
  const checks = [
    accounts.length > 0,
    hasRealTrade,
    hasJournalEntry,
    playbooks.length > 0,
    Boolean(settings.monthlyGoalConfigured),
  ]
  const completedCount = checks.filter(Boolean).length
  const complete = completedCount === CHECKLIST_LENGTH
  const hasReturningUserActivity = hasRealTrade && hasJournalEntry && playbooks.length > 0

  useEffect(() => {
    if (!complete || hasReturningUserActivity || settings.onboardingChecklistDismissed) return undefined
    setCompletionState('complete')
    const timer = window.setTimeout(() => setCompletionState('hidden'), COMPLETION_MESSAGE_MS)
    return () => window.clearTimeout(timer)
  }, [complete, hasReturningUserActivity, settings.onboardingChecklistDismissed])

  if (settings.onboardingChecklistDismissed || hasReturningUserActivity || completionState === 'hidden') return null

  const dismiss = () => setSettings((current) => ({ ...current, onboardingChecklistDismissed: true }))
  const openAddTrade = () => {
    setEditingTrade(null)
    setAddTradeOpen(true)
  }

  if (complete || completionState === 'complete') {
    return <section className="onb-card onb-complete" role="status" aria-live="polite">
      <Check size={19} aria-hidden="true" />
      <p>You’re all set</p>
    </section>
  }

  const items = [
    { title: 'Add your first account', done: checks[0], to: '/settings?tab=Preferences', action: 'Open accounts' },
    { title: 'Log or import your first trade', done: checks[1], to: '/import', action: 'Import trades' },
    { title: 'Write your first journal entry', done: checks[2], to: '/journal', action: 'Open journal' },
    { title: 'Create a playbook', done: checks[3], to: '/playbooks', action: 'Open playbooks' },
    { title: 'Set a monthly goal', done: checks[4], to: '#dashboard-goals', action: 'Set a goal', anchor: true },
  ]

  return <section className="onb-card" aria-labelledby="onb-title">
    <div className="onb-header">
      <div>
        <span className="onb-eyebrow">GETTING STARTED</span>
        <h2 id="onb-title">Make TradeJournal yours</h2>
        <p>{completedCount} of {CHECKLIST_LENGTH} complete</p>
      </div>
      <button type="button" className="onb-dismiss" onClick={dismiss}>Dismiss</button>
    </div>
    <div className="onb-progress" role="progressbar" aria-label="Onboarding progress" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={CHECKLIST_LENGTH}>
      <span style={{ width: `${completedCount / CHECKLIST_LENGTH * 100}%` }} />
    </div>
    <ol className="onb-list">
      {items.map((item, index) => (
        <li key={item.title}>
          {index === 1 && !item.done ? (
            <div className="onb-item">
              <span className={`onb-check ${item.done ? 'onb-done' : ''}`} aria-hidden="true">{item.done ? <Check size={14} /> : <Circle size={14} />}</span>
              <span className="onb-item-title">{item.title}</span>
              <span className="onb-item-actions">
                <button type="button" onClick={openAddTrade}>Add trade</button>
                <Link to={item.to}>{item.action}<ChevronRight size={14} /></Link>
              </span>
            </div>
          ) : item.anchor ? (
            <a className="onb-item" href={item.to}>
              <span className={`onb-check ${item.done ? 'onb-done' : ''}`} aria-hidden="true">{item.done ? <Check size={14} /> : <Circle size={14} />}</span>
              <span className="onb-item-title">{item.title}</span>
              <span className="onb-item-action">{item.done ? 'Done' : item.action}<ChevronRight size={14} /></span>
            </a>
          ) : (
            <Link className="onb-item" to={item.to}>
              <span className={`onb-check ${item.done ? 'onb-done' : ''}`} aria-hidden="true">{item.done ? <Check size={14} /> : <Circle size={14} />}</span>
              <span className="onb-item-title">{item.title}</span>
              <span className="onb-item-action">{item.done ? 'Done' : item.action}<ChevronRight size={14} /></span>
            </Link>
          )}
        </li>
      ))}
    </ol>
  </section>
}
