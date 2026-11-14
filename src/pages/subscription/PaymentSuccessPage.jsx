import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react'
import { useSubscription } from '../../context/SubscriptionContext'
import './subscription.css'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { subscription, hasActiveSubscription, refreshSubscription } = useSubscription()

  const method = searchParams.get('method') || ''
  const ref = searchParams.get('ref') || ''
  const plan = searchParams.get('plan') || subscription?.plan || 'Pro'
  const period = searchParams.get('period') || subscription?.period || 'monthly'

  const [checking, setChecking] = useState(false)

  const handleRefresh = async () => {
    setChecking(true)
    await refreshSubscription()
    setChecking(false)
  }

  const getMethodDisplayName = (id) => {
    switch (id) {
      case 'telebirr':
        return 'Telebirr'
      case 'cbe_birr':
        return 'CBE Birr'
      case 'cbe_bank':
        return 'CBE Bank Transfer'
      case 'binance_pay':
        return 'Binance Pay'
      case 'usdt_onchain':
        return 'USDT (On-Chain)'
      default:
        return id ? id.toUpperCase() : 'Manual Transfer'
    }
  }

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
          {hasActiveSubscription ? (
            /* ACTIVE SUBSCRIPTION CONFIRMATION */
            <div>
              <div className="success-icon-wrap active">
                <CheckCircle2 size={42} />
              </div>
              <h1>Subscription Active!</h1>
              <p>Your subscription is active and your full trading workspace has been unlocked.</p>

              <div className="success-details-box">
                <div className="success-details-row">
                  <span>Plan:</span>
                  <strong>TradeJournal {subscription?.plan?.toUpperCase()}</strong>
                </div>
                <div className="success-details-row">
                  <span>Billing Cycle:</span>
                  <strong>{subscription?.period === 'yearly' ? 'Annual (Yearly)' : 'Monthly'}</strong>
                </div>
                <div className="success-details-row">
                  <span>Active Until:</span>
                  <strong>{new Date(subscription?.current_period_end).toLocaleDateString()}</strong>
                </div>
                <div className="success-details-row">
                  <span>Payment Provider:</span>
                  <strong>{getMethodDisplayName(subscription?.provider)}</strong>
                </div>
              </div>

              <button
                type="button"
                className="success-cta-btn"
                onClick={() => navigate('/')}
              >
                Enter Dashboard <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            /* PENDING MANUAL APPROVAL STATE */
            <div>
              <div className="success-icon-wrap pending">
                <Clock size={40} />
              </div>
              <h1>Payment Submitted for Verification</h1>
              <p>
                We have received your payment details and uploaded proof. Our team is verifying your transfer with{' '}
                <strong>{getMethodDisplayName(method)}</strong>. Your subscription will be activated as soon as it is
                approved.
              </p>

              <div className="success-details-box">
                <div className="success-details-row">
                  <span>Plan Requested:</span>
                  <strong>TradeJournal {String(plan).toUpperCase()}</strong>
                </div>
                <div className="success-details-row">
                  <span>Billing Period:</span>
                  <strong>{period === 'yearly' ? 'Annual' : 'Monthly'}</strong>
                </div>
                <div className="success-details-row">
                  <span>Payment Method:</span>
                  <strong>{getMethodDisplayName(method)}</strong>
                </div>
                {ref && (
                  <div className="success-details-row">
                    <span>Transaction Reference:</span>
                    <strong style={{ wordBreak: 'break-all' }}>{ref}</strong>
                  </div>
                )}
                <div className="success-details-row">
                  <span>Status:</span>
                  <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Admin Verification</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="success-cta-btn"
                  onClick={handleRefresh}
                  disabled={checking}
                >
                  <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
                  {checking ? 'Checking Status…' : 'Check Verification Status'}
                </button>

                <Link
                  to="/"
                  style={{
                    display: 'inline-block',
                    padding: '12px',
                    fontSize: '14px',
                    color: 'var(--text-2)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  Return to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
