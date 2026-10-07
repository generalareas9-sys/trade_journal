import { eachDayOfInterval, endOfDay, format, startOfDay, subDays, startOfYear } from 'date-fns'

export const ranges = ['Today', '7D', '30D', '90D', 'YTD', 'Custom', 'All']

export const symbolPointValues = {
  EURUSD: 100000,
  XAUUSD: 100,
  NQ: 20,
  AAPL: 1,
  BTCUSD: 1,
}

export function calculateTradePnl(trade) {
  const pointValue = Number(trade.pointValue ?? symbolPointValues[trade.symbol] ?? 1)
  const size = Number(trade.size ?? trade.quantity)
  const entry = Number(trade.entry)
  const exit = Number(trade.exit)
  const fees = Number(trade.fees ?? 0)
  if (![size, entry, exit, fees].every(Number.isFinite)) return 0
  const gross = (trade.side === 'Long' ? exit - entry : entry - exit) * size * pointValue
  return Number((gross - fees).toFixed(2))
}

export function normalizeTrade(trade) {
  const size = Number(trade.size ?? trade.quantity)
  const calculatedPnl = calculateTradePnl({ ...trade, size })
  const pnl = trade.pnlOverride !== null && trade.pnlOverride !== undefined && Number.isFinite(Number(trade.pnlOverride))
    ? Number(trade.pnlOverride)
    : calculatedPnl
  const riskAmount = Number(trade.riskAmount ?? trade.risk ?? 0)
  const result = ['Win', 'Loss', 'Breakeven'].includes(trade.resultOverride)
    ? trade.resultOverride
    : pnl > 0 ? 'Win' : pnl < 0 ? 'Loss' : 'Breakeven'
  return {
    ...trade,
    size,
    quantity: size,
    pointValue: Number(trade.pointValue ?? symbolPointValues[trade.symbol] ?? 1),
    pnl,
    result,
    outcome: result,
    rMultiple: riskAmount > 0 ? Number((pnl / riskAmount).toFixed(2)) : 0,
  }
}

export function filterTrades(trades, range, now = new Date(), customStart, customEnd) {
  if (range === 'Custom') {
    const start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null
    const end = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : endOfDay(now)
    return trades.filter((trade) => {
      const date = new Date(`${trade.date}T12:00:00`)
      return (!start || date >= start) && date <= end
    })
  }

  let start = startOfDay(now)
  if (range === '7D') start = subDays(start, 6)
  if (range === '30D') start = subDays(start, 29)
  if (range === '90D') start = subDays(start, 89)
  if (range === 'YTD') start = startOfYear(now)
  if (range === 'All') return trades

  return trades.filter((trade) => {
    const date = new Date(`${trade.date}T12:00:00`)
    return date >= start && date <= endOfDay(now)
  })
}

export function calculateStats(trades) {
  const safeTrades = Array.isArray(trades) ? trades : []
  const safePnl = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0
  const openedAt = (trade) => trade?.openedAt && Number.isFinite(new Date(trade.openedAt).getTime()) ? new Date(trade.openedAt).getTime() : null
  const closedAt = (trade) => trade?.closedAt && Number.isFinite(new Date(trade.closedAt).getTime()) ? new Date(trade.closedAt).getTime() : null
  const wins = safeTrades.filter((trade) => safePnl(trade) > 0)
  const losses = safeTrades.filter((trade) => safePnl(trade) < 0)
  const total = safeTrades.reduce((sum, trade) => sum + safePnl(trade), 0)
  const grossWin = wins.reduce((sum, trade) => sum + safePnl(trade), 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + safePnl(trade), 0))
  const byDay = new Map()

  safeTrades.forEach((trade) => {
    if (typeof trade.date !== 'string' || !Number.isFinite(Date.parse(`${trade.date}T12:00:00`))) return
    byDay.set(trade.date, (byDay.get(trade.date) || 0) + safePnl(trade))
  })

  let running = 0
  let peak = 0
  let maxDrawdown = 0
  ;[...byDay.entries()].sort(([first], [second]) => first.localeCompare(second)).forEach(([, pnl]) => {
    running += pnl
    peak = Math.max(peak, running)
    maxDrawdown = Math.max(maxDrawdown, peak - running)
  })

  const avgWin = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const winRate = safeTrades.length ? wins.length / safeTrades.length * 100 : 0
  const dayValues = [...byDay.values()]
  const winningDays = dayValues.filter((value) => value > 0).length
  let currentStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0
  safeTrades.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.openedAt || '').localeCompare(String(b.openedAt || ''))).forEach((trade) => {
    if (safePnl(trade) > 0) {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1
      maxWinStreak = Math.max(maxWinStreak, currentStreak)
    } else if (safePnl(trade) < 0) {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1
      maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak))
    }
  })

  return {
    trades: safeTrades.length,
    wins: wins.length,
    losses: losses.length,
    netPnl: total,
    winRate,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? null : 0,
    avgWin,
    avgLoss,
    winLossRatio: avgLoss ? avgWin / avgLoss : 0,
    dayWinRate: dayValues.length ? winningDays / dayValues.length * 100 : 0,
    maxDrawdown,
    expectancy: safeTrades.length ? total / safeTrades.length : 0,
    largestWin: wins.length ? Math.max(...wins.map(safePnl)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map(safePnl)) : 0,
    maxWinStreak,
    maxLossStreak,
    greenDays: dayValues.filter((value) => value > 0).length,
    redDays: dayValues.filter((value) => value < 0).length,
    bestDay: byDay.size ? [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] : null,
    worstDay: byDay.size ? [...byDay.entries()].sort((a, b) => a[1] - b[1])[0] : null,
    avgHoldMinutes: safeTrades.length ? safeTrades.reduce((sum, trade) => {
      const start = openedAt(trade)
      const end = closedAt(trade)
      return sum + (start !== null && end !== null && end >= start ? (end - start) / 60000 : 0)
    }, 0) / safeTrades.length : 0,
    consistency: dayValues.length ? 100 - Math.min(100, (Math.sqrt(dayValues.reduce((sum, value) => sum + (value - total / dayValues.length) ** 2, 0) / dayValues.length) / (Math.abs(total / dayValues.length) + 1)) * 10) : 0,
  }
}

export function dailySeries(trades) {
  const daily = new Map()
  ;(Array.isArray(trades) ? trades : []).forEach((trade) => {
    if (typeof trade?.date !== 'string' || !Number.isFinite(Date.parse(`${trade.date}T12:00:00`))) return
    const pnl = Number.isFinite(Number(trade.pnl)) ? Number(trade.pnl) : 0
    daily.set(trade.date, (daily.get(trade.date) || 0) + pnl)
  })
  let cumulative = 0
  return [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, pnl]) => {
    cumulative += pnl
    return { date, label: format(new Date(`${date}T12:00:00`), 'MMM d'), pnl, cumulative }
  })
}

export function calendarDays(trades, month) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const days = eachDayOfInterval({ start, end })
  const grouped = new Map()
  ;(Array.isArray(trades) ? trades : []).forEach((trade) => {
    if (typeof trade?.date !== 'string' || !Number.isFinite(Date.parse(`${trade.date}T12:00:00`))) return
    grouped.set(trade.date, [...(grouped.get(trade.date) || []), trade])
  })
  return { days, grouped }
}

let currencyDisplayCode = 'USD'

export const setCurrencyDisplay = (code) => {
  if (['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(code)) currencyDisplayCode = code
}

const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$' }

export const currency = (value) => {
  const safeValue = Number.isFinite(value) ? value : 0
  const prefix = safeValue > 0 ? '+' : safeValue < 0 ? '-' : ''
  return `${prefix}${currencySymbols[currencyDisplayCode]}${Math.abs(safeValue).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export const axisCurrency = (value) => currency(value).replace(/^\+/, '')
export const percent = (value) => `${(Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(1)}%`
