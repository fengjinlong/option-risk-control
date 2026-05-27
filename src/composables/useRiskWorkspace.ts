import { reactive, readonly } from 'vue'

export type LegDirection = 'buy' | 'sell'
export type LegType = 'call' | 'put'

export interface Leg {
  id: string
  direction: LegDirection
  type: LegType
  strike: number
  size: number
  limitPrice: number | null
  ivStatus: 'low' | 'mid' | 'high'
  liquidityCost: number
}

export interface AccountData {
  equity: number
  mm: number
  im: number
  delta: number
  gamma: number
  vega: number
  theta: number
  dvol: number
  ivRank: number
  skew25d: number
}

export interface GreeksComparison {
  delta: number
  gamma: number
  vega: number
  theta: number
  deltaNew: number
  gammaNew: number
  vegaNew: number
  thetaNew: number
}

export interface HeatCell {
  pricePct: number
  ivPct: number
  mm: number
  liquidated: boolean
}

export interface Risk评估Result {
  mmAfter: number
  mmDelta: number
  greeks: GreeksComparison
  heatMatrix: HeatCell[]
}

const defaultAccount: AccountData = {
  equity: 12.45,
  mm: 1.45,
  im: 2.1,
  delta: -0.38,
  gamma: 0.021,
  vega: 2.14,
  theta: -0.87,
  dvol: 82.5,
  ivRank: 54.2,
  skew25d: -3.1,
}

const defaultLeg = (): Leg => ({
  id: crypto.randomUUID(),
  direction: 'buy',
  type: 'call',
  strike: 65000,
  size: 1,
  limitPrice: null,
  ivStatus: 'mid',
  liquidityCost: 0.02,
})

// ── simulation engine ──────────────────────────────────────────────────────
function calcLegMM(leg: Leg): number {
  const direction = leg.direction === 'buy' ? 1 : -1
  const typeSign = leg.type === 'call' ? 1 : 0.6
  const notional = leg.strike * leg.size * 0.001
  return notional * typeSign * 0.01 * (direction === 1 ? 1.2 : 1.0)
}

function calcLegGreeks(leg: Leg): { delta: number; gamma: number; vega: number; theta: number } {
  const dir = leg.direction === 'buy' ? 1 : -1
  const t = leg.type === 'call' ? 1 : 0.7
  const sz = leg.size
  return {
    delta: dir * t * 0.05 * sz,
    gamma: t * 0.003 * sz,
    vega: t * 0.8 * sz,
    theta: dir * t * -0.12 * sz,
  }
}

function calcHeatMatrix(legs: Leg[], mmDelta: number): HeatCell[] {
  const cells: HeatCell[] = []
  const baseEquity = defaultAccount.equity
  const baseMM = defaultAccount.mm

  for (const pricePct of [-20, -15, -10, -5, 0, 5, 10, 15, 20]) {
    for (const ivPct of [-10, -5, 0, 5, 10, 15, 20]) {
      const scaleFactor = 1 + pricePct * 0.008 + ivPct * 0.003
      const mm = baseMM + mmDelta * scaleFactor
      cells.push({
        pricePct,
        ivPct,
        mm: parseFloat(mm.toFixed(4)),
        liquidated: mm > baseEquity,
      })
    }
  }
  return cells
}

function calc评估(legs: Leg[]): Risk评估Result {
  const legMMs = legs.map(calcLegMM)
  const mmDelta = legMMs.reduce((s, v) => s + v, 0)
  const mmAfter = defaultAccount.mm + mmDelta

  const newGreeks = legs.reduce(
    (acc, leg) => {
      const g = calcLegGreeks(leg)
      return {
        delta: acc.delta + g.delta,
        gamma: acc.gamma + g.gamma,
        vega: acc.vega + g.vega,
        theta: acc.theta + g.theta,
      }
    },
    { delta: 0, gamma: 0, vega: 0, theta: 0 }
  )

  return {
    mmAfter: parseFloat(mmAfter.toFixed(4)),
    mmDelta: parseFloat(mmDelta.toFixed(4)),
    greeks: {
      delta: defaultAccount.delta,
      gamma: defaultAccount.gamma,
      vega: defaultAccount.vega,
      theta: defaultAccount.theta,
      deltaNew: defaultAccount.delta + newGreeks.delta,
      gammaNew: defaultAccount.gamma + newGreeks.gamma,
      vegaNew: defaultAccount.vega + newGreeks.vega,
      thetaNew: defaultAccount.theta + newGreeks.theta,
    },
    heatMatrix: calcHeatMatrix(legs, mmDelta),
  }
}

// ── state ────────────────────────────────────────────────────────────────────
const state = reactive<{
  account: AccountData
  legs: Leg[]
  legsSnapshot: Leg[]
  result: Risk评估Result
  debounceTimer: ReturnType<typeof setTimeout> | null
}>({
  account: { ...defaultAccount },
  legs: [],
  legsSnapshot: [],
  result: calc评估([]),
  debounceTimer: null,
})

function addLeg() {
  state.legs.push(defaultLeg())
  schedule评估()
}

function removeLeg(id: string) {
  state.legs = state.legs.filter((l) => l.id !== id)
  schedule评估()
}

function updateLeg(id: string, patch: Partial<Leg>) {
  const leg = state.legs.find((l) => l.id === id)
  if (leg) Object.assign(leg, patch)
  schedule评估()
}

function resetSandbox() {
  state.legs = []
  state.legsSnapshot = []
  schedule评估()
}

function commitSandbox() {
  state.legsSnapshot = state.legs.map((l) => ({ ...l }))
  schedule评估()
}

function schedule评估() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.debounceTimer = setTimeout(() => {
    state.result = calc评估(state.legs)
  }, 100)
}

export function useRiskWorkspace() {
  return {
    account: readonly(state),
    addLeg,
    removeLeg,
    updateLeg,
    resetSandbox,
    commitSandbox,
  }
}
