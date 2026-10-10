import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import MarqueeBar from './components/MarqueeBar'
import AddTradeModal from './components/AddTradeModal'
import LegacyMigrationDialog from './components/LegacyMigrationDialog'
import { SkeletonCard, SkeletonRows } from './components/UiElements'
import Skeleton from './components/Skeleton'
import { useJournal } from './hooks/useJournal'
import useShortcuts from './hooks/useShortcuts'
import WelcomeTour from './components/WelcomeTour'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const TermsPage = lazy(() => import('./pages/legal/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'))
const DisclaimerPage = lazy(() => import('./pages/legal/DisclaimerPage'))
const HelpCenterPage = lazy(() => import('./pages/ResourcePages').then((module) => ({ default: module.HelpCenterPage })))
const ChangelogPage = lazy(() => import('./pages/ResourcePages').then((module) => ({ default: module.ChangelogPage })))
const ContactPage = lazy(() => import('./pages/ResourcePages').then((module) => ({ default: module.ContactPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DailyJournal = lazy(() => import('./pages/DailyJournal'))
const TradeLog = lazy(() => import('./pages/TradeLog'))
const Reports = lazy(() => import('./pages/Reports'))
const WeeklyReview = lazy(() => import('./pages/WeeklyReview'))
const RiskCalculator = lazy(() => import('./pages/RiskCalculator'))
const Notebook = lazy(() => import('./pages/Notebook'))
const Playbooks = lazy(() => import('./pages/Playbooks'))
const Backtesting = lazy(() => import('./pages/WorkspacePages').then((module) => ({ default: module.Backtesting })))
const SettingsPage = lazy(() => import('./pages/WorkspacePages').then((module) => ({ default: module.SettingsPage })))
const TradeImport = lazy(() => import('./pages/TradeImport'))

class PageErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <section className="page-error-state" role="alert"><h2>We couldn’t load this page</h2><p>Your local journal data has not been changed. Try the page again.</p><button type="button" className="button-primary" onClick={() => this.setState({ hasError: false })}>Try again</button></section>
    }
    return this.props.children
  }
}

function UndoDeleteToast() {
  const { setTrades, notify } = useJournal()
  const [deletedTrade, setDeletedTrade] = useState(null)

  useEffect(() => {
    const handleDelete = (event) => setDeletedTrade(event.detail?.trade || null)
    window.addEventListener('tradejournal:trade-deleted', handleDelete)
    return () => window.removeEventListener('tradejournal:trade-deleted', handleDelete)
  }, [])

  useEffect(() => {
    if (!deletedTrade) return undefined
    const timer = window.setTimeout(() => setDeletedTrade(null), 8000)
    return () => window.clearTimeout(timer)
  }, [deletedTrade])

  if (!deletedTrade) return null
  return <div className="undo-toast" role="status" aria-live="polite"><span>Trade deleted.</span><button type="button" onClick={() => {
    setTrades((current) => [deletedTrade, ...current])
    setDeletedTrade(null)
    notify('Trade restored.')
  }}>Undo</button></div>
}

function PageSkeleton() {
  return <div className="page-content page-loading" aria-label="Loading page">
    <div className="page-loading-stats"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
    <div className="page-loading-chart"><SkeletonCard /><SkeletonRows rows={6} /></div>
  </div>
}

function ProtectedLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, settings = {}, setSettings, setAddTradeOpen, setEditingTrade, toast, demoTradeCount, removeDemoTrades } = useJournal()
  const onAddTrade = useCallback(() => {
    setEditingTrade(null)
    setAddTradeOpen(true)
  }, [setAddTradeOpen, setEditingTrade])
  const { helpOpen: shortcutsOpen, closeHelp: closeShortcuts } = useShortcuts({ navigate, onAddTrade, enabled: !tourOpen })
  const finishTour = useCallback(() => {
    setSettings((current) => ({ ...current, welcomeTourCompleted: true }))
    setTourOpen(false)
  }, [setSettings])

  useEffect(() => {
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    if (settings.welcomeTourCompleted !== true) setTourOpen(true)
  }, [settings.welcomeTourCompleted])

  useEffect(() => {
    if (!location.state?.showWelcomeTour) return
    setTourOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  return (
    <div className={`app-shell ${dark ? 'dark-theme' : ''}`}>
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} />
      <a className="skip-to-content" href="#main-content">Skip to content</a>
      <main id="main-content" tabIndex="-1" className={`main-shell ${collapsed ? 'main-collapsed' : ''}`}>
        <Topbar />
        <MarqueeBar />
        {demoTradeCount > 0 && (
          <div className="demo-data-banner" role="status">
            <span><strong>You are viewing demo data.</strong> Import your trades to replace the sample history.</span>
            <div>
              <Link to="/import" className="demo-import-link">Import your trades</Link>
              <button type="button" onClick={removeDemoTrades}>Remove demo data</button>
            </div>
          </div>
        )}
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <AddTradeModal />
      <LegacyMigrationDialog />
      {toast && <div className="toast-message" role="status" aria-live="polite">{toast}</div>}
      <UndoDeleteToast />
      {shortcutsOpen && <div className="shortcuts-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShortcuts() }}>
        <section className="shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
          <div><h2 id="shortcuts-title">Keyboard shortcuts</h2><button type="button" className="icon-button" aria-label="Close shortcuts" onClick={closeShortcuts}>×</button></div>
          <p><kbd>N</kbd><span>Add a trade</span></p><p><kbd>G</kbd> then <kbd>D</kbd><span>Go to Dashboard</span></p><p><kbd>G</kbd> then <kbd>J</kbd><span>Go to Daily Journal</span></p><p><kbd>G</kbd> then <kbd>T</kbd><span>Go to Trade Log</span></p><p><kbd>G</kbd> then <kbd>R</kbd><span>Go to Reports</span></p><p><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Open global search</span></p><p><kbd>?</kbd><span>Show this help</span></p>
        </section>
      </div>}
      {tourOpen && <WelcomeTour onFinish={finishTour} />}
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const { settings = {}, dark, setDark } = useJournal()
  const setDarkRef = useRef(setDark)
  setDarkRef.current = setDark

  useEffect(() => {
    const workspacePaths = ['/', '/journal', '/trades', '/import', '/reports', '/weekly-review', '/notebook', '/playbooks', '/backtesting', '/risk-calculator', '/settings', '/help', '/contact', '/changelog']
    const workspacePage = workspacePaths.includes(location.pathname)
    document.documentElement.classList.toggle('dark-theme', workspacePage && dark)
    document.documentElement.style.colorScheme = workspacePage && dark ? 'dark' : 'light'
  }, [location.pathname, dark])

  useEffect(() => {
    if (settings.themePreference === 'light' || settings.themePreference === 'dark') {
      setDarkRef.current(settings.themePreference === 'dark')
      return undefined
    }
    if (settings.themePreference !== 'system') return undefined
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const applySystemTheme = () => setDarkRef.current(colorScheme.matches)
    applySystemTheme()
    colorScheme.addEventListener('change', applySystemTheme)
    return () => colorScheme.removeEventListener('change', applySystemTheme)
  }, [settings.themePreference])

  return (
    <PageErrorBoundary key={location.pathname}><Suspense fallback={<PageSkeleton />}><Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/disclaimer" element={<DisclaimerPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/contact" element={<ContactPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Suspense fallback={<Skeleton variant="dashboard" />}><Dashboard /></Suspense>} />
          <Route path="/journal" element={<Suspense fallback={<Skeleton variant="journal" />}><DailyJournal /></Suspense>} />
          <Route path="/trades" element={<Suspense fallback={<Skeleton variant="trade-log" />}><TradeLog /></Suspense>} />
          <Route path="/import" element={<TradeImport />} />
          <Route path="/reports" element={<Suspense fallback={<Skeleton variant="reports" />}><Reports /></Suspense>} />
          <Route path="/weekly-review" element={<WeeklyReview />} />
          <Route path="/notebook" element={<Suspense fallback={<Skeleton variant="notebook" />}><Notebook /></Suspense>} />
          <Route path="/playbooks" element={<Suspense fallback={<Skeleton variant="playbooks" />}><Playbooks /></Suspense>} />
          <Route path="/backtesting" element={<Backtesting />} />
          <Route path="/risk-calculator" element={<RiskCalculator />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense></PageErrorBoundary>
  )
}
