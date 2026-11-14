import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../context/SubscriptionContext'

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
