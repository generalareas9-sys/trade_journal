import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  CreditCard,
  FileText,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
  Upload,
  Wallet,
  Zap,
} from 'lucide-react'
import { PLANS, PLAN_PERIODS, CURRENCIES, formatCurrency, getPlanPrice, getPlan } from '../../config/plans'
import { PAYMENT_METHODS, MANUAL_PAYMENT_CONFIG, getAvailablePaymentMethods } from '../../config/paymentMethods'
import { useSubscription } from '../../context/SubscriptionContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import './subscription.css'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { currency, setCurrency, country } = useSubscription()

  const planId = searchParams.get('plan') || 'pro'
  const period = searchParams.get('period') === 'yearly' ? PLAN_PERIODS.YEARLY : PLAN_PERIODS.MONTHLY
  const selectedPlan = getPlan(planId)

  // Payment method selection: default to telebirr if ETB, else binance_pay
  const defaultMethod = currency === CURRENCIES.ETB ? 'telebirr' : 'binance_pay'
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod)

  // Loading & error states
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  // Manual payment submission form fields
  const [txReference, setTxReference] = useState('')
  const [usdtNetwork, setUsdtNetwork] = useState('TRC20')
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [screenshotUploading, setScreenshotUploading] = useState(false)
  const [manualNotes, setManualNotes] = useState('')

  const isYearly = period === PLAN_PERIODS.YEARLY
  const totalAmount = getPlanPrice(selectedPlan.id, period, currency)

  // Copy helper
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  // Handle Manual Payment Submission
  const handleManualPaymentSubmit = async (e) => {
    e.preventDefault()
    setIsProcessing(true)
    setErrorMessage('')

    try {
      const trimmedTxRef = txReference.trim()
      if (!trimmedTxRef) {
        throw new Error('Please enter your transaction reference or receipt number.')
      }

      let storagePath = null

      // Upload screenshot to Supabase private storage bucket: payment-proofs
      if (screenshotFile && user?.id) {
        setScreenshotUploading(true)
        const fileExt = screenshotFile.name.split('.').pop()
        const cleanExt = fileExt ? fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'jpg'
        const safeName = `${Date.now()}_proof.${cleanExt}`
        const filePath = `${user.id}/${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, screenshotFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          console.warn('Screenshot upload warning:', uploadError)
          // Continue if file upload fails with clear message
          throw new Error(`Proof upload failed: ${uploadError.message}. Please try again.`)
        } else {
          storagePath = filePath
        }
        setScreenshotUploading(false)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Please sign in to complete your payment submission.')
      }

      // Call Edge Function submit-manual-payment (verifies on server, sets status='pending')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-manual-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlan.id,
          period,
          method: selectedMethodId,
          tx_reference: trimmedTxRef,
          screenshot_url: storagePath,
          notes: `${selectedMethodId === 'usdt_onchain' ? `[Network: ${usdtNetwork}] ` : ''}${manualNotes}`.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not submit payment request. Please try again.')
      }

      // Navigate to success page showing pending confirmation
      navigate(
        `/payment/success?method=${selectedMethodId}&pending=true&ref=${encodeURIComponent(trimmedTxRef)}&plan=${selectedPlan.id}&period=${period}`,
      )
    } catch (err) {
      console.error('Manual payment submission error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Could not submit payment.')
    } finally {
      setIsProcessing(false)
      setScreenshotUploading(false)
    }
  }

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === selectedMethodId)
  const availableMethods = getAvailablePaymentMethods(country, currency)

  // Helper to render method-specific details
  const renderMethodDetails = () => {
    if (selectedMethodId === 'telebirr') {
      const config = MANUAL_PAYMENT_CONFIG.telebirr
      return (
        <div className="manual-crypto-box">
          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Telebirr Account Holder Name</span>
            <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{config.receiverName}</strong>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Telebirr Phone Number</span>
            <div className="manual-copy-group">
              <code className="manual-copy-code">{config.phoneNumber}</code>
              <button
                type="button"
                className="manual-copy-btn"
                onClick={() => handleCopy(config.phoneNumber, 'telebirr_phone')}
              >
                {copiedKey === 'telebirr_phone' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'telebirr_phone' ? 'Copied' : 'Copy Number'}
              </button>
            </div>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Exact Amount to Transfer</span>
            <strong style={{ color: 'var(--purple)', fontSize: '18px' }}>
              {formatCurrency(totalAmount, CURRENCIES.ETB)}
            </strong>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="manual-crypto-label">Transfer Instructions</span>
            <ol className="manual-steps-list">
              {config.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    if (selectedMethodId === 'cbe_birr') {
      const config = MANUAL_PAYMENT_CONFIG.cbeBirr
      return (
        <div className="manual-crypto-box">
          <div className="manual-crypto-row">
            <span className="manual-crypto-label">CBE Birr Recipient Name</span>
            <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{config.receiverName}</strong>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">CBE Birr Mobile Number</span>
            <div className="manual-copy-group">
              <code className="manual-copy-code">{config.mobileNumber}</code>
              <button
                type="button"
                className="manual-copy-btn"
                onClick={() => handleCopy(config.mobileNumber, 'cbe_birr_phone')}
              >
                {copiedKey === 'cbe_birr_phone' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'cbe_birr_phone' ? 'Copied' : 'Copy Number'}
              </button>
            </div>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Exact Amount to Transfer</span>
            <strong style={{ color: 'var(--purple)', fontSize: '18px' }}>
              {formatCurrency(totalAmount, CURRENCIES.ETB)}
            </strong>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="manual-crypto-label">Transfer Instructions</span>
            <ol className="manual-steps-list">
              {config.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    if (selectedMethodId === 'cbe_bank') {
      const config = MANUAL_PAYMENT_CONFIG.cbeBank
      return (
        <div className="manual-crypto-box">
          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Bank</span>
            <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{config.bankName}</strong>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">CBE Account Holder Name</span>
            <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{config.accountName}</strong>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">CBE Account Number</span>
            <div className="manual-copy-group">
              <code className="manual-copy-code">{config.accountNumber}</code>
              <button
                type="button"
                className="manual-copy-btn"
                onClick={() => handleCopy(config.accountNumber, 'cbe_account')}
              >
                {copiedKey === 'cbe_account' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'cbe_account' ? 'Copied' : 'Copy Account'}
              </button>
            </div>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Exact Amount to Deposit / Transfer</span>
            <strong style={{ color: 'var(--purple)', fontSize: '18px' }}>
              {formatCurrency(totalAmount, CURRENCIES.ETB)}
            </strong>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="manual-crypto-label">Deposit Instructions</span>
            <ol className="manual-steps-list">
              {config.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    if (selectedMethodId === 'binance_pay') {
      const config = MANUAL_PAYMENT_CONFIG.binancePay
      const usdAmount = getPlanPrice(selectedPlan.id, period, CURRENCIES.USD)
      return (
        <div className="manual-crypto-box">
          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Binance Pay ID</span>
            <div className="manual-copy-group">
              <code className="manual-copy-code">{config.payId}</code>
              <button
                type="button"
                className="manual-copy-btn"
                onClick={() => handleCopy(config.payId, 'binance_pay')}
              >
                {copiedKey === 'binance_pay' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'binance_pay' ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Recipient Account</span>
            <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{config.accountName}</strong>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Amount to Send</span>
            <strong style={{ color: 'var(--purple)', fontSize: '18px' }}>
              {formatCurrency(usdAmount, CURRENCIES.USD)} USDT
            </strong>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="manual-crypto-label">Instructions</span>
            <ol className="manual-steps-list">
              {config.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    if (selectedMethodId === 'usdt_onchain') {
      const config = MANUAL_PAYMENT_CONFIG.usdtOnchain
      const usdAmount = getPlanPrice(selectedPlan.id, period, CURRENCIES.USD)
      return (
        <div className="manual-crypto-box">
          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Choose Blockchain Network</span>
            <select
              value={usdtNetwork}
              onChange={(e) => setUsdtNetwork(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
              }}
            >
              {config.networks.map((net) => (
                <option key={net.id} value={net.id}>
                  {net.name} {net.recommended ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">USDT Deposit Address</span>
            <div className="manual-copy-group">
              <code className="manual-copy-code">{config.walletAddress}</code>
              <button
                type="button"
                className="manual-copy-btn"
                onClick={() => handleCopy(config.walletAddress, 'usdt_wallet')}
              >
                {copiedKey === 'usdt_wallet' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'usdt_wallet' ? 'Copied' : 'Copy Address'}
              </button>
            </div>
          </div>

          <div className="manual-crypto-row">
            <span className="manual-crypto-label">Exact Amount to Send</span>
            <strong style={{ color: 'var(--purple)', fontSize: '18px' }}>
              {formatCurrency(usdAmount, CURRENCIES.USD)} USDT
            </strong>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="manual-crypto-label">Instructions</span>
            <ol className="manual-steps-list">
              {config.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    return null
  }

  // Get field labels tailored to selected method
  const getReferenceLabel = () => {
    switch (selectedMethodId) {
      case 'telebirr':
        return 'Telebirr Transaction Number / SMS Reference'
      case 'cbe_birr':
        return 'CBE Birr Transaction ID'
      case 'cbe_bank':
        return 'CBE Reference / FT Number (e.g. FT24...)'
      case 'binance_pay':
        return 'Binance Order / Transaction ID'
      case 'usdt_onchain':
        return 'Transaction Hash (TxID)'
      default:
        return 'Transaction Reference / Receipt Number'
    }
  }

  return (
    <div className="sub-page-shell">
      <div className="sub-container">
        {/* Top Header */}
        <header className="sub-header">
          <Link to="/plans" className="sub-brand">
            <ArrowLeft size={18} />
            <span>Back to Plans</span>
          </Link>

          <div className="sub-nav-actions">
            <div className="sub-currency-pill" role="group" aria-label="Currency selection">
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.ETB ? 'active' : ''}`}
                onClick={() => {
                  setCurrency(CURRENCIES.ETB)
                  if (!['telebirr', 'cbe_birr', 'cbe_bank'].includes(selectedMethodId)) {
                    setSelectedMethodId('telebirr')
                  }
                }}
              >
                🇪🇹 ETB
              </button>
              <button
                type="button"
                className={`sub-currency-btn ${currency === CURRENCIES.USD ? 'active' : ''}`}
                onClick={() => {
                  setCurrency(CURRENCIES.USD)
                  if (!['binance_pay', 'usdt_onchain'].includes(selectedMethodId)) {
                    setSelectedMethodId('binance_pay')
                  }
                }}
              >
                🌐 USD
              </button>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--loss)',
              marginBottom: '24px',
              fontSize: '14px',
            }}
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <div className="checkout-grid">
          {/* LEFT COLUMN: ORDER SUMMARY */}
          <aside className="checkout-summary-card">
            <div className="checkout-summary-title">
              <span>Order Summary</span>
              <Link to="/plans" className="checkout-change-plan">
                Change Plan
              </Link>
            </div>

            <div className="checkout-plan-pill">
              <div className="checkout-plan-info">
                <h3>TradeJournal {selectedPlan.name}</h3>
                <span>{isYearly ? 'Annual Billing (Save 20%)' : 'Monthly Billing'}</span>
              </div>
              <strong style={{ fontSize: '18px', color: 'var(--text-strong)' }}>
                {formatCurrency(totalAmount, currency)}
              </strong>
            </div>

            <div className="checkout-line-items">
              <div className="checkout-line-row">
                <span>Base Plan Price</span>
                <span>
                  {isYearly
                    ? formatCurrency(selectedPlan.pricing[currency]?.monthly * 12, currency)
                    : formatCurrency(totalAmount, currency)}
                </span>
              </div>

              {isYearly && (
                <div className="checkout-line-row discount">
                  <span>Annual Discount (20%)</span>
                  <span>
                    -
                    {formatCurrency(
                      selectedPlan.pricing[currency]?.monthly * 12 - selectedPlan.pricing[currency]?.yearly,
                      currency,
                    )}
                  </span>
                </div>
              )}

              <div className="checkout-line-row">
                <span>Account Setup & AI Sync</span>
                <span style={{ color: 'var(--profit)', fontWeight: 600 }}>FREE</span>
              </div>
            </div>

            <div className="checkout-total-row">
              <span>Total Due Today</span>
              <span style={{ color: 'var(--purple)' }}>{formatCurrency(totalAmount, currency)}</span>
            </div>

            <div className="checkout-guarantee-badge">
              <ShieldCheck size={24} />
              <div>
                <strong>Manual Verification Guarantee</strong>
                <div>
                  Your payment is reviewed by our admin team and activated promptly upon verification.
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: MANUAL PAYMENT METHODS & FORM */}
          <section className="checkout-methods-card">
            <div className="checkout-methods-header">
              <h2>Select Payment Method</h2>
              <p>Transfer the subscription amount and submit your receipt details for verification.</p>
            </div>

            {/* Methods Selection List */}
            <div className="payment-methods-list" role="radiogroup" aria-label="Payment method">
              {availableMethods.map((method) => {
                const isSelected = selectedMethodId === method.id
                const isDisabled = !method.enabled

                return (
                  <div
                    key={method.id}
                    className={`payment-method-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isDisabled) setSelectedMethodId(method.id)
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={isDisabled}
                  >
                    <div className="method-radio-left">
                      <div className="method-radio-circle">
                        {isSelected && <div className="method-radio-dot" />}
                      </div>
                      <div className="method-text">
                        <strong>
                          {method.id === 'telebirr' && <Smartphone size={16} />}
                          {method.id === 'cbe_birr' && <Phone size={16} />}
                          {method.id === 'cbe_bank' && <Building2 size={16} />}
                          {(method.id === 'binance_pay' || method.id === 'usdt_onchain') && <Wallet size={16} />}
                          {method.name}
                        </strong>
                        <p>{method.description}</p>
                      </div>
                    </div>

                    <div className="method-badges">
                      {isDisabled ? (
                        <span className="method-badge unavailable">Not available</span>
                      ) : (
                        <span className="method-badge">{method.badge}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Configured Account Details & Submission Form */}
            {selectedMethod && selectedMethod.enabled && (
              <form className="method-active-form" onSubmit={handleManualPaymentSubmit}>
                {/* Account Details Box */}
                {renderMethodDetails()}

                {/* Form Input: Transaction Reference */}
                <div className="manual-input-group">
                  <label htmlFor="txReference">
                    {getReferenceLabel()} <span style={{ color: 'var(--loss)' }}>*</span>
                  </label>
                  <input
                    id="txReference"
                    type="text"
                    required
                    placeholder="Enter the transaction or receipt reference number"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                  />
                </div>

                {/* Form Input: Payment Proof Upload */}
                <div className="manual-input-group">
                  <label htmlFor="proofFile">
                    Upload Payment Proof / Screenshot (Receipt image or photo){' '}
                    <span style={{ color: 'var(--loss)' }}>*</span>
                  </label>
                  <input
                    id="proofFile"
                    type="file"
                    accept="image/*,.pdf"
                    required
                    onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '13px' }}
                  />
                  {screenshotFile && (
                    <span style={{ fontSize: '12px', color: 'var(--profit)', marginTop: '4px' }}>
                      ✓ Attached: {screenshotFile.name} ({(screenshotFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                {/* Form Input: Optional Notes */}
                <div className="manual-input-group">
                  <label htmlFor="manualNotes">Additional Notes / Sender Name (Optional)</label>
                  <input
                    id="manualNotes"
                    type="text"
                    placeholder="e.g. Sent from John Doe phone/account"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="checkout-pay-btn"
                  disabled={isProcessing || !txReference.trim() || !screenshotFile}
                >
                  <Lock size={18} />
                  {isProcessing
                    ? screenshotUploading
                      ? 'Uploading Payment Proof…'
                      : 'Submitting Verification Request…'
                    : 'Submit Payment for Verification'}
                </button>
              </form>
            )}

            {/* Legal & Trust Assurances */}
            <footer className="checkout-footer-legal">
              <div className="checkout-trust-badges">
                <span className="checkout-trust-item">
                  <Lock size={14} /> 256-Bit SSL Encrypted
                </span>
                <span className="checkout-trust-item">
                  <ShieldCheck size={14} /> Secure Admin Verification
                </span>
              </div>

              <div className="checkout-legal-links">
                <Link to="/terms" target="_blank">
                  Terms of Service
                </Link>
                <span>•</span>
                <Link to="/refund-policy" target="_blank">
                  Refund Policy
                </Link>
                <span>•</span>
                <Link to="/contact" target="_blank">
                  Contact Support
                </Link>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  )
}
