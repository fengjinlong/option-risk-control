<script setup lang="ts">
import { computed } from 'vue'
import { useRiskWorkspace, type HeatCell } from '../../composables/useRiskWorkspace'

const { health, positions, state, groupsGreeks, imDelta } = useRiskWorkspace()

const PRICE_PCTS = [-20, -15, -10, -5, 0, 5, 10, 15, 20]
const IV_PCTS = [-10, -5, 0, 5, 10, 15, 20]

// ── Greeks from API ─────────────────────────────────────────────────────────
const greeksSummary = computed(() => positions.data?.greeks_summary ?? null)
const greeksThresholds = computed(() => positions.data?.greeks_thresholds ?? null)

// Greeks 对比行：从 API 取当前值 + 阈值，从策略组计算变化量
const greekRows = computed(() => {
  const s = greeksSummary.value
  const t = greeksThresholds.value
  if (!s) return []

  const gg = groupsGreeks.value

  return [
    { label: 'Delta', base: s.total_net_delta, delta: gg.delta, threshold: t?.delta_limit ?? 0, decimals: 4 },
    { label: 'Gamma', base: s.total_net_gamma, delta: gg.gamma, threshold: t?.gamma_limit ?? 0, decimals: 9 },
    { label: 'Vega', base: s.total_net_vega, delta: gg.vega, threshold: t?.vega_limit ?? 0, decimals: 4 },
    { label: 'Theta', base: s.total_net_theta, delta: gg.theta, threshold: t?.theta_limit ?? 0, decimals: 4 },
  ].map(row => ({
    ...row,
    newVal: row.base + row.delta,
    pct: row.threshold !== 0 ? Math.min(Math.abs((row.base + row.delta) / row.threshold) * 100, 9999) : 0,
  }))
})

function fmt(v: number | undefined | null, d: number): string {
  return Number(v).toFixed(d)
}

interface GreekRow {
  label: string
  base: number
  delta: number
  threshold: number
  decimals: number
}

// ── IM table ─────────────────────────────────────────────────────────────────
const imRows = computed(() => {
  const totalIM = imDelta.result?.totalIM ?? 0
  const delta = health.available > 0 ? (totalIM / health.available) * 100 : 0
  return [
    {
      label: 'IM',
      initial: health.initialMarginRate,
      delta,
    },
  ]
})

function imOver50(row: typeof imRows.value[0]): boolean {
  return (row.initial + row.delta) > 50
}

// ── MM ratio (used by alert) ──────────────────────────────────────────────────
const mmRatio = computed(() =>
  parseFloat(((state.result.mmDelta / (health.equity || 1)) * 100).toFixed(2))
)

// ── Heat Matrix ─────────────────────────────────────────────────────────────
function cellStyle(cell: HeatCell): Record<string, string> {
  const ratio = cell.mm / (health.equity || 1)
  if (cell.liquidated) {
    return { background: '#7f1d1d', color: '#fff', fontWeight: '700', fontSize: '11px', textAlign: 'center' }
  }
  if (ratio < 0.4) return { background: '#14532d', color: '#4ade80', fontSize: '11px', textAlign: 'center' }
  if (ratio < 0.7) return { background: '#78350f', color: '#fde68a', fontSize: '11px', textAlign: 'center' }
  return { background: '#9a3412', color: '#fed7aa', fontSize: '11px', textAlign: 'center' }
}

function cellText(cell: HeatCell): string {
  if (cell.liquidated) return `❌ 爆仓`
  return `$${cell.mm.toFixed(2)}`
}

const totalCells = computed(() => state.result.heatMatrix.length)
const liquidatedCount = computed(() => state.result.heatMatrix.filter(c => c.liquidated).length)
const isHighRisk = computed(() => mmRatio.value > 80 || liquidatedCount.value > 0)
const isWarning = computed(() => mmRatio.value > 50 && !isHighRisk.value)

const alertMsg = computed(() => {
  if (liquidatedCount.value > 0)
    return `【极高风险】在 ${liquidatedCount.value}/${totalCells.value} 个压力情景下发生强制平仓。建议立即降低保证金占用或平仓部分合约。`
  if (mmRatio.value > 70)
    return `【高风险】保证金占用率 ${mmRatio.value}% 接近红线。当前策略存在显著非线性暴露（Vanna/Volga），建议审慎评估。`
  if (mmRatio.value > 50)
    return `【注意】保证金占用率 ${mmRatio.value}%，处于中等风险区间。请持续监控 Greeks 漂移。`
  return `【正常】当前策略保证金占用安全。未见明显非线性风险暴露。`
})
</script>

<template>
  <div class="module3">
    <div class="section-title">
      <span class="dot" :class="isHighRisk ? 'red' : isWarning ? 'orange' : 'green'"></span>
      Risk Evaluation Engine
    </div>

    <!-- Loading -->
    <div v-if="health.loading && !health.data" class="skeleton-card">
      <el-skeleton :rows="2" animated />
    </div>

    <!-- Error -->
    <el-alert v-else-if="health.error" :title="health.error" type="error" show-icon :closable="false" />

    <template v-else-if="health.data">
      <!-- IM 变动 -->
      <div class="card">
        <div class="card-title">IM 变动</div>
        <el-table :data="imRows" size="small" border class="im-table">
          <el-table-column prop="label" label="指标" width="80" align="center" />
          <el-table-column label="仓位 IM" align="center">
            <template #default="{ row }">
              {{ row.initial.toFixed(2) }}%
            </template>
          </el-table-column>
          <el-table-column label="变化 IM" align="center">
            <template #default="{ row }">
              <span :class="row.delta >= 0 ? 'up' : 'down'">
                {{ row.delta >= 0 ? '+' : '' }}{{ (row.delta).toFixed(2) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="超50%阈值" align="center">
            <template #default="{ row }">
              <span :class="imOver50(row) ? 'over' : 'ok'">
                {{ imOver50(row) ? '是' : '否' }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Greeks comparison -->
      <div class="card">
        <div class="card-title">Greeks 增量合并对比</div>

        <div v-if="positions.loading && !greeksSummary" class="greek-loading">
          <el-skeleton :rows="2" animated />
        </div>

        <div v-else-if="!greeksSummary" class="greek-empty">暂无 Greeks 数据</div>

        <template v-else>
          <div class="gth">
            <span>Greek</span>
            <span>当前</span>
            <span>变化</span>
            <span>阈值</span>
            <span>当前/阈值</span>
          </div>
          <div v-for="row in greekRows" :key="row.label" class="gtr">
            <span class="glabel">{{ row.label }}</span>
            <!-- 当前 -->
            <span class="gbase">{{ fmt(row.base, row.decimals) }}</span>
            <!-- 变化 -->
            <span class="gdelta" :class="row.delta >= 0 ? 'up' : 'down'">
              {{ (row.delta >= 0 ? '+' : '') + fmt(row.delta, row.decimals) }}
            </span>
            <!-- 阈值 -->
            <span class="gthreshold">{{ fmt(row.threshold, row.decimals) }}</span>
            <!-- 当前/阈值百分比 -->
            <span class="gpct" :class="row.pct > 100 ? 'over' : 'ok'">
              {{ row.pct.toFixed(1) }}%
            </span>
          </div>
        </template>
      </div>

      <!-- Heat Matrix -->
      <div class="card heat-card">
        <div class="card-title">二维压力测试矩阵</div>
        <div class="matrix-meta">
          <span>纵轴: 标的价格变动 (%)</span>
          <span>横轴: IV 变动 (%)</span>
          <span class="liquidated-count" v-if="liquidatedCount > 0">
            🔴 {{ liquidatedCount }} 格爆仓
          </span>
        </div>
        <div class="matrix-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>Price \ IV</th>
                <th v-for="iv in IV_PCTS" :key="iv">{{ iv > 0 ? `+${iv}` : iv }}%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pricePct in PRICE_PCTS" :key="pricePct">
                <td class="row-label">{{ pricePct > 0 ? `+${pricePct}` : pricePct }}%</td>
                <td v-for="ivPct in IV_PCTS" :key="ivPct"
                  :style="cellStyle(state.result.heatMatrix.find(c => c.pricePct === pricePct && c.ivPct === ivPct)!)">
                  {{cellText(state.result.heatMatrix.find(c => c.pricePct === pricePct && c.ivPct === ivPct)!)}}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="matrix-legend">
          <span class="legend safe">安全 &lt;40%</span>
          <span class="legend warn">注意 40-70%</span>
          <span class="legend danger">危险 70-100%</span>
          <span class="legend liquid">爆仓 &gt;100%</span>
        </div>
      </div>

      <!-- Alert -->
      <el-alert :title="alertMsg" :type="isHighRisk ? 'error' : isWarning ? 'warning' : 'success'" show-icon
        :closable="false" />
    </template>
  </div>
</template>

<style scoped>
.module3 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding: 8px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--el-text-color-secondary);
  padding: 4px 4px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot.green {
  background: #52c41a;
}

.dot.orange {
  background: #faad14;
}

.dot.red {
  background: #ff4d4f;
}

.card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Greeks comparison ── */
.greek-loading,
.greek-empty {
  padding: 8px 0;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.im-table {
  font-size: 12px;
}

/* IM table up/down/over/ok */
.up {
  color: #ff4d4f;
  font-weight: 600;
}

.down {
  color: #52c41a;
  font-weight: 600;
}

.over {
  color: #ff4d4f;
  font-weight: 700;
}

.ok {
  color: #52c41a;
  font-weight: 700;
}

.gth,
.gtr {
  display: grid;
  grid-template-columns: 56px 1fr 1fr 1fr 1fr;
  gap: 4px;
  padding: 5px 0;
}

.gth {
  color: var(--el-text-color-secondary);
  font-weight: 600;
  font-size: 10px;
  border-bottom: 1px solid var(--el-border-color);
}

.gtr {
  align-items: center;
  border-bottom: 1px solid var(--el-fill-color);
}

.glabel {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.gbase {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-text-color-regular);
}

.gdelta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
}

.gdelta.up {
  color: #ff4d4f;
}

.gdelta.down {
  color: #52c41a;
}

.gthreshold {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.gpct {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.gpct.ok {
  color: #52c41a;
}

.gpct.over {
  color: #ff4d4f;
}

/* ── Heat Matrix ── */
.heat-card {
  overflow: hidden;
}

.matrix-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.liquidated-count {
  color: #ff4d4f;
  font-weight: 700;
}

.matrix-wrap {
  overflow-x: auto;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  min-width: 500px;
}

.matrix-table th {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  padding: 4px 6px;
  font-weight: 600;
  text-align: center;
  border: 1px solid var(--el-border-color);
  white-space: nowrap;
}

.matrix-table td {
  padding: 4px 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  transition: background 0.2s;
}

.row-label {
  background: var(--el-fill-color-dark) !important;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  text-align: center;
}

.matrix-legend {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 10px;
  flex-wrap: wrap;
}

.legend {
  padding: 2px 6px;
  border-radius: 4px;
}

.legend.safe {
  background: #14532d;
  color: #4ade80;
}

.legend.warn {
  background: #78350f;
  color: #fde68a;
}

.legend.danger {
  background: #9a3412;
  color: #fed7aa;
}

.legend.liquid {
  background: #7f1d1d;
  color: #fff;
}
</style>
