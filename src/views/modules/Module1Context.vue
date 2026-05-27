<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRiskWorkspace } from '../../composables/useRiskWorkspace'

const { health, positions, fetchHealth, fetchPositions } = useRiskWorkspace()

onMounted(() => {
  fetchHealth()
  fetchPositions()
})

// ── risk config ──────────────────────────────────────────────────────────────
const riskConfig = computed(() => {
  const map: Record<string, { border: string; dot: string; label: string; type: string }> = {
    SAFE:       { border: '#52c41a', dot: '#52c41a', label: 'SAFE',       type: 'success' },
    ATTENTION:  { border: '#faad14', dot: '#faad14', label: 'ATTENTION',  type: 'warning' },
    HIGH_RISK:  { border: '#fa8c16', dot: '#fa8c16', label: 'HIGH_RISK',  type: 'warning' },
    CRITICAL:   { border: '#ff4d4f', dot: '#ff4d4f', label: 'CRITICAL',   type: 'danger'  },
  }
  const r = health.riskLevel || 'SAFE'
  return map[r] ?? map.SAFE
})

// ── Greeks from API ─────────────────────────────────────────────────────────
const greeksSummary = computed(() => positions.data?.greeks_summary ?? null)
const greeksThresholds = computed(() => positions.data?.greeks_thresholds ?? null)

const greekRows = computed(() => {
  const s = greeksSummary.value
  const t = greeksThresholds.value
  if (!s || !t) return []
  return [
    { label: 'Delta', val: s.total_net_delta, threshold: t.delta_limit, unit: '', decimals: 4 },
    { label: 'Gamma', val: s.total_net_gamma, threshold: t.gamma_limit, unit: '', decimals: 6 },
    { label: 'Vega',  val: s.total_net_vega,  threshold: t.vega_limit,  unit: '/%', decimals: 4 },
    { label: 'Theta', val: s.total_net_theta, threshold: t.theta_limit, unit: '/day', decimals: 4 },
  ]
})

function barPercent(val: number, threshold: number): number {
  return Math.min(Math.abs(val / threshold) * 100, 100)
}

function barColor(val: number, threshold: number): string {
  return Math.abs(val / threshold) >= 0.7 ? '#ff4d4f' : '#52c41a'
}

function fmt(val: number, decimals: number): string {
  return val.toFixed(decimals)
}

// ── Positions ─────────────────────────────────────────────────────────────────
const positionsList = computed(() => positions.data?.data ?? [])

const positionCols = [
  { label: '名称',     key: 'name'         },
  { label: '方向',     key: 'side'         },
  { label: '数量',     key: 'size'         },
  { label: '入场价',   key: 'entry_price'  },
  { label: '当前价',   key: 'current_price'},
  { label: 'P&L',     key: 'pnl'          },
  { label: 'Delta',    key: 'net_delta'    },
  { label: 'Gamma',    key: 'net_gamma'    },
  { label: 'Vega',     key: 'net_vega'     },
  { label: 'Theta',    key: 'net_theta'    },
  { label: 'DTE',      key: 'dte'          },
]

function cellVal(pos: any, key: string): string {
  const v = pos[key]
  if (key === 'side') return v === 'Buy' ? '买入' : '卖出'
  if (key === 'pnl') return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
  if (key === 'net_gamma') return v.toFixed(6)
  if (['net_delta', 'net_vega', 'net_theta'].includes(key)) return v.toFixed(4)
  if (typeof v === 'number') return v.toFixed(2)
  return String(v)
}
</script>

<template>
  <div class="module1">
    <div class="section-title">
      <span class="dot" :style="{ background: riskConfig.dot }"></span>
      Account Context
    </div>

    <!-- Loading -->
    <div v-if="health.loading && !health.data" class="skeleton-card">
      <el-skeleton :rows="4" animated />
    </div>

    <!-- Error -->
    <el-alert
      v-else-if="health.error"
      :title="health.error"
      type="error"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <template v-else-if="health.data">
      <!-- Risk Level Banner -->
      <div
        class="risk-banner"
        :style="{ borderColor: riskConfig.border, color: riskConfig.border }"
      >
        <span class="risk-dot" :style="{ background: riskConfig.dot }"></span>
        <span class="risk-label">{{ riskConfig.label }}</span>
        <el-tag :type="riskConfig.type as any" size="small" class="env-tag">
          {{ health.data.environment }}
        </el-tag>
      </div>

      <!-- Health -->
      <div class="card" :style="{ borderLeftColor: riskConfig.border }">
        <div class="card-title">资金健康度</div>
        <div class="metric-grid">
          <div class="metric">
            <span class="metric-label">Equity (USD)</span>
            <span class="metric-value accent">${{ health.equity.toLocaleString() }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">MM (USD)</span>
            <span class="metric-value warn">${{ health.mm.toLocaleString() }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">IM (USD)</span>
            <span class="metric-value">${{ health.im.toLocaleString() }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">可用 (USD)</span>
            <span class="metric-value safe">${{ health.available.toLocaleString() }}</span>
          </div>
        </div>

        <!-- Margin Utilization bar -->
        <div class="progress-block">
          <div class="progress-label">
            <span>保证金利用率</span>
            <span :style="{ color: riskConfig.border }">{{ health.marginUtilization }}%</span>
          </div>
          <el-progress
            :percentage="Math.min(health.marginUtilization, 100)"
            :color="riskConfig.border"
            :show-text="false"
            :stroke-width="8"
          />
          <div class="progress-sub">
            <span>IM 占用率 {{ health.initialMarginRate }}%</span>
            <span>保证金余额 ${{ health.marginBalance.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Greeks -->
      <div class="card" :style="{ borderLeftColor: riskConfig.border }">
        <div class="card-title">现有 Greeks 暴露</div>
        <div v-if="positions.loading && !greeksSummary" class="pos-loading">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="!greeksSummary" class="pos-empty-text">暂无 Greeks 数据</div>
        <div v-else class="greek-list">
          <div
            v-for="row in greekRows"
            :key="row.label"
            class="greek-item"
          >
            <div class="greek-header">
              <span class="greek-label">{{ row.label }}</span>
              <span class="greek-values">
                <span class="greek-val">{{ fmt(row.val, row.decimals) }}</span>
                <span class="greek-sep"> / </span>
                <span class="greek-threshold">{{ fmt(row.threshold, row.decimals) }}</span>
                <span class="greek-unit">{{ row.unit }}</span>
              </span>
            </div>
            <div class="greek-bar-track">
              <div
                class="greek-bar-fill"
                :style="{
                  width: barPercent(row.val, row.threshold) + '%',
                  background: barColor(row.val, row.threshold),
                }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 现有仓位 -->
      <div class="card" :style="{ borderLeftColor: riskConfig.border }">
        <div class="card-title">现有仓位</div>
        <div v-if="positions.loading && positionsList.length === 0" class="pos-loading">
          <el-skeleton :rows="2" animated />
        </div>
        <div v-else-if="positionsList.length === 0" class="pos-empty-text">暂无仓位</div>
        <div v-else class="pos-wrap">
          <table class="pos-table">
            <thead>
              <tr>
                <th v-for="col in positionCols" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(pos, idx) in positionsList" :key="idx">
                <td
                  v-for="col in positionCols"
                  :key="col.key"
                  :class="[
                    'pos-td',
                    col.key === 'side' ? (pos.side === 'Buy' ? 'dir-buy' : 'dir-sell') : '',
                    col.key === 'pnl' ? (pos.pnl >= 0 ? 'pnl-pos' : 'pnl-neg') : '',
                  ]"
                >
                  {{ cellVal(pos, col.key) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- No data yet -->
    <div v-else class="empty-hint">
      <el-icon><el-icon-loading /></el-icon>
      <span>正在连接账户数据...</span>
    </div>
  </div>
</template>

<style scoped>
.module1 {
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

.skeleton-card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
}

.error-alert { border-radius: 8px; }

.risk-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1.5px solid;
  border-radius: 8px;
}

.risk-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.risk-label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  flex: 1;
}

.env-tag { margin-left: auto; }

.card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-left: 3px solid;
  border-radius: 8px;
  padding: 14px;
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metric-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', monospace;
}

.metric-value.accent { color: var(--el-color-primary); }
.metric-value.warn   { color: #faad14; }
.metric-value.safe   { color: #52c41a; }

.progress-block { margin-top: 4px; }

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin-bottom: 5px;
}

.progress-sub {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--el-text-color-disabled);
  margin-top: 4px;
}

/* ── Greeks ── */
.greek-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.greek-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.greek-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.greek-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.greek-values {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.greek-val {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.greek-sep {
  color: var(--el-text-color-disabled);
  margin: 0 2px;
}

.greek-threshold {
  color: var(--el-text-color-secondary);
}

.greek-unit {
  font-size: 10px;
  color: var(--el-text-color-disabled);
  margin-left: 2px;
}

.greek-bar-track {
  width: 100%;
  height: 5px;
  background: var(--el-border-color);
  border-radius: 3px;
  overflow: hidden;
}

.greek-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s, background 0.3s;
}

/* ── Positions ── */
.pos-loading,
.pos-empty-text {
  padding: 8px 0;
}

.pos-empty-text {
  font-size: 12px;
  color: var(--el-text-color-disabled);
  text-align: center;
}

.pos-wrap {
  overflow-x: auto;
}

.pos-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  min-width: 700px;
}

.pos-table th {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  font-weight: 600;
  padding: 6px 8px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color);
}

.pos-table th:first-child,
.pos-table td:first-child {
  text-align: left;
}

.pos-td {
  padding: 7px 8px;
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-text-color-regular);
  border-bottom: 1px solid var(--el-fill-color);
  white-space: nowrap;
}

.pos-td:first-child {
  text-align: left;
}

.pos-td.dir-buy  { color: #52c41a; font-weight: 600; }
.pos-td.dir-sell { color: #ff4d4f; font-weight: 600; }
.pos-td.pnl-pos  { color: #52c41a; }
.pos-td.pnl-neg  { color: #ff4d4f; }

.empty-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  padding: 24px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
