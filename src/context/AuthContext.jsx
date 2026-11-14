import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrCreateProfile, StaleAuthSessionError } from '../data/profile'
import { flushRegisteredPendingSaves } from '../data/pendingSaves'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const profileRequest = useRef(0)
  const sessionRef = useRef(null)
  const authEventCount = useRef(0)
  const user = session?.user ?? null

  const refreshProfile = useCallback(async () => {
    if (!user) {
      profileRequest.current += 1
      setProfile(null)
      return null
    }

    const request = ++profileRequest.current
    try {
      const nextProfile = await getOrCreateProfile(user)
      if (request === profileRequest.current) setProfile(nextProfile)
      return nextProfile
    } catch (error) {
      if (!(error instanceof StaleAuthSessionError)) throw error
      if (request !== profileRequest.current) return null

      console.error('The signed-in account no longer exists in Supabase Auth. Clearing the stale local session.')
      profileRequest.current += 1
      setProfile(null)
      const recoveryRequest = profileRequest.current
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) console.error('Could not clear the stale authentication session:', signOutError)
      if (recoveryRequest === profileRequest.current) {
        sessionRef.current = null
        setSession(null)
      }
      return null
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      profileRequest.current += 1
      setProfile(null)
      return
    }

    void refreshProfile()
  }, [user, refreshProfile])

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error('Failed to read auth session:', error)
        if (active && authEventCount.current === 0) {
          const nextSession = data?.session ?? null
          sessionRef.current = nextSession
          setSession(nextSession)
        }
      })
      .catch((error) => {
        console.error('Failed to read auth session:', error)
        if (active && authEventCount.current === 0) {
          sessionRef.current = null
          setSession(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authEventCount.current += 1
      const currentSession = sessionRef.current
      const receivedSession = nextSession ?? null
      const stableSession = receivedSession && currentSession?.user?.id === receivedSession.user?.id
        ? { ...receivedSession, user: currentSession.user }
        : receivedSession
      sessionRef.current = stableSession
      setSession(stableSession)
      setLoading(false)
    })

    return () => {
      active = false
      data?.subscription?.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const pendingSaveResult = await flushRegisteredPendingSaves()
    if (pendingSaveResult?.error) return { error: pendingSaveResult.error }
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out failed:', error)
    return { error }
  }, [])

  const value = useMemo(
    () => ({ session, user, loading, signOut, profile, refreshProfile }),
    [session, user, loading, signOut, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return context
}
