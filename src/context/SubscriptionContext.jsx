import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { CURRENCIES } from '../config/plans'

const SubscriptionContext = createContext(null)

// Detect default currency & country based on browser timezone and locale
function detectDefaultRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const languages = navigator.languages || [navigator.language || '']
    const isEthiopia =
      tz.toLowerCase().includes('addis_ababa') ||
      languages.some((l) => (l || '').toLowerCase().includes('et') || (l || '').toLowerCase().includes('am'))

    if (isEthiopia) {
      return { country: 'ET', currency: CURRENCIES.ETB }
    }
  } catch (err) {
    console.warn('Could not auto-detect timezone/locale:', err)
  }
  return { country: 'GLOBAL', currency: CURRENCIES.USD }
}

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const detected = useMemo(() => detectDefaultRegion(), [])
  const [currency, setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem('tradejournal:currency')
      if (saved === CURRENCIES.ETB || saved === CURRENCIES.USD) return saved
    } catch {
      // ignore
    }
    return detected.currency
  })

  const [country, setCountry] = useState(detected.country)

  const handleSetCurrency = useCallback((newCurrency) => {
    const val = newCurrency === CURRENCIES.ETB ? CURRENCIES.ETB : CURRENCIES.USD
    setCurrency(val)
    try {
      localStorage.setItem('tradejournal:currency', val)
    } catch {
      // ignore
    }
  }, [])

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return null
    }

    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        // Table might not exist yet if migration hasn't been run
        console.warn('Could not fetch subscription:', fetchError.message)
        setError(fetchError.message)
        setSubscription(null)
        return null
      }

      setSubscription(data || null)
      return data || null
    } catch (err) {
      console.error('Subscription refresh error:', err)
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial fetch and subscription to realtime changes
  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return undefined
    }

    void refreshSubscription()

    // Realtime channel for instant unlock when payment is processed
    const channel = supabase
      .channel(`public:subscriptions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            setSubscription(payload.new)
          } else if (payload.eventType === 'DELETE') {
            setSubscription(null)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshSubscription])

  // Active check
  const hasActiveSubscription = useMemo(() => {
    if (!subscription) return false
    if (subscription.status !== 'active') return false
    const expiresAt = new Date(subscription.current_period_end)
    return expiresAt.getTime() > Date.now()
  }, [subscription])

  const value = useMemo(
    () => ({
      subscription,
      hasActiveSubscription,
      loading,
      error,
      refreshSubscription,
      currency,
      setCurrency: handleSetCurrency,
      country,
      setCountry,
    }),
    [subscription, hasActiveSubscription, loading, error, refreshSubscription, currency, handleSetCurrency, country],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}

