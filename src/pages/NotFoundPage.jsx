import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJournal } from '../hooks/useJournal'
import '../not-found.css'

export default function NotFoundPage() {
  const { user } = useAuth()
  const { dark } = useJournal()

  return (
    <main className={`not-found-page nf-page${dark ? ' dark-theme' : ''}`}>
      <img className="nf-logo" src="/bear-logo.png" alt="TradeJournal bear logo" />
      <p className="not-found-code">404</p>
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist or may have moved.</p>
      <div className="nf-actions">
        <Link className="button-primary" to="/welcome">Back to home</Link>
        {user && <Link className="button-secondary" to="/">Go to dashboard</Link>}
      </div>
      <Link className="button-primary" to="/welcome">Return to TradeJournal</Link>
    </main>
  )
}
