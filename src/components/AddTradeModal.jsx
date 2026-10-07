import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { BookOpen, Brain, Camera, ClipboardCheck, Target, TrendingUp, X } from 'lucide-react'
import { STRATEGIES } from '../data/mockData'
import { calculateTradePnl } from '../utils/trading'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../context/AuthContext'
import { uploadScreenshot } from '../data/storage'
import TradeDetailsFields from './TradeDetailsFields'

const symbolOptions = ['NQ', 'EURUSD', 'XAUUSD', 'AAPL', 'BTCUSD']

const createInitialForm = () => ({
  symbol: 'NQ',
  side: 'Long',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:30',
  exitTime: '10:30',
  entry: '',
  exit: '',
  quantity: '1',
  fees: '4.5',
  risk: '100',
  strategy: 'Opening Range',
  tag: '',
  mistakes: [],
  notes: '',
  session: 'New York',
  preAnalysis: 'No',
  followedRules: 'No',
  entryConditionMet: 'No',
  management: 'Set and forget',
  screenshotBefore: '',
  screenshotAfter: '',
  psychBefore: '',
  psychAfter: '',
  riskManagement: '',
  stopLossSystem: '',
  takeProfitSystem: '',
  exitCondition: 'Closed early',
  rrr: '',
  resultOverride: null,
})

export default function AddTradeModal() {
  const { addTradeOpen, setAddTradeOpen, addTrade, updateTrade, editingTrade, setEditingTrade } = useJournal()
  const { user } = useAuth()
  const [form, setForm] = useState(createInitialForm)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState({})
  const [screenshotFiles, setScreenshotFiles] = useState({ before: null, after: null })
  const [uploadingScreenshots, setUploadingScreenshots] = useState({ before: false, after: false })
  const [screenshotErrors, setScreenshotErrors] = useState({ before: '', after: '' })
  const [persistedTradeId, setPersistedTradeId] = useState('')
  const [savingTrade, setSavingTrade] = useState(false)

  useEffect(() => {
    if (addTradeOpen) {
      if (editingTrade) {
        const localTime = (date) => {
          const value = new Date(date)
          return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        }
        setForm({
          ...createInitialForm(),
          ...editingTrade,
          date: editingTrade.date,
          time: localTime(editingTrade.openedAt),
          exitTime: localTime(editingTrade.closedAt),
          quantity: String(editingTrade.size ?? editingTrade.quantity ?? ''),
          risk: String(editingTrade.riskAmount ?? 0),
          fees: String(editingTrade.fees ?? 0),
          resultOverride: editingTrade.resultOverride ?? null,
          rrr: editingTrade.rrr ?? '',
        })
      } else {
        setForm(createInitialForm())
      }
      setError('')
      setValidation({})
      setScreenshotFiles({ before: null, after: null })
      setUploadingScreenshots({ before: false, after: false })
      setScreenshotErrors({ before: '', after: '' })
      setPersistedTradeId('')
      setSavingTrade(false)
    }
  }, [addTradeOpen, editingTrade])

  if (!addTradeOpen) return null

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setValidation((current) => ({ ...current, [key]: '' }))
    setError('')
  }

  const changePriceInput = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setValidation((current) => ({ ...current, [key]: '' }))
    setError('')
  }

  const entry = Number(form.entry)
  const exit = Number(form.exit)
  const quantity = Number(form.quantity)
  const fees = Number(form.fees || 0)
  const hasPnlPreview = form.entry !== '' && form.exit !== '' && Number.isFinite(entry) && Number.isFinite(exit) && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(fees) && fees >= 0
  const pnlPreview = hasPnlPreview ? calculateTradePnl({ symbol: form.symbol, side: form.side, entry, exit, size: quantity, fees }) : 0
  const automaticResult = hasPnlPreview ? (pnlPreview > 0 ? 'Win' : pnlPreview < 0 ? 'Loss' : 'Breakeven') : ''
  const finalResult = form.resultOverride !== null ? form.resultOverride : automaticResult

  const setScreenshotFile = (kind, file) => {
    setScreenshotFiles((current) => ({ ...current, [kind]: file }))
    setScreenshotErrors((current) => ({ ...current, [kind]: '' }))
    if (!file) setField(kind === 'before' ? 'screenshotBefore' : 'screenshotAfter', '')
  }

  const uploadTradeScreenshot = async (kind, tradeId) => {
    const file = screenshotFiles[kind]
    if (!file) return true
    if (!user?.id) {
      setScreenshotErrors((current) => ({ ...current, [kind]: 'Sign in before uploading screenshots.' }))
      return false
    }
    setUploadingScreenshots((current) => ({ ...current, [kind]: true }))
    setScreenshotErrors((current) => ({ ...current, [kind]: '' }))
    const uploaded = await uploadScreenshot(user.id, tradeId, kind, file)
    if (uploaded.error) {
      setScreenshotErrors((current) => ({ ...current, [kind]: uploaded.error.message || 'Screenshot upload failed.' }))
      setUploadingScreenshots((current) => ({ ...current, [kind]: false }))
      return false
    }
    const field = kind === 'before' ? 'screenshotBefore' : 'screenshotAfter'
    const updated = await updateTrade(tradeId, { [field]: uploaded.path })
    if (updated?.error) {
      setScreenshotErrors((current) => ({ ...current, [kind]: updated.error.message || 'Could not save screenshot path.' }))
      setUploadingScreenshots((current) => ({ ...current, [kind]: false }))
      return false
    }
    setField(field, uploaded.path)
    setScreenshotFiles((current) => ({ ...current, [kind]: null }))
    setUploadingScreenshots((current) => ({ ...current, [kind]: false }))
    return true
  }

  const submit = async (event) => {
    event.preventDefault()
    if (savingTrade) return
    const symbol = form.symbol.trim()
    const date = form.date
    const parsedEntry = Number(form.entry)
    const parsedExit = Number(form.exit)
    const parsedQuantity = Number(form.quantity)
    const parsedFees = Number(form.fees || 0)
    const risk = Number(form.risk || 0)
    const rrr = form.rrr === '' ? null : Number(form.rrr)

    const requiredErrors = {
      symbol: symbol ? '' : 'Choose a symbol.',
      date: date ? '' : 'Choose a date.',
      entry: Number.isFinite(parsedEntry) && parsedEntry > 0 ? '' : 'Enter an entry price greater than zero.',
      exit: Number.isFinite(parsedExit) && parsedExit > 0 ? '' : 'Enter an exit price greater than zero.',
      quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? '' : 'Enter a position size greater than zero.',
    }
    setValidation(requiredErrors)
    if (Object.values(requiredErrors).some(Boolean)) {
      setError('Complete the required fields highlighted below.')
      return
    }
    if (!Number.isFinite(parsedEntry) || parsedEntry <= 0 || !Number.isFinite(parsedExit) || parsedExit <= 0) {
      setError('Entry and exit prices must be greater than zero.')
      return
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Position size must be greater than zero.')
      return
    }
    if (!Number.isFinite(parsedFees) || parsedFees < 0 || !Number.isFinite(risk) || risk < 0) {
      setError('Fees and risk amount must be zero or greater.')
      return
    }
    if (rrr !== null && (!Number.isFinite(rrr) || rrr < 0)) {
      setError('RRR must be a number greater than or equal to zero.')
      return
    }
    if (form.resultOverride !== null && !form.resultOverride) {
      setError('Choose a manual result or reset to auto.')
      return
    }

    const openedAt = new Date(`${date}T${form.time || '09:30'}:00`)
    const closedAt = new Date(`${date}T${form.exitTime || form.time || '11:30'}:00`)
    if (Number.isNaN(openedAt.getTime()) || Number.isNaN(closedAt.getTime())) {
      setError('Enter a valid entry and exit time.')
      return
    }
    if (closedAt < openedAt) closedAt.setDate(closedAt.getDate() + 1)

    const normalizedPnl = calculateTradePnl({
      symbol,
      side: form.side,
      entry: parsedEntry,
      exit: parsedExit,
      size: parsedQuantity,
      fees: parsedFees,
    })
    const outcome = form.resultOverride !== null ? form.resultOverride : normalizedPnl > 0 ? 'Win' : normalizedPnl < 0 ? 'Loss' : 'Breakeven'
    const rMultiple = risk > 0 ? Number((normalizedPnl / risk).toFixed(2)) : 0

    const savedTrade = {
      date,
      openedAt: openedAt.toISOString(),
      closedAt: closedAt.toISOString(),
      symbol,
      side: form.side,
      entry: parsedEntry,
      exit: parsedExit,
      quantity: parsedQuantity,
      pnl: normalizedPnl,
      fees: parsedFees,
      riskAmount: risk,
      rMultiple,
      rrr: rrr === null ? null : Number(rrr.toFixed(2)),
      resultOverride: form.resultOverride,
      strategy: form.strategy || 'Uncategorized',
      tag: form.tag || 'Manual entry',
      outcome,
      result: outcome,
      notes: form.notes || 'No notes added.',
      session: form.session,
      preAnalysis: form.preAnalysis,
      followedRules: form.followedRules,
      entryConditionMet: form.entryConditionMet,
      management: form.management,
      screenshotBefore: form.screenshotBefore,
      screenshotAfter: form.screenshotAfter,
      psychBefore: form.psychBefore,
      psychAfter: form.psychAfter,
      riskManagement: form.riskManagement,
      stopLossSystem: form.stopLossSystem,
      takeProfitSystem: form.takeProfitSystem,
      exitCondition: form.exitCondition,
      mistakes: form.mistakes,
    }
    setSavingTrade(true)
    try {
      let tradeId = persistedTradeId
      if (!tradeId) {
        const saved = editingTrade
          ? await updateTrade(editingTrade.id, savedTrade)
          : await addTrade(savedTrade)
        if (saved?.error) {
          setError(saved.error.message || 'Could not save the trade.')
          return
        }
        tradeId = saved?.data?.id || editingTrade?.id
        if (!tradeId) {
          setError('The trade was saved but its id could not be read. Please reload before retrying.')
          return
        }
        setPersistedTradeId(tradeId)
      } else if (editingTrade) {
        const updated = await updateTrade(tradeId, savedTrade)
        if (updated?.error) {
          setError(updated.error.message || 'Could not save the trade.')
          return
        }
      }
      for (const kind of ['before', 'after']) {
        const success = await uploadTradeScreenshot(kind, tradeId)
        if (!success) return
      }
      setAddTradeOpen(false)
      if (editingTrade) setEditingTrade(null)
    } finally {
      setSavingTrade(false)
    }
  }

  const jumpToSection = (id) => {
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddTradeOpen(false) }}>
      <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="add-trade-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TRADE JOURNAL</span>
            <h2 id="add-trade-title">{editingTrade ? 'Edit trade' : 'Add a trade'}</h2>
            <p>Capture the details and keep your journal up to date.</p>
          </div>
          <button className="icon-button" onClick={() => setAddTradeOpen(false)} aria-label="Close"><X size={19} /></button>
        </div>

        <form onSubmit={submit}>
          <nav className="trade-form-steps" aria-label="Trade form sections">
            {[
              ['trade-basics', 'Basics', BookOpen],
              ['trade-execution', 'Execution', TrendingUp],
              ['trade-discipline', 'Discipline', ClipboardCheck],
              ['trade-outcome', 'Outcome', Target],
              ['trade-screenshots', 'Screenshots', Camera],
              ['trade-psychology', 'Psychology & risk', Brain],
            ].map(([id, label, Icon]) => <button key={id} type="button" onClick={() => jumpToSection(id)}><Icon size={13} />{label}</button>)}
          </nav>
          <h3 id="trade-basics" className="section-title"><BookOpen size={15} />Basics</h3>
          <div className="form-grid">
            <label>Symbol<select name="symbol" value={form.symbol} aria-invalid={Boolean(validation.symbol)} onChange={(event) => setField('symbol', event.target.value)}><option value="">Select a symbol</option>{symbolOptions.map((item) => <option key={item}>{item}</option>)}</select>{validation.symbol && <small className="field-error">{validation.symbol}</small>}</label>
            <label>Side<select name="side" value={form.side} onChange={(event) => setField('side', event.target.value)}><option>Long</option><option>Short</option></select></label>
            <label>Date<input name="date" type="date" value={form.date} aria-invalid={Boolean(validation.date)} onChange={(event) => setField('date', event.target.value)} />{validation.date && <small className="field-error">{validation.date}</small>}</label>
            <label>Entry time<input name="time" type="time" value={form.time} onChange={(event) => setField('time', event.target.value)} /></label>
            <label>Entry price<input name="entry" type="number" step="any" placeholder="0.00" value={form.entry} aria-invalid={Boolean(validation.entry)} onChange={(event) => changePriceInput('entry', event.target.value)} />{validation.entry && <small className="field-error">{validation.entry}</small>}</label>
            <label>Exit price<input name="exit" type="number" step="any" placeholder="0.00" value={form.exit} aria-invalid={Boolean(validation.exit)} onChange={(event) => changePriceInput('exit', event.target.value)} />{validation.exit && <small className="field-error">{validation.exit}</small>}</label>
            <label>Position size<input name="quantity" type="number" min="0.01" step="any" value={form.quantity} aria-invalid={Boolean(validation.quantity)} onChange={(event) => changePriceInput('quantity', event.target.value)} />{validation.quantity && <small className="field-error">{validation.quantity}</small>}</label>
            <label>Exit time<input name="exitTime" type="time" value={form.exitTime} onChange={(event) => setField('exitTime', event.target.value)} /></label>
            <label>Fees ($)<input name="fees" type="number" min="0" step="0.01" value={form.fees} onChange={(event) => changePriceInput('fees', event.target.value)} /></label>
            <label>Risk amount ($)<input name="risk" type="number" min="0" step="0.01" value={form.risk} onChange={(event) => setField('risk', event.target.value)} /></label>
            <h3 id="trade-execution" className="section-title form-span"><TrendingUp size={15} />Execution</h3>
            <label>Strategy<select name="strategy" value={form.strategy} onChange={(event) => setField('strategy', event.target.value)}>{STRATEGIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="form-span">Tag<input name="tag" placeholder="Add a tag" value={form.tag} onChange={(event) => setField('tag', event.target.value)} /></label>
            <fieldset className="mistake-picker form-span"><legend>Mistakes (optional)</legend>{['FOMO', 'revenge trade', 'moved stop', 'oversized'].map((mistake) => <button type="button" key={mistake} className={form.mistakes.includes(mistake) ? 'selected' : ''} onClick={() => setField('mistakes', form.mistakes.includes(mistake) ? form.mistakes.filter((item) => item !== mistake) : [...form.mistakes, mistake])}>{mistake}</button>)}</fieldset>
            <label className="form-span">Notes<textarea name="notes" rows="3" placeholder="What did you see? How did you execute?" value={form.notes} onChange={(event) => setField('notes', event.target.value)} /></label>
          </div>

          <TradeDetailsFields
            form={{ ...form, result: finalResult, pnlPreview, hasPnlPreview }}
            set={setField}
            onError={setError}
            uploadingScreenshots={uploadingScreenshots}
            screenshotErrors={screenshotErrors}
            onScreenshotFile={setScreenshotFile}
            onRetryScreenshot={(kind) => { if (persistedTradeId) void uploadTradeScreenshot(kind, persistedTradeId); else setError('Save the trade first to retry its screenshot upload.') }}
          />

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={() => setAddTradeOpen(false)}>Cancel</button>
            <button type="submit" className="button-primary" disabled={savingTrade}>{savingTrade ? 'Saving…' : editingTrade ? 'Save changes' : 'Save trade'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
