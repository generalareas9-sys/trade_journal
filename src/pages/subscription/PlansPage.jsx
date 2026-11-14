import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Sparkles, Zap, Shield, Crown } from 'lucide-react'
import { PLANS, PLAN_PERIODS, CURRENCIES, formatCurrency, getPlanPrice } from '../../config/plans'
import { useSubscription } from '../../context/SubscriptionContext'
import './subscription.css'

export default function PlansPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currency, setCurrency, hasActiveSubscription, subscription } = useSubscription()

  const initialPlan = searchParams.get('plan') || 'pro'
  const initialPeriod = searchParams.get('period') === 'yearly' ? PLAN_PERIODS.YEARLY : PLAN_PERIODS.MONTHLY

  const [selectedPlanId, setSelectedPlanId] = useState(initialPlan)
  const [period, setPeriod] = useState(initialPeriod)

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId)
  }

  const handleContinue = () => {
    navigate(`/checkout?plan=${selectedPlanId}&period=${period}&currency=${currency}`)
  }

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1]
  const isYearly = period === PLAN_PERIODS.YEARLY

  return (
    <div className="sub-page-shell">
      <div className="sub-container">
        {/* Top Header */}
        <header className="sub-header">
          <Link to="/" className="sub-brand">
            <img src="/bear-logo.png" alt="TradeJournal" />
            <span>Trade<b>Journal</b></span>
          </Link>

          <div className="sub-nav-actions">
            {/* Currency selector */}
            <div className="sub-currency-pill" role="group" aria-label="Currency selection">
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.ETB ? 'active' : ''}`}
                onClick={() => setCurrency(CURRENCIES.ETB)}
                title="Show prices in Ethiopian Birr"
              >
                🇪🇹 ETB
              </button>
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.USD ? 'active' : ''}`}
                onClick={() => setCurrency(CURRENCIES.USD)}
                title="Show prices in US Dollars"
              >
                🌐 USD
              </button>
            </div>

            {hasActiveSubscription && (
              <Link to="/" className="plan-select-btn" style={{ padding: '6px 14px', fontSize: '13px' }}>
                Go to Dashboard
              </Link>
            )}
          </div>
        </header>

        {hasActiveSubscription && (
          <div style={{
            background: 'var(--purple-soft)',
            border: '1px solid var(--purple)',
            borderRadius: '12px',
            padding: '12px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
          }}>
            <div>
              <strong>You have an active {subscription?.plan?.toUpperCase()} subscription</strong>
              <span style={{ color: 'var(--text-2)', marginLeft: '8px' }}>
                (Renews: {new Date(subscription?.current_period_end).toLocaleDateString()})
              </span>
            </div>
            <Link to="/" style={{ color: 'var(--purple)', fontWeight: 700, textDecoration: 'none' }}>
              Return to Journal →
            </Link>
          </div>
        )}

        {/* Hero title */}
        <div className="plans-hero">
          <span className="plans-badge">
            <Sparkles size={14} /> Invest in your trading discipline
          </span>
          <h1>Choose the Plan That Elevates Your Edge</h1>
          <p>
            Gain complete clarity over every setup, eliminate impulsive mistakes, and build lasting consistency with TradeJournal.
          </p>

          {/* Billing Toggle (Monthly / Yearly) */}
          <div className="sub-toggle-wrapper">
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
        </div>

        {/* 3 Plan Cards */}
        <div className="plans-grid">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const isPopular = plan.popular
            const pricing = plan.pricing[currency] || plan.pricing[CURRENCIES.USD]
            const priceMonthly = isYearly ? pricing.monthlyEquivalentYearly : pricing.monthly
            const totalAnnual = pricing.yearly

            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? 'selected' : ''} ${isPopular ? 'popular' : ''}`}
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
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`plan-select-btn ${isSelected ? 'primary' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectPlan(plan.id)
                    handleContinue()
                  }}
                >
                  {isSelected ? (
                    <>
                      Continue with {plan.name} <ArrowRight size={16} />
                    </>
                  ) : (
                    `Select ${plan.name}`
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="plans-action-bar">
          <div className="plans-action-summary">
            <strong>Selected: {selectedPlan.name} Plan ({isYearly ? 'Annual' : 'Monthly'})</strong>
            <p>
              Total due today: {formatCurrency(getPlanPrice(selectedPlan.id, period, currency), currency)}
              {isYearly && ' • Includes 20% annual discount'}
            </p>
          </div>

          <button type="button" className="plans-continue-btn" onClick={handleContinue}>
            Continue to Checkout <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

