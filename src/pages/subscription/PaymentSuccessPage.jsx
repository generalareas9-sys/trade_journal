import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { checkManualPaymentStatus } from '../../data/manualPaymentStatus'
import { supabase } from '../../lib/supabase'
import { CURRENCIES } from '../../config/plans'
import ContactSupportBox from './ContactSupportBox'
import './subscription.css'

const REJECTION_FALLBACK =
  'Your payment could not be verified. Please check that the amount, account and receipt are correct, then try again or contact support.'

function isActiveSubscription(subscription) {
  return (
    subscription?.status === 'active' &&
    Number.isFinite(Date.parse(subscription.current_period_end)) &&
    Date.parse(subscription.current_period_end) > Date.now()
  )
}

function methodName(method) {
  switch (method) {
    case 'telebirr':
      return 'Telebirr'
    case 'cbe_birr':
      return 'CBE Birr'
    case 'cbe_bank':
      return 'CBE Bank Transfer'
    default:
      return method || 'Manual Transfer'
  }
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subscription, hasActiveSubscription, refreshSubscription } = useSubscription()
  const requestedId = searchParams.get('requestId')
  const pendingRoute = searchParams.get('pending') === 'true' || Boolean(requestedId)
  const planFromUrl = searchParams.get('plan') || subscription?.plan || 'pro'
  const periodFromUrl = searchParams.get('period') || subscription?.period || 'monthly'
  const methodFromUrl = searchParams.get('method') || subscription?.provider || ''
  const [storedRequestId] = useState(() => {
    if (requestedId || !user?.id) return ''
    try {
      return localStorage.getItem(`tradejournal:payment-request:${user.id}`) || ''
    } catch (error) {
      console.warn('Could not read payment recovery reference:', error)
      return ''
    }
  })
  const trackingRequestId = requestedId || storedRequestId

  const [payment, setPayment] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [connectionLost, setConnectionLost] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [manualChecking, setManualChecking] = useState(false)
  const [activationFailed, setActivationFailed] = useState(false)
  const [approvedNotice, setApprovedNotice] = useState(false)

  const checkNowRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true
    let isChecking = false
    let pollTimer = null
    let redirectTimer = null
    let channel = null
    let pollCount = 0
    let activationStartedAt = null
    let monitoringStopped = false
    let observedStatus = null

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
        pollTimer = null
      }
    }

    const stopRealtime = () => {
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
      setRealtimeConnected(false)
    }

    const stopMonitoring = () => {
      monitoringStopped = true
      clearPollTimer()
      stopRealtime()
    }

    const nextDelay = () => Math.min(5000 + pollCount * 1000, 10000)

    const scheduleCheck = (delay = nextDelay()) => {
      clearPollTimer()
      if (!active || monitoringStopped || document.hidden) return
      pollTimer = window.setTimeout(() => {
        pollTimer = null
        void checkStatus(false)
      }, delay)
    }

    const confirmActivation = async (result) => {
      if (!result.subscriptionActive) return false
      const currentSubscription = await refreshSubscription()
      return isActiveSubscription(currentSubscription)
    }

    const checkStatus = async (manual) => {
      if (!active || document.hidden || monitoringStopped) {
        if (manual) setManualChecking(false)
        return
      }
      if (isChecking) {
        if (manual) setManualChecking(false)
        return
      }
      isChecking = true
      if (manual) setManualChecking(true)
      clearPollTimer()

      try {
        const result = await checkManualPaymentStatus(trackingRequestId)
        if (!active) return
        setConnectionLost(false)
        setStatusError('')

        if (!result.hasRequest) {
          setPayment(null)
          setStatusError('We could not find a payment request for this account. Please return to checkout or contact support.')
          stopMonitoring()
          return
        }

        const nextPayment = {
          status: result.status,
          method: result.method,
          plan: result.plan,
          period: result.period,
          currency: result.currency,
          transactionReference: result.transactionReference,
          rejectionReason: result.rejectionReason,
          submittedAt: result.submittedAt,
        }
        observedStatus = result.status
        setPayment(nextPayment)

        if (result.status === 'rejected') {
          stopMonitoring()
          return
        }

        if (result.status === 'approved') {
          if (activationStartedAt === null) activationStartedAt = Date.now()
          const isActive = await confirmActivation(result)
          if (!active) return

          if (isActive) {
            stopMonitoring()
            setActivationFailed(false)
            setApprovedNotice(true)
            try {
              const key = `tradejournal:payment-request:${user.id}`
              if (!trackingRequestId || localStorage.getItem(key) === trackingRequestId) {
                localStorage.removeItem(key)
              }
            } catch (error) {
              console.warn('Could not clear payment recovery reference:', error)
            }
            redirectTimer = window.setTimeout(() => navigate('/', { replace: true }), 1800)
            return
          }

          if (Date.now() - activationStartedAt >= 60000) {
            setActivationFailed(true)
            stopMonitoring()
            return
          }
        }

        pollCount += 1
        scheduleCheck()
      } catch (error) {
        if (!active) return
        setConnectionLost(true)
        setStatusError(error instanceof Error ? error.message : 'Could not check payment status.')
        if (observedStatus === 'approved' && activationStartedAt !== null && Date.now() - activationStartedAt >= 60000) {
          setActivationFailed(true)
          stopMonitoring()
          return
        }
        pollCount += 1
        scheduleCheck()
      } finally {
        isChecking = false
        if (active && manual) setManualChecking(false)
      }
    }

    checkNowRef.current = () => {
      monitoringStopped = false
      activationStartedAt = null
      setActivationFailed(false)
      pollCount = 0
      void checkStatus(true)
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        pollCount = 0
        void checkStatus(false)
      } else {
        clearPollTimer()
      }
    }

    const onOnline = () => {
      setConnectionLost(false)
      pollCount = 0
      void checkStatus(false)
    }

    const onOffline = () => setConnectionLost(true)

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    channel = supabase
      .channel(`manual-payment-status:${user.id}:${trackingRequestId || 'latest'}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manual_payment_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Realtime is only a wake-up signal; the Edge Function confirms the status.
          pollCount = 0
          void checkStatus(false)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false)
          scheduleCheck()
        }
      })

    void checkStatus(false)

    return () => {
      active = false
      clearPollTimer()
      if (redirectTimer !== null) window.clearTimeout(redirectTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (channel) void supabase.removeChannel(channel)
      checkNowRef.current = null
    }
  }, [navigate, refreshSubscription, trackingRequestId, user?.id])

  const handleManualCheck = useCallback(() => {
    checkNowRef.current?.()
  }, [])

  const handleTryAgain = () => {
    const plan = payment?.plan || planFromUrl
    const period = payment?.period || periodFromUrl
    const currency = payment?.currency || CURRENCIES.ETB
    const params = new URLSearchParams({ plan, period, currency, retry: 'true' })
    try {
      if (user?.id) localStorage.removeItem(`tradejournal:payment-request:${user.id}`)
    } catch (error) {
      console.warn('Could not clear payment recovery reference before retry:', error)
    }
    navigate(`/checkout?${params.toString()}`)
  }

  const paymentMethod = methodName(payment?.method || methodFromUrl)
  const plan = payment?.plan || planFromUrl
  const period = payment?.period || periodFromUrl
  const transactionReference = payment?.transactionReference || searchParams.get('ref') || ''
  const rejectionReason = payment?.rejectionReason?.trim() || REJECTION_FALLBACK
  const showLegacyActive = !pendingRoute && !payment && hasActiveSubscription

  return (
    <div className="sub-page-shell">
      <div className="sub-container">
        <header className="sub-header">
          <Link to="/" className="sub-brand">
            <img src="/bear-logo.png" alt="TradeJournal" />
            <span>Trade<b>Journal</b></span>
          </Link>
        </header>

        <div className="success-card">
          {payment?.status === 'rejected' ? (
            <div>
              <div className="success-icon-wrap rejected"><XCircle size={42} /></div>
              <h1>Payment Rejected</h1>
              <p>Your payment request could not be verified. Review the details below before submitting again.</p>
              <div className="success-details-box">
                <div className="success-details-row"><span>Transaction Reference:</span><strong>{payment.transactionReference || '—'}</strong></div>
                <div className="success-details-row"><span>Payment Method:</span><strong>{paymentMethod}</strong></div>
                <div className="success-details-row"><span>Requested Plan:</span><strong>TradeJournal {String(plan).toUpperCase()}</strong></div>
                <div className="success-details-row"><span>Billing Period:</span><strong>{period === 'yearly' ? 'Annual' : 'Monthly'}</strong></div>
                <div className="payment-rejection-reason">{rejectionReason}</div>
              </div>
              <button type="button" className="success-cta-btn" onClick={handleTryAgain}>
                Try Again <ArrowRight size={18} />
              </button>
              <ContactSupportBox />
            </div>
          ) : approvedNotice ? (
            <div role="status" aria-live="polite">
              <div className="success-icon-wrap active"><CheckCircle2 size={42} /></div>
              <h1>Payment Approved!</h1>
              <p>Payment Approved! Your TradeJournal subscription is now active. Redirecting to your dashboard...</p>
            </div>
          ) : payment?.status === 'approved' ? (
            <div>
              <div className="success-icon-wrap pending"><RefreshCw size={40} className={activationFailed ? '' : 'animate-spin'} /></div>
              <h1>Payment approved. Activating your subscription...</h1>
              {activationFailed ? (
                <>
                  <p>We could not confirm your active subscription yet. Please contact support so we can help.</p>
                  <button type="button" className="success-cta-btn" onClick={handleManualCheck} disabled={manualChecking}>
                    <RefreshCw size={16} className={manualChecking ? 'animate-spin' : ''} />
                    {manualChecking ? 'Checking…' : 'Check activation again'}
                  </button>
                  <ContactSupportBox />
                </>
              ) : (
                <>
                  <p>We are confirming that your subscription is active before opening your dashboard.</p>
                  {connectionLost && <p className="payment-status-note" role="status">Reconnecting… {statusError}</p>}
                </>
              )}
            </div>
          ) : payment?.status === 'pending' || pendingRoute ? (
            <div>
              <div className="success-icon-wrap pending"><Clock size={40} /></div>
              <h1>Payment Submitted for Verification</h1>
              <p>
                We have received your payment details and uploaded proof. Our team is verifying your transfer with{' '}
                <strong>{paymentMethod}</strong>. Your subscription will be activated as soon as it is approved.
              </p>
              <div className="success-details-box">
                <div className="success-details-row"><span>Plan Requested:</span><strong>TradeJournal {String(plan).toUpperCase()}</strong></div>
                <div className="success-details-row"><span>Billing Period:</span><strong>{period === 'yearly' ? 'Annual' : 'Monthly'}</strong></div>
                <div className="success-details-row"><span>Payment Method:</span><strong>{paymentMethod}</strong></div>
                {transactionReference && <div className="success-details-row"><span>Transaction Reference:</span><strong style={{ wordBreak: 'break-all' }}>{transactionReference}</strong></div>}
                <div className="success-details-row">
                  <span>Status:</span>
                  <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Admin Verification</span>
                </div>
              </div>

              {connectionLost ? (
                <p className="payment-status-note" role="status">Reconnecting… {statusError || 'We will keep checking automatically.'}</p>
              ) : statusError ? (
                <p className="payment-status-note" role="status">{statusError}</p>
              ) : (
                <p className="payment-status-note" role="status">
                  {realtimeConnected ? 'Waiting for verification. Status updates automatically.' : 'Checking for payment updates automatically.'}
                </p>
              )}

              <button type="button" className="success-cta-btn" onClick={handleManualCheck} disabled={manualChecking}>
                <RefreshCw size={16} className={manualChecking ? 'animate-spin' : ''} />
                {manualChecking ? 'Checking Status…' : 'Check Verification Status'}
              </button>
              <Link to="/" className="payment-return-link">Return to Home</Link>
            </div>
          ) : showLegacyActive ? (
            <div>
              <div className="success-icon-wrap active"><CheckCircle2 size={42} /></div>
              <h1>Subscription Active!</h1>
              <p>Your subscription is active and your full trading workspace has been unlocked.</p>
              <div className="success-details-box">
                <div className="success-details-row"><span>Plan:</span><strong>TradeJournal {subscription?.plan?.toUpperCase()}</strong></div>
                <div className="success-details-row"><span>Billing Cycle:</span><strong>{subscription?.period === 'yearly' ? 'Annual (Yearly)' : 'Monthly'}</strong></div>
                <div className="success-details-row"><span>Active Until:</span><strong>{new Date(subscription?.current_period_end).toLocaleDateString()}</strong></div>
                <div className="success-details-row"><span>Payment Provider:</span><strong>{methodName(subscription?.provider)}</strong></div>
              </div>
              <button type="button" className="success-cta-btn" onClick={() => navigate('/')}>
                Enter Dashboard <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div>
              <div className="success-icon-wrap pending"><ShieldCheck size={40} /></div>
              <h1>Checking Payment Status</h1>
              <p>{statusError || 'Please wait while we securely check your latest payment request.'}</p>
              <button type="button" className="success-cta-btn" onClick={handleManualCheck} disabled={manualChecking}>
                <RefreshCw size={16} className={manualChecking ? 'animate-spin' : ''} />
                {manualChecking ? 'Checking…' : 'Check Verification Status'}
              </button>
              <ContactSupportBox />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
