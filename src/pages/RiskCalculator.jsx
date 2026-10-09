import { useMemo, useState } from 'react'
import { Calculator, Copy, RotateCcw, ShieldAlert } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { symbolPointValues, calculateTradePnl } from '../utils/trading'
import '../risk-calculator.css'

const sizeSteps = { EURUSD: 0.01, XAUUSD: 0.01, NQ: 1, AAPL: 1, BTCUSD: 0.001 }
const createInitialForm = () => ({
  balance: '',
  riskMode: 'percent',
  riskValue: '1',
  symbol: Object.keys(symbolPointValues)[0] || '',
  side: 'Long',
  entry: '',
  stop: '',
  target: '',
  feesPerUnit: '0',
})
const numberFrom = (value) => value.trim() === '' ? null : Number(value)
const validNumber = (value) => value !== null && Number.isFinite(value)
const money = (value) => Number.isFinite(value)
  ? `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'
const signedMoney = (value) => Number.isFinite(value) ? `${value < 0 ? '-' : ''}${money(value)}` : '—'
const stepDigits = (step) => (String(step).split('.')[1] || '').length

function Field({ label, name, value, onChange, type = 'number', ...props }) {
  return <label className="rc-field" htmlFor={`rc-${name}`}>
    <span>{label}</span>
    <input id={`rc-${name}`} name={name} type={type} value={value} onChange={onChange} {...props} />
  </label>
}

function Output({ label, value, detail, emphasis = false }) {
  return <div className={`rc-output${emphasis ? ' rc-output-emphasis' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </div>
}

export default function RiskCalculator() {
  const { settings = {}, notify } = useJournal()
  const [form, setForm] = useState(createInitialForm)
  const symbols = Object.keys(symbolPointValues)

  const calculation = useMemo(() => {
    const balance = numberFrom(form.balance)
    const riskValue = numberFrom(form.riskValue)
    const entry = numberFrom(form.entry)
    const stop = numberFrom(form.stop)
    const target = numberFrom(form.target)
    const feesPerUnit = form.feesPerUnit === '' ? 0 : numberFrom(form.feesPerUnit)

    if (!validNumber(balance) || balance <= 0) return { error: 'Enter an account balance greater than zero.' }
    if (!validNumber(riskValue) || riskValue <= 0) return { error: 'Enter a risk amount greater than zero.' }
    if (!validNumber(entry) || !validNumber(stop)) return { error: 'Enter both an entry price and a stop-loss price.' }
    if (form.target !== '' && !validNumber(target)) return { error: 'Enter a valid take-profit price or leave it blank.' }
    if (!validNumber(feesPerUnit) || feesPerUnit < 0) return { error: 'Fees per unit must be zero or greater.' }

    const distance = Math.abs(entry - stop)
    if (distance === 0) return { error: 'Entry and stop-loss prices cannot be the same.' }
    if (form.side === 'Long' && stop > entry || form.side === 'Short' && stop < entry) {
      return { error: `The stop-loss must be below entry for a ${form.side.toLowerCase()} position.` }
    }
    if (target !== null && (form.side === 'Long' && target <= entry || form.side === 'Short' && target >= entry)) {
      return { error: `The take-profit must be beyond entry for a ${form.side.toLowerCase()} position.` }
    }

    const pointValue = Number(symbolPointValues[form.symbol])
    if (!Number.isFinite(pointValue) || pointValue <= 0) return { error: 'Select a supported symbol.' }
    const riskBudget = form.riskMode === 'percent' ? balance * riskValue / 100 : riskValue
    const perUnitRisk = distance * pointValue + feesPerUnit
    if (!Number.isFinite(riskBudget) || !Number.isFinite(perUnitRisk) || perUnitRisk <= 0) {
      return { error: 'These values are outside the supported calculation range.' }
    }

    const step = sizeSteps[form.symbol] || 0.01
    const rawSize = riskBudget / perUnitRisk
    const size = Number((Math.floor((rawSize + Number.EPSILON) / step) * step).toFixed(stepDigits(step)))
    if (!Number.isFinite(size) || size <= 0) return { error: 'The risk budget is too small for the minimum position size.' }

    const totalFees = feesPerUnit * size
    const lossPnl = calculateTradePnl({ symbol: form.symbol, side: form.side, entry, exit: stop, size, fees: totalFees })
    const rewardPnl = target === null
      ? null
      : calculateTradePnl({ symbol: form.symbol, side: form.side, entry, exit: target, size, fees: totalFees })
    if (!Number.isFinite(lossPnl) || rewardPnl !== null && !Number.isFinite(rewardPnl)) {
      return { error: 'These values are outside the supported calculation range.' }
    }
    if (rewardPnl !== null && rewardPnl <= 0) return { error: 'The take-profit does not cover the estimated fees.' }

    const riskAmount = Math.abs(lossPnl)
    const ratio = rewardPnl === null ? null : rewardPnl / riskAmount
    const breakEvenRate = ratio === null ? null : riskAmount / (riskAmount + rewardPnl) * 100
    if (![riskAmount, ratio, breakEvenRate].every((value) => value === null || Number.isFinite(value))) {
      return { error: 'These values are outside the supported calculation range.' }
    }
    return { balance, riskBudget, riskAmount, distance, size, rewardPnl, lossPnl, ratio, breakEvenRate }
  }, [form])

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function reset() {
    setForm(createInitialForm())
  }

  async function copySummary() {
    if (calculation.error) {
      notify('Complete valid calculator inputs before copying a summary.')
      return
    }
    const lines = [
      'Risk calculator summary',
      `Account balance: ${money(calculation.balance)}`,
      `Risk per trade: ${money(calculation.riskAmount)}`,
      `Symbol / side: ${form.symbol} / ${form.side}`,
      `Entry / stop: ${form.entry} / ${form.stop}`,
      `Stop distance: ${calculation.distance}`,
      `Position size: ${calculation.size}`,
      `Reward: ${calculation.rewardPnl === null ? 'Not set' : money(calculation.rewardPnl)}`,
      `Risk-to-reward: ${calculation.ratio === null ? 'Not set' : `1 : ${calculation.ratio.toFixed(2)}`}`,
      `Potential profit / loss: ${calculation.rewardPnl === null ? 'Not set' : money(calculation.rewardPnl)} / ${signedMoney(calculation.lossPnl)}`,
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

  const configuredDailyLimit = Number(settings.dailyLossLimit)
  const hasDailyLimit = settings.dailyLossLimit !== '' && settings.dailyLossLimit !== null && settings.dailyLossLimit !== undefined && Number.isFinite(configuredDailyLimit) && configuredDailyLimit > 0
  const overRiskThreshold = !calculation.error && calculation.riskAmount / calculation.balance > 0.02
  const ratioLabel = calculation.ratio !== null && calculation.ratio !== undefined && Number.isFinite(calculation.ratio)
    ? `1 : ${calculation.ratio.toFixed(2)}`
    : '—'

  return <div className="page-content rc-page">
    <header className="rc-header">
      <div className="rc-title"><span className="rc-title-icon"><Calculator size={20} /></span><div><span className="rc-eyebrow">POSITION PLANNING</span><h2>Risk calculator</h2><p>Estimate position size and potential outcomes before a trade.</p></div></div>
      <div className="rc-actions">
        <button type="button" className="rc-button" onClick={reset}><RotateCcw size={16} />Reset</button>
        <button type="button" className="rc-button rc-copy-button" onClick={() => void copySummary()}><Copy size={16} />Copy summary</button>
      </div>
    </header>

    <div className="rc-layout">
      <section className="rc-card rc-input-card" aria-labelledby="rc-input-title">
        <div className="rc-section-heading"><div><h3 id="rc-input-title">Trade details</h3><p>Enter your account and planned trade prices.</p></div></div>
        <div className="rc-fields">
          <Field label="Account balance ($)" name="balance" value={form.balance} onChange={(event) => update('balance', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="e.g. 25000" />
          <div className="rc-field">
            <span id="rc-risk-label">Risk per trade</span>
            <div className="rc-risk-control">
              <input aria-labelledby="rc-risk-label" name="riskValue" type="number" min="0" step="any" inputMode="decimal" value={form.riskValue} onChange={(event) => update('riskValue', event.target.value)} />
              <div className="rc-toggle" role="group" aria-label="Risk input type">
                <button type="button" aria-pressed={form.riskMode === 'percent'} className={form.riskMode === 'percent' ? 'selected' : ''} onClick={() => update('riskMode', 'percent')}>%</button>
                <button type="button" aria-pressed={form.riskMode === 'amount'} className={form.riskMode === 'amount' ? 'selected' : ''} onClick={() => update('riskMode', 'amount')}>$</button>
              </div>
            </div>
          </div>
          <label className="rc-field" htmlFor="rc-symbol"><span>Symbol</span><select id="rc-symbol" name="symbol" value={form.symbol} onChange={(event) => update('symbol', event.target.value)}>{symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol} · ${symbolPointValues[symbol].toLocaleString('en-US')} per point</option>)}</select></label>
          <label className="rc-field" htmlFor="rc-side"><span>Side</span><select id="rc-side" name="side" value={form.side} onChange={(event) => update('side', event.target.value)}><option value="Long">Long</option><option value="Short">Short</option></select></label>
          <Field label="Entry price" name="entry" value={form.entry} onChange={(event) => update('entry', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Entry price" />
          <Field label="Stop-loss price" name="stop" value={form.stop} onChange={(event) => update('stop', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Stop price" />
          <Field label="Take-profit price (optional)" name="target" value={form.target} onChange={(event) => update('target', event.target.value)} min="0" step="any" inputMode="decimal" placeholder="Target price" />
          <Field label="Fees per unit ($, optional)" name="feesPerUnit" value={form.feesPerUnit} onChange={(event) => update('feesPerUnit', event.target.value)} min="0" step="any" inputMode="decimal" />
        </div>
        {hasDailyLimit && <div className="rc-daily-limit"><ShieldAlert size={16} /><span>Daily loss limit in settings</span><strong>{money(configuredDailyLimit)}</strong></div>}
        <p className="rc-disclaimer">Calculator only. Not financial advice.</p>
      </section>

      <section className="rc-card rc-results-card" aria-labelledby="rc-results-title" aria-live="polite">
        <div className="rc-section-heading"><div><h3 id="rc-results-title">Calculation</h3><p>Updates as you change your inputs.</p></div></div>
        {calculation.error && <div className="rc-validation" role="status">{calculation.error}</div>}
        {!calculation.error && overRiskThreshold && <div className="rc-risk-warning" role="status"><ShieldAlert size={17} /><span>Your planned risk is above 2% of the account balance.</span></div>}
        <div className="rc-outputs">
          <Output label="Risk amount" value={calculation.error ? '—' : money(calculation.riskAmount)} detail={calculation.error ? '' : `${(calculation.riskAmount / calculation.balance * 100).toFixed(2)}% of account`} emphasis />
          <Output label="Stop distance" value={calculation.error ? '—' : calculation.distance} detail="Price points" />
          <Output label="Position size" value={calculation.error ? '—' : calculation.size} detail={calculation.error ? '' : `${sizeSteps[form.symbol] || 0.01} minimum increment`} />
          <Output label="Reward amount" value={calculation.error || calculation.rewardPnl === null ? '—' : money(calculation.rewardPnl)} />
          <Output label="Risk-to-reward" value={calculation.error ? '—' : ratioLabel} />
          <Output label="Potential profit" value={calculation.error || calculation.rewardPnl === null ? '—' : signedMoney(calculation.rewardPnl)} />
          <Output label="Potential loss" value={calculation.error ? '—' : signedMoney(calculation.lossPnl)} />
          <Output label="Break-even win rate" value={calculation.error || calculation.breakEvenRate === null ? '—' : `${calculation.breakEvenRate.toFixed(1)}%`} />
        </div>
      </section>
    </div>
  </div>
}
