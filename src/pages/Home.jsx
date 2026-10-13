import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Building2, CalendarDays, CalendarRange, ChevronRight, FileText, FlaskConical, Sparkles, Target } from 'lucide-react'
import { format } from 'date-fns'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../context/AuthContext'
import AIChat from '../components/AIChat'
import './dashboard-home.css'

export default function Home() {
  const { trades = [], journal = {}, accounts = [], settings = {} } = useJournal()
  const { user, profile } = useAuth()
  const [aiAvailable, setAiAvailable] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayJournal = journal[today]
  const hasTodayJournal = Boolean(todayJournal && Object.entries(todayJournal).some(([key, value]) => key !== 'date' && (Array.isArray(value) ? value.length > 0 : Boolean(value))))
  const displayName = profile?.display_name || profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Trader'
  const focusItems = useMemo(() => [
    ...(!trades.some((trade) => !trade.isDemo) ? [{ title: 'Bring in your trade history', detail: 'Import a CSV or add a trade to start seeing your patterns.', route: '/import', icon: FileText }] : []),
    ...(!hasTodayJournal ? [{ title: 'Plan your trading day', detail: 'Set your market bias, key levels, and risk before your next session.', route: '/journal', icon: CalendarDays }] : []),
    ...(!accounts.length ? [{ title: 'Set up a trading account', detail: 'Organize trades by broker, prop firm, or platform.', route: '/settings?tab=Accounts', icon: Building2 }] : []),
    ...(!settings.monthlyGoalConfigured ? [{ title: 'Set a performance goal', detail: 'Choose a monthly target and follow your progress.', route: '/settings?tab=Preferences', icon: Target }] : []),
    { title: 'Review your weekly performance', detail: 'Connect your results with your habits and trading decisions.', route: '/weekly-review', icon: CalendarRange },
    { title: 'Build your trading playbook', detail: 'Document the setups you want to repeat consistently.', route: '/playbooks', icon: BookOpen },
    { title: 'Test a setup against your history', detail: 'Filter past trades by strategy before planning what’s next.', route: '/backtesting', icon: FlaskConical },
  ].slice(0, 4), [trades, hasTodayJournal, accounts.length, settings.monthlyGoalConfigured])
  const productLinks = [
    { title: 'Daily Journal', text: 'Review trades, habits, and performance insights.', route: '/journal', icon: BookOpen, color: 'blue' },
    { title: 'Progress tracker', text: 'Build consistency with daily rules and streaks.', route: '/progress-tracker', icon: Target, color: 'violet' },
    { title: 'Backtesting', text: 'Review how your strategies performed historically.', route: '/backtesting', icon: FlaskConical, color: 'amber' },
    { title: 'Accounts', text: 'Manage accounts and keep your trades organized.', route: '/settings?tab=Accounts', icon: Building2, color: 'green' },
  ]
  return <main className="page-content home-page">
    <section className="home-hub" aria-label="Home workspace">
      <div className="home-ai-card panel">
        <span className="eyebrow">YOUR TRADING WORKSPACE</span>
        <h2>Welcome back, {displayName}</h2>
        <div className="home-ai-status"><span><Sparkles size={17} /></span><div><strong>TradeJournal AI <i>{aiAvailable ? 'Beta' : 'Coming soon'}</i></strong><p>{aiAvailable ? 'Ask practical questions about your journal and trading process.' : 'AI service is not yet available or is temporarily offline. Configure and deploy the service to enable journal insights.'}</p></div></div>
        <AIChat onAvailabilityChange={setAiAvailable} />
      </div>
      <div className="home-hub-grid">
        <section className="home-products" aria-labelledby="home-products-title">
          <div className="home-section-title"><h3 id="home-products-title">Explore your workspace</h3><p>Pick up where you want to focus.</p></div>
          <div className="home-product-grid">{productLinks.map(({ title, text, route, icon: Icon, color }) => <Link className={`home-product-card home-product-${color}`} to={route} key={title}><span><Icon size={18} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15} /></Link>)}</div>
        </section>
        <div className="home-side-panels">
          <section className="home-focus-panel panel" aria-labelledby="home-focus-title">
            <div className="home-section-title"><h3 id="home-focus-title">Recommended focus</h3><p>A few practical next steps for your workspace.</p></div>
            <div className="home-focus-list">{focusItems.map(({ title, detail, route, icon: Icon }) => <Link to={route} key={title}><span><Icon size={16} /></span><div><strong>{title}</strong><small>{detail}</small></div><ArrowRight size={15} /></Link>)}</div>
          </section>
          <section className="home-resources-panel panel" aria-labelledby="home-resources-title">
            <div className="home-section-title"><h3 id="home-resources-title">Helpful resources</h3><p>Learn how to make the most of your journal.</p></div>
            <div className="home-resource-list"><Link to="/help"><strong>TradeJournal Help Center</strong><small>Guides for logging, importing, and reviewing your trades.</small><ChevronRight size={14} /></Link><Link to="/reports"><strong>Understand your performance</strong><small>Explore your results, strategies, and trade discipline.</small><ChevronRight size={14} /></Link><Link to="/changelog"><strong>What’s new</strong><small>See the latest features and improvements.</small><ChevronRight size={14} /></Link></div>
          </section>
        </div>
      </div>
    </section>
  </main>
}
