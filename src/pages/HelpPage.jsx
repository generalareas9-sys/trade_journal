import { Link } from 'react-router-dom'
import packageInfo from '../../package.json'

const legalPages = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/disclaimer', label: 'Disclaimer' },
]

export default function HelpPage() {
  return (
    <main className="help-page page-content">
      <section className="panel help-card">
        <span className="eyebrow">TRADEJOURNAL</span>
        <h1>Help &amp; About</h1>
        <p>TradeJournal helps you record trades and review your trading process.</p>
        <dl>
          <div><dt>Version</dt><dd>{packageInfo.version}</dd></div>
          <div><dt>Contact</dt><dd>[CONTACT EMAIL]</dd></div>
        </dl>
        <p><a href="mailto:?subject=TradeJournal%20feedback">Send feedback</a></p>
        <nav aria-label="Legal pages">
          {legalPages.map(({ to, label }) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
      </section>
    </main>
  )
}
