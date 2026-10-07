import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function friendlyResetError(error) {
  const message = (error?.message || '').toLowerCase()
  if (error?.status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many requests. Please wait a moment and try again.'
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return "Can't reach the server. Check your internet connection and try again."
  }
  return "We couldn't send the reset link right now. Please try again."
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showEmailError, setShowEmailError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const validateEmail = (value) => emailPattern.test(value.trim()) ? '' : 'Enter a valid email address.'

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading || cooldown) return
    const validationError = validateEmail(email)
    setEmailError(validationError)
    setShowEmailError(true)
    setError('')
    setSuccess(false)
    if (validationError) return

    setLoading(true)
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (requestError) {
        const message = (requestError.message || '').toLowerCase()
        if (message.includes('user not found') || message.includes('no user')) {
          setSuccess(true)
          setCooldown(60)
          return
        }
        setError(friendlyResetError(requestError))
        return
      }
      setSuccess(true)
      setCooldown(60)
    } catch (requestError) {
      console.error('Password reset request failed:', requestError)
      setError(friendlyResetError(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-art-panel" aria-label="TradeJournal">
        <Link className="auth-brand" to="/welcome">
          <img src="/bear-logo.png" alt="" />
          <span>Trade<strong>Journal</strong></span>
        </Link>
        <div className="auth-art-copy">
          <div className="landing-eyebrow"><Sparkles size={15} /> YOUR TRADING, IN FOCUS</div>
          <h1>Make every<br /><span>trade count.</span></h1>
          <p>A clearer view of your decisions, your discipline, and the edge you’re building.</p>
          <div className="auth-trust"><ShieldCheck size={17} /> Your journal belongs to you.</div>
        </div>
        <span className="auth-art-caption">TradeJournal · Build consistency, one trade at a time.</span>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <Link className="auth-back-link" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
          <div className="auth-form-logo"><img src="/bear-logo.png" alt="" /></div>
          <p className="auth-kicker">ACCOUNT RECOVERY</p>
          <h2>Forgot your password?</h2>
          <p className="auth-intro">Enter your email and we’ll send you a link to reset your password.</p>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                aria-invalid={showEmailError && Boolean(emailError)}
                aria-describedby={showEmailError && emailError ? 'forgot-email-error' : undefined}
                onBlur={() => { setEmailError(validateEmail(email)); setShowEmailError(true) }}
                onChange={(event) => { setEmail(event.target.value); setError(''); setSuccess(false) }}
              />
              {showEmailError && emailError && <span className="auth-field-error" id="forgot-email-error">{emailError}</span>}
            </label>
            {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
            {success && <p className="auth-notice auth-success" role="status">If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.</p>}
            <button className="auth-submit" type="submit" disabled={loading || cooldown > 0} aria-busy={loading}>
              {loading ? 'Sending...' : cooldown ? `Send again in ${cooldown}s` : 'Send reset link'} <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
          <p className="auth-privacy">Your credentials are securely handled by Supabase.</p>
        </div>
      </section>
    </main>
  )
}
