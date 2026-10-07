import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const legalLinks = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/disclaimer', label: 'Disclaimer' },
]

export default function LegalLayout({ title, sections, children }) {
  const navigate = useNavigate()
  const [selectedSection, setSelectedSection] = useState('')

  const scrollToSection = (id) => {
    const section = document.getElementById(id)
    if (!section) return
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    setSelectedSection(id)
  }

  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link to="/welcome" className="legal-brand">
          <img src="/logo.svg" alt="" />
          <span>Trade<b>Journal</b></span>
        </Link>
        <button className="legal-back" type="button" onClick={() => navigate(window.history.state?.idx > 0 ? -1 : '/signup')}>
          <ArrowLeft size={16} /> Back
        </button>
      </header>

      <div className="legal-shell">
        <header className="legal-heading">
          <span className="legal-eyebrow">TRADEJOURNAL POLICIES</span>
          <h1>{title}</h1>
          <p>Last updated: October 7, 2026</p>
        </header>

        <div className="legal-template-warning" role="note">
          Template text. Have it reviewed by a legal professional before launch.
        </div>

        <div className="legal-content-layout">
          <aside className="legal-toc" aria-label="Table of contents">
            <h2>On this page</h2>
            <nav className="legal-toc-links">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} onClick={(event) => {
                  event.preventDefault()
                  scrollToSection(section.id)
                }}>
                  {section.title}
                </a>
              ))}
            </nav>
            <label className="legal-toc-mobile">
              <span className="sr-only">Jump to section</span>
              <select value={selectedSection} onChange={(event) => scrollToSection(event.target.value)}>
                <option value="" disabled>Jump to section…</option>
                {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>
            </label>
          </aside>

          <article className="legal-document">
            {children}
          </article>
        </div>
      </div>

      <footer className="legal-footer">
        <nav aria-label="Legal pages">
          {legalLinks.map(({ to, label }) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
        <p>© {new Date().getFullYear()} TradeJournal. All rights reserved.</p>
      </footer>
    </main>
  )
}
