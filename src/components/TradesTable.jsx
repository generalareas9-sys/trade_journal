import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { format } from 'date-fns'
import { calculateAchievedR, calculatePlannedRewardRisk, currency } from '../utils/trading'
import { Badge } from './UiElements'

const COLUMN_WIDTHS = {
  date: 110,
  symbol: 120,
  side: 80,
  entry: 100,
  exit: 100,
  time: 100,
  session: 110,
  rMultiple: 100,
  plannedRr: 120,
  achievedR: 105,
  setupGrade: 100,
  emotion: 140,
  tag: 220,
  strategy: 160,
  pnl: 120,
}

function TagCell({ trade }) {
  const arrayTags = Array.isArray(trade.tags)
    ? trade.tags.filter((tag) => typeof tag === 'string' && tag.trim())
    : []
  const tagValues = arrayTags.length
    ? arrayTags
    : typeof trade.tag === 'string' && trade.tag.trim()
      ? [trade.tag]
      : []
  const fullText = tagValues.join(', ') || '—'
  const freeText = !arrayTags.length && fullText.length > 120
  const [tooltip, setTooltip] = useState(null)

  const showTooltip = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: Math.max(8, rect.top - 44),
      text: fullText,
    })
  }

  return <>
    <td className="tags-cell" title={fullText}>
      {freeText
        ? <span className="tag-cell-text" tabIndex={0} title={fullText} onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)} onFocus={showTooltip} onBlur={() => setTooltip(null)}>{fullText}</span>
        : <span className="tag-chip-list">
          {tagValues.slice(0, 2).map((tag, index) => <span className="tag-inline tag-cell-chip" key={`${index}-${tag}`} title={tag} tabIndex={0} onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)} onFocus={showTooltip} onBlur={() => setTooltip(null)}>{tag}</span>)}
          {tagValues.length > 2 && <span className="tag-inline tag-cell-more" title={tagValues.slice(2).join(', ')} tabIndex={0} onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)} onFocus={showTooltip} onBlur={() => setTooltip(null)}>+{tagValues.length - 2}</span>}
          {!tagValues.length && '—'}
        </span>}
    </td>
    {tooltip && createPortal(<div className="trade-cell-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.text}</div>, document.body)}
  </>
}

export function TradeTable({ trades, compact = false, onSelect, searchable = false, pageSize = 8, showCount = true, pageResetKey }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [extraColumns, setExtraColumns] = useState([])

  const filtered = useMemo(() => {
    const search = query.toLowerCase()
    return [...trades].filter((trade) => !search || [trade.symbol, trade.side, trade.strategy, trade.tag, trade.notes].some((value) => String(value).toLowerCase().includes(search)))
      .sort((a, b) => {
        const getSortValue = (trade) => {
          if (sort.key === 'plannedRr') return calculatePlannedRewardRisk(trade) ?? -Infinity
          if (sort.key === 'achievedR') return calculateAchievedR(trade) ?? -Infinity
          if (sort.key === 'emotion') return [trade.emotionBefore, trade.emotionAfter].filter(Boolean).join(' → ')
          return trade[sort.key]
        }
        const left = getSortValue(a)
        const right = getSortValue(b)
        const comparison = typeof left === 'number' ? left - right : String(left).localeCompare(String(right))
        return sort.direction === 'asc' ? comparison : -comparison
      })
  }, [trades, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = compact ? filtered.slice(0, 6) : filtered.slice((page - 1) * pageSize, page * pageSize)
  const selectSort = (key) => setSort((old) => ({ key, direction: old.key === key && old.direction === 'desc' ? 'asc' : 'desc' }))

  useEffect(() => {
    if (pageResetKey !== undefined) setPage(1)
  }, [pageResetKey])

  const columns = compact ? [
    ['date', 'Date'],
    ['symbol', 'Symbol'],
    ['side', 'Side'],
    ['rMultiple', 'R-multiple'],
    ['pnl', 'Net P&L'],
  ] : [
    ['date', 'Date'],
    ['symbol', 'Symbol'],
    ['side', 'Side'],
    ['entry', 'Entry'],
    ['exit', 'Exit'],
    ['time', 'Time'],
    ['session', 'Session'],
    ['rMultiple', 'R-multiple'],
    ...(extraColumns.includes('setupGrade') ? [['setupGrade', 'Setup grade']] : []),
    ...(extraColumns.includes('emotion') ? [['emotion', 'Emotion']] : []),
    ['plannedRr', 'Planned R:R'],
    ['achievedR', 'Achieved R'],
    ['tag', 'Tags'],
    ['strategy', 'Strategy'],
    ['pnl', 'Net P&L'],
  ]

  return <>
    {searchable && <div className="table-toolbar"><label className="table-search"><Search size={16} /><input aria-label="Search trades" placeholder="Search trades..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label>{showCount && <span>{filtered.length} trades</span>}{!compact && <details className="trade-column-menu"><summary>Columns</summary><div>{[['setupGrade', 'Setup grade'], ['emotion', 'Emotion']].map(([key, label]) => <label key={key}><input type="checkbox" checked={extraColumns.includes(key)} onChange={(event) => setExtraColumns((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} />{label}</label>)}</div></details>}</div>}
    <div className="table-scroll trade-table-scroll"><table className={`trades-table trade-log-table${compact ? ' compact' : ''}`}>
      <colgroup>{columns.map(([key]) => <col key={key} style={{ width: `${COLUMN_WIDTHS[key]}px` }} />)}</colgroup>
      <thead><tr>{columns.map(([key, label]) => <th key={key} className={key === 'pnl' ? 'align-right pnl-cell' : ''}><button type="button" className="table-sort" aria-label={`Sort by ${label}`} onClick={() => selectSort(key)}>{label}<span className="sort-icon">{sort.key === key ? (sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} />}</span></button></th>)}</tr></thead>
      <tbody>{visible.map((trade) => <tr key={trade.id} onClick={() => onSelect?.(trade)} onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(trade) } }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Open ${trade.symbol} trade details` : undefined} className={onSelect ? 'clickable-row' : ''}>
        <td>{format(new Date(`${trade.date}T12:00:00`), compact ? 'MMM d' : 'MMM d, yyyy')}</td>
        <td><span className="symbol-cell"><span className={`symbol-icon symbol-${trade.symbol.slice(0, 2).toLowerCase()}`}>{trade.symbol.slice(0, 1)}</span><strong>{trade.symbol}</strong></span></td>
        <td><Badge tone={trade.side.toLowerCase()}>{trade.side}</Badge></td>
        {!compact && <><td>{trade.entry}</td><td>{trade.exit}</td><td>{format(new Date(trade.openedAt), 'h:mm a')}</td><td>{trade.session || '—'}</td></>}
        <td className={trade.rMultiple > 0 ? 'profit' : trade.rMultiple < 0 ? 'loss' : ''}>{trade.rMultiple > 0 ? '+' : ''}{Number(trade.rMultiple || 0).toFixed(2)}R</td>
        {!compact && extraColumns.includes('setupGrade') && <td>{trade.setupGrade || '—'}</td>}
        {!compact && extraColumns.includes('emotion') && <td>{[trade.emotionBefore, trade.emotionAfter].filter(Boolean).join(' → ') || '—'}</td>}
        {!compact && <td>{calculatePlannedRewardRisk(trade) === null ? '—' : `1 : ${calculatePlannedRewardRisk(trade).toFixed(2)}`}</td>}
        {!compact && <td>{calculateAchievedR(trade) === null ? '—' : `${calculateAchievedR(trade) >= 0 ? '+' : ''}${calculateAchievedR(trade).toFixed(2)}R`}</td>}
        {!compact && <><TagCell trade={trade} /><td title={trade.strategy || '—'}>{trade.strategy || '—'}</td></>}
        <td className={`align-right pnl-cell ${trade.pnl > 0 ? 'profit' : trade.pnl < 0 ? 'loss' : ''}`}>{currency(trade.pnl)}</td>
      </tr>)}
      {!visible.length && <tr><td colSpan={columns.length}><div className="table-empty">No trades match your search.</div></td></tr>}
      </tbody>
    </table></div>
    {!compact && <div className="table-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>{page} / {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>}
  </>
}
