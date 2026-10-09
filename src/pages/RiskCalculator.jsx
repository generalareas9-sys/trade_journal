import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Copy,
  Gauge,
  Ruler,
  RotateCcw,
  Scale,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { symbolPointValues, calculateTradePnl } from '../utils/trading'
import '../risk-calculator.css'

const lotStepOptions = ['0.001', '0.01', '0.1', '1']
const defaultSymbol = Object.keys(symbolPointValues)[0] || ''
const knownSymbols = Object.keys(symbolPointValues)

const numberFrom = (value) => {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : Number(trimmed)
}
const validNumber = (value) => value !== null && Number.isFinite(value)
const money = (value) => Number.isFinite(value)
  ? `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'
const signedMoney = (value) => Number.isFinite(value)
  ? `${value < 0 ? '-' : ''}${money(value)}`
  : '—'
const stepDigits = (step) => (String(step).split('.')[1] || '').length
const formatLots = (value, step) => {
  if (!Number.isFinite(value)) return '—'
  const digits = stepDigits(step)
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}
const formatExactLots = (value) => Number.isFinite(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })
  : '—'
const resolveContractSize = (symbolName) => {
  const normalized = String(symbolName ?? '').trim().toUpperCase()
  if (!normalized) return { known: false, contractSize: null }

  const direct = Number(symbolPointValues[normalized])
  if (Number.isFinite(direct) && direct > 0) return { known: true, contractSize: direct }

  const stripped = normalized.replace(/[MC]$/, '')
  const fallback = Number(symbolPointValues[stripped])
  if (Number.isFinite(fallback) && fallback > 0) return { known: true, contractSize: fallback }

  return { known: false, contractSize: null }
}

function Field({ label, name, value, onChange, type = 'number', hint, ...props }) {
  return <label className="rc-field" htmlFor={`rc-${name}`}>
    <span>{label}{hint && <small className="rc-field-hint">{hint}</small>}</span>
    <input id={`rc-${name}`} name={name} type={type} value={value} onChange={onChange} {...props} />
  </label>
}

function Output({ label, value, detail, tone = 'neutral', icon: Icon = Target }) {
  const [animatedValue, setAnimatedValue] = useState(value)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimatedValue(value)
      return undefined
    }

    const matches = [...value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)]
    if (!matches.length) {
      setAnimatedValue(value)
      return undefined
    }

    const match = matches[matches.length - 1]
    const finalNumber = Number(match[0].replace(/,/g, ''))
    if (!Number.isFinite(finalNumber)) {
      setAnimatedValue(value)
      return undefined
    }

    const decimals = (match[0].split('.')[1] || '').length
    const prefix = value.slice(0, match.index)
    const suffix = value.slice(match.index + match[0].length)
    let startTime
    let frame
    const animate = (time) => {
      if (startTime === undefined) startTime = time
      const progress = Math.min((time - startTime) / 400, 1)
      const current = finalNumber * progress
      const numberText = current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      setAnimatedValue(`${prefix}${numberText}${suffix}`)
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return <div className={`rc-output rc-output-${tone}`}>
    <span className="rc-output-label"><Icon size={15} aria-hidden="true" />{label}</span>
    <strong>{animatedValue}</strong>
    {detail && <small>{detail}</small>}
  </div>
}

export default function RiskCalculator() {
  const { settings = {}, notify } = useJournal()
  const [form, setForm] = useState(() => ({
    balance: '',
    riskMode: 'percent',
    riskValue: '1',
    symbol: defaultSymbol,
    customSymbol: '',
    side: 'Buy',
    entry: '',
    stop: '',
    target: '',
    feesPerUnit: '0',
    contractSize: String(symbolPointValues[defaultSymbol] || ''),
    lotStep: '0.01',
  }))

  function update(key, value) {
    setForm((current) => {
      if (key === 'symbol') {
        const nextSymbol = value
        const resolved = nextSymbol && nextSymbol !== '__custom__' ? resolveContractSize(nextSymbol) : { known: false, contractSize: null }
        return {
          ...current,
          symbol: nextSymbol,
          customSymbol: nextSymbol === '__custom__' ? current.customSymbol : '',
          contractSize: nextSymbol !== '__custom__' && resolved.known ? String(resolved.contractSize) : current.contractSize,
        }
      }

      if (key === 'customSymbol') {
        const resolved = resolveContractSize(value)
        return {
          ...current,
          customSymbol: value,
          contractSize: resolved.known ? String(resolved.contractSize) : current.contractSize,
        }
      }

      return { ...current, [key]: value }
    })
  }

  function reset() {
    setForm(() => ({
      balance: '',
      riskMode: 'percent',
      riskValue: '1',
      symbol: defaultSymbol,
      customSymbol: '',
      side: 'Buy',
      entry: '',
      stop: '',
      target: '',
      feesPerUnit: '0',
      contractSize: String(symbolPointValues[defaultSymbol] || ''),
      lotStep: '0.01',
    }))
  }

  const calculation = useMemo(() => {
    const balance = numberFrom(form.balance)
    const riskValue = numberFrom(form.riskValue)
    const entry = numberFrom(form.entry)
    const stop = numberFrom(form.stop)
    const target = numberFrom(form.target)
    const feesPerUnit = form.feesPerUnit === '' ? 0 : numberFrom(form.feesPerUnit)
    const contractSizeInput = numberFrom(form.contractSize)
    const lotStep = Number(form.lotStep) || 0.01

    if (!validNumber(balance) || balance <= 0) return { error: 'Enter an account balance greater than zero.' }
    if (!validNumber(riskValue) || riskValue <= 0) return { error: 'Enter a risk amount greater than zero.' }
    if (!validNumber(entry) || !validNumber(stop)) return { error: 'Enter both an entry price and a stop-loss price.' }
    if (form.target !== '' && !validNumber(target)) return { error: 'Enter a valid take-profit price or leave it blank.' }
    if (!validNumber(feesPerUnit) || feesPerUnit < 0) return { error: 'Fees per unit must be zero or greater.' }

    const selectedSymbol = form.symbol === '__custom__' ? form.customSymbol : form.symbol
    const symbolMeta = resolveContractSize(selectedSymbol)
    const contractSize = symbolMeta.known ? symbolMeta.contractSize : contractSizeInput
    if (!symbolMeta.known && (!validNumber(contractSizeInput) || contractSizeInput <= 0)) {
      return { error: 'Enter a contract size for this symbol.' }
    }
    if (!Number.isFinite(contractSize) || contractSize <= 0) return { error: 'Enter a valid contract size.' }

    const stopDistance = Math.abs(entry - stop)
    if (stopDistance === 0) return { error: 'Entry and stop-loss prices cannot be the same.' }
    if (form.side === 'Buy' && (stop >= entry)) {
      return { error: 'For a Buy trade, the stop-loss must be below entry.' }
    }
    if (form.side === 'Sell' && (stop <= entry)) {
      return { error: 'For a Sell trade, the stop-loss must be above entry.' }
    }
    if (form.target !== '' && target !== null) {
      const rewardDistance = Math.abs(target - entry)
      if (rewardDistance === 0) return { error: 'Take-profit cannot be the same as the entry price.' }
      if (form.side === 'Buy' && target <= entry) {
        return { error: 'For a Buy trade, the take-profit must be above entry.' }
      }
      if (form.side === 'Sell' && target >= entry) {
        return { error: 'For a Sell trade, the take-profit must be below entry.' }
      }
    }

    const riskBudget = form.riskMode === 'percent' ? balance * riskValue / 100 : riskValue
    const riskPerLot = stopDistance * contractSize
    if (!Number.isFinite(riskPerLot) || riskPerLot <= 0) return { error: 'These values are outside the supported calculation range.' }

    const exactLots = riskBudget / riskPerLot
    const roundedLots = Math.floor((exactLots + Number.EPSILON) / lotStep) * lotStep
    if (!Number.isFinite(roundedLots) || roundedLots <= 0) {
      return { error: 'Risk is too small for the minimum lot size.' }
    }

    const actualRisk = riskPerLot * roundedLots
    const exactPotentialLoss = riskPerLot * exactLots
    const roundedPotentialLoss = riskPerLot * roundedLots

    const rewardDistance = target === null ? null : Math.abs(target - entry)
    const rewardRatio = rewardDistance === null ? null : rewardDistance / stopDistance
    const feePerLot = feesPerUnit * contractSize
    const exactProfit = rewardDistance === null
      ? null
      : exactLots * contractSize * rewardDistance - Math.abs(feesPerUnit) * exactLots * contractSize
    const roundedProfit = rewardDistance === null
      ? null
      : roundedLots * contractSize * rewardDistance - Math.abs(feesPerUnit) * roundedLots * contractSize
    const exactBreakEven = rewardDistance === null ? null : (actualRisk / (actualRisk + Math.max(exactProfit, 0))) * 100
    const breakEvenRate = rewardDistance === null ? null : Math.max(0, (actualRisk / (actualRisk + Math.max(roundedProfit, 0))) * 100)

    if (rewardDistance !== null && (!Number.isFinite(rewardRatio) || rewardRatio < 0)) return { error: 'The take-profit distance is invalid.' }
    if (rewardDistance !== null && exactProfit !== null && !Number.isFinite(exactProfit)) return { error: 'These values are outside the supported calculation range.' }
    if (rewardDistance !== null && roundedProfit !== null && !Number.isFinite(roundedProfit)) return { error: 'These values are outside the supported calculation range.' }

    return {
      balance,
      riskBudget,
      contractSize,
      stopDistance,
      exactLots,
      roundedLots,
      actualRisk,
      exactPotentialLoss,
      roundedPotentialLoss,
      rewardDistance,
      rewardRatio,
      exactProfit,
      roundedProfit,
      breakEvenRate,
      lotStep,
      symbolText: selectedSymbol,
      feePerLot,
      sideText: form.side,
    }
  }, [form])

  async function copySummary() {
    if (calculation.error) {
      notify('Complete valid calculator inputs before copying a summary.')
      return
    }

    const selectedSymbol = form.symbol === '__custom__' ? (form.customSymbol || 'Custom') : form.symbol
    const ratioLine = calculation.rewardDistance === null ? 'Risk-to-reward: Not set' : `Risk-to-reward: 1 : ${(calculation.rewardRatio ?? 0).toFixed(2)}`
    const profitLine = calculation.rewardDistance === null
      ? 'Potential profit: Not set'
      : `Potential profit: ${money(calculation.roundedProfit)} (exact ${money(calculation.exactProfit)})`
    const riskText = calculation.roundedLots === calculation.exactLots
      ? `Actual risk at rounded lot size: ${money(calculation.actualRisk)}`
      : `Actual risk at rounded lot size: ${money(calculation.actualRisk)} (exact risk ${money(calculation.riskBudget)})`

    const lines = [
      'Risk calculator summary',
      `Account balance: ${money(calculation.balance)}`,
      `Risk amount: ${money(calculation.riskBudget)}`,
      `Symbol: ${selectedSymbol}`,
      `Contract size: ${calculation.contractSize}`,
      `Lot step: ${formatLots(calculation.lotStep, calculation.lotStep)}`,
      `Entry / stop: ${form.entry} / ${form.stop}`,
      `Stop-loss distance: ${String(calculation.stopDistance)}`,
      `Recommended lot size: ${formatLots(calculation.roundedLots, calculation.lotStep)}`,
      `Exact lot size: ${formatExactLots(calculation.exactLots)}`,
      riskText,
      ratioLine,
      profitLine,
      `Potential loss: ${signedMoney(calculation.roundedPotentialLoss)}`,
      `Break-even win rate: ${calculation.breakEvenRate === null ? 'Not set' : `${calculation.breakEvenRate.toFixed(1)}%`}`,
      'Calculator only. Not financial advice.',
    ]

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
      await navigator.clipboard.writeText(lines.join('\n'))
      notify('Risk calculator summary copied.')
    } catch (error) {
      notify(`Could not copy risk calculator summary: ${error.message || 'Clipboard access failed.'}`)
    }
  }

  async function copyLots() {
    if (calculation.error) {
      notify('Enter valid calculator inputs before copying the recommended lot size.')
      return
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
      await navigator.clipboard.writeText(formatLots(calculation.roundedLots, calculation.lotStep))
      notify('Recommended lot size copied.')
    } catch (error) {
      notify(`Could not copy recommended lot size: ${error.message || 'Clipboard access failed.'}`)
    }
  }

  const configuredDailyLimit = Number(settings.dailyLossLimit)
  const hasDailyLimit = settings.dailyLossLimit !== '' && settings.dailyLossLimit !== null && settings.dailyLossLimit !== undefined && Number.isFinite(configuredDailyLimit) && configuredDailyLimit > 0
  const overRiskThreshold = !calculation.error && calculation.riskBudget / calculation.balance > 0.02
  const riskPercent = !calculation.error ? calculation.riskBudget / calculation.balance * 100 : 0
  const riskMeterTone = riskPercent < 1 ? 'green' : riskPercent <= 2 ? 'amber' : 'red'
  const ratioLabel = calculation.rewardRatio !== null && calculation.rewardRatio !== undefined && Number.isFinite(calculation.rewardRatio)
    ? `1 : ${calculation.rewardRatio.toFixed(2)}`
    : '—'
  const riskShare = Number.isFinite(calculation.rewardRatio)
    ? 1 / (1 + calculation.rewardRatio) * 100
    : 0
  const rewardShare = 100 - riskShare

  const showCustomSymbol = form.symbol === '__custom__'
  const outputTiles = [
    { label: 'Stop-loss distance', value: calculation.error ? '—' : calculation.stopDistance.toFixed(3), detail: 'Absolute price move', tone: 'blue', icon: Ruler },
    { label: 'Recommended lot size', value: calculation.error ? '—' : formatLots(calculation.roundedLots, calculation.lotStep), detail: calculation.error ? '' : `Exact: ${formatExactLots(calculation.exactLots)} lots · actual risk ${money(calculation.actualRisk)}`, tone: 'blue', icon: Scale },
    { label: 'Risk amount', value: calculation.error ? '—' : money(calculation.riskBudget), detail: calculation.error ? '' : `${((calculation.riskBudget / calculation.balance) * 100).toFixed(2)}% of account`, tone: 'purple', icon: Wallet },
    ...(calculation.rewardDistance === null ? [] : [{ label: 'Risk-to-reward', value: calculation.error ? '—' : ratioLabel, detail: calculation.error ? '' : `${formatLots(calculation.rewardDistance, 2)} reward distance`, tone: 'neutral', icon: Scale }]),
    ...(calculation.rewardDistance === null ? [] : [{ label: 'Potential profit', value: calculation.error ? '—' : money(calculation.roundedProfit), detail: calculation.error ? '' : `Exact: ${money(calculation.exactProfit)}`, tone: 'green', icon: TrendingUp }]),
    { label: 'Potential loss', value: calculation.error ? '—' : signedMoney(calculation.roundedPotentialLoss), detail: calculation.error ? '' : `Exact: ${signedMoney(calculation.exactPotentialLoss)}`, tone: 'red', icon: TrendingDown },
    { label: 'Break-even win rate', value: calculation.error || calculation.breakEvenRate === null ? '—' : `${calculation.breakEvenRate.toFixed(1)}%`, detail: calculation.error || calculation.breakEvenRate === null ? '' : 'Required wins to break even', tone: 'neutral', icon: Target },
  ]

  return <div className="page-content rc-page">
    <header className="rc-header">
      <div className="rc-title"><span className="rc-title-icon"><Calculator size={20} /></span><div><span className="rc-eyebrow">POSITION PLANNING</span><h2>Risk calculator</h2><p>Estimate position size and potential outcomes before a trade.</p></div></div>
      <div className="rc-actions">
        <button type="button" className="rc-button" onClick={reset}><RotateCcw size={16} />Reset</button>
        <button type="button" className="rc-button rc-copy-button" onClick={() => void copySummary()}><Copy size={16} />Copy summary</button>
      </div>
    </header>

    <div className="rc-layout">
      <section className={`rc-card rc-input-card rc-enter rc-enter-1${calculation.error ? ' rc-has-error' : ''}`} aria-labelledby="rc-input-title">
        <div className="rc-section-heading"><div><h3 id="rc-input-title">Trade details</h3><p>Enter your account and planned trade prices.</p></div></div>
        <div className="rc-fields">
          <Field label="Account balance ($)" hint="USD" name="balance" value={form.balance} onChange={(event) => update('balance', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="e.g. 25000" />
          <div className="rc-field">
            <span id="rc-risk-label">Risk per trade <small className="rc-field-hint">{form.riskMode === 'percent' ? 'Percent of balance' : 'USD'}</small></span>
            <div className="rc-risk-control">
              <input aria-labelledby="rc-risk-label" name="riskValue" type="number" min="0" step="any" inputMode="decimal" value={form.riskValue} onChange={(event) => update('riskValue', event.target.value)} />
              <div className="rc-toggle" role="group" aria-label="Risk input type">
                <button type="button" aria-pressed={form.riskMode === 'percent'} className={form.riskMode === 'percent' ? 'selected' : ''} onClick={() => update('riskMode', 'percent')}>%</button>
                <button type="button" aria-pressed={form.riskMode === 'amount'} className={form.riskMode === 'amount' ? 'selected' : ''} onClick={() => update('riskMode', 'amount')}>$</button>
              </div>
            </div>
          </div>

          <label className="rc-field" htmlFor="rc-symbol"><span>Symbol</span><select id="rc-symbol" name="symbol" value={form.symbol} onChange={(event) => update('symbol', event.target.value)}>
            {knownSymbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
            <option value="__custom__">Custom symbol</option>
          </select></label>
          {showCustomSymbol && <Field label="Custom symbol" name="customSymbol" value={form.customSymbol} onChange={(event) => update('customSymbol', event.target.value)} placeholder="e.g. XAUUSDm" />}
          <Field label="Contract size" hint="Units per lot" name="contractSize" value={form.contractSize} onChange={(event) => update('contractSize', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="e.g. 100" />

          <label className="rc-field" htmlFor="rc-side"><span>Side</span><select className={`rc-side-select rc-side-${form.side.toLowerCase()}`} id="rc-side" name="side" value={form.side} onChange={(event) => update('side', event.target.value)}><option value="Buy">Buy</option><option value="Sell">Sell</option></select></label>
          <label className="rc-field" htmlFor="rc-lot-step"><span>Lot step <small className="rc-field-hint">Lots</small></span><select id="rc-lot-step" name="lotStep" value={form.lotStep} onChange={(event) => update('lotStep', event.target.value)}>{lotStepOptions.map((step) => <option key={step} value={step}>{step}</option>)}</select></label>
          <Field label="Entry price" hint="Price points" name="entry" value={form.entry} onChange={(event) => update('entry', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Entry price" />
          <Field label="Stop-loss price" hint="Price points" name="stop" value={form.stop} onChange={(event) => update('stop', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Stop price" />
          <Field label="Take-profit price (optional)" hint="Price points" name="target" value={form.target} onChange={(event) => update('target', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Target price" />
          <Field label="Fees per unit ($, optional)" hint="USD" name="feesPerUnit" value={form.feesPerUnit} onChange={(event) => update('feesPerUnit', event.target.value)} min="0" step="any" inputMode="decimal" />
        </div>
        {hasDailyLimit && <div className="rc-daily-limit"><ShieldAlert size={16} /><span>Daily loss limit in settings</span><strong>{money(configuredDailyLimit)}</strong></div>}
        <p className="rc-disclaimer">Calculator only. Not financial advice.</p>
      </section>

      <section className="rc-card rc-results-card rc-enter rc-enter-2" aria-labelledby="rc-results-title" aria-live="polite">
        <div className="rc-section-heading"><div><h3 id="rc-results-title">Calculation</h3><p>Updates as you change your inputs.</p></div></div>
        {calculation.error && <div className="rc-validation" role="alert">{calculation.error}</div>}
        {!calculation.error && overRiskThreshold && <div className="rc-risk-warning" role="status"><ShieldAlert size={17} /><span>Your planned risk is above 2% of the account balance.</span></div>}
        <div className="rc-lot-hero" key={calculation.error ? 'invalid-lots' : `lots-${calculation.roundedLots}`}>
          <div className="rc-lot-hero-copy">
            <span className="rc-lot-hero-label">Recommended lot size</span>
            <strong>{calculation.error ? '—' : formatLots(calculation.roundedLots, calculation.lotStep)}</strong>
            <small>{calculation.error ? 'Exact lot size unavailable' : `Exact: ${formatExactLots(calculation.exactLots)} lots`}</small>
            <small>{calculation.error ? 'Actual risk unavailable' : `Actual risk at this size: ${money(calculation.actualRisk)}`}</small>
          </div>
          <button type="button" className="rc-copy-lots" onClick={() => void copyLots()} disabled={Boolean(calculation.error)}><Copy size={16} />Copy lots</button>
        </div>
        <div className="rc-outputs">
          {outputTiles.map((tile) => <Output key={tile.label} label={tile.label} value={tile.value} detail={tile.detail} tone={tile.tone} icon={tile.icon} />)}
        </div>
        <div className={`rc-risk-meter rc-risk-meter-${riskMeterTone}`} role="img" aria-label={`Risk is ${riskPercent.toFixed(2)}% of account balance`}>
          <div className="rc-risk-meter-heading"><span><Gauge size={15} aria-hidden="true" />Risk as a share of balance</span><strong>{calculation.error ? '—' : `${riskPercent.toFixed(2)}%`}</strong></div>
          <div className="rc-risk-meter-track"><span style={{ width: `${Math.min(100, Math.max(0, riskPercent))}%` }} /></div>
          <small>{calculation.error ? 'Enter valid values to calculate risk.' : `${riskPercent < 1 ? 'Low' : riskPercent <= 2 ? 'Moderate' : 'High'} · Green under 1% · Amber 1–2% · Red above 2%`}</small>
        </div>
        {!calculation.error && calculation.rewardDistance !== null && (
          <div className="rc-rr-bar" aria-label={`Risk-to-reward ${ratioLabel}`}>
            <div className="rc-rr-heading"><strong>Risk-to-reward profile</strong><span>{ratioLabel}</span></div>
            <div className="rc-rr-track">
              <span className="rc-rr-risk" style={{ width: `${riskShare}%` }} />
              <span className="rc-rr-reward" style={{ width: `${rewardShare}%` }} />
            </div>
            <div className="rc-rr-labels"><span>Risk · {money(calculation.actualRisk)}</span><span>Reward · {money(calculation.roundedProfit)}</span></div>
          </div>
        )}
      </section>
    </div>
    <footer className="rc-footer-note">Calculator only. Not financial advice.</footer>
  </div>
}
