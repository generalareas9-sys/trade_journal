import { useEffect, useState } from 'react'
import { Clock3, FileText, ImagePlus, LoaderCircle, X } from 'lucide-react'
import { format } from 'date-fns'
import { currency } from '../utils/trading'
import { Badge } from './UiElements'
import { useAuth } from '../context/AuthContext'
import { deleteScreenshot, getSignedUrl, uploadScreenshot } from '../data/storage'

export default function TradeDrawer({ trade, onClose, onEdit, onDelete, onUpdate }) {
  const { user } = useAuth()
  const [imageUrls, setImageUrls] = useState({})
  const [uploading, setUploading] = useState('')
  const [imageError, setImageError] = useState('')
  const [retryFile, setRetryFile] = useState(null)
  const [imageLoading, setImageLoading] = useState({})
  const [imageLoadErrors, setImageLoadErrors] = useState({})
  const [retryImageLoad, setRetryImageLoad] = useState(0)

  useEffect(() => {
    let active = true
    setImageUrls({})
    setImageLoadErrors({})
    const values = {
      before: trade?.screenshotBefore || '',
      after: trade?.screenshotAfter || '',
    }
    setImageLoading(Object.fromEntries(Object.entries(values).map(([kind, value]) => [kind, Boolean(value && !value.startsWith('data:'))])))
    for (const [kind, value] of Object.entries(values)) {
      if (!value) continue
      if (value.startsWith('data:')) {
        setImageUrls((current) => ({ ...current, [kind]: value }))
        continue
      }
      void getSignedUrl(value).then(({ url, error }) => {
        if (!active) return
        if (error || !url) setImageLoadErrors((current) => ({ ...current, [kind]: error?.message || 'Could not load trade screenshot.' }))
        else setImageUrls((current) => ({ ...current, [kind]: url }))
      }).catch((error) => {
        if (active) setImageLoadErrors((current) => ({ ...current, [kind]: error.message || 'Could not load trade screenshot.' }))
      }).finally(() => {
        if (active) setImageLoading((current) => ({ ...current, [kind]: false }))
      })
    }
    return () => { active = false }
  }, [trade?.id, trade?.screenshotBefore, trade?.screenshotAfter, retryImageLoad])

  if (!trade) return null

  const upload = async (kind, file = retryFile?.kind === kind ? retryFile.file : null) => {
    if (!file) return
    setRetryFile({ kind, file })
    setUploading(kind)
    setImageError('')
    const result = await uploadScreenshot(user?.id, trade.id, kind, file)
    if (result.error) {
      setImageError(result.error.message || 'Screenshot upload failed.')
      setUploading('')
      return
    }
    const updated = await onUpdate?.(trade.id, { [kind === 'before' ? 'screenshotBefore' : 'screenshotAfter']: result.path })
    if (updated?.error) setImageError(updated.error.message || 'Could not save screenshot path.')
    else setRetryFile(null)
    setUploading('')
  }

  const remove = async (kind) => {
    const field = kind === 'before' ? 'screenshotBefore' : 'screenshotAfter'
    const path = trade[field]
    const result = await onUpdate?.(trade.id, { [field]: '' })
    if (result?.error) {
      setImageError(result.error.message || 'Could not remove screenshot.')
      return
    }
    setImageUrls((current) => ({ ...current, [kind]: '' }))
    setImageLoadErrors((current) => ({ ...current, [kind]: '' }))
    if (path && !path.startsWith('data:')) {
      const removed = await deleteScreenshot(path)
      if (removed.error) console.warn('Could not delete removed trade screenshot from storage.', removed.error)
    }
  }

  return <>
    <button className="drawer-scrim" aria-label="Close trade details" onClick={onClose} />
    <aside className="trade-drawer">
      <div className="drawer-header"><div><span className="eyebrow">TRADE DETAILS</span><h2>{trade.symbol} <Badge tone={trade.side.toLowerCase()}>{trade.side}</Badge></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <p className="drawer-date">{format(new Date(`${trade.date}T12:00:00`), 'EEEE, MMMM d, yyyy')} · {format(new Date(trade.openedAt), 'h:mm a')}</p>
      <div className={`drawer-pnl ${trade.pnl > 0 ? 'profit' : trade.pnl < 0 ? 'loss' : ''}`}>{currency(trade.pnl)}<small>Net P&L</small></div>
      <div className="drawer-stats"><div><span>Entry price</span><strong>{trade.entry}</strong></div><div><span>Exit price</span><strong>{trade.exit}</strong></div><div><span>Size</span><strong>{trade.quantity} {trade.quantity === 1 ? 'unit' : 'units'}</strong></div><div><span>Fees</span><strong>{currency(trade.fees)}</strong></div><div><span>R-multiple</span><strong>{trade.rMultiple}R</strong></div><div><span>Duration</span><strong><Clock3 size={13} />{Math.round((new Date(trade.closedAt) - new Date(trade.openedAt)) / 60000)} min</strong></div></div>
      {(trade.contractExpiry || trade.contractMultiplier || trade.tickSize || trade.tickValue) && <div className="drawer-section">
        <h3>Futures contract details</h3>
        <div className="trade-detail-grid">
          {trade.contractExpiry && <div><span>Contract expiry</span><strong>{trade.contractExpiry}</strong></div>}
          {trade.contractMultiplier && <div><span>Contract multiplier</span><strong>{trade.contractMultiplier} per point</strong></div>}
          {trade.tickSize && <div><span>Tick size</span><strong>{trade.tickSize}</strong></div>}
          {trade.tickValue && <div><span>Tick value</span><strong>{currency(trade.tickValue)}</strong></div>}
        </div>
      </div>}
      <div className="drawer-section"><h3><FileText size={15} /> Trade notes</h3><p>{trade.notes}</p></div>
      <div className="drawer-section"><h3>Strategy & tags</h3><span className="tag-chip">{trade.strategy}</span><span className="tag-chip">{trade.tag}</span></div>
      {trade.mistakes?.length > 0 && <div className="drawer-section"><h3>Recorded mistakes</h3><div className="mistake-chips">{trade.mistakes.map((mistake) => <span className="tag-chip" key={mistake}>{mistake}</span>)}</div></div>}
      {(trade.session || trade.result || trade.management || trade.exitCondition || trade.rrr !== undefined) && <div className="drawer-section">
        <h3>Trade details</h3>
        <div className="trade-detail-grid">
          {trade.session && <div><span>Session</span><strong>{trade.session}</strong></div>}
          {trade.result && <div><span>Result</span><strong>{trade.result}</strong></div>}
          {trade.management && <div><span>Management</span><strong>{trade.management}</strong></div>}
          {trade.exitCondition && <div><span>Exit condition</span><strong>{trade.exitCondition}</strong></div>}
          {trade.rrr !== undefined && trade.rrr !== null && <div><span>Planned RRR</span><strong>1 : {trade.rrr}</strong></div>}
          {trade.riskAmount !== undefined && <div><span>Risk amount</span><strong>{currency(trade.riskAmount)}</strong></div>}
          {trade.preAnalysis && <div><span>Pre-analysis</span><strong>{trade.preAnalysis}</strong></div>}
          {trade.followedRules && <div><span>Followed rules</span><strong>{trade.followedRules}</strong></div>}
          {trade.entryConditionMet && <div><span>Entry condition</span><strong>{trade.entryConditionMet}</strong></div>}
        </div>
        {trade.psychBefore && <p><strong>Psychology before:</strong> {trade.psychBefore}</p>}
        {trade.psychAfter && <p><strong>Psychology after:</strong> {trade.psychAfter}</p>}
        {trade.riskManagement && <p><strong>Risk management:</strong> {trade.riskManagement}</p>}
        {trade.stopLossSystem && <p><strong>Stop loss:</strong> {trade.stopLossSystem}</p>}
        {trade.takeProfitSystem && <p><strong>Take profit:</strong> {trade.takeProfitSystem}</p>}
      </div>}
      <div className="drawer-section"><h3><ImagePlus size={15} /> Screenshots</h3>{uploading && <p role="status">Uploading screenshot…</p>}<div className="trade-screenshots">
        {['before', 'after'].map((kind) => {
          const field = kind === 'before' ? 'screenshotBefore' : 'screenshotAfter'
          const path = trade[field]
          return <figure key={kind}>
            {imageUrls[kind] ? <img src={imageUrls[kind]} alt={`${kind} trade`} /> : <div className="screenshot-placeholder">{uploading === kind || imageLoading[kind] ? <LoaderCircle size={20} className="spin" /> : <ImagePlus size={21} />}<span>{uploading === kind ? 'Uploading…' : imageLoading[kind] ? 'Loading screenshot…' : path ? 'Screenshot unavailable' : `No ${kind} screenshot`}</span></div>}
            <figcaption>{kind === 'before' ? 'Before trade' : 'After trade'}</figcaption>
            {imageLoadErrors[kind] && <p className="field-error" role="alert">{imageLoadErrors[kind]} <button type="button" className="link-btn" onClick={() => setRetryImageLoad((count) => count + 1)}>Retry</button></p>}
            <label className="link-btn shot-remove">{path ? 'Replace screenshot' : 'Add screenshot'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!!uploading} onChange={(event) => { void upload(kind, event.target.files[0]); event.target.value = '' }} /></label>
            {path && <button type="button" className="link-btn shot-remove" onClick={() => void remove(kind)}>Remove screenshot</button>}
          </figure>
        })}
      </div></div>
      {imageError && <div className="drawer-section" role="alert"><p className="field-error">{imageError}</p>{retryFile && <button type="button" className="link-btn" onClick={() => void upload(retryFile.kind, retryFile.file)}>Retry</button>}</div>}
      <div className="drawer-actions"><button className="button-secondary" onClick={onDelete}>Delete trade</button><button className="button-primary drawer-edit" onClick={onEdit}>Edit trade</button></div>
    </aside>
  </>
}
