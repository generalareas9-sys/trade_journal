/**
 * TradeJournal Subscription Plans Configuration
 * Edit plans, pricing, features, and limits here.
 */

export const PLAN_PERIODS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
}

export const CURRENCIES = {
  ETB: 'ETB',
  USD: 'USD',
}

export const PLANS = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Foundational journaling and metrics for developing traders.',
    popular: false,
    badge: null,
    pricing: {
      ETB: {
        monthly: 800,
        yearly: 7680, // 640 ETB/mo
        monthlyEquivalentYearly: 640,
        discountPercent: 20,
      },
      USD: {
        monthly: 15,
        yearly: 144, // $12/mo
        monthlyEquivalentYearly: 12,
        discountPercent: 20,
      },
    },
    features: [
      'Unlimited trade entry and manual logging',
      'Automated PnL, Win Rate & RRR metrics',
      'Daily trading journal & emotional check-in',
      'CSV trade imports (MT4, MT5, cTrader)',
      'Calendar view & interactive equity chart',
      'Standard community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Advanced edge discovery, AI analysis, and playbook tracking.',
    popular: true,
    badge: 'Most Popular',
    pricing: {
      ETB: {
        monthly: 1500,
        yearly: 14400, // 1,200 ETB/mo
        monthlyEquivalentYearly: 1200,
        discountPercent: 20,
      },
      USD: {
        monthly: 29,
        yearly: 279, // $23.25/mo
        monthlyEquivalentYearly: 23.25,
        discountPercent: 20,
      },
    },
    features: [
      'Everything in Essential',
      'TradeJournal AI Assistant & pattern insights',
      'Playbooks & trade setup rule checklists',
      'Edge Reports & setup performance breakdown',
      'Weekly review and habit consistency tracker',
      'Multiple trading accounts tracking',
      'Priority email and Telegram support',
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    tagline: 'Maximum analytics firepower for full-time and prop firm traders.',
    popular: false,
    badge: 'Ultimate Power',
    pricing: {
      ETB: {
        monthly: 2500,
        yearly: 24000, // 2,000 ETB/mo
        monthlyEquivalentYearly: 2000,
        discountPercent: 20,
      },
      USD: {
        monthly: 49,
        yearly: 468, // $39/mo
        monthlyEquivalentYearly: 39,
        discountPercent: 20,
      },
    },
    features: [
      'Everything in Pro',
      'Higher AI assistant usage limits',
      'Risk violation alerts & discipline tracking',
      'Automated tagging & backtesting workspace',
      'Exportable institutional-grade PDF reports',
      'Dedicated 1-on-1 VIP onboarding',
      'Early access to all upcoming features',
    ],
  },
]

/**
 * Get plan configuration by plan ID
 */
export function getPlan(planId) {
  return PLANS.find((plan) => plan.id.toLowerCase() === (planId || '').toLowerCase()) || PLANS[1]
}

/**
 * Get price for a plan, period, and currency
 */
export function getPlanPrice(planId, period = PLAN_PERIODS.MONTHLY, currency = CURRENCIES.USD) {
  const plan = getPlan(planId)
  const currencyPrices = plan.pricing[currency] || plan.pricing[CURRENCIES.USD]
  return period === PLAN_PERIODS.YEARLY ? currencyPrices.yearly : currencyPrices.monthly
}

/**
 * Format currency amount
 */
export function formatCurrency(amount, currency = CURRENCIES.USD) {
  if (currency === CURRENCIES.ETB) {
    return `${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ETB`
  }
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
