import { reactive, readonly, computed } from 'vue'
import Big from 'big.js'
import { toBig, ZERO, add, sub, mul, div, formatDisplay, gt, lt, gte } from './useCryptoMath'

// ── types ──────────────────────────────────────────────────────────────────────

export type TransactionSide = 'buy' | 'sell'

export interface Transaction {
  id: string
  ticker: string
  side: TransactionSide
  price: string
  qty: string
  amount: string
  timestamp: number
}

export interface Holding {
  ticker: string
  qty: string
  avgCost: string
  transactions: Transaction[]
}

export interface LivePrice {
  ticker: string
  price: string
  change24h: number
}

// ── initial watchlist ──────────────────────────────────────────────────────────

const INITIAL_TICKERS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE']

const INITIAL_HOLDINGS: Holding[] = [
  {
    ticker: 'BTC',
    qty: '0.15',
    avgCost: '62500.00',
    transactions: [
      { id: 't1', ticker: 'BTC', side: 'buy', price: '62000', qty: '0.10', amount: '6200', timestamp: Date.now() - 86400000 * 5 },
      { id: 't2', ticker: 'BTC', side: 'buy', price: '63000', qty: '0.05', amount: '3150', timestamp: Date.now() - 86400000 * 2 },
    ],
  },
  {
    ticker: 'ETH',
    qty: '2.5',
    avgCost: '3200.00',
    transactions: [
      { id: 't3', ticker: 'ETH', side: 'buy', price: '3000', qty: '1.5', amount: '4500', timestamp: Date.now() - 86400000 * 7 },
      { id: 't4', ticker: 'ETH', side: 'buy', price: '3400', qty: '1.0', amount: '3400', timestamp: Date.now() - 86400000 * 3 },
    ],
  },
  {
    ticker: 'SOL',
    qty: '10.0',
    avgCost: '145.00',
    transactions: [
      { id: 't5', ticker: 'SOL', side: 'buy', price: '140', qty: '5.0', amount: '700', timestamp: Date.now() - 86400000 * 10 },
      { id: 't6', ticker: 'SOL', side: 'buy', price: '150', qty: '5.0', amount: '750', timestamp: Date.now() - 86400000 * 4 },
    ],
  },
  {
    ticker: 'BNB',
    qty: '0.0',
    avgCost: '0.0000',
    transactions: [],
  },
  {
    ticker: 'XRP',
    qty: '500.0',
    avgCost: '0.52',
    transactions: [
      { id: 't7', ticker: 'XRP', side: 'buy', price: '0.50', qty: '300', amount: '150', timestamp: Date.now() - 86400000 * 15 },
      { id: 't8', ticker: 'XRP', side: 'buy', price: '0.55', qty: '200', amount: '110', timestamp: Date.now() - 86400000 * 8 },
    ],
  },
  {
    ticker: 'DOGE',
    qty: '1000.0',
    avgCost: '0.155',
    transactions: [
      { id: 't9', ticker: 'DOGE', side: 'buy', price: '0.15', qty: '1000', amount: '150', timestamp: Date.now() - 86400000 * 20 },
    ],
  },
]

// ── base prices ───────────────────────────────────────────────────────────────

const BASE_PRICES: Record<string, number> = {
  BTC: 67000,
  ETH: 3500,
  SOL: 160,
  BNB: 580,
  XRP: 0.58,
  DOGE: 0.17,
}

// ── state ─────────────────────────────────────────────────────────────────────

interface PortfolioState {
  holdings: Holding[]
  livePrices: Record<string, LivePrice>
}

const state = reactive<PortfolioState>({
  holdings: JSON.parse(JSON.stringify(INITIAL_HOLDINGS)),
  livePrices: Object.fromEntries(
    INITIAL_TICKERS.map(ticker => [
      ticker,
      { ticker, price: BASE_PRICES[ticker].toString(), change24h: 0 }
    ])
  ),
})

// ── helpers ───────────────────────────────────────────────────────────────────

function getHolding(ticker: string): Holding | undefined {
  return state.holdings.find(h => h.ticker === ticker)
}

function getLivePrice(ticker: string): Big {
  const lp = state.livePrices[ticker]
  return lp ? toBig(lp.price) : ZERO
}

// ── recalculate cost basis ────────────────────────────────────────────────────

function recalculateHolding(ticker: string): void {
  const h = getHolding(ticker)
  if (!h) return

  const sorted = [...h.transactions].sort((a, b) => a.timestamp - b.timestamp)

  let runningQty = ZERO
  let totalCost = ZERO

  for (const tx of sorted) {
    const price = toBig(tx.price)
    const qty = toBig(tx.qty)

    if (tx.side === 'buy') {
      const cost = mul(price, qty)
      totalCost = add(totalCost, cost)
      runningQty = add(runningQty, qty)
    } else {
      if (gte(runningQty, qty)) {
        const avgCost = runningQty.gt(ZERO) ? div(totalCost, runningQty) : ZERO
        const costReduction = mul(avgCost, qty)
        totalCost = sub(totalCost, costReduction)
        runningQty = sub(runningQty, qty)
      } else {
        runningQty = ZERO
        totalCost = ZERO
      }
    }

    if (runningQty.eq(ZERO)) {
      totalCost = ZERO
    }
  }

  h.qty = formatDisplay(runningQty)
  h.avgCost = runningQty.gt(ZERO) ? formatDisplay(div(totalCost, runningQty)) : '0.0000'
}

// ── public API ────────────────────────────────────────────────────────────────

function addTransaction(ticker: string, side: TransactionSide, price: string, qty: string, amount: string): void {
  let h = getHolding(ticker)
  if (!h) {
    h = {
      ticker,
      qty: '0.0000',
      avgCost: '0.0000',
      transactions: [],
    }
    state.holdings.push(h)
  }

  const tx: Transaction = {
    id: crypto.randomUUID(),
    ticker,
    side,
    price,
    qty,
    amount,
    timestamp: Date.now(),
  }

  h.transactions.push(tx)
  recalculateHolding(ticker)
}

function deleteTransaction(ticker: string, txId: string): void {
  const h = getHolding(ticker)
  if (!h) return

  const idx = h.transactions.findIndex(t => t.id === txId)
  if (idx !== -1) {
    h.transactions.splice(idx, 1)
    recalculateHolding(ticker)
  }
}

function addTicker(ticker: string): boolean {
  if (getHolding(ticker)) return false
  state.holdings.push({
    ticker,
    qty: '0.0000',
    avgCost: '0.0000',
    transactions: [],
  })
  if (!state.livePrices[ticker]) {
    const basePrice = BASE_PRICES[ticker] ?? 1
    state.livePrices[ticker] = { ticker, price: basePrice.toString(), change24h: 0 }
  }
  return true
}

function removeTicker(ticker: string): void {
  const idx = state.holdings.findIndex(h => h.ticker === ticker)
  if (idx !== -1) {
    state.holdings.splice(idx, 1)
  }
}

// 更新价格（供外部调用，后续对接接口）
function updatePrice(ticker: string, price: string, change24h: number = 0): void {
  state.livePrices[ticker] = { ticker, price, change24h }
}

// ── computed values ───────────────────────────────────────────────────────────

const nav = computed(() => {
  let total = ZERO
  for (const h of state.holdings) {
    const qty = toBig(h.qty)
    const price = getLivePrice(h.ticker)
    total = add(total, mul(qty, price))
  }
  return total
})

const totalCostBasis = computed(() => {
  let total = ZERO
  for (const h of state.holdings) {
    const qty = toBig(h.qty)
    const avgCost = toBig(h.avgCost)
    total = add(total, mul(qty, avgCost))
  }
  return total
})

const totalPnL = computed(() => sub(nav.value, totalCostBasis.value))

function getHoldingPnL(ticker: string): Big {
  const h = getHolding(ticker)
  if (!h) return ZERO

  const qty = toBig(h.qty)
  const avgCost = toBig(h.avgCost)
  const currentPrice = getLivePrice(ticker)

  const currentValue = mul(qty, currentPrice)
  const costBasis = mul(qty, avgCost)
  return sub(currentValue, costBasis)
}

function getHoldingPnLPercent(ticker: string): Big {
  const h = getHolding(ticker)
  if (!h) return ZERO

  const qty = toBig(h.qty)
  if (qty.eq(ZERO)) return ZERO

  const avgCost = toBig(h.avgCost)
  if (avgCost.eq(ZERO)) return ZERO

  const currentPrice = getLivePrice(ticker)
  const costBasis = mul(qty, avgCost)
  if (costBasis.eq(ZERO)) return ZERO

  return div(sub(currentPrice, avgCost), avgCost).times(100)
}

const donutData = computed(() => {
  const items: { name: string; value: number }[] = []
  let totalValue = ZERO

  for (const h of state.holdings) {
    const qty = toBig(h.qty)
    if (qty.gt(ZERO)) {
      const price = getLivePrice(h.ticker)
      totalValue = add(totalValue, mul(qty, price))
    }
  }

  if (totalValue.eq(ZERO)) return []

  for (const h of state.holdings) {
    const qty = toBig(h.qty)
    if (qty.gt(ZERO)) {
      const price = getLivePrice(h.ticker)
      const value = mul(qty, price)
      const pct = div(value, totalValue).times(100).toNumber()
      items.push({ name: h.ticker, value: pct })
    }
  }

  return items.sort((a, b) => b.value - a.value)
})

// ── export ────────────────────────────────────────────────────────────────────

export function useSpotPortfolio() {
  return {
    holdings: readonly(state).holdings,
    livePrices: readonly(state).livePrices,
    nav,
    totalCostBasis,
    totalPnL,
    donutData,
    getHolding,
    getHoldingPnL,
    getHoldingPnLPercent,
    addTransaction,
    deleteTransaction,
    addTicker,
    removeTicker,
    updatePrice,
  }
}
