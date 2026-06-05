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

// ── state ─────────────────────────────────────────────────────────────────────

interface PortfolioState {
  holdings: Holding[]
  livePrices: Record<string, LivePrice>
}

const state = reactive<PortfolioState>({
  holdings: [],
  livePrices: {},
})

export function initFromWatchlist(items: { ticker: string; live_price: string }[]): void {
  state.holdings.splice(0, state.holdings.length, ...items.map(item => ({
    ticker: item.ticker,
    qty: '0.0000',
    avgCost: '0.0000',
    transactions: [],
  })))
  for (const item of items) {
    state.livePrices[item.ticker] = { ticker: item.ticker, price: item.live_price, change24h: 0 }
  }
}

export function setLivePrice(ticker: string, live_price: string, change24h: number = 0): void {
  state.livePrices[ticker] = { ticker, price: live_price, change24h }
}

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
  return true
}

function removeTicker(ticker: string): void {
  const idx = state.holdings.findIndex(h => h.ticker === ticker)
  if (idx !== -1) {
    state.holdings.splice(idx, 1)
  }
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
    setLivePrice,
  }
}
