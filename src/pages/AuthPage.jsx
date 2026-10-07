import { useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function friendlyAuthError(error, mode) {
  const message = (error?.message || '').toLowerCase()
  const code = error?.code || ''

  if (code === 'user_already_exists' || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the confirmation link.'
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return 'That password is too weak. Use at least 8 characters.'
  }
  if (
    code === 'over_request_rate_limit'
    || code === 'over_email_send_rate_limit'
    || message.includes('rate limit')
    || error?.status === 429
  ) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return "Can't reach the server. Check your internet connection and try again."
  }
  return mode === 'signup'
    ? "We couldn't create your account. Please try again."
    : "We couldn't sign you in. Please try again."
}

function googleAuthErrorMessage(message) {
  const normalized = (message || '').toLowerCase()
  if (normalized.includes('not enabled') || normalized.includes('not configured') || normalized.includes('unsupported provider')) {
    return 'Google sign-in is not available yet. Please use email and password.'
  }
  return ''
}

export default function AuthPage({ mode }) {
  const location = useLocation()
  const isSignUp = mode === 'signup' || location.pathname === '/signup'
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showConfirmFeedback, setShowConfirmFeedback] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [legalError, setLegalError] = useState('')
  const [success, setSuccess] = useState(() => location.state?.passwordUpdated ? 'Password updated. You can now sign in with your new password.' : '')

  function validateField(field, value) {
    if (field === 'name' && isSignUp && !value.trim()) return 'Please enter your name.'
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.'
    if (field === 'password' && value.length < 8) return 'Use a password with at least 8 characters.'
    return ''
  }

  function handleFieldBlur(field, value) {
    setFieldErrors((current) => ({ ...current, [field]: validateField(field, value) }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading || googleLoading) return

    const trimmedEmail = email.trim()
    const nextFieldErrors = {
      ...(isSignUp ? { name: validateField('name', name) } : {}),
      email: validateField('email', trimmedEmail),
      password: validateField('password', password),
      ...(isSignUp ? { confirmPassword: confirmPassword.length > 0 && confirmPassword === password ? '' : 'Passwords do not match.' } : {}),
    }
    if (isSignUp) setShowConfirmFeedback(true)
    setFieldErrors(nextFieldErrors)
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setError('')
      setSuccess('')
      return
    }
    if (isSignUp && !acceptedLegal) {
      setError('')
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name: name.trim() } },
        })

        if (signUpError) {
          setError(friendlyAuthError(signUpError, 'signup'))
          return
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError('An account with this email already exists. Try signing in instead.')
          return
        }

        if (data.session) {
          setSuccess('Account created! Taking you to your dashboard...')
          navigate(location.state?.from || '/', { replace: true })
        } else {
          setSuccess('Account created. Please check your email to confirm your account before signing in.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })

        if (signInError) {
          setError(friendlyAuthError(signInError, 'login'))
          return
        }
        navigate(location.state?.from || '/', { replace: true })
      }
    } catch (authError) {
      console.error('Auth request failed:', authError)
      setError(friendlyAuthError(authError, isSignUp ? 'signup' : 'login'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    if (loading || googleLoading) return
    if (isSignUp && !acceptedLegal) {
      setLegalError('Please agree to the Terms and Privacy Policy before continuing.')
      return
    }

    setError('')
    setLegalError('')
    setGoogleLoading(true)
    let redirecting = false
    try {
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/`, skipBrowserRedirect: true },
      })
      if (googleError) {
        console.error('Google sign-in failed:', googleError)
        setError(googleAuthErrorMessage(googleError.message) || friendlyAuthError(googleError, isSignUp ? 'signup' : 'login'))
        return
      }

      if (!data?.url) throw new Error('Google sign-in did not return an authorization URL.')
      const authorizationResponse = await fetch(data.url, { redirect: 'manual' })
      if (authorizationResponse.status >= 400) {
        const responseText = await authorizationResponse.text()
        let responseMessage = responseText
        try {
          responseMessage = JSON.parse(responseText).msg || responseText
        } catch {
          responseMessage = responseText
        }
        const unavailableMessage = googleAuthErrorMessage(responseMessage)
        console.error('Google sign-in authorization failed:', { status: authorizationResponse.status, body: responseText })
        setError(unavailableMessage || friendlyAuthError({ message: responseMessage, status: authorizationResponse.status }, isSignUp ? 'signup' : 'login'))
        return
      }

      redirecting = true
      window.location.assign(data.url)
    } catch (googleError) {
      console.error('Google sign-in failed:', googleError)
      setError(googleAuthErrorMessage(googleError?.message) || friendlyAuthError(googleError, isSignUp ? 'signup' : 'login'))
    } finally {
      if (!redirecting) setGoogleLoading(false)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
    setLegalError('')
  }
  const confirmPasswordMatches = confirmPassword.length > 0 && confirmPassword === password

  return (
    <main className="auth-page">
      <section className="auth-art-panel" aria-label="TradeJournal">
        <Link className="auth-brand" to="/welcome">
          <img src="/logo.svg" alt="" />
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
          <Link className="auth-back-link" to="/welcome"><ArrowLeft size={16} /> Back to home</Link>
          <div className="auth-form-logo"><img src="/logo.svg" alt="" /></div>
          <p className="auth-kicker">{isSignUp ? 'START YOUR JOURNEY' : 'WELCOME BACK'}</p>
          <h2>{isSignUp ? 'Create your account' : 'Sign in to TradeJournal'}</h2>
          <p className="auth-intro">{isSignUp ? 'A more intentional trading routine starts here.' : 'Pick up where you left off and review your trading.'}</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <label>
                <span>Your name</span>
                <input
                  autoComplete="name"
                  name="name"
                  placeholder="e.g. Osman"
                  required
                  value={name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                  onBlur={(event) => handleFieldBlur('name', event.target.value)}
                  onChange={(event) => { setName(event.target.value); clearMessages() }}
                />
                {fieldErrors.name && <span className="auth-field-error" id="auth-name-error">{fieldErrors.name}</span>}
              </label>
            )}
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                onBlur={(event) => handleFieldBlur('email', event.target.value)}
                onChange={(event) => { setEmail(event.target.value); clearMessages() }}
              />
              {fieldErrors.email && <span className="auth-field-error" id="auth-email-error">{fieldErrors.email}</span>}
            </label>
            <label>
              <span className="auth-password-label">
                <span>Password</span>
                {!isSignUp && <Link className="auth-forgot" to="/forgot-password">Forgot password?</Link>}
              </span>
              <div className="auth-password-field">
                <input
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={8}
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={`auth-password-hint${fieldErrors.password ? ' auth-password-error' : ''}`}
                  onBlur={(event) => handleFieldBlur('password', event.target.value)}
                  onChange={(event) => { setPassword(event.target.value); clearMessages() }}
                />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <span className={`auth-password-strength strength-${password.length >= 12 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 'strong' : password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password) ? 'good' : password.length >= 8 ? 'fair' : password ? 'weak' : 'empty'}`}>
                <span className="auth-strength-meter" aria-hidden="true">
                  {[1, 2, 3, 4].map((segment) => <i key={segment} />)}
                </span>
                <span>{password.length >= 12 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 'Strong' : password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password) ? 'Good' : password.length >= 8 ? 'Fair' : password ? 'Weak' : ' '}</span>
              </span>
              <small className="auth-password-hint" id="auth-password-hint">{password.length < 8 ? 'At least 8 characters' : 'Use a mix of characters for more strength.'}</small>
              {fieldErrors.password && <span className="auth-field-error" id="auth-password-error">{fieldErrors.password}</span>}
            </label>
            {isSignUp && (
              <label>
                <span className="auth-password-label"><span>Confirm password</span></span>
                <div className="auth-password-field">
                  <input
                    autoComplete="new-password"
                    name="confirmPassword"
                    placeholder="Re-enter your password"
                    required
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    aria-invalid={showConfirmFeedback && !confirmPasswordMatches}
                    aria-describedby="auth-confirm-password-status"
                    onBlur={() => {
                      setShowConfirmFeedback(true)
                      setFieldErrors((current) => ({ ...current, confirmPassword: confirmPasswordMatches ? '' : 'Passwords do not match.' }))
                    }}
                    onChange={(event) => {
                      const value = event.target.value
                      setConfirmPassword(value)
                      clearMessages()
                      if (showConfirmFeedback) {
                        setFieldErrors((current) => ({ ...current, confirmPassword: value.length > 0 && value === password ? '' : 'Passwords do not match.' }))
                      }
                    }}
                  />
                  <button type="button" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirmPassword((visible) => !visible)}>
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <span
                  className={`auth-confirm-feedback ${showConfirmFeedback && confirmPasswordMatches ? 'auth-password-match' : 'auth-field-error'}`}
                  id="auth-confirm-password-status"
                  role="status"
                >
                  {showConfirmFeedback ? (confirmPasswordMatches ? 'Passwords match' : 'Passwords do not match.') : '\u00a0'}
                </span>
              </label>
            )}
            {isSignUp && (
              <label className="auth-legal">
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  required
                  onChange={(event) => {
                    setAcceptedLegal(event.target.checked)
                    setLegalError('')
                  }}
                  aria-invalid={Boolean(legalError)}
                  aria-describedby="auth-legal-hint"
                />
                <span>
                  I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>Privacy Policy</a>
                  <small id="auth-legal-hint" className={legalError ? 'auth-legal-error' : ''} role={legalError ? 'alert' : undefined}>{legalError || 'Required to create your account.'}</small>
                </span>
              </label>
            )}
            {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
            {success && <p className="auth-notice auth-success" role="status">{success}</p>}
            <button className="auth-submit" type="submit" disabled={loading || googleLoading || (isSignUp && !acceptedLegal)} aria-busy={loading}>{loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create account' : 'Sign in')} <ArrowRight size={17} /></button>
            <div className="auth-or-divider" aria-hidden="true"><span>or</span></div>
            <button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={loading || googleLoading} aria-busy={googleLoading}>
              <svg aria-hidden="true" viewBox="0 0 48 48" focusable="false">
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.73 7.18l7.22 5.6c4.22-3.9 6.59-9.64 6.59-17.25Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.22-5.6c-2 1.34-4.57 2.13-8.68 2.13-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                <path fill="#FBBC05" d="M10.54 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" />
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
              </svg>
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to TradeJournal?'}
            {' '}<Link to={isSignUp ? '/login' : '/signup'}>{isSignUp ? 'Sign in' : 'Create an account'}</Link>
          </p>
          <p className="auth-privacy"><LockKeyhole size={13} /> Your credentials are securely handled by Supabase.</p>
          <nav className="auth-legal-footer" aria-label="Legal pages">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/disclaimer">Disclaimer</Link>
          </nav>
        </div>
      </section>
    </main>
  )
}
