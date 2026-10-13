import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrCreateProfile, StaleAuthSessionError } from '../data/profile'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const profileRequest = useRef(0)
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
      if (recoveryRequest === profileRequest.current) setSession(null)
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
        if (active) setSession(data?.session ?? null)
      })
      .catch((error) => {
        console.error('Failed to read auth session:', error)
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      data?.subscription?.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
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
