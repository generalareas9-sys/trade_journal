import { Inbox } from 'lucide-react'

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return <div className={`empty-state ${className}`}>
    <span className="empty-state-icon"><Icon size={20} /></span>
    <strong>{title}</strong>
    {description && <p>{description}</p>}
    {action}
  </div>
}

export function SkeletonCard() {
  return <div className="skeleton-card" aria-hidden="true">
    <span className="skeleton-line skeleton-label" />
    <span className="skeleton-line skeleton-number" />
    <span className="skeleton-line skeleton-caption" />
  </div>
}

export function SkeletonRows({ rows = 5 }) {
  return <div className="skeleton-rows" aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index}>
      <span className="skeleton-line skeleton-cell-wide" /><span className="skeleton-line skeleton-cell" /><span className="skeleton-line skeleton-cell-short" />
    </div>)}
  </div>
}
