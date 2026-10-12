import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Bitcoin,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  History,
  LockKeyhole,
  LineChart,
  MoreHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  ArrowRight,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { updateProfileSettings } from '../../data/repo'
import { useJournal } from '../../hooks/useJournal'
import { BitcoinBrand, BrokerBrand, CartoonAvatar, hasBrokerBrand, SimpleBrandIcon } from './OnboardingIllustrations'
import { brokerOptions, onboardingSteps } from './onboardingSteps'

const initialAnswers = {
  experience: '',
  capitalType: [],
  struggles: [],
  broker: '',
  markets: [],
  goals: [],
  source: [],
}

const optionIcons = {
  sprout: Activity,
  trending: TrendingUp,
  target: Target,
  lotus: Sparkles,
  stocks: TrendingUp,
  options: FileText,
  forex: ArrowLeftRight,
  crypto: Bitcoin,
  futures: Clock3,
  cfd: LineChart,
  other: MoreHorizontal,
  journal: FileText,
  analyze: BarChart3,
  backtest: History,
  learn: GraduationCap,
  ai: Sparkles,
  community: UsersRound,
  friend: UserRound,
}
const savedAnswers = (value) => ({
  experience: typeof value?.experience === 'string' ? value.experience : '',
  capitalType: Array.isArray(value?.capitalType) ? value.capitalType : [],
  struggles: Array.isArray(value?.struggles) ? value.struggles : [],
  broker: typeof value?.broker === 'string' ? value.broker : '',
  markets: Array.isArray(value?.markets) ? value.markets : [],
  goals: Array.isArray(value?.goals) ? value.goals : [],
  source: Array.isArray(value?.source) ? value.source : [],
})

const resumeStep = (value) => {
  const step = Number(value)
  return Number.isInteger(step) ? Math.max(0, Math.min(onboardingSteps.length - 1, step)) : 0
}

function LogoMark() {
  return <div className="obf-logo-mark"><img src="/bear-logo.png" alt="TradeJournal bear logo" /></div>
}

function PolyPattern() {
  return <svg className="obf-poly-pattern" viewBox="0 0 420 780" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M0 0h420L280 170 95 135 0 240zM95 135l185 35-72 210L0 240zM280 170l140 110v210l-212-110zM208 415l212 75v190H82zM0 240l208 175-126 265L0 610zM0 610l82 70-82 100zM420 0v280l-140-110zM280 170l-72 245 212-135zM82 680l126-265 212 75\" fill="none" stroke="#fff" strokeWidth="1.2" />
    <path d="M0 0l95 135L0 240zm420 0L280 170l140 110zM280 170l-72 245 212-135zM82 680l126-265L0 240z" fill="#fff" fillOpacity=".16" />
  </svg>
}

function BrokerIllustration() {
  return <svg className="obf-broker-art" viewBox="0 0 250 150" role="img" aria-label="Pastel isometric bar chart illustration">
    <g className="obf-art-float">
      <path d="M26 102 128 53l100 47-102 48z" fill="#27213D" />
      <path d="m46 101 82-39 78 38-82 39z" fill="#39324F" />
      <path d="m65 100 63-30 60 29-64 30z" fill="#322C48" stroke="#77708F" strokeWidth="1" />
      <path d="m83 96 15-7v-27l-15 7z" fill="#F3A56E" />
      <path d="m98 89 16 8V70l-16-8z" fill="#D9855F" />
      <path d="m114 93 16-8V43l-16 8z" fill="#F6C18F" />
      <path d="m130 85 16 8V48l-16-8z" fill="#E99CA7" />
      <path d="m146 94 16-8V66l-16 8z" fill="#EEB2B9" />
      <path d="m162 86 15 7V57l-15-7z" fill="#80C7C0" />
      <path d="M67 104 128 75m-40 40 61-29m-40 39 61-29m-94 0 80 39m-64-47 80 39" fill="none" stroke="#5A536C" strokeWidth="1" opacity=".7" />
      <circle cx="103" cy="50" r="3" fill="#F6C18F" />
      <circle cx="148" cy="38" r="3" fill="#E99CA7" />
      <circle cx="178" cy="53" r="3" fill="#80C7C0" />
    </g>
  </svg>
}

function SelectableOptions({ step, value, onChange, onLimit, onSelected, shake }) {
  const multiple = step.type !== 'single'
  const selected = multiple ? value : [value].filter(Boolean)
  const role = multiple ? 'checkbox' : 'radio'
  const chooseOption = (label) => {
    if (step.key === 'capitalType') {
      if (label === "I haven't started yet") {
        onChange(selected.includes(label) ? [] : [label])
        return
      }
      const next = selected.filter((item) => item !== "I haven't started yet")
      onChange(next.includes(label) ? next.filter((item) => item !== label) : [...next, label])
      return
    }
    if (step.type === 'single') {
      onChange(label)
      onSelected?.()
      return
    }
    if (step.type === 'limited' && !selected.includes(label) && selected.length >= 2) {
      onLimit()
      return
    }
    onChange(selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label])
  }

  const moveFocus = (event) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
    event.preventDefault()
    const options = [...event.currentTarget.closest('[role="group"], [role="radiogroup"]').querySelectorAll('[role="radio"], [role="checkbox"]')]
    const currentIndex = options.indexOf(event.currentTarget)
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + direction + options.length) % options.length
    options[nextIndex].focus()
    options[nextIndex].click()
  }

  return <div className={`obf-options obf-options-${step.key} ${step.layout === 'grid' ? 'obf-options-grid' : ''} ${step.type === 'single' ? 'obf-options-experience' : ''} ${shake ? 'obf-is-shaking' : ''}`} role={multiple ? 'group' : 'radiogroup'} aria-label={step.title}>
    {step.options.map((option, index) => {
      const isSelected = selected.includes(option.label)
      const Icon = option.icon ? optionIcons[option.icon] : null
      const isExperience = step.key === 'experience'
      return <button
        className={`obf-option ${isSelected ? 'is-selected' : ''} ${step.layout === 'grid' ? 'obf-option-grid' : ''} ${step.type === 'single' ? 'obf-option-experience-card' : ''} ${step.type === 'capital' ? 'obf-option-text-only' : ''}`}
        key={option.label}
        type="button"
        role={role}
        aria-checked={isSelected}
        style={{ '--obf-delay': `${Math.min(index, 7) * 60}ms` }}
        onClick={() => chooseOption(option.label)}
        onKeyDown={moveFocus}
      >
        {option.icon && step.type !== 'single' && <span className={`obf-option-icon obf-color-${option.color} obf-icon-${option.icon}`}>
          {step.key === 'source' && ['google', 'x', 'instagram', 'tiktok', 'youtube', 'reddit'].includes(option.icon)
            ? <SimpleBrandIcon name={option.label === 'Google search' ? 'Google' : option.label} />
            : option.icon === 'crypto'
              ? <BitcoinBrand />
              : Icon && <Icon size={36} strokeWidth={2.15} />}
          {option.icon === 'options' && <span className="obf-icon-decoration">$</span>}
          {option.icon === 'forex' && <span className="obf-icon-decoration">$</span>}
          {option.icon === 'futures' && <span className="obf-icon-decoration">↗</span>}
        </span>}
        {isExperience && <CartoonAvatar type={['newbie', 'climber', 'ninja', 'monk'][index]} />}
        <span className="obf-option-copy">
          <strong>{option.label}</strong>
          {option.detail && <small>{option.detail}</small>}
        </span>
        {isSelected && <span className="obf-selected-badge" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
      </button>
    })}
  </div>
}

function BrokerSelect({ value, onChange, onSelected }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value && !brokerOptions.includes(value) ? '' : value)
  const [customBroker, setCustomBroker] = useState(value && !brokerOptions.includes(value) ? value : '')
  const [isOther, setIsOther] = useState(Boolean(value && !brokerOptions.includes(value)))
  const inputRef = useRef(null)
  const otherInputRef = useRef(null)
  const skipOpenOnFocusRef = useRef(false)
  const filteredBrokers = useMemo(() => brokerOptions.filter((broker) => broker !== 'Other (type your own)' && broker.toLowerCase().includes(query.toLowerCase())), [query])
  const otherInitials = (name) => name === 'Interactive Brokers'
    ? 'IB'
    : name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const moveBrokerFocus = (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    const options = [...event.currentTarget.parentElement.querySelectorAll('[role="option"]')]
    const currentIndex = options.indexOf(event.currentTarget)
    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
    options[nextIndex].focus()
  }

  const selectBroker = (broker) => {
    if (broker === 'Other (type your own)') {
      setIsOther(true)
      setCustomBroker('')
      onChange('')
      setQuery('')
      setOpen(false)
      window.setTimeout(() => otherInputRef.current?.focus(), 0)
      return
    }
    onChange(broker)
    onSelected?.()
    setQuery(broker)
    setCustomBroker('')
    setIsOther(false)
    setOpen(false)
    skipOpenOnFocusRef.current = true
    inputRef.current?.focus()
  }

  return <div className="obf-broker-select">
    <label className="obf-visually-hidden" htmlFor="obf-broker-search">Select broker</label>
    <div className="obf-broker-control">
      <div className={`obf-broker-input-wrap ${open ? 'is-open' : ''}`}>
        <input
          ref={inputRef}
          id="obf-broker-search"
          type="text"
          role="combobox"
          aria-label="Select broker"
          aria-expanded={open}
          aria-controls="obf-broker-list"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Select broker"
          value={open ? query : value || customBroker}
          onFocus={() => {
            if (skipOpenOnFocusRef.current) {
              skipOpenOnFocusRef.current = false
              return
            }
            setQuery(value && brokerOptions.includes(value) ? value : '')
            setOpen(true)
          }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setIsOther(false); onChange(''); setCustomBroker('') }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              window.setTimeout(() => {
                const options = document.querySelectorAll('#obf-broker-list [role="option"]')
                options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus()
              }, 0)
            }
            if (event.key === 'Enter' && filteredBrokers.length) {
              event.preventDefault()
              selectBroker(filteredBrokers[0])
            }
          }}
        />
        {value || customBroker
          ? <button className="obf-broker-clear" type="button" aria-label="Clear broker" onClick={() => {
              onChange('')
              setCustomBroker('')
              setQuery('')
              setIsOther(false)
              setOpen(false)
              skipOpenOnFocusRef.current = true
              inputRef.current?.focus()
            }}><X size={18} /></button>
          : <button className="obf-broker-chevron" type="button" aria-label={open ? 'Close broker list' : 'Open broker list'} onClick={() => { setOpen((current) => !current); inputRef.current?.focus() }}><ChevronDown size={19} /></button>}
      </div>
      {open && <div id="obf-broker-list" className="obf-broker-list" role="listbox" aria-label="Broker options">
        {filteredBrokers.map((broker) => <button type="button" role="option" aria-selected={broker === value} key={broker} onClick={() => selectBroker(broker)} onKeyDown={moveBrokerFocus}>
          <span className="obf-broker-logo-wrap"><BrokerBrand name={broker} />{!hasBrokerBrand(broker) && <span className="obf-broker-initials">{otherInitials(broker)}</span>}</span><span>{broker}</span>
        </button>)}
        <button type="button" role="option" aria-selected={false} onClick={() => selectBroker('Other (type your own)')} onKeyDown={moveBrokerFocus}>
          <span className="obf-broker-initials obf-broker-other">+</span><span>Other (type your own)</span>
        </button>
      </div>}
    </div>
    {isOther && <input
      ref={otherInputRef}
      className="obf-other-broker"
      type="text"
      aria-label="Type your broker name"
      placeholder="Other broker name"
      value={customBroker}
      onFocus={() => setOpen(false)}
      onChange={(event) => { setCustomBroker(event.target.value); onChange(event.target.value.trim()) }}
      onBlur={() => { if (customBroker.trim()) onSelected?.() }}
    />}
  </div>
}

function BackgroundConfetti() {
  return <div className="obf-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2
    return <i key={index} style={{
      '--obf-x': `${Math.round(Math.cos(angle) * 150)}px`,
      '--obf-y': `${Math.round(Math.sin(angle) * 190)}px`,
      '--obf-turn': `${index * 37}deg`,
    }} />
  })}</div>
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { accounts = [], addAccount, setSettings } = useJournal()
  const profileSettings = profile?.settings || {}
  const saved = { ...(profileSettings.appSettings || {}), ...profileSettings }
  const [stepIndex, setStepIndex] = useState(() => resumeStep(saved.onboardingStep))
  const [answers, setAnswers] = useState(() => ({ ...initialAnswers, ...savedAnswers(saved.onboarding) }))
  const [direction, setDirection] = useState('forward')
  const [transition, setTransition] = useState('in')
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [shake, setShake] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const transitionTimer = useRef(null)
  const hintTimer = useRef(null)
  const autoContinueTimer = useRef(null)
  const continueStepRef = useRef(null)
  const currentStep = onboardingSteps[stepIndex]
  const currentValue = answers[currentStep.key]
  const canContinue = currentStep.type === 'single'
    ? Boolean(currentValue)
    : currentStep.type === 'broker'
      ? Boolean(currentValue.trim())
      : Array.isArray(currentValue) && currentValue.length > 0

  useEffect(() => () => {
    window.clearTimeout(transitionTimer.current)
    window.clearTimeout(hintTimer.current)
    window.clearTimeout(autoContinueTimer.current)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { document.title = 'Welcome | TradeJournal' }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if ((saved.onboardingCompleted === true || saved.appSettings?.onboardingCompleted === true) && !finished) navigate('/', { replace: true })
  }, [saved.onboardingCompleted, saved.appSettings?.onboardingCompleted, finished, navigate])

  const saveAnswers = async (nextAnswers, nextStep, completed) => {
    if (!user?.id || !profile) throw new Error('Your account profile is not available. Please reload and try again.')
    setSettings((current) => ({
      ...current,
      onboarding: nextAnswers,
      onboardingStep: nextStep,
      onboardingCompleted: completed,
    }))
    const result = await updateProfileSettings(user.id, {
      ...profileSettings,
      appSettings: {
        ...(profileSettings.appSettings || {}),
        onboarding: nextAnswers,
        onboardingStep: nextStep,
        onboardingCompleted: completed,
      },
      onboarding: nextAnswers,
      onboardingStep: nextStep,
      onboardingCompleted: completed,
    })
    if (result.error) throw result.error
  }

  const createBrokerAccountIfNeeded = (broker) => {
    if (broker && accounts.length === 0) addAccount({ name: `${broker} account`, broker, currency: 'USD' })
  }

  const showLimitHint = () => {
    setHint('Choose up to 2 options.')
    setShake(true)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => { setHint(''); setShake(false) }, 1100)
  }

  const updateAnswer = (key, value) => setAnswers((current) => ({ ...current, [key]: value }))

  const changeStep = (nextIndex, nextDirection) => {
    setDirection(nextDirection)
    setTransition('out')
    window.clearTimeout(transitionTimer.current)
    transitionTimer.current = window.setTimeout(() => {
      setStepIndex(nextIndex)
      setTransition('in')
    }, 200)
  }

  const finishOnboarding = async ({ skip = false } = {}) => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      createBrokerAccountIfNeeded(answers.broker)
      await saveAnswers(answers, stepIndex, true)
      const refreshed = await refreshProfile()
      if (!refreshed?.settings?.onboardingCompleted && !refreshed?.settings?.appSettings?.onboardingCompleted) throw new Error('Onboarding status could not be refreshed.')
      if (skip) {
        navigate('/', { replace: true })
        return
      }
      setFinished(true)
      transitionTimer.current = window.setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (saveError) {
      console.error('Could not save onboarding answers:', saveError)
      setError(saveError?.message || 'Your answers could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const continueStep = async () => {
    if (!canContinue || saving) return
    setSaving(true)
    setError('')
    try {
      if (stepIndex === onboardingSteps.length - 1) {
        await saveAnswers(answers, stepIndex, true)
        createBrokerAccountIfNeeded(answers.broker)
        setFinished(true)
        const refreshed = await refreshProfile()
        if (!refreshed?.settings?.onboardingCompleted && !refreshed?.settings?.appSettings?.onboardingCompleted) {
          setFinished(false)
          throw new Error('Onboarding status could not be refreshed.')
        }
        continueStepRef.current = continueStep

        const autoContinue = () => {
          if (currentStep.key !== 'experience' && currentStep.key !== 'broker') return
          window.clearTimeout(autoContinueTimer.current)
          autoContinueTimer.current = window.setTimeout(() => continueStepRef.current?.(), 600)
        }
        transitionTimer.current = window.setTimeout(() => navigate('/', { replace: true }), 1500)
      } else {
        const nextStep = stepIndex + 1
        await saveAnswers(answers, nextStep, false)
        changeStep(nextStep, 'forward')
      }
    } catch (saveError) {
      console.error('Could not save onboarding progress:', saveError)
      setError(saveError?.message || 'Your answers could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const goBack = async () => {
    if (stepIndex === 0 || saving) return
    window.clearTimeout(autoContinueTimer.current)
    setSaving(true)
    setError('')
    try {
      const previousStep = stepIndex - 1
      await saveAnswers(answers, previousStep, false)
      changeStep(previousStep, 'back')
    } catch (saveError) {
      console.error('Could not save onboarding progress:', saveError)
      setError(saveError?.message || 'Your answers could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (finished) {
    return <main className="obf-page obf-finished-page" style={{ colorScheme: 'light' }}>
      <PolyPattern />
      <BackgroundConfetti />
      <section className="obf-finished-content" role="status" aria-live="polite">
        <span className="obf-finished-check"><svg viewBox="0 0 88 88" aria-hidden="true"><circle className="obf-check-ring" cx="44" cy="44" r="39" /><path className="obf-check-tick" d="m27 45 12 12 23-26" /></svg></span>
        <h1>You're all set</h1>
      </section>
    </main>
  }

  const canSkip = !saving
  const showLogo = stepIndex < 3

  return <main className={`obf-page ${stepIndex === 5 ? 'obf-dark-step' : ''}`} style={{ colorScheme: stepIndex === 5 ? 'dark' : 'light' }}>
    <PolyPattern />
    <div className="obf-progress-wrap">
      <div className="obf-progress-track" role="progressbar" aria-label="Onboarding progress" aria-valuenow={stepIndex + 1} aria-valuemin="1" aria-valuemax={onboardingSteps.length}>
        <span style={{ width: `${((stepIndex + 1) / onboardingSteps.length) * 100}%` }} />
      </div>
    </div>
    <div className="obf-back-wrap">
      <button className="obf-back-button" type="button" aria-label="Go to previous step" disabled={stepIndex === 0 || saving} onClick={goBack}><ArrowLeft size={25} /></button>
    </div>
    <div className="obf-content">
      <section className={`obf-stage obf-stage-${transition} obf-stage-${direction}`} aria-live="polite" aria-atomic="true">
        {showLogo && <LogoMark />}
        {stepIndex === 3 && <BrokerIllustration />}
        <header className={`obf-heading ${stepIndex === 5 ? 'obf-heading-goals' : ''}`}>
          <h1>{currentStep.title}</h1>
          <p>{currentStep.subtitle}</p>
        </header>
        {currentStep.type === 'broker'
            ? <BrokerSelect key={stepIndex} value={answers.broker} onChange={(value) => updateAnswer('broker', value)} onSelected={autoContinue} />
          : <SelectableOptions
                key={stepIndex}
                step={currentStep}
              value={currentValue}
              onChange={(value) => updateAnswer(currentStep.key, value)}
              onSelected={autoContinue}
              onLimit={showLimitHint}
              shake={shake}
            />}
        <p className={`obf-hint ${hint ? 'is-visible' : ''}`} role="status" aria-live="polite">{hint}</p>
      </section>
      <footer className="obf-footer">
        {error && <p className="obf-error" role="alert">{error}</p>}
        <button className="obf-continue" type="button" disabled={!canContinue || saving} onClick={continueStep}>
          {saving ? 'Saving…' : <>{stepIndex === onboardingSteps.length - 1 ? 'Finish' : 'Continue'}<ArrowRight className="obf-continue-arrow" size={20} aria-hidden="true" /></>}
        </button>
        {!canContinue && <p className="obf-disabled-hint"><LockKeyhole size={13} aria-hidden="true" />Choose an option to continue</p>}
        <button className="obf-skip" type="button" disabled={!canSkip} onClick={() => finishOnboarding({ skip: true })}>Skip for now</button>
      </footer>
    </div>
  </main>
}
