import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Crown, Diamond, LogOut, Rocket, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { PLANS, PLAN_PERIODS, CURRENCIES, formatCurrency } from '../../config/plans'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import PremiumBackground from './PremiumBackground'
import CurrencyFlag from './CurrencyFlag'
import './subscription.css'

export default function PlansPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currency, setCurrency, hasActiveSubscription, subscription } = useSubscription()
  const { signOut } = useAuth()

  const initialPlan = searchParams.get('plan') || 'pro'
  const initialPeriod = searchParams.get('period') === 'yearly' ? PLAN_PERIODS.YEARLY : PLAN_PERIODS.MONTHLY

  const [selectedPlanId, setSelectedPlanId] = useState(initialPlan)
  const [period, setPeriod] = useState(initialPeriod)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId)
  }

  const handleContinue = (planId = selectedPlanId) => {
    navigate(`/checkout?plan=${planId}&period=${period}&currency=${currency}`)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError('')
    try {
      const { error } = await signOut()
      if (error) {
        setSignOutError(`Could not sign out: ${error.message || 'Please try again.'}`)
        return
      }
      navigate('/welcome', { replace: true })
    } catch (error) {
      console.error('Unexpected sign-out failure:', error)
      setSignOutError(`Could not sign out: ${error?.message || 'Please try again.'}`)
    } finally {
      setSigningOut(false)
    }
  }

  const isYearly = period === PLAN_PERIODS.YEARLY

  return (
    <div className="sub-page-shell plans-page">
      <PremiumBackground variant="plans" />
      <div className="sub-container plans-container">
        {/* Top Header */}
        <header className="sub-header plans-header plans-entrance" style={{ '--entrance-delay': '0ms' }}>
          <Link to="/welcome" className="sub-brand plans-brand" aria-label="TradeJournal home">
            <img src="/bear-logo.png" alt="" />
            <span>Trade<b>Journal</b></span>
          </Link>

          <div className="plans-header-actions">
            <Link to="/welcome" className="plans-header-link">
              <ArrowLeft size={16} />
              Back to home
            </Link>
            <button type="button" className="plans-header-link plans-signout" onClick={handleSignOut} disabled={signingOut}>
              <LogOut size={16} />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            <div className="sub-currency-pill" role="group" aria-label="Currency selection">
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.ETB ? 'active' : ''}`}
                onClick={() => setCurrency(CURRENCIES.ETB)}
                title="Show prices in Ethiopian Birr"
              >
                <CurrencyFlag currency={CURRENCIES.ETB} /> ETB
              </button>
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.USD ? 'active' : ''}`}
                onClick={() => setCurrency(CURRENCIES.USD)}
                title="Show prices in US Dollars"
              >
                <CurrencyFlag currency={CURRENCIES.USD} /> USD
              </button>
            </div>
          </div>
        </header>

        {signOutError && <p className="plans-signout-error" role="alert">{signOutError}</p>}

        {hasActiveSubscription && (
          <div className="plans-subscription-notice">
            <span>
              <strong>You have an active {subscription?.plan?.toUpperCase()} subscription</strong>
              <span>Renews {new Date(subscription?.current_period_end).toLocaleDateString()}</span>
            </span>
          </div>
        )}

        <section className="plans-hero-layout plans-entrance" style={{ '--entrance-delay': '70ms' }} aria-labelledby="plans-heading">
          <div className="plans-hero plans-hero-copy">
            <span className="plans-badge">
              <Sparkles size={14} /> Invest in your trading discipline
            </span>
            <h1 id="plans-heading">
              Choose the Plan That <span>Elevates</span> Your Edge
            </h1>
            <p>
              Gain complete clarity over every setup, eliminate impulsive mistakes, and build lasting consistency with TradeJournal.
            </p>
          </div>

          <div className="sub-toggle-wrapper plans-billing-entrance">
            <div className="sub-toggle" role="group" aria-label="Billing frequency">
              <button
                type="button"
                className={`sub-toggle-btn ${!isYearly ? 'active' : ''}`}
                onClick={() => setPeriod(PLAN_PERIODS.MONTHLY)}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                className={`sub-toggle-btn ${isYearly ? 'active' : ''}`}
                onClick={() => setPeriod(PLAN_PERIODS.YEARLY)}
              >
                Annual Billing
                <span className="sub-discount-pill">Save 20%</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3 Plan Cards */}
        <div className="plans-grid plans-entrance" style={{ '--entrance-delay': '210ms' }}>
          {PLANS.map((plan, idx) => {
            const isSelected = selectedPlanId === plan.id
            const isPopular = plan.popular
            const pricing = plan.pricing[currency] || plan.pricing[CURRENCIES.USD]
            const priceMonthly = isYearly ? pricing.monthlyEquivalentYearly : pricing.monthly
            const totalAnnual = pricing.yearly
            const PlanIcon = plan.id === 'essential' ? Rocket : plan.id === 'pro' ? Diamond : Crown

            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? 'selected' : ''} ${isPopular ? 'popular' : ''}`} style={{ '--i': idx }}
                onClick={() => handleSelectPlan(plan.id)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectPlan(plan.id) }}
              >
                {/* Most Popular Badge for Pro */}
                {plan.badge && (
                  <div className="plan-card-popular-badge">
                    {plan.id === 'pro' ? <Crown size={13} /> : <Zap size={13} />}
                    {plan.badge}
                  </div>
                )}

                <div className="plan-header">
                  <h3 className="plan-name">
                    <span className={`plan-icon plan-icon--${plan.id}`}><PlanIcon size={20} aria-hidden="true" /></span>
                    <span>{plan.name}</span>
                    {isSelected && <Check size={18} color="var(--purple)" />}
                  </h3>
                  <p className="plan-tagline">{plan.tagline}</p>
                </div>

                <div className="plan-price-box">
                  <div className="plan-price-main">
                    <span className="plan-amount">{formatCurrency(priceMonthly, currency)}</span>
                    <span className="plan-period">/ month</span>
                  </div>
                  {isYearly ? (
                    <div className="plan-billing-note">
                      Billed annually ({formatCurrency(totalAnnual, currency)} / year)
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
                      Billed monthly • Cancel anytime
                    </div>
                  )}
                </div>

                <ul className="plan-features-list">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="plan-feature-item">
                      <Check className="plan-feature-icon" size={16} />
                      <span>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`plan-select-btn ${isSelected ? 'primary' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectPlan(plan.id)
                    handleContinue(plan.id)
                  }}
                >
                  {plan.id === 'essential' ? 'Get Started' : `Choose ${plan.name}`}
                  <ArrowRight size={16} />
                </button>
              </div>
            )
          })}
        </div>

        <section className="plans-trust-strip plans-entrance" style={{ '--entrance-delay': '310ms' }} aria-label="Payment and billing information">
          <div className="plans-trust-item">
            <ShieldCheck size={25} />
            <span>
              <strong>Secure payments</strong>
              <small>Telebirr and bank transfer available</small>
            </span>
          </div>
          <div className="plans-trust-methods" aria-label="Available bank transfer methods">
            <span className="plans-trust-logo">
              <img src="/payments/telebirr-logo.png" alt="Telebirr" />
            </span>
            <span className="plans-trust-logo plans-cbe-logo">
              <img src="/payments/cbe-logo.png" alt="" />
              <strong>CBE Bank Transfer</strong>
            </span>
          </div>
          <div className="plans-trust-item plans-cancel-item">
            <Check size={22} />
            <span>
              <strong>Cancel anytime</strong>
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
