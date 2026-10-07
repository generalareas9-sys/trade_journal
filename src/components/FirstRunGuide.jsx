import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Circle, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useJournal } from '../hooks/useJournal'
import './FirstRunGuide.css'

const welcomeSteps = [
  {
    title: 'Welcome to TradeJournal',
    body: 'A calm place to record your decisions, understand your results, and build a process you can repeat.',
  },
  {
    title: 'Log a trade',
    body: 'Add the entry, exit, risk, and the reasoning behind the trade. A little context makes each review more useful.',
  },
  {
    title: 'Import your history',
    body: 'Bring in a CSV export from your broker to see your performance over time. You can review the column mapping before importing.',
  },
  {
    title: 'Learn from discipline reports',
    body: 'Reports connect your results with your rules, sessions, strategies, and recorded mistakes—so you can focus on process, not just outcomes.',
  },
]

export function WelcomeGuide() {
  const { settings = {}, setSettings } = useJournal()
  const [step, setStep] = useState(0)
  if (settings.welcomeGuideDismissed) return null

  const dismiss = () => setSettings((current) => ({ ...current, welcomeGuideDismissed: true }))
  const current = welcomeSteps[step]

  return <div className="first-run-overlay" role="presentation">
    <section className="first-run-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-guide-title">
      <button type="button" className="first-run-close" aria-label="Skip welcome guide" onClick={dismiss}><X size={18} /></button>
      <span className="eyebrow">GETTING STARTED · {step + 1} OF {welcomeSteps.length}</span>
      <div className="first-run-progress" aria-hidden="true"><i style={{ width: `${(step + 1) / welcomeSteps.length * 100}%` }} /></div>
      <h2 id="welcome-guide-title">{current.title}</h2>
      <p>{current.body}</p>
      <div className="first-run-dialog-footer">
        <button type="button" className="first-run-skip" onClick={dismiss}>Skip for now</button>
        <div>
          {step > 0 && <button type="button" className="button-secondary" onClick={() => setStep((value) => value - 1)}><ChevronLeft size={16} /> Back</button>}
          <button type="button" className="button-primary" onClick={() => step === welcomeSteps.length - 1 ? dismiss() : setStep((value) => value + 1)}>{step === welcomeSteps.length - 1 ? 'Get started' : 'Next'}{step < welcomeSteps.length - 1 && <ChevronRight size={16} />}</button>
        </div>
      </div>
    </section>
  </div>
}

export function OnboardingChecklist({ onAddTrade }) {
  const { accounts = [], trades = [], journal = {}, playbooks = [], settings = {}, setSettings, addAccount } = useJournal()
  const [accountDialog, setAccountDialog] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountBroker, setAccountBroker] = useState('')
  const [accountCurrency, setAccountCurrency] = useState('USD')
  const [accountError, setAccountError] = useState('')
  const navigate = useNavigate()

  if (settings.onboardingChecklistDismissed) return null
  const hasRealTrades = trades.some((trade) => !trade.isDemo)
  const hasJournal = Object.values(journal).some((entry) => entry && Object.entries(entry).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))))
  const checks = [
    accounts.length > 0,
    hasRealTrades,
    hasJournal,
    playbooks.length > 0,
    Boolean(settings.monthlyGoalConfigured),
  ]
  const items = [
    { title: 'Add your first account', action: () => setAccountDialog(true), label: 'Add account' },
    { title: 'Import trades or add one', action: () => navigate('/import'), label: 'Import trades' },
    { title: 'Write your first journal entry', to: '/journal', label: 'Open journal' },
    { title: 'Create a playbook', to: '/playbooks', label: 'Open playbooks' },
    { title: 'Set a monthly goal', to: '/settings?tab=Preferences', label: 'Set goal' },
  ]
  const done = checks.filter(Boolean).length
  const percent = Math.round(done / checks.length * 100)

  if (done === checks.length) return null
  const addFirstAccount = (event) => {
    event.preventDefault()
    if (!accountName.trim()) {
      setAccountError('Enter a name for this account.')
      return
    }
    addAccount({ name: accountName.trim(), broker: accountBroker.trim(), currency: accountCurrency })
    setAccountDialog(false)
    setAccountName('')
    setAccountBroker('')
    setAccountCurrency('USD')
    setAccountError('')
  }

  return <>
    <section className="panel onboarding-card" aria-labelledby="onboarding-title">
      <div className="onboarding-head">
        <div><span className="eyebrow">YOUR FIRST FIVE STEPS</span><h2 id="onboarding-title">Make TradeJournal yours</h2><p>{done} of {checks.length} complete</p></div>
        <button type="button" className="onboarding-dismiss" onClick={() => setSettings((current) => ({ ...current, onboardingChecklistDismissed: true }))}>Dismiss</button>
      </div>
      <div className="onboarding-progress" role="progressbar" aria-label="Getting started progress" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${percent}%` }} /></div>
      <ol className="onboarding-list">{items.map((item, index) => {
        const content = <><span className={`onboarding-check ${checks[index] ? 'is-done' : ''}`}>{checks[index] ? <Check size={13} /> : <Circle size={13} />}</span><span className="onboarding-item-title">{item.title}</span><span className="onboarding-item-action">{checks[index] ? 'Done' : item.label}<ChevronRight size={14} /></span></>
        return <li key={item.title}>{item.to
          ? <Link to={item.to} aria-label={`${item.title} — ${item.label}`}>{content}</Link>
          : <button type="button" onClick={item.action} aria-label={`${item.title} — ${item.label}`}>{content}</button>}
        </li>
      })}</ol>
      {!hasRealTrades && <div className="onboarding-shortcuts"><button type="button" className="button-secondary" onClick={onAddTrade}>Add a trade</button><Link className="button-secondary" to="/import">Import CSV</Link></div>}
    </section>
    {accountDialog && <div className="first-run-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountDialog(false) }}>
      <form className="first-run-dialog account-quick-dialog" role="dialog" aria-modal="true" aria-labelledby="first-account-title" onSubmit={addFirstAccount}>
        <button type="button" className="first-run-close" aria-label="Close account form" onClick={() => setAccountDialog(false)}><X size={18} /></button>
        <span className="eyebrow">ACCOUNT SETUP</span><h2 id="first-account-title">Add your first account</h2><p>Use a name that helps you recognize this trading account.</p>
        <label>Account name<input autoFocus value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="e.g. Personal account" /></label>
        <label>Broker <span>(optional)</span><input value={accountBroker} onChange={(event) => setAccountBroker(event.target.value)} placeholder="Broker name" /></label>
        <label>Currency<select value={accountCurrency} onChange={(event) => setAccountCurrency(event.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>CAD</option><option>AUD</option></select></label>
        {accountError && <p className="first-run-error" role="alert">{accountError}</p>}
        <div className="first-run-dialog-footer"><button type="button" className="first-run-skip" onClick={() => setAccountDialog(false)}>Cancel</button><button type="submit" className="button-primary">Save account</button></div>
      </form>
    </div>}
  </>
}
