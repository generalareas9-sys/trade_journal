import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, CircleAlert, CircleCheck, FileSpreadsheet, HelpCircle, Plus, RotateCcw, Trash2, UploadCloud } from 'lucide-react'
import Papa from 'papaparse'
import { format, isValid, parse } from 'date-fns'
import { accounts } from '../data/mockData'
import { useData } from '../context/DataContext'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const REQUIRED_FIELDS = ['date', 'symbol', 'side', 'entry', 'exit', 'size']
const FIELD_LABELS = {
  date: 'Date / entry date',
  symbol: 'Symbol',
  side: 'Side',
  entry: 'Entry price',
  exit: 'Exit price',
  size: 'Size / quantity',
  fees: 'Fees / commission',
  pnl: 'P&L',
  entryTime: 'Entry time',
  exitTime: 'Exit time',
  account: 'Account',
  notes: 'Notes',
}
const ALIASES = {
  date: ['date', 'tradedate', 'opendate', 'entrydate', 'datetime', 'timestamp', 'opentime', 'entrytime', 'time'],
  symbol: ['symbol', 'instrument', 'ticker', 'market', 'asset', 'contract'],
  side: ['side', 'type', 'direction', 'action', 'buysell', 'position', 'ordertype'],
  entry: ['entry', 'entryprice', 'open', 'openprice', 'priceopen', 'openrate', 'avgentry', 'avgopenprice', 'fillprice'],
  exit: ['exit', 'close', 'exitprice', 'closeprice', 'priceclose', 'closerate', 'avgexit'],
  size: ['size', 'qty', 'quantity', 'volume', 'lots', 'contracts'],
  fees: ['fees', 'fee', 'commission', 'commissions', 'swap', 'costs', 'tradingfees', 'transactioncost', 'commissionswap'],
  pnl: ['pnl', 'pl', 'profit', 'profitloss', 'netprofit', 'netpnl', 'realizedpnl', 'realizedprofit'],
  entryTime: ['opentime', 'entrytime', 'entrydatetime', 'time'],
  exitTime: ['closetime', 'exittime', 'exitdatetime'],
  account: ['account', 'accountname', 'portfolio'],
  notes: ['notes', 'note', 'comment'],
}
const FORMATS = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
}
const TIMEZONES = [
  ['local', 'Device local time'],
  ['UTC', 'UTC'],
  ['America/New_York', 'New York'],
  ['Europe/London', 'London'],
  ['Europe/Paris', 'Central Europe'],
  ['Asia/Tokyo', 'Tokyo'],
]
const normalizeHeader = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const formatMoney = (value) => `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function detectMapping(headers) {
  const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }))
  return Object.fromEntries(Object.entries(ALIASES).map(([field, aliases]) => {
    const match = normalized.find(({ key }) => aliases.includes(key))
    return [field, match?.header || '']
  }))
}

function parseDateValue(value, preferredFormat) {
  const text = String(value || '').trim()
  if (!text) return null
  const textDate = text.match(/^([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/)
  const datePart = textDate?.[0] || text.split(/[T ]/)[0]
  const reference = new Date(2000, 0, 1)
  let candidates
  if (preferredFormat !== 'auto') candidates = [FORMATS[preferredFormat]]
  else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(datePart)) candidates = ['yyyy-MM-dd', 'yyyy/M/d', 'yyyy/MM/dd']
  else {
    const numeric = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (numeric) {
      const first = Number(numeric[1])
      const second = Number(numeric[2])
      candidates = first > 12 ? ['dd/MM/yyyy', 'dd-MM-yyyy', 'd/M/yy'] : second > 12
        ? ['MM/dd/yyyy', 'MM-dd-yyyy', 'M/d/yy']
        : ['MM/dd/yyyy', 'dd/MM/yyyy', 'M/d/yy', 'd/M/yy']
    } else candidates = ['MMM d, yyyy', 'MMMM d, yyyy', 'd MMM yyyy', 'd MMMM yyyy']
  }
  for (const candidate of candidates) {
    if (!candidate) continue
    const date = parse(datePart, candidate, reference)
    if (isValid(date)) return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }
  const fallback = new Date(datePart)
  if (!Number.isNaN(fallback.getTime())) return { year: fallback.getFullYear(), month: fallback.getMonth() + 1, day: fallback.getDate() }
  return null
}

function parseTimeValue(value, fallback = '09:30:00') {
  const text = String(value || '').trim()
  const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!match) return fallback ? fallback.split(':').map(Number) : null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || 0)
  const meridiem = match[4]?.toUpperCase()
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0
  if (hour > 23 || minute > 59 || second > 59) return null
  return [hour, minute, second]
}

function timestampFor(parts, timezone) {
  const { year, month, day, time } = parts
  const [hour, minute, second] = time
  if (timezone === 'local') return new Date(year, month - 1, day, hour, minute, second).toISOString()
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  if (timezone === 'UTC') return new Date(desiredUtc).toISOString()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let candidate = desiredUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]))
    const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second))
    candidate = desiredUtc - (representedUtc - candidate)
  }
  return new Date(candidate).toISOString()
}

function parseNumeric(value, delimiter) {
  let text = String(value ?? '').trim()
  if (!text) return null
  const negativeAccounting = /^\(.*\)$/.test(text)
  text = text.replace(/[()$€£¥\s]/g, '')
  if (delimiter !== ',' && text.includes(',') && !text.includes('.')) text = text.replace(',', '.')
  else text = text.replace(/,/g, '')
  text = text.replace(/[^\d.eE+-]/g, '')
  const number = Number(text)
  return Number.isFinite(number) ? (negativeAccounting ? -number : number) : null
}

function normalizeSide(value, format) {
  const text = String(value || '').trim().toLowerCase()
  if (format === 'buy-sell') {
    if (['buy', 'long', 'b'].includes(text)) return 'Long'
    if (['sell', 'short', 's'].includes(text)) return 'Short'
  } else if (format === 'long-short') {
    if (['long', 'buy', 'b'].includes(text)) return 'Long'
    if (['short', 'sell', 's'].includes(text)) return 'Short'
  } else {
    if (['b', 'buy', 'long'].includes(text)) return 'Long'
    if (['s', 'sell', 'short'].includes(text)) return 'Short'
  }
  return ''
}

function makeDuplicateKey(trade) {
  return [
    trade.account || 'main',
    String(trade.symbol || '').toUpperCase(),
    trade.side,
    trade.openedAt,
    Number(trade.entry),
    Number(trade.size),
  ].join('|')
}

function saveDownload(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sampleTemplate() {
  const rows = [
    ['Date', 'Symbol', 'Side', 'Entry', 'Exit', 'Size', 'Fees', 'PnL', 'Entry Time', 'Exit Time', 'Account', 'Notes'],
    ['2026-10-05', 'EURUSD', 'Buy', '1.16420', '1.16640', '1.00', '4.50', '', '09:35:00', '10:10:00', 'Main account', 'London breakout retest'],
    ['2026-10-06', 'NQ', 'Sell', '24620.00', '24608.00', '1', '3.00', '', '10:02:00', '10:26:00', 'Main account', 'Failed opening range'],
  ]
  return Papa.unparse(rows)
}

function TradeImport() {
  const { trades, importSettings, setImportSettings, importTrades, undoImport } = useData()
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [delimiter, setDelimiter] = useState(',')
  const [mapping, setMapping] = useState({})
  const [parseError, setParseError] = useState('')
  const [parseNotice, setParseNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [importAnyway, setImportAnyway] = useState(false)
  const [completed, setCompleted] = useState(null)
  const [undoComplete, setUndoComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const setSetting = (key, value) => setImportSettings((current) => ({ ...current, [key]: value }))
  const updatePointValue = (symbol, value) => setSetting('pointValues', {
    ...importSettings.pointValues,
    [symbol]: value === '' ? '' : Number(value),
  })
  const removePointValue = (symbol) => {
    const pointValues = { ...importSettings.pointValues }
    delete pointValues[symbol]
    setSetting('pointValues', pointValues)
  }
  const addPointValue = () => setSetting('pointValues', { ...importSettings.pointValues, [`__NEW_IMPORT_${Date.now()}__`]: 1 })
  const renamePointValue = (oldName, newName) => {
    const pointValues = { ...importSettings.pointValues }
    const value = pointValues[oldName]
    delete pointValues[oldName]
    pointValues[newName.toUpperCase()] = value
    setSetting('pointValues', pointValues)
  }

  const loadFile = (file) => {
    setParseError('')
    setParseNotice('')
    setCompleted(null)
    setUndoComplete(false)
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setParseError('Choose a .csv or .txt file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setParseError('This file is larger than the 10 MB limit.')
      return
    }
    setBusy(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      delimitersToGuess: [',', ';', '\t'],
      complete: (result) => {
        setBusy(false)
        if (!result.meta.fields?.length) {
          setParseError('No header row was found. Add column names to the first row and try again.')
          return
        }
        setFileName(file.name)
        setHeaders(result.meta.fields)
        setSourceRows(result.data)
        setDelimiter(result.meta.delimiter || ',')
        setMapping(detectMapping(result.meta.fields))
        if (result.errors.length) setParseNotice(`${result.errors.length} formatting warning${result.errors.length === 1 ? '' : 's'} detected; check the preview before importing.`)
        setStep(1)
      },
      error: (error) => {
        setBusy(false)
        setParseError(`Could not parse this file: ${error.message}`)
      },
    })
  }

  const evaluatedRows = useMemo(() => sourceRows.map((source, index) => {
    const getValue = (key) => mapping[key] ? source[mapping[key]] ?? '' : ''
    const rawDate = String(getValue('date')).trim()
    const dateParts = parseDateValue(rawDate, importSettings.dateFormat || 'auto')
    const externalTime = mapping.entryTime && mapping.entryTime !== mapping.date ? getValue('entryTime') : ''
    const entryTimeValue = externalTime || rawDate
    const time = parseTimeValue(entryTimeValue)
    const symbol = String(getValue('symbol')).trim().toUpperCase()
    const side = normalizeSide(getValue('side'), importSettings.sideFormat || 'buy-sell')
    const entry = parseNumeric(getValue('entry'), delimiter)
    const exit = parseNumeric(getValue('exit'), delimiter)
    const size = parseNumeric(getValue('size'), delimiter)
    const feesRaw = String(getValue('fees')).trim()
    const parsedFees = feesRaw ? parseNumeric(feesRaw, delimiter) : 0
    const fees = parsedFees ?? 0
    const csvPnlRaw = getValue('pnl')
    const csvPnl = csvPnlRaw === '' ? null : parseNumeric(csvPnlRaw, delimiter)
    const configuredAccount = String(getValue('account')).trim()
    const matchedAccount = configuredAccount && accounts.find((account) => account.id.toLowerCase() === configuredAccount.toLowerCase() || account.name.toLowerCase() === configuredAccount.toLowerCase())
    const account = matchedAccount?.id || importSettings.targetAccount || 'main'
    const date = dateParts ? `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}` : ''
    const openedAt = dateParts && time ? timestampFor({ ...dateParts, time }, importSettings.timezone || 'local') : ''
    const exitTimeValue = getValue('exitTime')
    const exitTime = parseTimeValue(exitTimeValue, '')
    const closedAt = dateParts && exitTime
      ? timestampFor({ ...dateParts, time: exitTime }, importSettings.timezone || 'local')
      : openedAt && new Date(new Date(openedAt).getTime() + 60 * 60 * 1000).toISOString()
    const pointValue = Number(importSettings.pointValues?.[symbol] ?? 1)
    const calculatedPnl = entry !== null && exit !== null && size !== null
      ? (side === 'Long' ? exit - entry : entry - exit) * size * pointValue - fees
      : null
    const pnl = csvPnl !== null ? csvPnl : calculatedPnl
    let reason = ''
    if (!dateParts) reason = 'Bad date'
    else if (!symbol) reason = 'Missing symbol'
    else if (!side) reason = 'Unknown side'
    else if (entry === null) reason = 'Missing or invalid entry price'
    else if (exit === null) reason = 'Missing or invalid exit price'
    else if (size === null || size <= 0) reason = 'Missing or invalid size'
    else if (parsedFees === null) reason = 'Invalid fees value'
    else if (csvPnlRaw !== '' && csvPnl === null) reason = 'Invalid P&L value'
    else if (!Number.isFinite(pointValue) || pointValue <= 0) reason = 'Invalid point value'
    else if (pnl === null || !Number.isFinite(pnl)) reason = 'Could not calculate P&L'
    else if (!openedAt) reason = 'Invalid entry time'
    const trade = {
      date, openedAt, closedAt, symbol, side, entry, exit, size, quantity: size,
      pointValue, fees, pnl, pnlOverride: csvPnl, account,
      notes: String(getValue('notes')).trim(),
      strategy: 'Uncategorized', tag: 'CSV import', riskAmount: 0,
      session: '', preAnalysis: '', followedRules: '', entryConditionMet: '',
      management: '', screenshotBefore: '', screenshotAfter: '', psychBefore: '',
      psychAfter: '', riskManagement: '', stopLossSystem: '', takeProfitSystem: '',
      exitCondition: 'Closed early', mistakes: [],
    }
    return { rowNumber: index + 2, source, trade, valid: !reason, reason, duplicate: false }
  }), [sourceRows, mapping, delimiter, importSettings])

  const existingKeys = useMemo(() => new Set(trades.map(makeDuplicateKey)), [trades])
  const reviewedRows = useMemo(() => {
    const seen = new Set(existingKeys)
    return evaluatedRows.map((row) => {
      if (!row.valid) return row
      const key = makeDuplicateKey(row.trade)
      const duplicate = seen.has(key)
      seen.add(key)
      return { ...row, duplicate }
    })
  }, [evaluatedRows, existingKeys])
  const validCount = reviewedRows.filter((row) => row.valid).length
  const invalidRows = reviewedRows.filter((row) => !row.valid)
  const duplicateCount = reviewedRows.filter((row) => row.valid && row.duplicate).length
  const selectedRows = reviewedRows.filter((row) => row.valid && (importAnyway || !row.duplicate))
  const requiredMapped = REQUIRED_FIELDS.every((field) => mapping[field])

  const updateMapping = (field, value) => setMapping((current) => ({ ...current, [field]: value }))
  const resetWizard = () => {
    setStep(0)
    setFileName('')
    setHeaders([])
    setSourceRows([])
    setMapping({})
    setParseError('')
    setParseNotice('')
    setCompleted(null)
    setUndoComplete(false)
    setImportAnyway(false)
  }
  const runImport = () => {
    if (!selectedRows.length) return
    const importBatchId = `csv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const imported = importTrades(selectedRows.map((row) => row.trade), importBatchId)
    setCompleted({ importBatchId, imported, skipped: importAnyway ? 0 : duplicateCount, invalid: invalidRows.length })
    setStep(3)
  }
  const downloadInvalid = () => {
    const rows = invalidRows.map((row) => ({ ...row.source, 'Import error': row.reason, 'Source row': row.rowNumber }))
    saveDownload('trade-import-invalid-rows.csv', Papa.unparse(rows), 'text/csv;charset=utf-8')
  }
  const downloadTemplate = () => saveDownload('tradejournal-import-template.csv', sampleTemplate(), 'text/csv;charset=utf-8')

  return <div className="page-content trade-import-page">
    <div className="import-page-intro">
      <div><span className="eyebrow">BRING YOUR HISTORY</span><h2>Import trades</h2><p>Upload a broker export, match its columns, and review each trade before it joins your journal.</p></div>
      <Link to="/trades" className="button-secondary"><ArrowLeft size={15} />Back to Trade Log</Link>
    </div>

    <section className="panel import-wizard">
      <div className="import-progress" aria-label={`Step ${step + 1} of 4`}>
        {['Upload', 'Map columns', 'Preview', 'Done'].map((label, index) => <div className={`import-progress-step ${index === step ? 'active' : ''} ${index < step ? 'complete' : ''}`} key={label}>
          <span>{index < step ? <Check size={15} /> : index + 1}</span><strong>{label}</strong>
        </div>)}
        <div className="import-progress-track"><i style={{ width: `${step * 33.333}%` }} /></div>
      </div>

      {step === 0 && <div className="import-upload-layout">
        <div>
          <div className={`import-dropzone ${dragging ? 'drag-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files?.[0]) }}>
            <span className="import-upload-icon"><UploadCloud size={25} /></span>
            <h3>{busy ? 'Reading your file…' : 'Drop your trade file here'}</h3>
            <p>CSV or tab-delimited text · up to 10 MB</p>
            <button className="button-primary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><FileSpreadsheet size={16} />Choose file</button>
            <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
            {fileName && <div className="selected-import-file"><CircleCheck size={15} />{fileName}</div>}
          </div>
          {parseError && <p className="import-error" role="alert"><CircleAlert size={15} />{parseError}</p>}
          {parseNotice && <p className="import-notice" role="status"><CircleAlert size={15} />{parseNotice}</p>}
          <div className="import-upload-actions">
            <button className="button-primary" disabled={!headers.length || busy} onClick={() => setStep(1)}>Continue to map columns <ArrowRight size={15} /></button>
            <button className="button-secondary" onClick={downloadTemplate}><ArrowDownToLine size={15} />Download sample template</button>
          </div>
        </div>
        <HelpPanel />
      </div>}

      {step === 1 && <div className="import-step-content">
        <div className="import-section-heading"><div><span className="eyebrow">STEP 2</span><h3>Match your CSV columns</h3><p>Required fields are marked. We guessed the closest header names; review before continuing.</p></div><span className="import-file-chip"><FileSpreadsheet size={15} />{fileName}</span></div>
        <div className="import-mapping-grid">{Object.entries(FIELD_LABELS).map(([field, label]) => <label className={`import-map-field ${REQUIRED_FIELDS.includes(field) ? 'is-required' : ''}`} key={field}>
          <span>{label}{REQUIRED_FIELDS.includes(field) && <i>Required</i>}</span>
          <select value={mapping[field] || ''} onChange={(event) => updateMapping(field, event.target.value)}>
            <option value="">Not mapped</option>
            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </label>)}</div>
        <div className="import-settings-block">
          <div className="import-section-heading"><div><span className="eyebrow">IMPORT SETTINGS</span><h3>How should we read this file?</h3><p>These preferences are saved for your next import.</p></div></div>
          <div className="import-settings-grid">
            <label>Date format<select value={importSettings.dateFormat || 'auto'} onChange={(event) => setSetting('dateFormat', event.target.value)}><option value="auto">Auto-detect</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label>
            <label>Source timezone<select value={importSettings.timezone || 'local'} onChange={(event) => setSetting('timezone', event.target.value)}>{TIMEZONES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Side values in file<select value={importSettings.sideFormat || 'buy-sell'} onChange={(event) => setSetting('sideFormat', event.target.value)}><option value="buy-sell">Buy / Sell</option><option value="long-short">Long / Short</option><option value="b-s">B / S</option></select></label>
            <label>Target account<select value={importSettings.targetAccount || 'main'} onChange={(event) => setSetting('targetAccount', event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          </div>
          <div className="point-value-heading"><div><strong>Per-symbol point value</strong><span>Used to calculate net P&amp;L when your CSV has no P&amp;L column.</span></div><button className="button-secondary" type="button" onClick={addPointValue}><Plus size={14} />Add symbol</button></div>
          <div className="point-value-grid">{Object.entries(importSettings.pointValues || {}).map(([symbol, value], index) =>           <div className="point-value-row" key={index}>
            <label><span className="sr-only">Symbol</span><input value={symbol.startsWith('__NEW_IMPORT_') ? '' : symbol} placeholder="Symbol" onChange={(event) => renamePointValue(symbol, event.target.value)} onBlur={(event) => { if (!event.target.value.trim()) removePointValue(symbol) }} /></label>
            <label><span className="sr-only">Point value for {symbol}</span><input type="number" min="0.000001" step="any" value={value} onChange={(event) => updatePointValue(symbol, event.target.value)} /></label>
            <button className="icon-button" type="button" aria-label={`Remove ${symbol || 'symbol'} point value`} onClick={() => removePointValue(symbol)}><Trash2 size={15} /></button>
          </div>)}</div>
          <p className="import-footnote"><HelpCircle size={14} />Defaults: EURUSD 100,000 · XAUUSD 100 · NQ 20 · ES 50 · AAPL 1 · BTCUSD 1</p>
        </div>
        <div className="import-step-actions"><button className="button-secondary" onClick={() => setStep(0)}><ArrowLeft size={15} />Back</button><button className="button-primary" disabled={!requiredMapped} onClick={() => setStep(2)}>Preview trades <ArrowRight size={15} /></button></div>
      </div>}

      {step === 2 && <div className="import-step-content">
        <div className="import-section-heading"><div><span className="eyebrow">STEP 3</span><h3>Review before importing</h3><p>We check every row for required values and duplicates before adding anything.</p></div><button className="button-secondary" onClick={() => setStep(1)}><ArrowLeft size={15} />Edit mapping</button></div>
        <div className="import-count-grid">
          <div><span>Valid rows</span><strong>{validCount}</strong></div>
          <div><span>Duplicates</span><strong className={duplicateCount ? 'import-count-warn' : ''}>{duplicateCount}</strong></div>
          <div><span>Invalid rows</span><strong className={invalidRows.length ? 'import-count-bad' : ''}>{invalidRows.length}</strong></div>
        </div>
        <label className="import-duplicate-option"><input type="checkbox" checked={importAnyway} onChange={(event) => setImportAnyway(event.target.checked)} /><span><strong>Import duplicate rows anyway</strong><small>Off by default: duplicate trades are skipped.</small></span></label>
        <div className="table-scroll import-preview-scroll"><table className="import-preview-table"><thead><tr><th>Row</th><th>Date / time</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Size</th><th>Net P&amp;L</th><th>Status</th></tr></thead><tbody>
          {reviewedRows.slice(0, 50).map((row) => <tr key={row.rowNumber} className={!row.valid ? 'import-invalid-row' : row.duplicate ? 'import-duplicate-row' : ''}>
            <td>{row.rowNumber}</td><td>{row.trade.date || String(row.source[mapping.date] || '—')}{row.trade.openedAt && <small>{format(new Date(row.trade.openedAt), 'HH:mm')}</small>}</td>
            <td>{row.trade.symbol || '—'}</td><td>{row.trade.side || '—'}</td><td>{row.trade.entry ?? '—'}</td><td>{row.trade.exit ?? '—'}</td><td>{row.trade.size ?? '—'}</td>
            <td className={row.trade.pnl > 0 ? 'profit' : row.trade.pnl < 0 ? 'loss' : ''}>{row.trade.pnl === null ? '—' : formatMoney(row.trade.pnl)}</td>
            <td>{row.valid ? row.duplicate ? <span className="import-row-status duplicate">Duplicate</span> : <span className="import-row-status ready">Ready</span> : <span className="import-row-status invalid" title={row.reason}>{row.reason}</span>}</td>
          </tr>)}
          {!reviewedRows.length && <tr><td colSpan="9">No data rows found in this file.</td></tr>}
        </tbody></table></div>
        <p className="import-preview-footnote">Showing the first {Math.min(reviewedRows.length, 50)} of {reviewedRows.length} rows. The counts above include the entire file.</p>
        <div className="import-step-actions"><button className="button-secondary" onClick={() => setStep(1)}><ArrowLeft size={15} />Back</button><button className="button-primary" disabled={!selectedRows.length} onClick={runImport}>Import {selectedRows.length} trades <ArrowRight size={15} /></button></div>
      </div>}

      {step === 3 && completed && <div className="import-done">
        <span className="import-done-icon"><CircleCheck size={31} /></span>
        <span className="eyebrow">IMPORT COMPLETE</span>
        <h3>{undoComplete ? 'Import batch removed' : 'Your trades are in the journal'}</h3>
        <p>{undoComplete
          ? 'All trades from this import batch have been removed.'
          : `Imported ${completed.imported}, skipped ${completed.skipped} duplicates, ${completed.invalid} invalid.`}</p>
        {!undoComplete && <div className="import-done-actions">
          {completed.invalid > 0 && <button className="button-secondary" onClick={downloadInvalid}><ArrowDownToLine size={15} />Download invalid rows</button>}
          <button className="button-secondary import-undo-button" onClick={() => { undoImport(completed.importBatchId); setUndoComplete(true) }}><RotateCcw size={15} />Undo import</button>
        </div>}
        <div className="import-step-actions"><Link to="/trades" className="button-secondary">View Trade Log</Link><button className="button-primary" onClick={resetWizard}>Import another file</button></div>
      </div>}
    </section>
  </div>
}

function HelpPanel() {
  return <aside className="import-help-panel">
    <div className="import-help-title"><span><HelpCircle size={16} /></span><div><strong>Exporting your trades</strong><small>Most platforms can export history as CSV.</small></div></div>
    <details open><summary>MetaTrader (MT4 / MT5)</summary><p>Open the account history or toolbox history tab, choose the period, then right-click the history list and select a report or save the history as a report. If the platform exports HTML, save or convert the table to CSV/TXT before uploading.</p></details>
    <details><summary>TradingView</summary><p>Open the Strategy Tester or broker panel and use its export/download control when available. Exports vary by broker and integration; ensure the file has one header row with trade date, symbol, side, prices, and size.</p></details>
    <details><summary>Tradovate-style platforms</summary><p>In the performance or account history area, select a date range and export fills or trades to CSV. Some exports contain individual fills; combine fills into completed trades first if you want one journal row per round trip.</p></details>
    <div className="import-template-callout"><FileSpreadsheet size={17} /><span><strong>Need a starting point?</strong><small>Download the sample CSV with supported headers.</small></span><button className="view-link" onClick={() => saveDownload('tradejournal-import-template.csv', sampleTemplate(), 'text/csv;charset=utf-8')}>Download template <ArrowDownToLine size={14} /></button></div>
  </aside>
}

export default TradeImport
