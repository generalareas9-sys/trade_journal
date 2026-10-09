import '../skeleton.css'

const layouts = {
  dashboard: { stats: 5, panels: 3, rows: 4 },
  'trade-log': { stats: 4, panels: 1, rows: 8 },
  reports: { stats: 4, panels: 3, rows: 6 },
  journal: { stats: 4, panels: 2, rows: 7 },
  notebook: { stats: 0, panels: 2, rows: 8 },
  playbooks: { stats: 0, panels: 4, rows: 3 },
}

export default function Skeleton({ variant = 'dashboard' }) {
  const layout = layouts[variant] || layouts.dashboard

  return (
    <div className={`sk-page sk-${variant}`} role="status" aria-label={`Loading ${variant.replace('-', ' ')} page`}>
      {layout.stats > 0 && (
        <div className="sk-stats" aria-hidden="true">
          {Array.from({ length: layout.stats }, (_, index) => (
            <div className="sk-block sk-stat" key={index}><i /><b /><i /></div>
          ))}
        </div>
      )}
      <div className="sk-panels" aria-hidden="true">
        {Array.from({ length: layout.panels }, (_, index) => (
          <div className={`sk-block sk-panel sk-panel-${index + 1}`} key={index}>
            <b />
            <i />
            {Array.from({ length: layout.rows }, (_, row) => <i className="sk-row" key={row} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
