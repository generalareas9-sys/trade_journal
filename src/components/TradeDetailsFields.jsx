import { useEffect, useRef, useState } from 'react'
import { Brain, Camera, Check, ClipboardCheck, LoaderCircle, Target, TrendingUp, X } from 'lucide-react'
import { currency } from '../utils/trading'
import { getSignedUrl } from '../data/storage'

function choiceTone(option) {
  if (['Yes', 'TP hit', 'Win', 'Long'].includes(option)) return 'green'
  if (['No', 'SL hit', 'Loss', 'Short'].includes(option)) return 'red'
  if (['Closed early', 'Breakeven'].includes(option)) return 'amber'
  return 'purple'
}

function handleRadioKeyDown(event, index, options, onChange) {
  let nextIndex = index
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % options.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = options.length - 1
  else return
  event.preventDefault()
  event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[nextIndex]?.focus()
  onChange(options[nextIndex])
}

function Segmented({ label, options, value, onChange, readOnly = false, result = false, allowClear = false }) {
  return <div className="field">
    <label>{label} {result && <span className="auto-tag">Auto</span>}</label>
    <div className={`segmented ${result ? 'result-segmented' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const selected = value === option
        return <button
          type="button"
          role="radio"
          key={option}
          disabled={readOnly}
          aria-checked={selected}
          tabIndex={selected || (!value && index === 0) ? 0 : -1}
          className={`seg choice-tone--${choiceTone(option)}${selected ? ' active' : ''}`}
          onKeyDown={(event) => handleRadioKeyDown(event, index, options, onChange)}
          onClick={() => onChange(allowClear && selected ? '' : option)}
        >
          {selected && <Check size={14} aria-hidden="true" />}
          {option}
        </button>
      })}
    </div>
  </div>
}

function YesNo({ label, value, onChange }) {
  return <Segmented label={label} options={['Yes', 'No']} value={value} onChange={onChange} allowClear />
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
    <div className="segmented result-manual-options" role="radiogroup" aria-label="Manual result">
      {['Win', 'Loss', 'Breakeven'].map((result, index) => (
        <button
          type="button"
          role="radio"
          key={result}
          aria-checked={form.resultOverride === result}
          tabIndex={form.resultOverride === result || (form.resultOverride === null && index === 0) ? 0 : -1}
          className={`seg choice-tone--${choiceTone(result)}${form.resultOverride === result ? ` active ${result === 'Win' ? 'result-manual-win' : result === 'Loss' ? 'result-manual-loss' : ''}` : ''}`}
          onKeyDown={(event) => handleRadioKeyDown(event, index, ['Win', 'Loss', 'Breakeven'], (value) => set('resultOverride', value))}
          onClick={() => set('resultOverride', result)}
        >
          {form.resultOverride === result && <Check size={14} aria-hidden="true" />}
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
  const [loadingImage, setLoadingImage] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = ''
    setLoadError('')
    setLoadingImage(false)
    if (!value) {
      setPreview('')
    } else if (value.startsWith('data:')) {
      setPreview(value)
    } else {
      setPreview('')
      setLoadingImage(true)
      void getSignedUrl(value).then(({ url, error }) => {
        if (!active) return
        if (error) setLoadError(error.message || 'Could not load screenshot.')
        else if (url) setPreview(url)
        else setLoadError('Could not load screenshot.')
      }).catch((error) => {
        if (active) setLoadError(error.message || 'Could not load screenshot.')
      }).finally(() => {
        if (active) setLoadingImage(false)
      })
    }
    return () => {
      active = false
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    }
  }, [value, retryCount])

  const handle = (file) => {
    if (!file) return
    setLoadError('')
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
      {preview ? <img src={preview} alt={label} /> : <span className="shot-empty">{uploading || loadingImage ? <LoaderCircle size={20} className="spin" /> : <Camera size={20} />}<strong>{uploading ? 'Uploading screenshot…' : loadingImage ? 'Loading screenshot…' : 'Click, drag, or paste a screenshot'}</strong><small>PNG, JPG or WebP · up to 10 MB</small></span>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(event) => { handle(event.target.files[0]); event.target.value = '' }} />
    </div>
    {uploading && <small role="status">Uploading screenshot…</small>}
    {(uploadError || loadError) && <p className="field-error" role="alert">{uploadError || loadError} <button type="button" className="link-btn" onClick={uploadError ? onRetry : () => setRetryCount((count) => count + 1)}>Retry</button></p>}
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
    <Segmented label="Exit condition" options={['TP hit', 'SL hit', 'Closed early']} value={form.exitCondition} onChange={(value) => set('exitCondition', value)} allowClear />
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
    <details className="plan-review-section" id="trade-plan-review">
      <summary><Target size={15} aria-hidden="true" />Plan and review</summary>
      <div className="details-grid plan-review-grid">
        <label className="field">Planned stop-loss price<input type="number" step="any" value={form.plannedStopLoss ?? ''} onChange={(event) => set('plannedStopLoss', event.target.value)} /></label>
        <label className="field">Planned take-profit price<input type="number" step="any" value={form.plannedTakeProfit ?? ''} onChange={(event) => set('plannedTakeProfit', event.target.value)} /></label>
        <Segmented label="Setup grade" options={['A', 'B', 'C']} value={form.setupGrade} onChange={(value) => set('setupGrade', value)} allowClear />
        <Segmented label="Confidence" options={['1', '2', '3', '4', '5']} value={String(form.confidence ?? '')} onChange={(value) => set('confidence', value ? Number(value) : '')} allowClear />
        <Segmented label="Emotion before" options={['Calm', 'Confident', 'Fear', 'FOMO', 'Revenge', 'Bored', 'Hesitant']} value={form.emotionBefore} onChange={(value) => set('emotionBefore', value)} allowClear />
        <Segmented label="Emotion after" options={['Calm', 'Confident', 'Fear', 'FOMO', 'Revenge', 'Bored', 'Hesitant']} value={form.emotionAfter} onChange={(value) => set('emotionAfter', value)} allowClear />
        <Segmented label="Market condition" options={['Trending', 'Ranging', 'News-driven', 'Choppy']} value={form.marketCondition} onChange={(value) => set('marketCondition', value)} allowClear />
        <Segmented label="Timeframe" options={['M1', 'M5', 'M15', 'H1', 'H4', 'D1']} value={form.timeframe} onChange={(value) => set('timeframe', value)} allowClear />
        <TextArea label="Lesson learned" value={form.lessonLearned} onChange={(value) => set('lessonLearned', value)} placeholder="What will you carry into the next trade?" />
        <YesNo label="Would I take this trade again?" value={form.takeAgain} onChange={(value) => set('takeAgain', value)} />
        <label className="field">Best price reached<input type="number" step="any" value={form.bestPriceReached ?? ''} onChange={(event) => set('bestPriceReached', event.target.value)} /></label>
        <label className="field">Worst price reached<input type="number" step="any" value={form.worstPriceReached ?? ''} onChange={(event) => set('worstPriceReached', event.target.value)} /></label>
      </div>
    </details>
  </div>
}
