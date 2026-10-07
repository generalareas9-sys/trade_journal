import { useEffect, useRef, useState } from 'react'
import { Brain, Camera, ClipboardCheck, LoaderCircle, Target, TrendingUp, X } from 'lucide-react'
import { currency } from '../utils/trading'
import { getSignedUrl } from '../data/storage'

function Segmented({ label, options, value, onChange, readOnly = false, result = false }) {
  return <div className="field">
    <label>{label} {result && <span className="auto-tag">Auto</span>}</label>
    <div className={`segmented ${result ? 'result-segmented' : ''}`} role="group" aria-label={label}>
      {options.map((option) => <button type="button" key={option} disabled={readOnly} aria-pressed={value === option} className={value === option ? 'seg active' : 'seg'} onClick={() => onChange(option)}>{option}</button>)}
    </div>
  </div>
}

function YesNo({ label, value, onChange }) {
  return <Segmented label={label} options={['Yes', 'No']} value={value} onChange={onChange} />
}

function ResultField({ form }) {
  const amount = currency(form.pnlPreview)
  const resultClass = form.result === 'Win' ? 'result-win' : form.result === 'Loss' ? 'result-loss' : 'result-neutral'
  const mismatch = form.hasPnlPreview
    && ((form.exitCondition === 'TP hit' && form.result === 'Loss') || (form.exitCondition === 'SL hit' && form.result === 'Win'))

  return <div className="field">
    <label>Result · calculated from P&amp;L <span className="auto-tag">Auto</span></label>
    <div className="result-summary">
      <span className={`result-badge ${form.hasPnlPreview ? resultClass : 'result-neutral'}`}>
        {form.hasPnlPreview ? `${form.result} · ${amount}` : 'Enter entry and exit prices'}
      </span>
      {form.hasPnlPreview && <span className="result-pnl">Net P&amp;L: {amount}</span>}
    </div>
    {mismatch && <small className="result-warning" role="status">Exit condition and result do not match</small>}
  </div>
}

function ManualResultField({ form, set }) {
  return <div className="field manual-result-field">
    <div className="result-manual-row">
      <label>Set result</label>
      {form.resultOverride !== null && <button className="link-btn" type="button" onClick={() => set('resultOverride', null)}>Reset to auto</button>}
    </div>
    <div className="segmented result-manual-options" role="group" aria-label="Manual result">
      {['Win', 'Loss', 'Breakeven'].map((result) => (
        <button
          type="button"
          key={result}
          aria-pressed={form.resultOverride === result}
          className={`seg ${form.resultOverride === result ? `active ${result === 'Win' ? 'result-manual-win' : result === 'Loss' ? 'result-manual-loss' : ''}` : ''}`}
          onClick={() => set('resultOverride', result)}
        >
          {result}
        </button>
      ))}
    </div>
  </div>
}

function TextArea({ label, value, onChange, placeholder }) {
  return <div className="field">
    <label>{label}</label>
    <textarea rows={3} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </div>
}

function SectionTitle({ children, id }) {
  const Icon = children === 'Execution' ? TrendingUp
    : children === 'Discipline' ? ClipboardCheck
      : children === 'Outcome' ? Target
        : children === 'Screenshots' ? Camera
          : Brain
  return <h3 id={id} className="details-section-title"><Icon size={15} aria-hidden="true" />{children}</h3>
}

function Shot({ label, value, onChange, onFile, uploading, uploadError, onRetry, onError }) {
  const ref = useRef(null)
  const objectUrl = useRef('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    let active = true
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = ''
    if (!value) {
      setPreview('')
    } else if (value.startsWith('data:')) {
      setPreview(value)
    } else {
      setPreview('')
      void getSignedUrl(value).then(({ url, error }) => {
        if (!active) return
        if (error) onError(error.message || 'Could not load screenshot.')
        else setPreview(url || '')
      })
    }
    return () => {
      active = false
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    }
  }, [value, onError])

  const handle = (file) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onError('Choose a PNG, JPG, or WebP image for trade screenshots.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('Screenshots must be 10 MB or smaller.')
      return
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    setPreview(objectUrl.current)
    onFile(file)
  }

  return <div className="field">
    <label>{label}</label>
    <div
      className="shot-drop"
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          ref.current?.click()
        }
      }}
      onPaste={(event) => handle(event.clipboardData.files[0])}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        handle(event.dataTransfer.files[0])
      }}
    >
      {preview ? <img src={preview} alt={label} /> : <span className="shot-empty">{uploading ? <LoaderCircle size={20} className="spin" /> : <Camera size={20} />}<strong>{uploading ? 'Uploading screenshot…' : 'Click, drag, or paste a screenshot'}</strong><small>PNG, JPG or WebP · up to 10 MB</small></span>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(event) => { handle(event.target.files[0]); event.target.value = '' }} />
    </div>
    {uploading && <small role="status">Uploading screenshot…</small>}
    {uploadError && <p className="field-error" role="alert">{uploadError} <button type="button" className="link-btn" onClick={onRetry}>Retry</button></p>}
    {(value || preview) && <button type="button" className="link-btn shot-remove" onClick={() => { onChange(''); onFile(null) }}><X size={13} />Remove screenshot</button>}
  </div>
}

export default function TradeDetailsFields({ form, set, onError, uploadingScreenshots, screenshotErrors, onScreenshotFile, onRetryScreenshot }) {
  return <div className="details-grid">
    <Segmented label="Trading session" options={['Asia', 'London', 'New York']} value={form.session} onChange={(value) => set('session', value)} />
    <Segmented label="Trade management" options={['Partial', 'Breakeven', 'Set and forget', 'Trailing stop loss']} value={form.management} onChange={(value) => set('management', value)} />
    <SectionTitle id="trade-discipline">Discipline</SectionTitle>
    <YesNo label="Pre-analysis and preparation done?" value={form.preAnalysis} onChange={(value) => set('preAnalysis', value)} />
    <YesNo label="Followed trading rules before entry?" value={form.followedRules} onChange={(value) => set('followedRules', value)} />
    <YesNo label="Entry condition fulfilled?" value={form.entryConditionMet} onChange={(value) => set('entryConditionMet', value)} />
    <SectionTitle id="trade-outcome">Outcome</SectionTitle>
    <Segmented label="Exit condition" options={['TP hit', 'SL hit', 'Closed early']} value={form.exitCondition} onChange={(value) => set('exitCondition', value)} />
    <ResultField form={form} />
    <div className="field">
      <label>RRR (reward per 1 risk)</label>
      <div className="rrr-input"><span>1 :</span><input type="number" step="0.01" min="0" placeholder="2.5" value={form.rrr} onChange={(event) => set('rrr', event.target.value)} /></div>
    </div>
    <ManualResultField form={form} set={set} />
    <SectionTitle id="trade-screenshots">Screenshots</SectionTitle>
    <Shot label="Screenshot before trade" value={form.screenshotBefore} onChange={(value) => set('screenshotBefore', value)} onFile={(file) => onScreenshotFile('before', file)} uploading={uploadingScreenshots.before} uploadError={screenshotErrors.before} onRetry={() => onRetryScreenshot('before')} onError={onError} />
    <Shot label="Screenshot after trade" value={form.screenshotAfter} onChange={(value) => set('screenshotAfter', value)} onFile={(file) => onScreenshotFile('after', file)} uploading={uploadingScreenshots.after} uploadError={screenshotErrors.after} onRetry={() => onRetryScreenshot('after')} onError={onError} />
    <SectionTitle id="trade-psychology">Psychology & risk</SectionTitle>
    <TextArea label="Psychology before trade" value={form.psychBefore} onChange={(value) => set('psychBefore', value)} placeholder="How did you feel before entering?" />
    <TextArea label="Psychology after trade" value={form.psychAfter} onChange={(value) => set('psychAfter', value)} placeholder="How did you feel after closing?" />
    <TextArea label="Risk management" value={form.riskManagement} onChange={(value) => set('riskManagement', value)} placeholder="Risk per trade, position sizing..." />
    <TextArea label="Stop loss system" value={form.stopLossSystem} onChange={(value) => set('stopLossSystem', value)} placeholder="Where and why was the SL placed?" />
    <TextArea label="Take profit system" value={form.takeProfitSystem} onChange={(value) => set('takeProfitSystem', value)} placeholder="Where and why was the TP placed?" />
  </div>
}
