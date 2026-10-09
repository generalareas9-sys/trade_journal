import { useEffect, useRef, useState } from 'react'
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
  const toggleRef = useRef(null)
  const collapsed = settings.onboardingCollapsed === true
    || settings.onboardingCollapsed === undefined && Boolean(settings.onboardingChecklistDismissed)
  const previousCollapsed = useRef(collapsed)

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
    if (!complete || hasReturningUserActivity || collapsed) return undefined
    setCompletionState('complete')
    const timer = window.setTimeout(() => {
      setSettings((current) => ({ ...current, onboardingCollapsed: true }))
      setCompletionState('hidden')
    }, COMPLETION_MESSAGE_MS)
    return () => window.clearTimeout(timer)
  }, [complete, hasReturningUserActivity, collapsed, setSettings])

  useEffect(() => {
    if (previousCollapsed.current !== collapsed) toggleRef.current?.focus()
    previousCollapsed.current = collapsed
  }, [collapsed])

  if (hasReturningUserActivity) return null

  const toggleCollapsed = () => setSettings((current) => ({ ...current, onboardingCollapsed: !collapsed }))
  const openAddTrade = () => {
    setEditingTrade(null)
    setAddTradeOpen(true)
  }

  const items = [
    { title: 'Add your first account', done: checks[0], to: '/settings?tab=Preferences', action: 'Open accounts' },
    { title: 'Log or import your first trade', done: checks[1], to: '/import', action: 'Import trades' },
    { title: 'Write your first journal entry', done: checks[2], to: '/journal', action: 'Open journal' },
    { title: 'Create a playbook', done: checks[3], to: '/playbooks', action: 'Open playbooks' },
    { title: 'Set a monthly goal', done: checks[4], to: '#dashboard-goals', action: 'Set a goal', anchor: true },
  ]

  const showCompleteMessage = complete || completionState === 'complete' || completionState === 'hidden'

  return <section className={`onb-card${collapsed ? ' onb-collapsed' : ''}`} aria-labelledby={collapsed ? undefined : 'onb-title'}>
    <div className="onb-bar-wrap">
      <div className="onb-collapsed-bar">
        <span className="onb-bar-check"><Check size={15} aria-hidden="true" /></span>
        <span className="onb-bar-summary">
          <span>{complete ? 'Getting started · All done' : `Getting started · ${completedCount} of ${CHECKLIST_LENGTH} complete`}</span>
          <span className="onb-bar-progress" role="progressbar" aria-label="Onboarding progress" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={CHECKLIST_LENGTH}>
            <span style={{ width: `${completedCount / CHECKLIST_LENGTH * 100}%` }} />
          </span>
        </span>
        <button
          ref={collapsed ? toggleRef : null}
          type="button"
          className="onb-dismiss onb-show"
          aria-expanded={!collapsed}
          aria-controls="onb-checklist-content"
          onClick={toggleCollapsed}
        >Show checklist</button>
      </div>
    </div>
    <div
      id="onb-checklist-content"
      className="onb-expand-wrap"
      aria-hidden={collapsed}
      inert={collapsed}
    >
      <div className="onb-expanded-content">
        {showCompleteMessage ? (
          <div className="onb-complete" role="status" aria-live="polite">
            <Check size={19} aria-hidden="true" />
            <p>You’re all set</p>
            <button
              ref={!collapsed ? toggleRef : null}
              type="button"
              className="onb-dismiss"
              aria-expanded={!collapsed}
              aria-controls="onb-checklist-content"
              onClick={toggleCollapsed}
            >Hide</button>
          </div>
        ) : <>
          <div className="onb-header">
            <div>
              <span className="onb-eyebrow">GETTING STARTED</span>
              <h2 id="onb-title">Make TradeJournal yours</h2>
              <p>{completedCount} of {CHECKLIST_LENGTH} complete</p>
            </div>
            <button
              ref={!collapsed ? toggleRef : null}
              type="button"
              className="onb-dismiss"
              aria-expanded={!collapsed}
              aria-controls="onb-checklist-content"
              onClick={toggleCollapsed}
            >Hide</button>
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
        </>}
      </div>
    </div>
  </section>
}
