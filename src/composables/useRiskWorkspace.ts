import { reactive, readonly } from 'vue'
import request from '../utils/request'
import type { AccountHealth } from '../types/account'

// ── types ────────────────────────────────────────────────────────────────────
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
  mmDelta: number
  greeks: GreeksComparison
  heatMatrix: HeatCell[]
}

// ── mock Greeks (sandbox simulation uses real API equity for liquidation) ─────
const MOCK_GREEKS = {
  delta: -0.38,
  gamma: 0.021,
  vega: 2.14,
  theta: -0.87,
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

function calc评估(legs: Leg[], equity: number, mm: number): Risk评估Result {
  const mmDelta = legs.reduce((s, l) => s + calcLegMM(l), 0)

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

  const heatMatrix: HeatCell[] = []
  for (const pricePct of [-20, -15, -10, -5, 0, 5, 10, 15, 20]) {
    for (const ivPct of [-10, -5, 0, 5, 10, 15, 20]) {
      const scaleFactor = 1 + pricePct * 0.008 + ivPct * 0.003
      const cellMM = mmDelta * scaleFactor
      const totalMM = mm + cellMM
      heatMatrix.push({
        pricePct,
        ivPct,
        mm: parseFloat(cellMM.toFixed(4)),
        liquidated: equity > 0 && totalMM > equity,
      })
    }
  }

  return {
    mmDelta: parseFloat(mmDelta.toFixed(4)),
    greeks: {
      delta: MOCK_GREEKS.delta,
      gamma: MOCK_GREEKS.gamma,
      vega: MOCK_GREEKS.vega,
      theta: MOCK_GREEKS.theta,
      deltaNew: MOCK_GREEKS.delta + ng.delta,
      gammaNew: MOCK_GREEKS.gamma + ng.gamma,
      vegaNew: MOCK_GREEKS.vega + ng.vega,
      thetaNew: MOCK_GREEKS.theta + ng.theta,
    },
    heatMatrix,
  }
}

// ── health API state ────────────────────────────────────────────────────────
interface HealthState {
  loading: boolean
  error: string | null
  data: AccountHealth | null
  equity: number
  mm: number
  im: number
  available: number
  marginBalance: number
  marginUtilization: number
  initialMarginRate: number
  riskLevel: 'SAFE' | 'ATTENTION' | 'HIGH_RISK' | 'CRITICAL' | ''
}

const healthState = reactive<HealthState>({
  loading: false,
  error: null,
  data: null,
  equity: 0,
  mm: 0,
  im: 0,
  available: 0,
  marginBalance: 0,
  marginUtilization: 0,
  initialMarginRate: 0,
  riskLevel: '',
})

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

async function fetchHealth(): Promise<boolean> {
  healthState.loading = true
  healthState.error = null
  try {
    const res = await request.get<AccountHealth>('/api/v1/account/health')
    const h = res as unknown as AccountHealth
    if (h.status !== 'success') {
      healthState.error = h.status
      return false
    }
    healthState.data = h
    healthState.equity = round2(h.metrics.total_equity_usd)
    healthState.mm = round2(h.metrics.maintenance_margin_usd)
    healthState.im = round2(h.metrics.initial_margin_usd)
    healthState.available = round2(h.metrics.total_available_balance_usd)
    healthState.marginBalance = round2(h.metrics.total_margin_balance_usd)
    healthState.marginUtilization = round2(h.metrics.margin_utilization_rate)
    healthState.initialMarginRate = round2(h.metrics.initial_margin_rate)
    healthState.riskLevel = h.risk_level
    return true
  } catch (e: any) {
    healthState.error = e.message || '获取账户数据失败'
    return false
  } finally {
    healthState.loading = false
  }
}

// ── sandbox simulation state ────────────────────────────────────────────────
interface WorkspaceState {
  delta: number
  gamma: number
  vega: number
  theta: number
  legs: Leg[]
  result: Risk评估Result
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const state = reactive<WorkspaceState>({
  delta: MOCK_GREEKS.delta,
  gamma: MOCK_GREEKS.gamma,
  vega: MOCK_GREEKS.vega,
  theta: MOCK_GREEKS.theta,
  legs: [],
  result: calc评估([], 0, 0),
  debounceTimer: null,
})

function schedulepg() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.debounceTimer = setTimeout(() => {
    state.result = calc评估(state.legs, healthState.equity, healthState.mm)
    // sync Greeks
    state.delta = MOCK_GREEKS.delta
    state.gamma = MOCK_GREEKS.gamma
    state.vega = MOCK_GREEKS.vega
    state.theta = MOCK_GREEKS.theta
  }, 100)
}

export function useRiskWorkspace() {
  return {
    // health API
    health: readonly(healthState),
    fetchHealth,
    // simulation
    state: readonly(state),
    legs: readonly(state.legs),
    addLeg: () => { state.legs.push(defaultLeg()); schedulepg() },
    removeLeg: (id: string) => { state.legs = state.legs.filter(l => l.id !== id); schedulepg() },
    updateLeg: (id: string, patch: Partial<Leg>) => {
      const leg = state.legs.find(l => l.id === id)
      if (leg) Object.assign(leg, patch)
      schedulepg()
    },
    resetSandbox: () => { state.legs = []; schedulepg() },
    commitSandbox: () => schedulepg(),
  }
}
