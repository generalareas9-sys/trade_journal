import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight, CircleHelp, FileText, Mail, Menu, Search, X } from 'lucide-react'

const EMAIL = 'oseidebrahim@gmail.com'

function ResourceLayout({ children, showBackToApp = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const closeMenu = () => {
    setMenuOpen(false)
    setResourcesOpen(false)
  }

  return (
    <div className="lp resource-page">
      <a className="skip-to-content lp-skip-link" href="#resource-main">Skip to content</a>
      <header className="lp-nav scrolled">
        <div className="lp-wrap lp-nav-in">
          <Link to="/welcome" className="lp-brand" aria-label="TradeJournal home" onClick={closeMenu}>
            <img src="/bear-logo.png" alt="" /><span>Trade<b>Journal</b></span>
          </Link>
          <nav className={menuOpen ? 'open' : ''} aria-label="Main navigation">
            <a href="/welcome#features" onClick={closeMenu}>Why TradeJournal</a>
            <a href="/welcome#dashboard-preview" onClick={closeMenu}>Demo</a>
            <a href="/welcome#how" onClick={closeMenu}>How it works</a>
            <a href="/welcome#pricing" onClick={closeMenu}>Pricing</a>
            <a href="/welcome#faq" onClick={closeMenu}>FAQ</a>
            <div className={`lp-resources ${resourcesOpen ? 'open' : ''}`}>
              <button type="button" aria-expanded={resourcesOpen} onClick={() => setResourcesOpen((open) => !open)}>Resources <ChevronDown size={14} /></button>
              <div className="lp-resources-menu">
                <Link to="/help" onClick={closeMenu}><CircleHelp size={15} />Help Center</Link>
                <Link to="/changelog" onClick={closeMenu}><FileText size={15} />Changelog</Link>
                <Link to="/contact" onClick={closeMenu}><Mail size={15} />Contact</Link>
              </div>
            </div>
            <Link to="/login" className="lp-link-mobile" onClick={closeMenu}>Sign in</Link>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-ghost">Sign in</Link>
            <Link to="/signup" className="lp-btn">Get started</Link>
          </div>
          <button className="lp-burger" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {showBackToApp && <div className="lp-wrap resource-back-app"><Link to="/">Back to app</Link></div>}
      <main id="resource-main" className="resource-main">{children}</main>
      <footer className="lp-footer">
        <div className="lp-wrap lp-foot-in">
          <div>
            <Link to="/welcome" className="lp-brand"><img src="/bear-logo.png" alt="" /><span>Trade<b>Journal</b></span></Link>
            <p>Track every trade, review every decision, and build your edge.</p>
            <p>Created by Osman Seid Ebrahim<br />Information Science Student &amp; Developer<br />Haramaya University, Ethiopia</p>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <a href="https://t.me/Vy_kin_g" target="_blank" rel="noreferrer">@Vy_kin_g</a>
          </div>
          <div><h4>Product</h4><Link to="/welcome#features">Features</Link><Link to="/welcome#pricing">Pricing</Link><Link to="/welcome#faq">FAQ</Link></div>
          <div><h4>Resources</h4><Link to="/help">Help Center</Link><Link to="/changelog">Changelog</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
        </div>
        <div className="lp-wrap lp-legal">
          <p>TradeJournal is a journaling and analytics tool only. It is not financial, investment, or tax advice. Past performance does not guarantee future results. Trading involves risk of loss.</p>
          <p>© {new Date().getFullYear()} TradeJournal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

const HELP_CATEGORIES = [
  {
    title: 'Getting started',
    articles: [
      ['What is TradeJournal?', 'TradeJournal is a trading journal designed to help traders record, review, and analyze their trades so they can better understand their performance and improve their decision-making.'],
      ['Creating an account', 'Create an account from the TradeJournal welcome page. Your journal workspace is available after you sign in.'],
      ['Setting up your trading journal', 'Start by choosing the account and preferences that fit your workflow in Settings, then add or import your trade history.'],
      ['Adding your first trade', 'Use the trade entry flow to record a trade manually, or import trade history from a supported CSV or TXT file.'],
    ],
  },
  {
    title: 'Trade journal',
    articles: [
      ['Recording a trade', 'Record the trade details in your journal so you can review the setup, execution, and outcome later.'],
      ['Entry, stop loss and take profit', 'Use the trade fields to capture your entry and planned risk levels when they apply to your trade.'],
      ['Adding trade notes', 'Add notes to preserve the context behind a setup and your decisions.'],
      ['Adding screenshots', 'Attach screenshots to a trade to keep a visual record of your setup and review.'],
      ['Editing and reviewing trades', 'Open a recorded trade to review or update its details and notes.'],
    ],
  },
  {
    title: 'Performance & analytics',
    articles: [
      ['Understanding win rate', 'Win rate is the proportion of recorded trades with a winning outcome. Review it alongside other statistics and risk measures.'],
      ['Profit and loss', 'Profit and loss summarizes the financial outcomes recorded for your trades over the selected period.'],
      ['Risk-to-reward ratio', 'Risk-to-reward compares the amount at risk on a setup with its potential or realized reward.'],
      ['Reviewing trading performance', 'Use reports and dashboard statistics to review recorded results over time and across your trading activity.'],
      ['Identifying trading patterns', 'Compare your trades, notes, and recorded habits to look for recurring patterns in your own data.'],
    ],
  },
  {
    title: 'Trading process',
    articles: [
      ['Reviewing your trading decisions', 'Journal notes and daily reflections help you revisit the reasoning behind a trade, not just its outcome.'],
      ['Identifying mistakes', 'Record mistakes in your reviews and look for repeated themes across your trades.'],
      ['Finding recurring trading habits', 'Use your journal entries and trade reviews to spot habits that recur over time.'],
      ['Improving your trading discipline', 'Consistent reviews can help you notice when your actions align with your trading plan and where they do not.'],
    ],
  },
  {
    title: 'Account & settings',
    articles: [
      ['Managing your profile', 'Review and update your profile details from your account settings.'],
      ['Account settings', 'Use Settings to manage available account preferences and security options.'],
      ['Privacy', 'Read the Privacy page for information about TradeJournal data and privacy practices.'],
      ['Data management', 'TradeJournal provides account data and journal management options in Settings. Review those controls before making changes to your data.'],
    ],
  },
]

const HELP_FAQS = [
  ['What is TradeJournal?', HELP_CATEGORIES[0].articles[0][1]],
  ['Why should I keep a trading journal?', 'A trading journal helps you identify patterns, mistakes, strengths, weaknesses, and habits that may not be obvious from individual trades.'],
  ['Can I add screenshots to my trades?', 'Yes. Screenshots can help you review your setups and understand what happened before, during, and after a trade.'],
  ['Who created TradeJournal?', 'TradeJournal is an independent project created by Osman Seid Ebrahim, an Information Science student and developer at Haramaya University.'],
]

function ResourceHero({ eyebrow, title, subtitle }) {
  return <section className="resource-hero"><div className="lp-wrap">
    <span className="lp-eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{subtitle}</p>
  </div></section>
}

export function HelpCenterPage() {
  const [query, setQuery] = useState('')
  const [openArticle, setOpenArticle] = useState('')
  const [openFaq, setOpenFaq] = useState(-1)
  const term = query.trim().toLowerCase()
  const categories = HELP_CATEGORIES.map((category) => ({
    ...category,
    articles: category.articles.filter(([title, answer]) => !term || `${title} ${answer}`.toLowerCase().includes(term)),
  })).filter((category) => category.articles.length)
  const faqs = HELP_FAQS.filter(([question, answer]) => !term || `${question} ${answer}`.toLowerCase().includes(term))

  return <ResourceLayout showBackToApp>
    <ResourceHero eyebrow="Help Center" title="How can we help?" subtitle="Find answers, learn how TradeJournal works, and get the most out of your trading journal." />
    <div className="lp-wrap resource-content">
      <label className="resource-search"><Search size={20} /><span className="visually-hidden">Search help articles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles..." /></label>
      <section className="resource-category-grid" aria-label="Help articles">
        {categories.map((category) => <article className="resource-card resource-category" key={category.title}>
          <h2>{category.title}</h2>
          <div className="resource-article-list">{category.articles.map(([title, answer]) => {
            const isOpen = openArticle === title
            const answerId = `help-answer-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
            return <div className={`resource-article ${isOpen ? 'open' : ''}`} key={title}>
              <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenArticle(isOpen ? '' : title)}>
                {title}<ChevronDown size={17} />
              </button>
              {isOpen && <p id={answerId}>{answer}</p>}
            </div>
          })}</div>
        </article>)}
      </section>
      {!categories.length && <p className="resource-empty">No help articles match “{query}”. Try another search.</p>}
      <section className="resource-faq" aria-labelledby="resource-faq-heading">
        <div className="resource-section-heading"><span className="lp-eyebrow">FAQs</span><h2 id="resource-faq-heading">Frequently asked questions</h2></div>
        {faqs.map(([question, answer], index) => {
          const isOpen = openFaq === index
          const answerId = `resource-faq-answer-${index}`
          return <article className={`resource-faq-item ${isOpen ? 'open' : ''}`} key={question}>
            <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenFaq(isOpen ? -1 : index)}>{question}<ChevronDown size={20} /></button>
            {isOpen && <p id={answerId}>{answer}</p>}
          </article>
        })}
        {!faqs.length && <p className="resource-empty">No FAQs match your search.</p>}
      </section>
      <section className="resource-cta">
        <span className="resource-cta-icon"><CircleHelp size={22} /></span>
        <h2>Still need help?</h2>
        <p>Have a question that isn't answered here? Get in touch.</p>
        <Link className="lp-btn" to="/contact">Contact Support <ArrowRight size={17} /></Link>
      </section>
    </div>
  </ResourceLayout>
}

const CURRENT_FEATURES = [
  ['Trade journal', 'Record and review trades, including notes and screenshots.'],
  ['CSV and TXT import', 'Import trade history and map file columns to journal fields.'],
  ['Performance reports', 'Review statistics and performance across recorded trades.'],
  ['Daily journal', 'Keep reflections and review your trading decisions.'],
  ['Playbooks and notes', 'Organize trading guidance, setup notes, and checklists.'],
  ['Account settings', 'Manage account preferences and review available settings.'],
]

const PLANNED_FEATURES = [
  'Advanced trading analytics',
  'Better trade filtering',
  'Improved journal organization',
  'More performance statistics',
  'Improved mobile experience',
  'Additional charting and visualization',
  'Exporting trading data',
  'More customization options',
]

export function ChangelogPage() {
  return <ResourceLayout>
    <ResourceHero eyebrow="Changelog" title="What's new" subtitle="Follow the latest improvements, features, fixes, and updates to TradeJournal." />
    <div className="lp-wrap resource-content resource-changelog">
      <section className="resource-release" aria-labelledby="available-heading">
        <div className="resource-release-marker"><i /></div>
        <article className="resource-card resource-release-card">
          <div className="resource-release-top"><span className="resource-badge available">AVAILABLE</span><span>Current product</span></div>
          <h2 id="available-heading">Available in TradeJournal</h2>
          <p>These capabilities are present in the current project.</p>
          <div className="resource-feature-list">{CURRENT_FEATURES.map(([title, description]) => <div key={title}>
            <span className="resource-badge available">AVAILABLE</span><h3>{title}</h3><p>{description}</p>
          </div>)}</div>
        </article>
      </section>
      <section className="resource-release planned-release" aria-labelledby="planned-heading">
        <div className="resource-release-marker"><i /></div>
        <article className="resource-card resource-release-card">
          <div className="resource-release-top"><span className="resource-badge planned">PLANNED</span><span>Future ideas</span></div>
          <h2 id="planned-heading">What we're considering</h2>
          <p>These are planned improvements, not released features.</p>
          <div className="resource-planned-list">{PLANNED_FEATURES.map((feature) => <div key={feature}><span className="resource-badge planned">PLANNED</span><span>{feature}</span></div>)}</div>
        </article>
      </section>
      <section className="resource-cta">
        <span className="resource-cta-icon"><Mail size={22} /></span>
        <h2>Have an idea for TradeJournal?</h2>
        <p>Your feedback can help shape future improvements.</p>
        <Link className="lp-btn" to="/contact">Contact <ArrowRight size={17} /></Link>
      </section>
    </div>
  </ResourceLayout>
}

const CONTACT_CATEGORIES = [
  ['General questions', 'For questions about TradeJournal and how it works.'],
  ['Feedback & suggestions', "Have an idea that could make TradeJournal better? I'd love to hear your suggestions."],
  ['Bug report', "Found something that isn't working correctly? Let me know so it can be investigated."],
]

export function ContactPage() {
  const [draftStatus, setDraftStatus] = useState('')

  function openEmailDraft(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim()
    const subject = String(formData.get('subject') || '').trim()
    const message = String(formData.get('message') || '').trim()
    const body = `From: ${name}\nReply to: ${email}\n\n${message}`
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setDraftStatus('Your email app should open with a draft. TradeJournal does not send messages directly yet; send the email from your app to contact Osman.')
  }

  return <ResourceLayout>
    <ResourceHero eyebrow="Contact" title="Get in touch" subtitle="Have a question, feedback, or need help with TradeJournal? I'd love to hear from you." />
    <div className="lp-wrap resource-content">
      <section className="contact-kind-grid" aria-label="Reasons to get in touch">
        {CONTACT_CATEGORIES.map(([title, description]) => <article className="resource-card contact-kind" key={title}>
          <span className="resource-cta-icon"><Mail size={19} /></span><h2>{title}</h2><p>{description}</p>
        </article>)}
      </section>
      <div className="contact-layout">
        <section className="resource-card contact-form-card">
          <span className="lp-eyebrow">Send a message</span>
          <h2>Write to the creator</h2>
          <p className="contact-form-intro">This form opens a prefilled message in your email app. It does not send data to a server.</p>
          <form className="resource-contact-form" onSubmit={openEmailDraft}>
            <label>Full Name<input name="name" type="text" autoComplete="name" required maxLength={120} /></label>
            <label>Email Address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>Subject<input name="subject" type="text" required maxLength={160} /></label>
            <label>Message<textarea name="message" rows="6" required maxLength={5000} /></label>
            <button className="lp-btn" type="submit">Send Message <ArrowRight size={17} /></button>
            <p className="contact-form-status" role="status" aria-live="polite">{draftStatus}</p>
          </form>
        </section>
        <aside className="resource-card contact-details">
          <span className="lp-eyebrow">Project creator</span>
          <h2>Osman Seid Ebrahim</h2>
          <p>Information Science Student &amp; Developer<br />Haramaya University</p>
          <dl>
            <div><dt>Email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
            <div><dt>Phone</dt><dd><a href="tel:+251986446282">+251 986 446 282</a></dd></div>
            <div><dt>Telegram</dt><dd><a href="https://t.me/Vy_kin_g" target="_blank" rel="noreferrer">@Vy_kin_g</a></dd></div>
            <div><dt>Location</dt><dd>Haramaya University<br />Ethiopia</dd></div>
          </dl>
          <p className="contact-email-note">If your email app does not open, you can write directly to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        </aside>
      </div>
    </div>
  </ResourceLayout>
}
