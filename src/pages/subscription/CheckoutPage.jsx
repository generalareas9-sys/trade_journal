import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  CreditCard,
  ChevronDown,
  FileText,
  Home,
  Lock,
  LogOut,
  Phone,
  Settings,
  ShieldCheck,
  Wallet,
  UploadCloud,
} from 'lucide-react'
import { PLANS, PLAN_PERIODS, CURRENCIES, formatCurrency, getPlanPrice, getPlan } from '../../config/plans'
import { PAYMENT_METHODS, MANUAL_PAYMENT_CONFIG, getAvailablePaymentMethods } from '../../config/paymentMethods'
import { useSubscription } from '../../context/SubscriptionContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { paymentAccounts } from '../../config/paymentAccounts'
import ContactSupportBox from './ContactSupportBox'
import PremiumBackground from './PremiumBackground'
import CurrencyFlag from './CurrencyFlag'
import './subscription.css'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { currency, setCurrency, country, hasActiveSubscription, loading: subscriptionLoading } = useSubscription()

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  // Manual payment submission form fields
  const [txReference, setTxReference] = useState('')
  const [usdtNetwork, setUsdtNetwork] = useState('TRC20')
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [screenshotUploading, setScreenshotUploading] = useState(false)
  const [manualNotes, setManualNotes] = useState('')
  const [isDraggingProof, setIsDraggingProof] = useState(false)
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('')
  const proofInputRef = useRef(null)
  const profileMenuRef = useRef(null)

  const isYearly = period === PLAN_PERIODS.YEARLY
  const totalAmount = getPlanPrice(selectedPlan.id, period, currency)
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Trader'
  const initials = displayName.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const isSubscriptionLocked = !subscriptionLoading && !hasActiveSubscription

  const handleSignOut = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        setErrorMessage(`Could not sign out: ${error.message || 'Please try again.'}`)
        return
      }
      navigate('/welcome', { replace: true })
    } catch (error) {
      console.error('Unexpected sign-out failure:', error)
      setErrorMessage(`Could not sign out: ${error instanceof Error ? error.message : 'Please try again.'}`)
    }
  }

  useEffect(() => {
    if (!screenshotFile?.type.startsWith('image/')) {
      setScreenshotPreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(screenshotFile)
    setScreenshotPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [screenshotFile])

  const handleProofFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrorMessage('Please upload an image or PDF receipt.')
      return
    }
    setErrorMessage('')
    setScreenshotFile(file)
  }

  const handleRemoveProof = () => {
    setScreenshotFile(null)
    if (proofInputRef.current) proofInputRef.current.value = ''
  }

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
      if (!screenshotFile) {
        throw new Error('Please upload your payment receipt or screenshot.')
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

  const renderUnavailablePaymentDetails = () => (
    <div className="payment-details-unavailable" role="status">
      Payment details for this method are not available yet. Please choose another method or contact support.
    </div>
  )

  // Helper to render only the selected method's details
  const renderMethodDetails = () => {
    if (selectedMethodId === 'telebirr') {
      const account = paymentAccounts.telebirr
      const instructions = MANUAL_PAYMENT_CONFIG.telebirr?.instructions
      if (!account?.holderName?.trim() || !account?.phone?.trim() || !instructions?.length) {
        return renderUnavailablePaymentDetails()
      }

      return (
        <div key={selectedMethodId} className="manual-crypto-box show">
          <div className="method-detail-header">
            <img src="/payments/telebirr-logo.png" alt="Telebirr" className="method-logo-img" />
            <strong>Telebirr</strong>
          </div>
          <div className="payment-detail-grid">
            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Account Holder Name</span>
              <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{account.holderName}</strong>
            </div>

            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Telebirr Phone Number</span>
              <div className="manual-copy-group">
                <code className="manual-copy-code">{account.phoneDisplay}</code>
                <button
                  type="button"
                  className="manual-copy-btn"
                  onClick={() => handleCopy(account.phone, 'telebirr_phone')}
                >
                  {copiedKey === 'telebirr_phone' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'telebirr_phone' ? 'Copied!' : 'Copy Number'}
                </button>
              </div>
            </div>

            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Exact Amount to Transfer</span>
              <strong className="payment-exact-amount" style={{ color: 'var(--purple)', fontSize: '18px' }}>
                {formatCurrency(totalAmount, CURRENCIES.ETB)}
              </strong>
            </div>
          </div>

          <div className="payment-instructions">
            <span className="manual-crypto-label">Transfer Instructions</span>
            <ol className="manual-steps-list">
              {instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    if (selectedMethodId === 'cbe_bank') {
      const account = paymentAccounts.cbe
      const instructions = MANUAL_PAYMENT_CONFIG.cbeBank?.instructions
      if (
        !account?.bankName?.trim() ||
        !account?.holderName?.trim() ||
        !account?.accountNumber?.trim() ||
        !instructions?.length
      ) {
        return renderUnavailablePaymentDetails()
      }

      return (
        <div key={selectedMethodId} className="manual-crypto-box show">
          <div className="method-detail-header">
            <img src="/payments/cbe-logo.png" alt="Commercial Bank of Ethiopia" className="method-logo-img" />
            <strong>CBE Bank Transfer</strong>
          </div>
          <div className="payment-detail-grid">
            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Bank Name</span>
              <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{account.bankName}</strong>
            </div>

            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Account Holder Name</span>
              <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>{account.holderName}</strong>
            </div>

            <div className="manual-crypto-row">
              <span className="manual-crypto-label">CBE Account Number</span>
              <div className="manual-copy-group">
                <code className="manual-copy-code">{account.accountNumber}</code>
                <button
                  type="button"
                  className="manual-copy-btn"
                  onClick={() => handleCopy(account.accountNumber, 'cbe_account')}
                >
                  {copiedKey === 'cbe_account' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'cbe_account' ? 'Copied!' : 'Copy Account Number'}
                </button>
              </div>
            </div>

            <div className="manual-crypto-row">
              <span className="manual-crypto-label">Exact Amount to Transfer</span>
              <strong className="payment-exact-amount" style={{ color: 'var(--purple)', fontSize: '18px' }}>
                {formatCurrency(totalAmount, CURRENCIES.ETB)}
              </strong>
            </div>
          </div>

          <div className="payment-instructions">
            <span className="manual-crypto-label">Transfer Instructions</span>
            <ol className="manual-steps-list">
              {instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )
    }

    return renderUnavailablePaymentDetails()
  }

  // Get field labels tailored to selected method
  const getReferenceLabel = () => {
    switch (selectedMethodId) {
      case 'telebirr':
        return 'Telebirr Transaction Number / SMS Reference'
      case 'cbe_bank':
        return 'CBE Transaction Reference Number'
      default:
        return 'Transaction Reference / Receipt Number'
    }
  }

  return (
    <div className="sub-page-shell checkout-page">
      <PremiumBackground variant="checkout" />
      <header className="checkout-topbar">
        <div className="checkout-topbar-inner checkout-entrance" style={{ '--entrance-delay': '0ms' }}>
          <Link to="/welcome" className="checkout-brand" aria-label="TradeJournal Pro home">
            <img src="/bear-logo.png" alt="" />
            <span>TradeJournal <b>Pro</b></span>
          </Link>

          <nav className="checkout-main-nav" aria-label="Main navigation">
            <Link to="/">
              <Home size={16} /> Dashboard {isSubscriptionLocked && <Lock className="checkout-nav-lock" size={12} aria-hidden="true" />}
            </Link>
            <Link to="/plans" className="active"><CreditCard size={16} /> Plans</Link>
            <Link to="/journal">
              <BookOpen size={16} /> My Journal {isSubscriptionLocked && <Lock className="checkout-nav-lock" size={12} aria-hidden="true" />}
            </Link>
            <Link to="/settings">
              <Settings size={16} /> Settings {isSubscriptionLocked && <Lock className="checkout-nav-lock" size={12} aria-hidden="true" />}
            </Link>
          </nav>

          <div className="checkout-header-actions">
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
                <CurrencyFlag currency={CURRENCIES.ETB} /> ETB
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
                <CurrencyFlag currency={CURRENCIES.USD} /> USD
              </button>
            </div>
            <div
              className="checkout-profile-menu"
              ref={profileMenuRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsProfileMenuOpen(false)
              }}
            >
              <button
                type="button"
                className="checkout-profile"
                aria-label={`User menu for ${displayName}`}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
              >
                <span>{initials || 'TJ'}</span>
                <small>{displayName}</small>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {isProfileMenuOpen && (
                <div className="checkout-profile-dropdown" role="menu">
                  <Link to="/welcome" role="menuitem" onClick={() => setIsProfileMenuOpen(false)}>
                    <Home size={15} /> Back to home
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      void handleSignOut()
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="sub-container checkout-container">
        <div className="checkout-page-heading checkout-entrance" style={{ '--entrance-delay': '70ms' }}>
          <Link to="/plans" className="checkout-back-link"><ArrowLeft size={16} /> Back to plans</Link>
          <span>SECURE CHECKOUT</span>
        </div>

        {errorMessage && (
          <div className="checkout-error-message" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="checkout-grid checkout-entrance" style={{ '--entrance-delay': '140ms' }}>
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
            {availableMethods.length > 0 ? (
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
                      onKeyDown={(event) => {
                        if (!isDisabled && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          setSelectedMethodId(method.id)
                        }
                      }}
                      role="radio"
                      aria-checked={isSelected}
                      aria-disabled={isDisabled}
                      tabIndex={isDisabled ? -1 : 0}
                    >
                      <div className="method-radio-left">
                        <div className="method-radio-circle">
                          {isSelected && <div className="method-radio-dot" />}
                        </div>
                        <div className="method-text">
                          <strong>
                            {method.id === 'telebirr' && <img src="/payments/telebirr-logo.png" alt="Telebirr" className="method-logo-img" />}
                            {method.id === 'cbe_birr' && <Phone size={16} />}
                            {method.id === 'cbe_bank' && <img src="/payments/cbe-logo.png" alt="Commercial Bank of Ethiopia" className="method-logo-img" />}
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
            ) : (
              <div className="checkout-payment-empty" role="status">
                <span className="checkout-payment-empty-icon"><Wallet size={23} /></span>
                <div className="checkout-payment-empty-copy">
                  <span className="checkout-payment-empty-eyebrow">PAYMENT METHODS</span>
                  <h3>No {currency} payment methods available</h3>
                  <p>Telebirr and CBE Bank Transfer currently accept ETB. Switch to ETB to continue securely.</p>
                  <button
                    type="button"
                    className="checkout-payment-empty-action"
                    onClick={() => {
                      setCurrency(CURRENCIES.ETB)
                      setSelectedMethodId('telebirr')
                    }}
                  >
                    Switch to ETB
                    <ArrowLeft size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Configured Account Details & Submission Form */}
            {selectedMethod && selectedMethod.enabled && (
              <form className="method-active-form" onSubmit={handleManualPaymentSubmit}>
                {/* Account Details Box */}
                {renderMethodDetails()}
                <ContactSupportBox />

                <div className="payment-form-grid">
                  <div className="payment-form-fields">
                    <div className="manual-input-group">
                      <label htmlFor="txReference">
                        {getReferenceLabel()} <span aria-hidden="true">*</span>
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

                    <div className="manual-input-group">
                      <label htmlFor="manualNotes">Additional Notes <span>(Optional)</span></label>
                      <textarea
                        id="manualNotes"
                        rows={3}
                        placeholder="Add your sender name or any payment details"
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="manual-input-group payment-proof-group">
                    <label htmlFor="proofFile">Upload Payment Proof <span aria-hidden="true">*</span></label>
                    <input
                      ref={proofInputRef}
                      id="proofFile"
                      className="payment-file-input"
                      type="file"
                      accept="image/*,.pdf"
                      aria-label="Upload payment receipt or screenshot"
                      onChange={(e) => handleProofFile(e.currentTarget.files?.[0])}
                    />
                    <div
                      className={`payment-upload-dropzone ${isDraggingProof ? 'dragging' : ''} ${screenshotFile ? 'has-file' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label="Choose a payment receipt or drop a file here"
                      onClick={() => proofInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          proofInputRef.current?.click()
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setIsDraggingProof(true)
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault()
                        setIsDraggingProof(false)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        setIsDraggingProof(false)
                        handleProofFile(event.dataTransfer.files?.[0])
                      }}
                    >
                      {screenshotPreviewUrl ? (
                        <img className="payment-upload-preview" src={screenshotPreviewUrl} alt="Selected payment receipt preview" />
                      ) : (
                        <span className="payment-upload-icon">
                          {screenshotFile ? <FileText size={24} /> : <UploadCloud size={26} />}
                        </span>
                      )}
                      <strong>
                        {screenshotFile ? screenshotFile.name : 'Drag and drop your receipt here or browse files'}
                      </strong>
                      <span>
                        {screenshotFile
                          ? `${(screenshotFile.size / 1024).toFixed(1)} KB · ${screenshotFile.type === 'application/pdf' ? 'PDF document' : 'Image receipt'}`
                          : 'Upload an image or PDF of your payment receipt'}
                      </span>
                    </div>
                    {screenshotFile && (
                      <div className="payment-upload-actions">
                        <button
                          type="button"
                          onClick={() => {
                            if (proofInputRef.current) proofInputRef.current.value = ''
                            proofInputRef.current?.click()
                          }}
                        >
                          Replace file
                        </button>
                        <button type="button" onClick={handleRemoveProof}>Remove</button>
                      </div>
                    )}
                  </div>
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

          </section>
        </div>

        <footer className="checkout-footer-legal checkout-entrance" style={{ '--entrance-delay': '260ms' }}>
          <div className="checkout-footer-security">
            <span><Lock size={15} /> Secure HTTPS connection</span>
            <i aria-hidden="true" />
            <span><ShieldCheck size={15} /> Secure Admin Verification</span>
          </div>
          <nav className="checkout-legal-links" aria-label="Legal and support links">
            <Link to="/terms" target="_blank">Terms of Service</Link>
            <Link to="/refund-policy" target="_blank">Refund Policy</Link>
            <Link to="/contact" target="_blank">Contact Support</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
