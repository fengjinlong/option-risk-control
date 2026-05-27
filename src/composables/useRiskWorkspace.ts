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

const ACCOUNT = {
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
} as const

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
  const dir = leg.direction === 'buy' ? 1 : -1
  const typeSign = leg.type === 'call' ? 1 : 0.6
  const notional = leg.strike * leg.size * 0.001
  return notional * typeSign * 0.01 * (dir === 1 ? 1.2 : 1.0)
}

function calcLegGreeks(leg: Leg) {
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

function calcHeatMatrix(_legs: Leg[], mmDelta: number): HeatCell[] {
  const cells: HeatCell[] = []
  for (const pricePct of [-20, -15, -10, -5, 0, 5, 10, 15, 20]) {
    for (const ivPct of [-10, -5, 0, 5, 10, 15, 20]) {
      const scaleFactor = 1 + pricePct * 0.008 + ivPct * 0.003
      const mm = ACCOUNT.mm + mmDelta * scaleFactor
      cells.push({
        pricePct,
        ivPct,
        mm: parseFloat(mm.toFixed(4)),
        liquidated: mm > ACCOUNT.equity,
      })
    }
  }
  return cells
}

function calc评估(legs: Leg[]): Risk评估Result {
  const mmDelta = legs.reduce((s, l) => s + calcLegMM(l), 0)
  const mmAfter = ACCOUNT.mm + mmDelta

  const ng = legs.reduce(
    (acc, l) => {
      const g = calcLegGreeks(l)
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
      delta: ACCOUNT.delta,
      gamma: ACCOUNT.gamma,
      vega: ACCOUNT.vega,
      theta: ACCOUNT.theta,
      deltaNew: ACCOUNT.delta + ng.delta,
      gammaNew: ACCOUNT.gamma + ng.gamma,
      vegaNew: ACCOUNT.vega + ng.vega,
      thetaNew: ACCOUNT.theta + ng.theta,
    },
    heatMatrix: calcHeatMatrix(legs, mmDelta),
  }
}

// ── flat state (fields at top level for easy access) ─────────────────────
interface WorkspaceState {
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
  legs: Leg[]
  result: Risk评估Result
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const state = reactive<WorkspaceState>({
  equity: ACCOUNT.equity,
  mm: ACCOUNT.mm,
  im: ACCOUNT.im,
  delta: ACCOUNT.delta,
  gamma: ACCOUNT.gamma,
  vega: ACCOUNT.vega,
  theta: ACCOUNT.theta,
  dvol: ACCOUNT.dvol,
  ivRank: ACCOUNT.ivRank,
  skew25d: ACCOUNT.skew25d,
  legs: [],
  result: calc评估([]),
  debounceTimer: null,
})

function schedule评估() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.debounceTimer = setTimeout(() => {
    state.result = calc评估(state.legs)
  }, 100)
}

export function useRiskWorkspace() {
  return {
    state: readonly(state) as Readonly<WorkspaceState>,
    legs: readonly(state.legs) as Readonly<Leg[]>,
    addLeg: () => { state.legs.push(defaultLeg()); schedule评估() },
    removeLeg: (id: string) => { state.legs = state.legs.filter(l => l.id !== id); schedule评估() },
    updateLeg: (id: string, patch: Partial<Leg>) => {
      const leg = state.legs.find(l => l.id === id)
      if (leg) Object.assign(leg, patch)
      schedule评估()
    },
    resetSandbox: () => { state.legs = []; schedule评估() },
    commitSandbox: () => schedule评估(),
  }
}
