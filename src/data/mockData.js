import { addDays, format, isWeekend, subDays } from 'date-fns'
import { calculateTradePnl, symbolPointValues } from '../utils/trading'

export const STRATEGIES = ['Opening Range', 'Trend Continuation', 'Liquidity Sweep', 'Breakout Retest', 'VWAP Reclaim', 'Uncategorized']
export { symbolPointValues }

const symbols = ['EURUSD', 'XAUUSD', 'NQ', 'AAPL', 'BTCUSD']
const tags = ['A+ setup', 'London session', 'NY open', 'Breakout', 'Reversal', 'News']

const random = (seed) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}
const rand = random(18427)

const nextTradeDate = (index, symbol) => {
  let date = addDays(subDays(new Date(), 120), index % 120)
  if (symbol !== 'BTCUSD') {
    while (isWeekend(date)) {
      date = addDays(date, 1)
    }
  }
  return date
}

const formatPrice = (symbol, value) => Number(value.toFixed(symbol === 'EURUSD' ? 5 : 2))

export const accounts = [
  { id: 'main', name: 'Main account', balance: 52480.75, broker: 'Tradovate' },
  { id: 'funded', name: 'Funded challenge', balance: 100000, broker: 'Topstep' },
]

export const mockTrades = Array.from({ length: 150 }, (_, index) => {
  const symbol = symbols[index % symbols.length]
  const date = nextTradeDate(index, symbol)
  const side = rand() > 0.48 ? 'Long' : 'Short'
  const strategy = STRATEGIES[index % STRATEGIES.length]
  const tag = tags[index % tags.length]
  const size = symbol === 'EURUSD' ? Number((0.5 + rand() * 0.7).toFixed(2)) : symbol === 'XAUUSD' ? Number((1 + rand()).toFixed(2)) : symbol === 'NQ' ? 1 : symbol === 'AAPL' ? 25 + Math.floor(rand() * 36) : Number((0.15 + rand() * 0.15).toFixed(3))
  const basePrice = symbol === 'EURUSD' ? 1.06 + rand() * 0.12 : symbol === 'XAUUSD' ? 2140 + rand() * 260 : symbol === 'NQ' ? 17100 + rand() * 2000 : symbol === 'AAPL' ? 165 + rand() * 60 : 48000 + rand() * 28000
  const symbolTradeIndex = Math.floor(index / symbols.length)
  const favorableMove = symbolTradeIndex % 30 < 17
  const targetGross = favorableMove ? 220 + rand() * 120 : -(125 + rand() * 95)
  const moveMagnitude = Math.abs(targetGross) / (size * symbolPointValues[symbol])
  const moveShift = favorableMove ? 1 : -1
  const entry = formatPrice(symbol, basePrice)
  const exit = formatPrice(symbol, entry + (side === 'Long' ? 1 : -1) * moveShift * moveMagnitude)
  const fees = Number((3 + rand() * 8).toFixed(2))
  const riskAmount = Number((140 + rand() * 55).toFixed(2))
  const pnl = calculateTradePnl({ symbol, side, entry, exit, size, fees })
  const opened = new Date(date)
  opened.setHours(8 + Math.floor(rand() * 7), Math.floor(rand() * 60), 0, 0)
  const closed = new Date(opened.getTime() + (25 + Math.floor(rand() * 180)) * 60000)
  const outcome = pnl > 0 ? 'Win' : 'Loss'

  return {
    id: `TR-${String(1024 + index).padStart(4, '0')}`,
    date: format(date, 'yyyy-MM-dd'),
    openedAt: opened.toISOString(),
    closedAt: closed.toISOString(),
    symbol,
    side,
    entry,
    exit,
    size,
    quantity: size,
    pointValue: symbolPointValues[symbol],
    pnl,
    fees,
    riskAmount,
    rMultiple: Number((pnl / riskAmount).toFixed(2)),
    rrr: Number((1 + rand() * 3).toFixed(2)),
    strategy,
    tag,
    mistakes: pnl < 0 && index % 4 === 0 ? [['FOMO'], ['revenge trade'], ['moved stop'], ['oversized']][Math.floor(index / 4) % 4] : [],
    outcome,
    result: outcome,
    isDemo: true,
    session: ['Asia', 'London', 'New York'][index % 3],
    preAnalysis: index % 4 === 0 ? 'No' : 'Yes',
    followedRules: index % 5 === 0 ? 'No' : 'Yes',
    entryConditionMet: index % 6 === 0 ? 'No' : 'Yes',
    management: ['Partial', 'Breakeven', 'Set and forget', 'Trailing stop loss'][index % 4],
    screenshotBefore: '',
    screenshotAfter: '',
    psychBefore: '',
    psychAfter: '',
    riskManagement: '',
    stopLossSystem: '',
    takeProfitSystem: '',
    exitCondition: outcome === 'Win' ? 'TP hit' : 'SL hit',
    notes: pnl >= 0 ? 'Followed the plan and held through the intended move.' : 'Entered a touch early. The reversal punished the first break of structure.',
    status: 'Closed',
  }
})

export const journalSeed = [
  { date: format(subDays(new Date(), 1), 'yyyy-MM-dd'), mood: '🙂', plan: 'Wait for clean levels at the NY open. Keep risk under 1% and avoid chasing the first move.', review: 'Stayed patient on the first setup. One entry was rushed; I need to wait for the retest.', rules: ['Followed my plan', 'Respected risk limits'], tags: ['NY session', 'Patience'] },
  { date: format(subDays(new Date(), 2), 'yyyy-MM-dd'), mood: '🔥', plan: 'Focus on A+ trend continuation setups. Take a break after two trades.', review: 'Good discipline today. Stopped after the target was hit.', rules: ['Followed my plan', 'No revenge trading', 'Respected risk limits'], tags: ['Trend day'] },
]

export const playbooks = [
  { name: 'Opening Range', short: 'OR', color: 'purple', trades: 38, winRate: 63, profitFactor: 1.84, description: 'Trade the first decisive break of the session range.', entry: ['Mark the first 15-minute high and low', 'Wait for a candle close beyond the range', 'Enter on the retest with volume confirmation'], exit: ['Stop just inside the opening range', 'Take partials at 1.5R', 'Trail remaining size behind structure'] },
  { name: 'Trend Continuation', short: 'TC', color: 'blue', trades: 31, winRate: 66, profitFactor: 1.93, description: 'Join momentum when the impulse confirms and the trend is intact.', entry: ['Trend remains higher or lower on the 15-minute chart', 'Wait for a pullback into support or resistance', 'Take the breakout from a clean continuation candle'], exit: ['Scale out at key intraday levels', 'Move stop to breakeven after 1R', 'Lock in the final piece near the next obstacle'] },
  { name: 'Liquidity Sweep', short: 'LS', color: 'green', trades: 27, winRate: 59, profitFactor: 1.62, description: 'Fade a false breakout after the market sweeps the prior swing and rejects', entry: ['Find prior highs or lows', 'Wait for a sweep plus rapid rejection', 'Enter only after the lost structure is reclaimed'], exit: ['Stop just beyond the sweep wick', 'Take profits at the opposing liquidity pocket', 'Reduce size when the tape loses momentum'] },
  { name: 'Breakout Retest', short: 'BR', color: 'amber', trades: 24, winRate: 61, profitFactor: 1.71, description: 'Retest the breakout level after the move has shown real intent.', entry: ['Break outside the prior range with momentum', 'Wait for a test of the breakout level', 'Confirm with follow-through before committing'], exit: ['Initial target at the first expansion leg', 'Stop below the retest wick', 'Trail trailing stop after 2R'] },
  { name: 'VWAP Reclaim', short: 'VR', color: 'purple', trades: 30, winRate: 68, profitFactor: 2.13, description: 'Re-enter on a reclaim of VWAP after a healthy pullback.', entry: ['Price closes back through VWAP', 'Wait for candle confirmation and volume', 'Only trade in the dominant direction'], exit: ['Target the next level or extension band', 'Scale once the move is clean', 'Reduce exposure at the next obvious reaction point'] },
  { name: 'Uncategorized', short: 'UC', color: 'purple', trades: 0, winRate: 0, profitFactor: 0, description: 'Trades without a selected strategy. Assign a setup to improve your reports.', entry: ['Identify and record the setup before entry'], exit: ['Follow the planned stop and target'] },
]

export const notebookFolders = ['All notes', 'Trade ideas', 'Market prep', 'Lessons learned']
export const notebookNotes = [
  { title: 'A better morning routine', folder: 'Market prep', date: 'Today', body: 'Review the higher timeframe before the open. Mark prior day high and low, overnight range, and major news. One clean setup is enough.' },
  { title: 'EURUSD — range expansion', folder: 'Trade ideas', date: 'Yesterday', body: 'Look for continuation if London holds above the overnight high. Avoid entering into the 10am data release.' },
  { title: 'What I learned this week', folder: 'Lessons learned', date: 'Oct 2', body: 'My best trades came after waiting for a retest. The impulse entries were consistently lower quality. Keep the checklist visible.' },
]
