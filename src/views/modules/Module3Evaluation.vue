<script setup lang="ts">
import { computed } from 'vue'
import { useRiskWorkspace, type HeatCell } from '../../composables/useRiskWorkspace'

const { health, positions, state } = useRiskWorkspace()

const PRICE_PCTS = [-20, -15, -10, -5, 0, 5, 10, 15, 20]
const IV_PCTS = [-10, -5, 0, 5, 10, 15, 20]

// ── Greeks from API ─────────────────────────────────────────────────────────
const greeksSummary = computed(() => positions.data?.greeks_summary ?? null)
const greeksThresholds = computed(() => positions.data?.greeks_thresholds ?? null)

// Greeks 对比行：从 API 取当前值 + 阈值，从 sandbox legs 计算变化量
const greekRows = computed(() => {
  const s = greeksSummary.value
  const t = greeksThresholds.value
  if (!s) return []

  // 从 sandbox legs 汇总增量
  const g = state.result.greeks

  return [
    { label: 'Delta', base: s.total_net_delta, delta: g.deltaNew - g.delta,     threshold: t?.delta_limit ?? 0, decimals: 4 },
    { label: 'Gamma', base: s.total_net_gamma, delta: g.gammaNew - g.gamma,   threshold: t?.gamma_limit ?? 0, decimals: 6 },
    { label: 'Vega',  base: s.total_net_vega,  delta: g.vegaNew - g.vega,     threshold: t?.vega_limit ?? 0,  decimals: 4 },
    { label: 'Theta', base: s.total_net_theta, delta: g.thetaNew - g.theta,   threshold: t?.theta_limit ?? 0,  decimals: 4 },
  ]
})

function fmt(v: number, d: number): string {
  return v.toFixed(d)
}

interface GreekRow {
  label: string
  base: number
  delta: number
  threshold: number
  decimals: number
}

function isOverLimit(row: GreekRow | undefined): boolean {
  if (!row) return false
  // 超限 = 新值（base + delta）超出阈值正向或负向边界
  const newVal = row.base + row.delta
  return Math.abs(newVal) > row.threshold
}

function calcNewVal(row: GreekRow | undefined): number {
  if (!row) return 0
  return row.base + row.delta
}

// ── MM ───────────────────────────────────────────────────────────────────────
const mmArrow = computed(() => {
  const before = health.mm
  const after = health.mm + state.result.mmDelta
  const diff = after - before
  const sign = diff >= 0 ? '+' : ''
  return { before: before.toFixed(2), after: after.toFixed(2), diff: `${sign}${diff.toFixed(2)}` }
})

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
      <!-- MM Evolution -->
      <div class="card">
        <div class="card-title">边际保证金变动</div>
        <div class="mm-arrow">
          <span class="mm-before">{{ mmArrow.before }} BTC</span>
          <span class="arrow">──►</span>
          <span class="mm-after">{{ mmArrow.after }} BTC</span>
          <span class="mm-delta" :class="mmArrow.diff.startsWith('-') ? 'down' : 'up'">
            ({{ mmArrow.diff }} BTC)
          </span>
        </div>
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
            <span>是否超限</span>
          </div>
          <div v-for="row in greekRows" :key="row.label" class="gtr">
            <span class="glabel">{{ row.label }}</span>
            <!-- 当前 -->
            <span class="gbase">{{ fmt(row.base, row.decimals) }}</span>
            <!-- 变化 -->
            <span
              class="gdelta"
              :class="row.delta >= 0 ? 'up' : 'down'"
            >
              {{ (row.delta >= 0 ? '+' : '') + fmt(row.delta, row.decimals) }}
            </span>
            <!-- 阈值 -->
            <span class="gthreshold">{{ fmt(row.threshold, row.decimals) }}</span>
            <!-- 是否超限 -->
            <span
              class="gover"
              :class="isOverLimit(row) ? 'yes' : 'no'"
            >
              {{ isOverLimit(row) ? '是' : '否' }}
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
                <td
                  v-for="ivPct in IV_PCTS"
                  :key="ivPct"
                  :style="cellStyle(state.result.heatMatrix.find(c => c.pricePct === pricePct && c.ivPct === ivPct)!)"
                >
                  {{ cellText(state.result.heatMatrix.find(c => c.pricePct === pricePct && c.ivPct === ivPct)!) }}
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
      <el-alert
        :title="alertMsg"
        :type="isHighRisk ? 'error' : isWarning ? 'warning' : 'success'"
        show-icon
        :closable="false"
      />
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

.dot.green  { background: #52c41a; }
.dot.orange { background: #faad14; }
.dot.red    { background: #ff4d4f; }

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

.mm-arrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  flex-wrap: wrap;
}

.mm-before  { color: var(--el-text-color-secondary); }
.arrow      { color: var(--el-text-color-placeholder); font-size: 16px; }
.mm-after   { color: var(--el-color-primary); font-weight: 700; }
.mm-delta   { font-size: 12px; }
.mm-delta.up   { color: #ff4d4f; }
.mm-delta.down { color: #52c41a; }

/* ── Greeks comparison ── */
.greek-loading,
.greek-empty {
  padding: 8px 0;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.gth,
.gtr {
  display: grid;
  grid-template-columns: 56px 1fr 1fr 1fr 56px;
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

.gdelta.up   { color: #ff4d4f; }
.gdelta.down { color: #52c41a; }

.gthreshold {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.gover {
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.gover.yes { color: #ff4d4f; }
.gover.no  { color: #52c41a; }

/* ── Heat Matrix ── */
.heat-card { overflow: hidden; }

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

.matrix-wrap { overflow-x: auto; }

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

.legend.safe   { background: #14532d; color: #4ade80; }
.legend.warn   { background: #78350f; color: #fde68a; }
.legend.danger { background: #9a3412; color: #fed7aa; }
.legend.liquid { background: #7f1d1d; color: #fff; }
</style>
