import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, LoaderCircle, Shield, UserRound, SlidersHorizontal, Database, Trash2 } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../context/AuthContext'
import { migrateBackup } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { deleteAllUserRows } from '../data/repo'
import { deleteScreenshot, deleteUserScreenshots, uploadAvatar } from '../data/storage'
import ProfileAvatar from '../components/ProfileAvatar'
import './SettingsPage.css'
import '../settings-extra.css'

const TABS = [
  ['Profile', UserRound],
  ['Security', Shield],
  ['Preferences', SlidersHorizontal],
  ['Data', Database],
  ['Danger zone', Trash2],
]

function initials(name, email) {
  const words = (name || email || '?').trim().split(/[\s@._-]+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || '?'
}

function passwordLevel(value) {
  if (!value) return 'empty'
  if (value.length >= 12 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)) return 'strong'
  if (value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value)) return 'good'
  if (value.length >= 8) return 'fair'
  return 'weak'
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const {
    accounts = [], account, setAccount, dark, setThemeChoice, profile = {}, setProfile,
    settings = {}, setSettings, importSettings, playbookChecklists, trades = [],
    journal = {}, notes = [], playbooks = [], clearAllTrades, replaceData, exportBackup,
  } = useJournal()
  const { user, profile: authProfile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => TABS.some(([label]) => label === searchParams.get('tab')) ? searchParams.get('tab') : 'Profile')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [backup, setBackup] = useState(null)
  const [backupConfirmationText, setBackupConfirmationText] = useState('')
  const [deleteTradesText, setDeleteTradesText] = useState('')
  const [deleteAccountText, setDeleteAccountText] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftCountry, setDraftCountry] = useState('')
  const fileRef = useRef(null)
  const avatarFileRef = useRef(null)
  const avatarPreviewRef = useRef('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const displayName = profile.name || authProfile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const avatarPath = authProfile?.settings?.avatarPath || authProfile?.settings?.appSettings?.avatarPath || ''
  const avatarInitials = initials(displayName, user?.email)
  const themePreference = settings.themeChosen === true && ['light', 'dark', 'system'].includes(settings.themePreference)
    ? settings.themePreference
    : 'dark'

  useEffect(() => {
    setDraftName(profile.name || displayName)
    setDraftCountry(profile.country || '')
  }, [profile.name, profile.country, displayName])

  useEffect(() => () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current)
  }, [])

  const notifyError = (value) => { setMessage(''); setError(value) }
  const notifySuccess = (value) => { setError(''); setMessage(value) }
  const changeThemePreference = (preference) => {
    setThemeChoice(preference)
  }
  const authErrorMessage = (authError, action) => {
    const rawMessage = authError?.message || ''
    if (/fetch|network|failed to reach/i.test(rawMessage)) return 'A network error occurred. Check your connection and try again.'
    if (action === 'password' && /password|weak|length|characters/i.test(rawMessage)) return 'Choose a password that meets the account security requirements.'
    return rawMessage || `Could not ${action === 'email' ? 'update your email' : 'update your password'}. Please try again.`
  }

  const saveProfile = async (avatarChanges = {}) => {
    setBusy(true)
    const nextProfile = { ...profile, name: draftName.trim(), country: draftCountry.trim() }
    setProfile(nextProfile)
    const hasAvatarChange = Object.prototype.hasOwnProperty.call(avatarChanges, 'avatarPath')
    const nextAvatarPath = hasAvatarChange
      ? avatarChanges.avatarPath
      : authProfile?.settings?.avatarPath || authProfile?.settings?.appSettings?.avatarPath || null
    const saved = await supabase.from('profiles').update({
      settings: {
        ...authProfile?.settings,
        avatarPath: nextAvatarPath,
        appSettings: { ...settings, ...(hasAvatarChange ? { avatarPath: nextAvatarPath } : {}) },
        importSettings,
        playbookChecklists,
        profile: nextProfile,
      },
    }).eq('user_id', user.id)
    setBusy(false)
    if (saved.error) {
      notifyError(`Could not save profile: ${saved.error.message}`)
      return false
    }
    else {
      await refreshProfile()
      notifySuccess('Profile saved.')
      return true
    }
  }

  const clearAvatarPreview = () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current)
    avatarPreviewRef.current = ''
    setAvatarPreview('')
  }

  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setMessage('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      notifyError('Choose a PNG, JPG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      notifyError('Choose an image that is 5 MB or smaller.')
      return
    }

    clearAvatarPreview()
    const previewUrl = URL.createObjectURL(file)
    avatarPreviewRef.current = previewUrl
    setAvatarPreview(previewUrl)
    setAvatarBusy(true)
    setMessage('Uploading your photo…')

    const uploaded = await uploadAvatar(user.id, file)
    if (uploaded.error) {
      console.error('Profile photo upload failed:', uploaded.error)
      clearAvatarPreview()
      setAvatarBusy(false)
      notifyError(uploaded.error.message === 'Unable to load this image. Try another file.'
        ? uploaded.error.message
        : 'Could not upload your photo. Please try again.')
      return
    }

    const saved = await saveProfile({ avatarPath: uploaded.path })
    if (!saved) {
      if (avatarPath !== uploaded.path) {
        const cleanup = await deleteScreenshot(uploaded.path)
        if (cleanup.error) console.error('Could not clean up an unsaved profile photo:', cleanup.error)
      }
      clearAvatarPreview()
      setAvatarBusy(false)
      return
    }
    setSettings((current) => ({ ...current, avatarPath: uploaded.path }))
    clearAvatarPreview()
    setAvatarBusy(false)
    notifySuccess('Profile photo uploaded.')
  }

  const removeProfilePhoto = async () => {
    if (!avatarPath) return
    setError('')
    setMessage('')
    setAvatarBusy(true)
    const saved = await saveProfile({ avatarPath: null })
    if (!saved) {
      setAvatarBusy(false)
      return
    }
    setSettings((current) => ({ ...current, avatarPath: null }))
    const removed = await deleteScreenshot(avatarPath)
    setAvatarBusy(false)
    if (removed.error) {
      console.error('Could not remove profile photo from storage:', removed.error)
      notifyError('Your profile photo was removed, but the stored image could not be deleted. Please try again later.')
      return
    }
    notifySuccess('Profile photo removed.')
  }

  const changeEmail = async (event) => {
    event.preventDefault()
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setBusy(false)
    if (updateError) notifyError(authErrorMessage(updateError, 'email'))
    else {
      setNewEmail('')
      notifySuccess('Check your new email address for a confirmation link.')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (newPassword.length < 8) return notifyError('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return notifyError('Passwords do not match.')
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (updateError) notifyError(authErrorMessage(updateError, 'password'))
    else {
      setNewPassword('')
      setConfirmPassword('')
      notifySuccess('Password updated.')
    }
  }

  const downloadJson = () => {
    const data = exportBackup()
    downloadFile('tradejournal-backup.json', JSON.stringify({
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt,
      accounts,
      trades,
      journal,
      notes,
      playbooks,
      profile: { ...profile, displayName },
      settings: { ...settings, dark, account },
    }, null, 2), 'application/json')
    notifySuccess('Your data backup was downloaded.')
  }

  const downloadCsv = () => {
    const columns = ['date', 'symbol', 'side', 'entry', 'exit', 'size', 'pnl', 'fees', 'strategy', 'tags']
    const quote = (value) => `"${String(Array.isArray(value) ? value.join('; ') : value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...trades.map((trade) => columns.map((key) => quote(trade[key])).join(','))].join('\r\n')
    downloadFile('tradejournal-trades.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8')
    notifySuccess('Trades CSV was downloaded.')
  }

  const inspectBackup = async (file) => {
    setError('')
    setMessage('')
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const validated = migrateBackup(parsed)
      setBackup({ data: parsed, validated, counts: {
        accounts: validated.accounts?.length || 0, trades: validated.trades.length,
        journal: Object.keys(validated.journal || {}).length, notes: validated.notes?.length || 0,
        playbooks: validated.playbooks?.length || 0,
      } })
    } catch (parseError) {
      notifyError(`Backup is not valid: ${parseError.message}`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const importBackup = () => {
    if (!backup) return
    if (backupConfirmationText !== 'DELETE') return
    if (!window.confirm('Importing this backup replaces your current cloud data. Continue?')) return
    replaceData(backup.data)
    setBackup(null)
    setBackupConfirmationText('')
    notifySuccess('Backup import started. Any cloud save errors will be reported.')
  }

  const removeTrades = async () => {
    if (deleteTradesText !== 'DELETE') return
    if (!window.confirm(`Permanently delete all ${trades.length} trades and their screenshot files?`)) return
    setBusy(true)
    const result = await clearAllTrades()
    if (result.error) {
      setBusy(false)
      return notifyError(`Could not delete trades: ${result.error.message || 'Unknown error'}`)
    }
    setBusy(false)
    setDeleteTradesText('')
    notifySuccess(`Deleted ${result.data?.count || 0} trades.`)
  }

  const removeAccount = async () => {
    if (deleteAccountText !== 'DELETE') return
    if (!window.confirm('Permanently delete all account data and remove your authentication account? This cannot be undone.')) return
    setBusy(true)
    setError('')
    const rows = await deleteAllUserRows(user.id)
    if (rows.error) {
      setBusy(false)
      return notifyError(`Account cleanup was incomplete. Database: ${rows.error.message || 'Unknown error'}`)
    }
    const files = await deleteUserScreenshots(user.id)
    if (files.error) {
      setBusy(false)
      return notifyError(`Account cleanup was incomplete. Files: ${files.error.message || 'Unknown error'}`)
    }
    let functionUnavailable = false
    try {
      const { error: functionError } = await supabase.functions.invoke('delete-account')
      functionUnavailable = Boolean(functionError)
    } catch {
      functionUnavailable = true
    }
    if (functionUnavailable) window.alert('Your data was deleted. Account removal needs the delete-account function to be deployed.')
    await signOut()
    setBusy(false)
    navigate('/welcome', { replace: true })
  }

  const tabContent = () => {
    if (tab === 'Profile') return <div className="settings-tab-content">
      <div className="settings-avatar-row">
        <button className="settings-avatar-trigger" type="button" aria-label="Choose a profile photo" onClick={() => avatarFileRef.current?.click()} disabled={avatarBusy || busy}>
          <ProfileAvatar className="settings-avatar-preview" path={avatarPath} initials={avatarInitials} previewUrl={avatarPreview} refreshKey={authProfile} />
        </button>
        <div className="settings-avatar-actions">
          <input ref={avatarFileRef} className="settings-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose profile photo file" onChange={uploadProfilePhoto} />
          <button className="button-secondary" type="button" onClick={() => avatarFileRef.current?.click()} disabled={avatarBusy || busy}>
            {avatarBusy ? <><LoaderCircle className="settings-avatar-spinner" size={16} />Uploading...</> : 'Upload photo'}
          </button>
          <button className="button-secondary" type="button" onClick={removeProfilePhoto} disabled={!avatarPath || avatarBusy || busy}>Remove photo</button>
        </div>
      </div>
      <p className="set-profile-email">Current email <strong>{user?.email || '—'}</strong></p>
      <label className="settings-field"><span>Display name</span><input autoComplete="name" value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
      <label className="settings-field"><span>Country <small>(optional)</small></span><input autoComplete="country-name" value={draftCountry} onChange={(event) => setDraftCountry(event.target.value)} /></label>
      <button className="button-primary" disabled={busy} onClick={saveProfile}>{busy ? 'Saving...' : 'Save profile'}</button>
    </div>
    if (tab === 'Security') return <div className="settings-tab-content">
      <p className="settings-current-email">Signed in as <strong>{user?.email || '—'}</strong></p>
      <form onSubmit={changeEmail} className="settings-security-form"><h3>Change email</h3><label className="settings-field"><span>New email address</span><input type="email" required autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><button className="button-secondary" disabled={busy || !newEmail.trim()}>{busy ? 'Updating...' : 'Update email'}</button><small>Supabase will send a confirmation link to the new address.</small></form>
      <form onSubmit={changePassword} className="settings-security-form"><h3>Change password</h3><label className="settings-field"><span>New password</span><input type="password" required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-invalid={Boolean(newPassword) && newPassword.length < 8} aria-describedby="settings-password-hint" /></label><span className={`auth-password-strength strength-${passwordLevel(newPassword)}`}><span className="auth-strength-meter">{[1, 2, 3, 4].map((part) => <i key={part} />)}</span><span>{newPassword ? passwordLevel(newPassword) : ' '}</span></span><small id="settings-password-hint">{newPassword.length < 8 ? 'At least 8 characters' : 'Use a mix of characters for more strength.'}</small><label className="settings-field"><span>Confirm password</span><input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword} /></label><button className="button-secondary" disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}>{busy ? 'Updating...' : 'Update password'}</button></form>
      <button className="settings-signout" disabled={busy} onClick={async () => { setBusy(true); const result = await signOut(); setBusy(false); if (result?.error) notifyError(`Could not sign out: ${result.error.message}`); else navigate('/welcome', { replace: true }) }}>Sign out of this device</button>
    </div>
    if (tab === 'Preferences') return <div className="settings-tab-content">
      <label className="settings-preference-row"><span><strong>Theme</strong><small>Choose your workspace appearance.</small></span><select value={themePreference} onChange={(event) => changeThemePreference(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Match my device</option></select></label>
      <label className="settings-preference-row"><span><strong>Default account</strong><small>Choose the account shown when you open your journal.</small></span><select value={settings.defaultAccount || 'all'} onChange={(event) => { setSettings((current) => ({ ...current, defaultAccount: event.target.value })); setAccount(event.target.value) }}><option value="all">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="settings-preference-row"><span><strong>Currency display</strong><small>Changes the displayed currency symbol; it does not convert trade values.</small></span><select value={settings.currencyDisplay || 'USD'} onChange={(event) => setSettings((current) => ({ ...current, currencyDisplay: event.target.value }))}><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="JPY">JPY (¥)</option><option value="CAD">CAD ($)</option><option value="AUD">AUD ($)</option></select></label>
      {[
        ['monthlyPnlGoal', 'Monthly P&L goal', 'Set a monthly net P&L target for your dashboard.'],
        ['dailyLossLimit', 'Daily loss limit', 'Show a warning when daily loss reaches this amount.'],
        ['maxTradesPerDay', 'Maximum trades per day', 'Show a warning if you exceed this count.'],
        ['riskWarningThreshold', 'Risk per trade warning threshold (%)', 'Warn when planned trade risk exceeds this percentage.'],
      ].map(([key, label, description]) => <label className="settings-preference-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="number" min="0" step="any" value={settings[key] ?? (key === 'riskWarningThreshold' ? 2 : '')} onChange={(event) => {
        setSettings((current) => ({ ...current, [key]: event.target.value === '' ? '' : Number(event.target.value), ...(key === 'monthlyPnlGoal' ? { monthlyGoalConfigured: true } : {}) }))
      }} /></label>)}
      <p className="settings-autosaved">Preferences save automatically to your account.</p>
    </div>
    if (tab === 'Data') return <div className="settings-tab-content">
      <p>Download a portable copy of your account data, or import a validated TradeJournal backup.</p>
      <div className="settings-data-actions"><button className="button-secondary" onClick={downloadJson}><Download size={15} />Download all my data</button><button className="button-secondary" onClick={downloadCsv}>Export trades as CSV</button><button className="button-secondary" onClick={() => fileRef.current?.click()}>Import backup</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => inspectBackup(event.target.files?.[0])} /></div>
      <small>JSON export includes a schema version and export date. Backup imports replace the current cloud data.</small>
      {backup && <div className="settings-backup-preview"><h3>Backup preview</h3><p>This validated backup contains:</p><ul>{Object.entries(backup.counts).map(([label, count]) => <li key={label}>{label}: {count}</li>)}</ul><label className="settings-field set-import-confirm"><span>Type DELETE to confirm replacing your current data</span><input autoComplete="off" value={backupConfirmationText} onChange={(event) => setBackupConfirmationText(event.target.value)} /></label><div className="settings-inline-actions"><button className="button-secondary" onClick={() => { setBackup(null); setBackupConfirmationText('') }}>Cancel</button><button className="button-primary" disabled={backupConfirmationText !== 'DELETE'} onClick={importBackup}>Import backup</button></div></div>}
    </div>
    return <div className="settings-tab-content settings-danger-content">
      <section><h3>Delete all my trades</h3><p>Deletes every trade from your account and removes trade screenshot files. Your journal, notes, playbooks, and account remain.</p><p className="set-danger-count">Trades to be removed: <strong>{trades.length}</strong></p><label className="settings-field"><span>Type DELETE to confirm</span><input autoComplete="off" value={deleteTradesText} onChange={(event) => setDeleteTradesText(event.target.value)} /></label><button className="settings-danger-button" disabled={busy || deleteTradesText !== 'DELETE'} onClick={removeTrades}>{busy ? 'Deleting...' : 'Delete all my trades'}</button></section>
      <section><h3>Delete my account and data</h3><p>Permanently deletes your profile, trades, journal entries, notes, playbooks, accounts, and all files in your screenshots folder, then removes your authentication account.</p><label className="settings-field"><span>Type DELETE to confirm</span><input autoComplete="off" value={deleteAccountText} onChange={(event) => setDeleteAccountText(event.target.value)} /></label><button className="settings-danger-button" disabled={busy || deleteAccountText !== 'DELETE'} onClick={removeAccount}>{busy ? 'Deleting account...' : 'Delete my account and data'}</button></section>
    </div>
  }

  return <div className="page-content settings-page">
    <div className="page-intro-row"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Settings</h2><p>Manage your profile, security, preferences, and data.</p></div></div>
    <section className="panel settings-management">
      <nav className="settings-tab-nav" aria-label="Settings sections">{TABS.map(([label, Icon]) => <button key={label} type="button" className={tab === label ? 'active' : ''} aria-current={tab === label ? 'page' : undefined} onClick={() => { setTab(label); setError(''); setMessage('') }}><Icon size={16} />{label}</button>)}</nav>
      <div className="settings-tab-panel"><header><h3>{tab}</h3><p>{tab === 'Profile' ? 'Your display name and profile details.' : tab === 'Security' ? 'Manage your sign-in credentials.' : tab === 'Preferences' ? 'Set defaults for your trading workspace.' : tab === 'Data' ? 'Export or restore your journal data.' : 'These actions cannot be undone.'}</p></header>{tabContent()}{error && <p className="settings-feedback error" role="alert">{error}</p>}{message && <p className="settings-feedback success" role="status">{message}</p>}</div>
    </section>
    {backup && tab !== 'Data' && null}
  </div>
}
