export const money = (value) => {
  const rounded = Math.round(value)
  return `${rounded < 0 ? '-' : ''}$${Math.abs(rounded).toLocaleString('en-US')}`
}

export function statsFor(trades) {
  const safeTrades = Array.isArray(trades) ? trades : []
  const pnl = (trade) => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0
  const winners = safeTrades.filter((trade) => pnl(trade) > 0)
  const losers = safeTrades.filter((trade) => pnl(trade) < 0)
  const grossProfit = winners.reduce((sum, trade) => sum + pnl(trade), 0)
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + pnl(trade), 0))
  const netPnl = grossProfit - grossLoss

  return {
    trades: safeTrades.length,
    winRate: safeTrades.length ? winners.length / safeTrades.length * 100 : 0,
    netPnl,
    avgWin: winners.length ? grossProfit / winners.length : 0,
    avgLoss: losers.length ? -grossLoss / losers.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: safeTrades.length ? netPnl / safeTrades.length : 0,
  }
}

export function groupStats(trades, field) {
  const groups = new Map()
  trades.forEach((trade) => {
    const key = trade[field] || 'Not set'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(trade)
  })

  return [...groups.entries()]
    .map(([key, items]) => ({ key, ...statsFor(items) }))
    .sort((first, second) => second.trades - first.trades)
}
