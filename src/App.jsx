import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import MarqueeBar from './components/MarqueeBar'
import AddTradeModal from './components/AddTradeModal'
import LegacyMigrationDialog from './components/LegacyMigrationDialog'
import { SkeletonCard, SkeletonRows } from './components/UiElements'
import { useJournal } from './hooks/useJournal'

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const goTimer = useRef(0)
  const goPending = useRef(false)
  const navigate = useNavigate()
  const { dark, setAddTradeOpen, setEditingTrade, toast, demoTradeCount, removeDemoTrades } = useJournal()

  useEffect(() => {
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (goPending.current) {
        const routes = { d: '/', j: '/journal', t: '/trades', r: '/reports' }
        const route = routes[event.key.toLowerCase()]
        goPending.current = false
        window.clearTimeout(goTimer.current)
        if (route) {
          event.preventDefault()
          navigate(route)
          return
        }
      }
      if (event.key.toLowerCase() === 'g') {
        goPending.current = true
        window.clearTimeout(goTimer.current)
        goTimer.current = window.setTimeout(() => { goPending.current = false }, 1200)
        return
      }
      if (event.key.toLowerCase() !== 'n') return
      event.preventDefault()
      setEditingTrade(null)
      setAddTradeOpen(true)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [navigate, setAddTradeOpen, setEditingTrade])

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
      {shortcutsOpen && <div className="shortcuts-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShortcutsOpen(false) }}>
        <section className="shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
          <div><h2 id="shortcuts-title">Keyboard shortcuts</h2><button type="button" className="icon-button" aria-label="Close shortcuts" onClick={() => setShortcutsOpen(false)}>×</button></div>
          <p><kbd>N</kbd><span>Add a trade</span></p><p><kbd>G</kbd> then <kbd>D</kbd><span>Go to Dashboard</span></p><p><kbd>G</kbd> then <kbd>J</kbd><span>Go to Daily Journal</span></p><p><kbd>G</kbd> then <kbd>T</kbd><span>Go to Trade Log</span></p><p><kbd>G</kbd> then <kbd>R</kbd><span>Go to Reports</span></p><p><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Open global search</span></p><p><kbd>?</kbd><span>Show this help</span></p>
        </section>
      </div>}
    </div>
  )
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/landing' || location.pathname === '/welcome') {
      document.documentElement.style.colorScheme = 'light'
    }
  }, [location.pathname])

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/journal" element={<DailyJournal />} />
          <Route path="/trades" element={<TradeLog />} />
          <Route path="/import" element={<TradeImport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/weekly-review" element={<WeeklyReview />} />
          <Route path="/notebook" element={<Notebook />} />
          <Route path="/playbooks" element={<Playbooks />} />
          <Route path="/backtesting" element={<Backtesting />} />
          <Route path="/risk-calculator" element={<RiskCalculator />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense></PageErrorBoundary>
  )
}
