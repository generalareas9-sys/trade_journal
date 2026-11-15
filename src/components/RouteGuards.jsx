import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'
import { checkManualPaymentStatus } from '../data/manualPaymentStatus'

function FullScreenLoader({ message = 'Loading...' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-2)', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--line)',
          borderTopColor: 'var(--purple)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{message}</p>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const checkedPaymentRecovery = useRef(null)

  useEffect(() => {
    if (loading || !user) {
      checkedPaymentRecovery.current = null
      return undefined
    }

    const isPaymentStatusPage = location.pathname === '/payment/success'
    const isExplicitCheckoutRetry = new URLSearchParams(location.search).get('retry') === 'true'
    if (isPaymentStatusPage || isExplicitCheckoutRetry || checkedPaymentRecovery.current === user.id) {
      return undefined
    }

    checkedPaymentRecovery.current = user.id
    let active = true
    checkManualPaymentStatus()
      .then((result) => {
        if (!active || !result.hasRequest) return
        const needsFollowUp =
          result.status === 'pending' ||
          result.status === 'rejected' ||
          (result.status === 'approved' && !result.subscriptionActive)
        if (needsFollowUp) {
          navigate('/payment/success?pending=true', { replace: true })
        }
      })
      .catch((error) => {
        if (active) checkedPaymentRecovery.current = null
        console.warn('Could not recover the latest payment status:', error)
      })

    return () => {
      active = false
    }
  }, [loading, user, location.pathname, location.search, navigate])

  if (loading && !user) return <FullScreenLoader />
  if (!user) return <Navigate to="/welcome" replace state={{ from: location }} />

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading && !user) return <FullScreenLoader />
  if (user) return <Navigate to={location.state?.from || '/'} replace />

  return <Outlet />
}

/**
 * Route guard requiring an active subscription.
 * Unsubscribed users are redirected to /plans.
 */
export function RequireSubscription() {
  const { hasActiveSubscription, loading } = useSubscription()
  const location = useLocation()

  if (loading) {
    return <FullScreenLoader message="Checking subscription..." />
  }

  if (!hasActiveSubscription) {
    return <Navigate to="/plans" replace state={{ from: location }} />
  }

  return <Outlet />
}
