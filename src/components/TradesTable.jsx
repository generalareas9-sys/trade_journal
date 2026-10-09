import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { format } from 'date-fns'
import { currency } from '../utils/trading'
import { Badge } from './UiElements'

export function TradeTable({ trades, compact = false, onSelect, searchable = false, pageSize = 8, showCount = true, pageResetKey }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const search = query.toLowerCase()
    return [...trades].filter((trade) => !search || [trade.symbol, trade.side, trade.strategy, trade.tag, trade.notes].some((value) => String(value).toLowerCase().includes(search)))
      .sort((a, b) => {
        const left = a[sort.key]
        const right = b[sort.key]
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
    ['pnl', 'Net P&L'],
    ['rMultiple', 'R-multiple'],
  ] : [
    ['date', 'Date'],
    ['symbol', 'Symbol'],
    ['side', 'Side'],
    ['entry', 'Entry'],
    ['exit', 'Exit'],
    ['time', 'Time'],
    ['session', 'Session'],
    ['rMultiple', 'R-multiple'],
    ['tag', 'Tags'],
    ['pnl', 'Net P&L'],
  ]

  return <>
    {searchable && <div className="table-toolbar"><label className="table-search"><Search size={16} /><input aria-label="Search trades" placeholder="Search trades..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label>{showCount && <span>{filtered.length} trades</span>}</div>}
    <div className="table-scroll"><table className="trades-table">
      <thead><tr>{columns.map(([key, label]) => <th key={key} className={key === 'pnl' ? 'align-right' : ''}><button type="button" className="table-sort" aria-label={`Sort by ${label}`} onClick={() => selectSort(key)}>{label}<span className="sort-icon">{sort.key === key ? (sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} />}</span></button></th>)}</tr></thead>
      <tbody>{visible.map((trade) => <tr key={trade.id} onClick={() => onSelect?.(trade)} onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(trade) } }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Open ${trade.symbol} trade details` : undefined} className={onSelect ? 'clickable-row' : ''}>
        <td>{format(new Date(`${trade.date}T12:00:00`), compact ? 'MMM d' : 'MMM d, yyyy')}</td>
        <td><span className="symbol-cell"><span className={`symbol-icon symbol-${trade.symbol.slice(0, 2).toLowerCase()}`}>{trade.symbol.slice(0, 1)}</span><strong>{trade.symbol}</strong></span></td>
        <td><Badge tone={trade.side.toLowerCase()}>{trade.side}</Badge></td>
        {!compact && <><td>{trade.entry}</td><td>{trade.exit}</td><td>{format(new Date(trade.openedAt), 'h:mm a')}</td><td>{trade.session || '—'}</td></>}
        {!compact && <td className={trade.rMultiple > 0 ? 'profit' : trade.rMultiple < 0 ? 'loss' : ''}>{trade.rMultiple > 0 ? '+' : ''}{Number(trade.rMultiple || 0).toFixed(2)}R</td>}
        {!compact && <td><span className="tag-inline">{trade.tag || '—'}</span></td>}
        <td className={`align-right pnl-cell ${trade.pnl > 0 ? 'profit' : trade.pnl < 0 ? 'loss' : ''}`}>{currency(trade.pnl)}</td>
        {compact && <td className={trade.rMultiple > 0 ? 'profit' : trade.rMultiple < 0 ? 'loss' : ''}>{trade.rMultiple > 0 ? '+' : ''}{Number(trade.rMultiple || 0).toFixed(2)}R</td>}
      </tr>)}
      {!visible.length && <tr><td colSpan={columns.length}><div className="table-empty">No trades match your search.</div></td></tr>}
      </tbody>
    </table></div>
    {!compact && <div className="table-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>{page} / {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>}
  </>
}
