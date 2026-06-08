import { reactive, readonly, computed } from 'vue'
import request from '../utils/request'
import type { AccountHealth } from '../types/account'
import { calcTotalIM, type IMCalcResult } from './useIMCalculator'

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

export interface LegGroup {
  id: string
  expiry: string
  optionName: string
  direction: LegDirection
  size: number
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

export interface GroupsGreeks {
  delta: number
  gamma: number
  vega: number
  theta: number
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

function calccc(legs: Leg[], equity: number, mm: number): Risk评估Result {
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

// ── market prices state ────────────────────────────────────────────────────────
interface PricesState {
  loading: boolean
  data: Record<string, number>
}

const pricesState = reactive<PricesState>({
  loading: false,
  data: {},
})

async function fetchPrices() {
  pricesState.loading = true
  try {
    const res = await request.get<{ BTC: number; CRV: number; ETH: number; LINK: number; SOL: number }>('/api/v1/market/prices')
    pricesState.data = res as unknown as Record<string, number>
  } finally {
    pricesState.loading = false
  }
}

// ── global vol radar (IV percentile) state ─────────────────────────────────────
type VolRadarData = Record<string, {
  current_dvol: number
  iv_percentile_1y: number
  sample_days: number
  status: string
}>

interface VolRadarState {
  loading: boolean
  data: VolRadarData
}

const volRadarState = reactive<VolRadarState>({
  loading: false,
  data: {},
})

async function fetchVolRadar() {
  volRadarState.loading = true
  try {
    const res = await request.get<import('../types/account').GlobalVolRadarResponse>('/api/v1/market/global-vol-radar')
    volRadarState.data = (res as any).data ?? {}
  } finally {
    volRadarState.loading = false
  }
}

// ── positions / Greeks state ──────────────────────────────────────────────────
interface PositionsState {
  loading: boolean
  data: import('../types/account').EthOptionsResponse | null
}

const positionsState = reactive<PositionsState>({
  loading: false,
  data: null,
})

async function fetchPositions() {
  positionsState.loading = true
  try {
    const res = await request.get<import('../types/account').EthOptionsResponse>('/api/v1/positions/options')
    // const res = await request.get<import('../types/account').EthOptionsResponse>('/api/v1/positions/eth-options')
    positionsState.data = res as unknown as import('../types/account').EthOptionsResponse
  } finally {
    positionsState.loading = false
  }
}

// ── IM delta state ────────────────────────────────────────────────────────────
const imDeltaState = reactive<{
  result: IMCalcResult | null
}>({
  result: null,
})

function commitSandbox() {
  const S = (pricesState.data as any)?.data?.ETH ?? 0
  console.log('[commitSandbox] S =', S, '| groups =', groups.length)
  if (S === 0) { console.warn('[commitSandbox] S is 0, skip'); return }

  const inputs = groups
    .filter(g => g.expiry && g.optionName)
    .map(g => {
      const chain = optionsState.chainMap[g.expiry] ?? []
      const opt = chain.find(o => o.symbol === g.optionName)
      if (!opt) return null
      return {
        S,
        K: opt.strike,
        optionType: (opt.type === 'Call' ? 'call' : 'put') as 'call' | 'put',
        direction: g.direction,
        size: g.size,
        P_mark: opt.mark_price,
        P_order: opt.bid_price,
      }
    })
    .filter(Boolean) as Parameters<typeof calcTotalIM>[0]

  console.log('[commitSandbox] inputs after filter:', JSON.stringify(inputs, null, 2))
  const rawResult = calcTotalIM(inputs)
  console.log('[IM Calculator] inputs:', JSON.stringify(inputs, null, 2))
  console.log('[IM Calculator] raw result:', JSON.stringify(rawResult, null, 2))
  imDeltaState.result = rawResult
}

// ── options dates & chain ─────────────────────────────────────────────────────
interface OptionsState {
  datesLoading: boolean
  chainLoading: boolean
  dates: string[]
  chainMap: Record<string, import('../types/account').EthOptionsChainApiItem[]>
}

const optionsState = reactive<OptionsState>({
  datesLoading: false,
  chainLoading: false,
  dates: [],
  chainMap: {},
})

async function fetchDates() {
  optionsState.datesLoading = true
  try {
    const res = await request.get<import('../types/account').EthOptionDatesResponse>('/api/v1/market/options/dates')
    // const res = await request.get<import('../types/account').EthOptionDatesResponse>('/api/v1/market/eth-options/dates')
    optionsState.dates = (res as any).data ?? []
  } finally {
    optionsState.datesLoading = false
  }
}

async function fetchChain(date: string) {
  if (optionsState.chainMap[date]) return
  optionsState.chainLoading = true
  try {
    // const res = await request.get<import('../types/account').EthOptionsChainResponse>(`/api/v1/market/eth-options/chain?date=${date}`)
    const res = await request.get<import('../types/account').EthOptionsChainResponse>(`/api/v1/market/options/chain?date=${date}`)
    optionsState.chainMap[date] = (res as any).data ?? []
  } finally {
    optionsState.chainLoading = false
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
  result: calccc([], 0, 0),
  debounceTimer: null,
})

// ── leg groups ───────────────────────────────────────────────────────────────
const groups = reactive<LegGroup[]>([])

// ── leg groups Greeks（实时计算）──────────────────────────────────────────────
const groupsGreeks = computed<GroupsGreeks>(() => {
  const result: GroupsGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0 }
  for (const g of groups) {
    if (!g.expiry || !g.optionName) continue
    const chain = optionsState.chainMap[g.expiry] ?? []
    const opt = chain.find(o => o.symbol === g.optionName)
    if (!opt) continue
    const dir = g.direction === 'buy' ? 1 : -1
    result.delta += dir * opt.greeks.delta * g.size
    result.gamma += dir * opt.greeks.gamma * g.size
    result.vega += dir * opt.greeks.vega * g.size
    result.theta += dir * opt.greeks.theta * g.size
  }
  return result
})

function defaultGroup(): LegGroup {
  return {
    id: crypto.randomUUID(),
    expiry: '',
    optionName: '',
    direction: 'buy',
    size: 1,
  }
}

function addGroup() {
  groups.push(defaultGroup())
}

function removeGroup(id: string) {
  const idx = groups.findIndex(g => g.id === id)
  if (idx !== -1) groups.splice(idx, 1)
}

function updateGroup(id: string, patch: Partial<LegGroup>) {
  const g = groups.find(g => g.id === id)
  if (g) Object.assign(g, patch)
}

function resetGroups() {
  groups.splice(0, groups.length)
}

// ── sandbox simulation state ────────────────────────────────────────────────
function schedulepg() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.debounceTimer = setTimeout(() => {
    state.result = calccc(state.legs, healthState.equity, healthState.mm)
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
    // prices API
    prices: readonly(pricesState),
    fetchPrices,
    // positions API
    positions: readonly(positionsState),
    fetchPositions,
    // options dates & chain
    options: readonly(optionsState),
    fetchDates,
    fetchChain,
    // leg groups
    groups,
    addGroup,
    removeGroup,
    updateGroup,
    resetGroups,
    groupsGreeks,
    commitSandbox,
    imDelta: readonly(imDeltaState),
    // vol radar
    volRadar: readonly(volRadarState),
    fetchVolRadar,
    // simulation
    state: readonly(state),
  }
}
