import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileSpreadsheet,
  Flag,
  Layers3,
  Menu,
  NotebookPen,
  Shield,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Upload,
  X,
  CircleHelp,
  FileText,
  Mail,
} from 'lucide-react'

const FEATURES = [
  { icon: BarChart3, title: 'Performance analytics', text: 'See the key stats calculated from the trades you have logged.', visual: 'bars', tone: 'indigo' },
  { icon: CalendarDays, title: 'P&L calendar', text: 'Scan profitable and losing days in a clear calendar view.', visual: 'calendar', tone: 'magenta' },
  { icon: ClipboardCheck, title: 'Discipline tracking', text: 'Record whether you followed your plan and review your decisions.', visual: 'checklist', tone: 'blue' },
  { icon: Upload, title: 'CSV trade import', text: 'Map a CSV file to your trade fields and review before importing.', visual: 'upload', tone: 'pink' },
  { icon: BookOpen, title: 'Playbooks and notes', text: 'Keep setup guidance, journal notes, and checklists together.', visual: 'notebook', tone: 'purple' },
  { icon: ShieldCheck, title: 'A focused workspace', text: 'Keep trade reviews and performance reports organized in one place.', visual: 'shield', tone: 'teal' },
]

const STEPS = [
  { n: '01', title: 'Import or log trades', text: 'Upload a broker CSV or add a trade manually with details and notes.' },
  { n: '02', title: 'Review every day', text: 'Reflect on your plan, record your mood, and check whether you followed your rules.' },
  { n: '03', title: 'Find your edge', text: 'Use reports to compare results across symbols, sessions, and trading habits.' },
]

const MORE_TOOLS = [
  { icon: TrendingUp, title: 'Trade replay notes', text: 'Add chart-by-chart notes when historical replay is available.', status: 'Coming soon', accent: 'violet' },
  { icon: Target, title: 'Tags and mistake review', text: 'Label trades with tags and review recorded mistakes in reports.', accent: 'indigo' },
  { icon: Shield, title: 'Risk calculator', text: 'Plan position risk with a dedicated calculator.', status: 'Coming soon', accent: 'blue' },
  { icon: Flag, title: 'Goals and progress', text: 'Track monthly P&L and win-rate goals from your dashboard.', accent: 'teal' },
  { icon: Layers3, title: 'Account overview', text: 'Switch between one account or review all accounts together.', accent: 'magenta' },
  { icon: ShieldCheck, title: 'Daily limit warnings', text: 'See a dashboard warning when your daily limits are exceeded.', accent: 'pink' },
  { icon: CalendarDays, title: 'Weekly review report', text: 'Get a focused weekly summary of trades and reflections.', status: 'Coming soon', accent: 'emerald' },
  { icon: Smartphone, title: 'Mobile-friendly journal', text: 'Use the journal and review your trades on a smaller screen.', accent: 'amber' },
]

const FAQ = [
  ['Is TradeJournal free?', 'TradeJournal is currently in preview. Sign up to explore the journal and its current features.'],
  ['Which brokers can I use?', 'You can import trade history from CSV or TXT files. The importer lets you map your file columns to trade fields.'],
  ['Where is my data stored?', 'Your account and journal data is stored in the cloud. Your browser also keeps your login session and theme preference.'],
  ['Does it give financial advice?', 'No. TradeJournal is a journaling and analytics tool only. Trading involves risk of loss.'],
  ['Can I use it on my phone?', 'The app is responsive and works in modern mobile browsers.'],
]

function useReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      element.classList.add('in')
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('in')
        observer.disconnect()
      }
    }, { threshold: 0.15 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}

function Reveal({ children, className = '', style }) {
  const ref = useReveal()
  return <div ref={ref} className={`lp-reveal ${className}`} style={style}>{children}</div>
}

function FeatureVisual({ type }) {
  if (type === 'bars') {
    return <div className="lp-feature-visual lp-feature-bars-wrap" aria-hidden="true"><div className="lp-feature-bars">{[35, 54, 44, 75, 61, 92, 72].map((height, index) => <i key={index} style={{ '--lp-bar-height': `${height}%`, '--lp-index': index }} />)}</div><div className="lp-feature-win-ring"><span>62%<small>win rate</small></span></div></div>
  }
  if (type === 'calendar') {
    return <div className="lp-feature-visual lp-feature-calendar" aria-hidden="true">{Array.from({ length: 21 }, (_, index) => <i key={index} className={[2, 5, 9, 14, 19].includes(index) ? 'loss' : [0, 1, 4, 6, 8, 11, 13, 16, 18, 20].includes(index) ? 'win' : ''} />)}</div>
  }
  if (type === 'checklist') {
    return <div className="lp-feature-visual lp-feature-checklist" aria-hidden="true"><span><Check size={12} /> Followed my plan</span><span><Check size={12} /> Respected my risk</span></div>
  }
  if (type === 'upload') {
    return <div className="lp-feature-visual lp-feature-upload" aria-hidden="true"><span><FileSpreadsheet size={18} /> trades.csv</span><b><Upload size={14} /> Upload file</b></div>
  }
  if (type === 'notebook') {
    return <div className="lp-feature-visual lp-feature-notebook" aria-hidden="true"><div><span /><span /><span /><span /></div><ul><li><Check size={12} /> Entry plan</li><li><Check size={12} /> Review notes</li></ul></div>
  }
  return <div className="lp-feature-visual lp-feature-dashboard" aria-hidden="true"><div className="lp-feature-mini-kpis"><i><b>62%</b><small>Win rate</small></i><i><b>1.8</b><small>Profit factor</small></i><i><b>32</b><small>Trades</small></i></div><svg viewBox="0 0 180 34"><polyline points="0,29 24,22 48,25 72,14 96,19 120,8 144,12 180,3" /></svg></div>
}

function CountUp({ value, decimals = 0, suffix = '', prefix = '', grouped = false }) {
  const ref = useRef(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const finish = () => setCount(value)
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }

    let frame = 0
    let startedAt
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const animate = (time) => {
        if (startedAt === undefined) startedAt = time
        const progress = Math.min((time - startedAt) / 1100, 1)
        setCount(value * (1 - (1 - progress) ** 3))
        if (progress < 1) frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [value])

  const display = grouped
    ? Math.round(count).toLocaleString('en-US')
    : count.toFixed(decimals)
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

function BacktestVisual() {
  const ref = useReveal()
  const streak = ['win', 'win', 'loss', 'win', 'win', 'win', 'loss', 'win', 'loss', 'win', 'win', 'win', 'loss', 'win', 'win', 'win']
  const stats = [
    { label: 'Win rate', value: 62, suffix: '%' },
    { label: 'Profit factor', value: 1.8, decimals: 1 },
    { label: 'Max drawdown', value: 4.2, decimals: 1, suffix: '%' },
    { label: 'Average R', value: 0.8, decimals: 1, suffix: 'R' },
  ]

  return (
    <div ref={ref} className="lp-backtest-visual lp-reveal" role="group" aria-label="Illustrative backtesting charts, not account data">
      <div className="lp-backtest-topline"><strong>Setup performance</strong><span>Illustrative sample, not account data</span></div>
      <div className="lp-backtest-charts">
        <div className="lp-equity-chart">
          <div><span>Illustrative equity curve</span><small>Sample</small></div>
          <svg viewBox="0 0 460 150" role="img" aria-label="Illustrative equity curve">
            <defs><linearGradient id="lp-equity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a78bfa" stopOpacity=".35" /><stop offset="1" stopColor="#a78bfa" stopOpacity="0" /></linearGradient></defs>
            {[35, 75, 115].map((y) => <line key={y} x1="0" y1={y} x2="460" y2={y} />)}
            <path className="lp-equity-area" d="M0 126 L45 111 L85 118 L126 91 L166 98 L208 72 L250 83 L292 52 L334 60 L376 33 L420 42 L460 18 L460 150 L0 150Z" />
            <path className="lp-equity-line" d="M0 126 L45 111 L85 118 L126 91 L166 98 L208 72 L250 83 L292 52 L334 60 L376 33 L420 42 L460 18" />
          </svg>
          <div className="lp-equity-labels"><span>Trade 1</span><span>Trade 16</span><span>Trade 32</span></div>
        </div>
        <div className="lp-winloss">
          <div className="lp-winloss-donut"><span>62%<small>sample wins</small></span></div>
          <div><strong>Win / loss record</strong><span>Illustrative sample</span></div>
        </div>
      </div>
      <div className="lp-streak-row"><span>Sample trade streak</span><div>{streak.map((result, index) => <i key={index} className={result} style={{ '--lp-index': index }} />)}</div></div>
      <div className="lp-backtest-stats">{stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong><CountUp {...stat} /></strong></div>)}</div>
    </div>
  )
}

function DashboardPreview() {
  const calendar = [
    ['1', '', ''], ['2', '+84', 'w'], ['3', '+126', 'w'], ['4', '', ''], ['5', '-42', 'l'], ['6', '', ''], ['7', '+98', 'w'],
    ['8', '+114', 'w'], ['9', '', ''], ['10', '-36', 'l'], ['11', '+72', 'w'], ['12', '', ''], ['13', '+156', 'w'], ['14', '', ''],
    ['15', '', ''], ['16', '+64', 'w'], ['17', '+92', 'w'], ['18', '-28', 'l'], ['19', '', ''], ['20', '+120', 'w'], ['21', '', ''],
    ['22', '+88', 'w'], ['23', '-54', 'l'], ['24', '', ''], ['25', '+142', 'w'], ['26', '+76', 'w'], ['27', '', ''], ['28', '+108', 'w'],
    ['29', '', ''], ['30', '+94', 'w'], ['31', '-32', 'l'], ['1', '', 'muted'], ['2', '+68', 'w'], ['3', '', 'muted'], ['4', '', 'muted'],
  ]
  const kpis = [
    { label: 'Net P&L', value: 2840, prefix: '+$', grouped: true, detail: 'Sample period', tone: 'positive', points: '0,28 14,21 28,24 42,12 56,17 70,5' },
    { label: 'Win rate', value: 62.5, decimals: 1, suffix: '%', detail: 'Illustrative trades', points: '0,24 14,16 28,19 42,11 56,14 70,4' },
    { label: 'Profit factor', value: 1.84, decimals: 2, detail: 'Sample period', points: '0,25 14,22 28,14 42,18 56,8 70,5' },
    { label: 'Winning days', value: 68, suffix: '%', detail: 'Illustrative month', points: '0,25 14,20 28,21 42,12 56,16 70,5' },
  ]
  const streak = ['win', 'win', 'loss', 'win', 'win', 'win', 'loss', 'win', 'loss', 'win', 'win', 'win', 'loss', 'win', 'win', 'win']

  return (
    <div className="lp-preview" role="group" aria-label="Illustrative TradeJournal dashboard preview, not account data">
      <div className="lp-pv-bar"><span><i /><i /><i /></span><b>TRADEJOURNAL</b><small>PERFORMANCE OVERVIEW</small></div>
      <div className="lp-pv-body">
        <div className="lp-pv-heading"><span>Dashboard</span><small>Illustrative sample, not account data</small></div>
        <div className="lp-pv-kpis">
          {kpis.map(({ label, value, decimals, suffix, prefix, grouped, detail, tone, points }) => (
            <div key={label}>
              <small>{label}</small>
              <b className={tone || ''}><CountUp value={value} decimals={decimals} suffix={suffix} prefix={prefix} grouped={grouped} /></b>
              <em>{detail}</em>
              <svg className="lp-pv-sparkline" viewBox="0 0 70 32" aria-hidden="true"><polyline points={points} /></svg>
            </div>
          ))}
        </div>
        <div className="lp-pv-chart">
          <div className="lp-pv-chart-title"><b>Daily net cumulative P&amp;L</b><span>Last 30 days <ChevronDown size={14} /></span></div>
          <div className="lp-pv-plot">
            <div className="lp-pv-axis" aria-hidden="true"><span>$3k</span><span>$2k</span><span>$1k</span><span>$0</span></div>
            <svg viewBox="0 0 700 180" role="img" aria-label="Illustrative cumulative profit and loss chart">
            <defs>
              <linearGradient id="lp-chart-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#a78bfa" stopOpacity=".42" />
                <stop offset="1" stopColor="#6c5ce7" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[28, 68, 108, 148].map((y) => <line key={y} x1="4" y1={y} x2="696" y2={y} stroke="currentColor" strokeDasharray="3 7" />)}
            <path className="lp-pv-area" d="M4 154 L54 141 L104 146 L154 119 L204 128 L254 99 L304 108 L354 81 L404 90 L454 58 L504 70 L554 45 L604 52 L654 25 L696 17 L696 170 L4 170Z" fill="url(#lp-chart-gradient)" />
            <path className="lp-line" d="M4 154 L54 141 L104 146 L154 119 L204 128 L254 99 L304 108 L354 81 L404 90 L454 58 L504 70 L554 45 L604 52 L654 25 L696 17" fill="none" stroke="#b9a4ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="lp-pv-last-point" cx="696" cy="17" r="5"><title>Jun 30 · +$2,840</title></circle>
            <circle className="lp-pv-hover-point" cx="454" cy="58" r="8"><title>Jun 22 · +$1,920</title></circle>
            </svg>
          </div>
          <div className="lp-pv-chart-dates"><span>JUN 01</span><span>JUN 08</span><span>JUN 15</span><span>JUN 22</span><span>JUN 30</span></div>
        </div>
        <div className="lp-pv-lower">
          <div className="lp-pv-calendar">
            <div className="lp-pv-calendar-head"><b>Trading calendar</b><small>Illustrative month</small></div>
            <div className="lp-pv-calendar-grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <small key={`${day}-${index}`}>{day}</small>)}
              {calendar.map(([day, pnl, tone], index) => <span key={index} className={`${tone} ${index > 30 ? 'muted' : ''}`} style={{ '--lp-cell-index': index }}><b>{day}</b>{pnl && <small>{pnl}</small>}</span>)}
            </div>
          </div>
          <div className="lp-pv-summary">
            <div className="lp-pv-summary-head"><b>At a glance</b><small>Illustrative sample</small></div>
            <div className="lp-pv-summary-main">
              <div className="lp-pv-donut"><span>62%<small>win rate</small></span></div>
              <div className="lp-pv-summary-stats">
                <div><span>Average win</span><strong className="lp-pv-positive">+$284</strong></div>
                <div><span>Average loss</span><strong className="lp-pv-negative">-$156</strong></div>
                <div><span>Trade count</span><strong>32</strong></div>
              </div>
            </div>
            <div className="lp-pv-streak"><span>Win / loss streak</span><div>{streak.map((result, index) => <i key={index} className={result} style={{ '--lp-cell-index': index }} />)}</div></div>
          </div>
        </div>
      </div>
      <div className="lp-float-note"><span><Check size={14} /></span><div><b>Review with context</b><small>Plan · execution · outcome</small></div></div>
    </div>
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const sections = ['dashboard-preview', 'features', 'how', 'pricing', 'faq']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveSection(visible.target.id)
    }, { rootMargin: '-56px 0px -58% 0px', threshold: [0.1, 0.25, 0.5] })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const closeMenu = () => { setMenuOpen(false); setResourcesOpen(false) }
  const navLink = (href, id, label) => <a className={activeSection === id ? 'active' : ''} href={href} onClick={closeMenu}>{label}</a>

  return (
    <div className="lp">
      <a className="skip-to-content lp-skip-link" href="#landing-main">Skip to content</a>
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-wrap lp-nav-in">
          <Link to="/welcome" className="lp-brand" aria-label="TradeJournal home">
            <img src="/bear-logo.png" alt="" /><span>Trade<b>Journal</b></span>
          </Link>
          <nav className={menuOpen ? 'open' : ''} aria-label="Main navigation">
            {navLink('#features', 'features', 'Why TradeJournal')}
            {navLink('#dashboard-preview', 'dashboard-preview', 'Demo')}
            {navLink('#how', 'how', 'How it works')}
            {navLink('#pricing', 'pricing', 'Pricing')}
            {navLink('#faq', 'faq', 'FAQ')}
            <div className={`lp-resources ${resourcesOpen ? 'open' : ''}`}>
              <button type="button" aria-expanded={resourcesOpen} onClick={() => setResourcesOpen((open) => !open)}>Resources <ChevronDown size={14} /></button>
              <div className="lp-resources-menu">
                <a href="mailto:help@tradejournal.app?subject=Help%20center" onClick={closeMenu}><CircleHelp size={15} />Help center</a>
                <a href="mailto:help@tradejournal.app?subject=Changelog" onClick={closeMenu}><FileText size={15} />Changelog</a>
                <a href="mailto:hello@tradejournal.app" onClick={closeMenu}><Mail size={15} />Contact</a>
              </div>
            </div>
            <Link to="/login" className="lp-link-mobile" onClick={closeMenu}>Sign in</Link>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-ghost">Sign in</Link>
            <Link to="/signup" className="lp-btn">Get started</Link>
          </div>
          <button
            className="lp-burger"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main id="landing-main">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-pill"><span /> TRADING, WITH CLARITY</span>
              <h1>Meet your trading journal.<br /><span>Build your edge.</span></h1>
              <p className="lp-sub">Track every trade, understand your performance, and review the habits behind your results—all in one focused workspace.</p>
              <div className="lp-cta-row">
                <Link to="/signup" className="lp-btn lp-lg">Get started <ArrowRight size={18} /></Link>
                <Link to="/login" className="lp-btn lp-outline lp-lg">Sign in</Link>
              </div>
              <div className="lp-hero-proof"><ShieldCheck size={16} /><span>Import your history or start with a manual trade</span></div>
            </div>
          </div>
        </section>

        <section id="dashboard-preview" className="lp-dashboard-section" aria-labelledby="lp-dashboard-heading">
          <Reveal className="lp-dashboard-content">
            <div className="lp-wrap">
              <div className="lp-dashboard-title">
                <h2 id="lp-dashboard-heading">Your trading, at a glance</h2>
                <p>A preview of the dashboard you get after signing up</p>
                <span className="lp-dashboard-sample"><ShieldCheck size={14} /> Illustrative sample, not account data</span>
              </div>
              <DashboardPreview />
            </div>
          </Reveal>
        </section>

        <Reveal className="lp-section-kicker"><span /> EVERYTHING IN ONE PLACE <i /> TRADE LOG <i /> JOURNAL <i /> REPORTS <i /> PLAYBOOKS</Reveal>

        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="lp-eyebrow">Features</span>
              <h2>Tools for a clearer view of every trade</h2>
              <p>Keep your history, reflections, and results connected in one workspace.</p>
            </Reveal>
            <div className="lp-grid lp-feature-grid">
              {FEATURES.map(({ icon: Icon, title, text, visual, tone }, index) => (
                <Reveal key={title} className={`lp-card lp-feature-card lp-feature-${tone}`} style={{ '--lp-delay': `${index * 60}ms` }}>
                  <span className="lp-ico"><Icon size={27} strokeWidth={1.8} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <FeatureVisual type={visual} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-backtest-section">
          <div className="lp-wrap lp-backtest-layout">
            <Reveal className="lp-backtest-copy">
              <span className="lp-eyebrow">Backtesting and win/loss record</span>
              <h2>Review the setups in your own history</h2>
              <p className="lp-lead">Filter logged trades by setup and symbol to compare historical outcomes. Candle-by-candle market replay is still on the way.</p>
              <ul className="lp-checks">
                <li><Check size={18} /> Compare results across recorded setups</li>
                <li><Check size={18} /> Review win rate and net results</li>
                <li><Check size={18} /> Keep sample visuals separate from account data</li>
              </ul>
              <Link to="/signup" className="lp-btn lp-backtest-link">Explore the journal <ArrowRight size={17} /></Link>
            </Reveal>
            <BacktestVisual />
          </div>
        </section>

        <section className="lp-section lp-more-tools">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="lp-eyebrow">More tools</span>
              <h2>Small details that support better reviews</h2>
              <p>See what is available now and what we are still building.</p>
            </Reveal>
            <div className="lp-more-grid">
              {MORE_TOOLS.map(({ icon: Icon, title, text, status, accent }, index) => (
                <Reveal key={title} className={`lp-more-card lp-more-${accent} ${status ? 'is-coming-soon' : 'is-available'}`} style={{ '--lp-delay': `${index * 60}ms` }}>
                  <div className="lp-more-card-top">
                    <span className="lp-more-icon"><Icon size={20} /></span>
                    {status
                      ? <span className="lp-coming-soon"><Clock3 size={12} />Coming soon</span>
                      : <span className="lp-available"><i />Available now</span>}
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="lp-section lp-alt">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="lp-eyebrow">How it works</span>
              <h2>A simple routine for clearer reviews</h2>
            </Reveal>
            <Reveal className="lp-steps">
              {STEPS.map((step, index) => (
                <Reveal key={step.n} className="lp-step" style={{ '--lp-delay': `${index * 60}ms` }}>
                  <em>{step.n}</em><h3>{step.title}</h3><p>{step.text}</p><ArrowUpRight className="lp-step-arrow" size={18} />
                </Reveal>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap lp-split">
            <Reveal>
              <span className="lp-eyebrow">Your edge</span>
              <h2>See how your process shows up in the results</h2>
              <p className="lp-lead">Compare logged trades where you followed your rules with those where you did not. Your journal helps you review the pattern without promising an outcome.</p>
              <ul className="lp-checks">
                {['Preparation, rules, and entry-condition checks', 'Compare results by session and management', 'Review the impact of mistakes'].map((text) => (
                  <li key={text}><Check size={18} />{text}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal className="lp-compare">
              <div className="lp-compare-plan"><small>Plan-following trades</small><b>Keep what worked in view</b><span>Review your own trade notes and results</span><i aria-hidden="true" /></div>
              <div className="lp-compare-mistake"><small>Trades that broke your rules</small><b>Learn from the decision</b><span>Use your own review to refine your process</span><i aria-hidden="true" /></div>
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="lp-section lp-alt">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="lp-eyebrow">Pricing</span>
              <h2>Pricing details are on the way</h2>
              <p>TradeJournal is in preview while we shape plans around what traders need most.</p>
            </Reveal>
            <Reveal className="lp-pricing-note">
              <div className="lp-preview-badge">Preview</div>
              <h3>Start exploring TradeJournal</h3>
              <p>Get a feel for the current journal and review workflow. No price is listed while the product is in preview.</p>
              <ul>
                <li><Check size={17} /> Import or log your trades</li>
                <li><Check size={17} /> Keep journal notes and playbooks</li>
                <li><Check size={17} /> Review reports and goals</li>
              </ul>
              <Link to="/signup" className="lp-btn">Get started <ArrowRight size={17} /></Link>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="lp-section">
          <div className="lp-wrap lp-faq-wrap">
            <Reveal className="lp-head">
              <span className="lp-eyebrow">FAQ</span>
              <h2>Questions, answered</h2>
            </Reveal>
            {FAQ.map(([question, answer], index) => {
              const isOpen = openFaq === index
              const answerId = `lp-faq-answer-${index}`
              return (
                <Reveal key={question} style={{ '--lp-delay': `${index * 60}ms` }}>
                  <div className={`lp-faq ${isOpen ? 'open' : ''}`}>
                    <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} aria-expanded={isOpen} aria-controls={answerId}>
                      {question}<ChevronDown size={20} />
                    </button>
                    <div className="lp-faq-a" id={answerId} aria-hidden={!isOpen}><p>{answer}</p></div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <Reveal>
              <img className="lp-final-bear" src="/bear-logo.png" alt="" />
              <span className="lp-final-eyebrow">YOUR NEXT REVIEW STARTS HERE</span>
              <h2>Ready to trade with a clearer head?</h2>
              <p>Bring your trades, notes, and review routine into one focused workspace.</p>
              <Link to="/signup" className="lp-btn lp-lg lp-white">Create your account <ArrowRight size={18} /></Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <Reveal className="lp-wrap lp-foot-in">
          <div>
            <Link to="/welcome" className="lp-brand"><img src="/bear-logo.png" alt="" /><span>Trade<b>Journal</b></span></Link>
            <p>A journal and analytics workspace for traders.</p>
          </div>
          <div><h4>Product</h4><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
          <div><h4>Legal</h4><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/disclaimer">Disclaimer</Link></div>
        </Reveal>
        <div className="lp-wrap lp-legal">
          <p>TradeJournal is a journaling and analytics tool only. It is not financial, investment, or tax advice. Past performance does not guarantee future results. Trading involves risk of loss.</p>
          <p>© {new Date().getFullYear()} TradeJournal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
