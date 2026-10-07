import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function friendlyUpdateError(error) {
  const message = (error?.message || '').toLowerCase()
  if (error?.code === 'weak_password' || message.includes('password should be') || message.includes('weak password')) {
    return 'Choose a stronger password with at least 8 characters.'
  }
  if (message.includes('same password') || message.includes('different from')) {
    return 'Your new password must be different from your current password.'
  }
  if (message.includes('expired') || message.includes('invalid') || message.includes('session')) {
    return 'This reset link is invalid or has expired. Request a new one to continue.'
  }
  if (error?.status === 429 || message.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.'
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return "Can't reach the server. Check your internet connection and try again."
  }
  return "We couldn't update your password right now. Please try again."
}

function PasswordStrength({ password }) {
  const strength = password.length >= 12 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
    ? 'strong'
    : password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password)
      ? 'good'
      : password.length >= 8 ? 'fair' : password ? 'weak' : 'empty'
  const label = strength === 'empty' ? ' ' : strength[0].toUpperCase() + strength.slice(1)
  return <span className={`auth-password-strength strength-${strength}`}><span className="auth-strength-meter" aria-hidden="true">{[1, 2, 3, 4].map((segment) => <i key={segment} />)}</span><span>{label}</span></span>
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [recoveryValid, setRecoveryValid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    let active = true
    let recoveryEventSeen = false
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') recoveryEventSeen = true
      if (event === 'SIGNED_OUT') {
        setRecoveryValid(false)
        setChecking(false)
      } else if (event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryValid(true)
        setChecking(false)
      }
    })

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) console.error('Failed to check password recovery session:', sessionError)
        if (!active) return
        setRecoveryValid(Boolean(data?.session) || recoveryEventSeen)
        setChecking(false)
      })
      .catch((sessionError) => {
        console.error('Failed to check password recovery session:', sessionError)
        if (active) {
          setRecoveryValid(recoveryEventSeen)
          setChecking(false)
        }
      })

    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const passwordError = password.length > 0 && password.length < 8 ? 'Use a password with at least 8 characters.' : ''
  const confirmationError = confirmPassword.length > 0 && confirmPassword !== password ? 'Passwords do not match.' : ''
  const valid = password.length >= 8 && confirmPassword.length > 0 && confirmPassword === password

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    if (!valid || loading || !recoveryValid) return

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(friendlyUpdateError(updateError))
        return
      }
      setUpdated(true)
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) console.error('Password updated, but signing out failed:', signOutError)
      window.setTimeout(() => navigate('/login', { replace: true, state: { passwordUpdated: true } }), 2000)
    } catch (updateError) {
      console.error('Password update failed:', updateError)
      setError(friendlyUpdateError(updateError))
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
          <h2>Set a new password</h2>
          <p className="auth-intro">Choose a new password for your TradeJournal account.</p>
          {checking ? <p className="auth-notice" role="status">Checking your reset link…</p> : updated ? (
            <p className="auth-notice auth-success" role="status">Password updated. Taking you to sign in…</p>
          ) : !recoveryValid ? (
            <div className="auth-form">
              <p className="auth-notice auth-error" role="alert">This reset link is invalid or has expired.</p>
              <Link className="auth-submit auth-submit-link" to="/forgot-password">Request a new reset link <ArrowRight size={17} /></Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <label>
                <span>New password</span>
                <div className="auth-password-field">
                  <input
                    autoComplete="new-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    aria-invalid={submitted && Boolean(passwordError)}
                    aria-describedby={`reset-password-hint${submitted && passwordError ? ' reset-password-error' : ''}`}
                    onBlur={() => setSubmitted(true)}
                    onChange={(event) => { setPassword(event.target.value); setError('') }}
                  />
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
                <PasswordStrength password={password} />
                <small className="auth-password-hint" id="reset-password-hint">At least 8 characters</small>
                {submitted && passwordError && <span className="auth-field-error" id="reset-password-error">{passwordError}</span>}
              </label>
              <label>
                <span>Confirm password</span>
                <div className="auth-password-field">
                  <input
                    autoComplete="new-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    aria-invalid={submitted && Boolean(confirmationError)}
                    aria-describedby="reset-confirm-status"
                    onBlur={() => setSubmitted(true)}
                    onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
                  />
                  <button type="button" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirmPassword((visible) => !visible)}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
                <span className={`auth-confirm-feedback ${confirmPassword && !confirmationError ? 'auth-password-match' : 'auth-field-error'}`} id="reset-confirm-status" role="status">
                  {confirmPassword ? confirmationError || 'Passwords match' : ' '}
                </span>
              </label>
              {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={!valid || loading} aria-busy={loading}>{loading ? 'Updating...' : 'Update password'} <ArrowRight size={17} /></button>
            </form>
          )}
          <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
        </div>
      </section>
    </main>
  )
}
