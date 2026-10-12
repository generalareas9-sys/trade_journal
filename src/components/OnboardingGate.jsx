import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateProfileSettings } from '../data/repo'
import { useJournal } from '../hooks/useJournal'

function hasJournalEntries(journal) {
  return Object.values(journal || {}).some((entry) => entry && Object.entries(entry).some(([key, value]) => (
    key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))
  )))
}

function GateMessage({ children, action, label }) {
  return <main className="obf-gate-message" role="status">
    <p>{children}</p>
    {action && <button type="button" onClick={action}>{label}</button>}
  </main>
}

export default function OnboardingGate() {
  const { user, profile, refreshProfile } = useAuth()
  const { dataLoading, dataError, retryLoad, trades = [], journal = [], setSettings } = useJournal()
  const location = useLocation()
  const [profileReady, setProfileReady] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileRetry, setProfileRetry] = useState(0)
  const [activityError, setActivityError] = useState('')
  const [activitySaving, setActivitySaving] = useState(false)

  useEffect(() => {
    let active = true
    setProfileReady(false)
    setProfileError('')
    if (profile?.user_id === user?.id) {
      setProfileReady(true)
      return () => { active = false }
    }
    refreshProfile().then((result) => {
      if (!active) return
      if (!result) {
        setProfileError('Your onboarding status could not be loaded. Please try again.')
        return
      }
      setProfileReady(true)
    }).catch((error) => {
      console.error('Could not load onboarding status:', error)
      if (active) setProfileError(error?.message || 'Your onboarding status could not be loaded. Please try again.')
    })
    return () => { active = false }
  }, [user?.id, profile?.user_id, profileRetry, refreshProfile])

  const hasPriorActivity = trades.some((trade) => !trade.isDemo) || hasJournalEntries(journal)
  const onboardingCompleted = profile?.settings?.onboardingCompleted === true
    || profile?.settings?.appSettings?.onboardingCompleted === true
  const shouldAutoComplete = profileReady && !dataLoading && !dataError && !onboardingCompleted && hasPriorActivity

  useEffect(() => {
    if (!shouldAutoComplete || !user?.id) return undefined
    let active = true
    setActivitySaving(true)
    setActivityError('')
    setSettings((current) => ({ ...current, onboardingCompleted: true }))
    updateProfileSettings(user.id, {
      ...(profile?.settings || {}),
      onboardingCompleted: true,
      appSettings: {
        ...(profile?.settings?.appSettings || {}),
        onboardingCompleted: true,
      },
    }).then(async (result) => {
      if (result.error) throw result.error
      if (active) setActivitySaving(false)
      const refreshed = await refreshProfile()
      if (!refreshed?.settings?.onboardingCompleted && !refreshed?.settings?.appSettings?.onboardingCompleted) {
        throw new Error('Onboarding status could not be refreshed.')
      }
    }).catch((error) => {
      console.error('Could not mark onboarding complete for an active account:', error)
      if (active) setActivityError(error?.message || 'Onboarding could not be skipped for this account.')
    }).finally(() => {
      if (active) setActivitySaving(false)
    })
    return () => { active = false }
  }, [shouldAutoComplete, user?.id, profile?.settings, refreshProfile, setSettings])

  if (profileError) {
    return <GateMessage action={() => setProfileRetry((value) => value + 1)} label="Try again">{profileError}</GateMessage>
  }
  if (!profileReady) {
    return <GateMessage>Preparing your workspace…</GateMessage>
  }
  if (onboardingCompleted) return <Outlet />
  if (dataError) {
    return <GateMessage action={retryLoad} label="Try again">Your journal data could not be loaded: {dataError}</GateMessage>
  }
  if (dataLoading || activitySaving) {
    return <GateMessage>Preparing your workspace…</GateMessage>
  }
  if (activityError) {
    return <GateMessage action={() => { setActivityError(''); setProfileRetry((value) => value + 1) }} label="Try again">{activityError}</GateMessage>
  }
  if (shouldAutoComplete) return <GateMessage>Finishing account setup…</GateMessage>
  if (!onboardingCompleted && location.pathname !== '/onboarding' && !hasPriorActivity) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }
  return <Outlet />
}
