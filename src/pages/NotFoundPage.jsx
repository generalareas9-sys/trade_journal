import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="not-found-code">404</p>
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist or may have moved.</p>
      <Link className="button-primary" to="/welcome">Return to TradeJournal</Link>
    </main>
  )
}
