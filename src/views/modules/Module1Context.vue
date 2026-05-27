<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRiskWorkspace } from '../../composables/useRiskWorkspace'

const { health, state, startHealthPoll, stopHealthPoll } = useRiskWorkspace()

onMounted(() => startHealthPoll(30000))
onUnmounted(() => stopHealthPoll())

// Card border & dot color driven by risk level
const riskConfig = computed(() => {
  const map: Record<string, { border: string; dot: string; label: string; type: string }> = {
    SAFE:        { border: '#52c41a', dot: '#52c41a', label: 'SAFE',        type: 'success' },
    ATTENTION:   { border: '#faad14', dot: '#faad14', label: 'ATTENTION',  type: 'warning' },
    HIGH_RISK:   { border: '#fa8c16', dot: '#fa8c16', label: 'HIGH_RISK',  type: 'warning' },
    CRITICAL:    { border: '#ff4d4f', dot: '#ff4d4f', label: 'CRITICAL',  type: 'danger' },
  }
  const r = health.riskLevel || 'SAFE'
  return map[r] ?? map.SAFE
})

const greekRows = computed(() => [
  { label: 'Delta', val: state.delta, unit: '' },
  { label: 'Gamma', val: state.gamma, unit: '' },
  { label: 'Vega',  val: state.vega,  unit: 'BTC/%' },
  { label: 'Theta', val: state.theta, unit: 'BTC/day' },
])
</script>

<template>
  <div class="module1">
    <div class="section-title">
      <span class="dot" :style="{ background: riskConfig.dot }"></span>
      Account Context
    </div>

    <!-- Loading -->
    <div v-if="health.loading && !health.data" class="skeleton-card">
      <el-skeleton :rows="3" animated />
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

        <!-- Margin Utilization — core risk bar -->
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
        <div class="greek-list">
          <div v-for="row in greekRows" :key="row.label" class="greek-row">
            <span class="greek-label">{{ row.label }}</span>
            <span class="greek-val">{{ row.val.toFixed(3) }} {{ row.unit }}</span>
          </div>
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
  background: transparent;
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

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.metric-value {
  font-size: 13px;
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
  margin-bottom: 4px;
}

.progress-sub {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--el-text-color-disabled);
  margin-top: 3px;
}

.greek-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.greek-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.greek-label { color: var(--el-text-color-secondary); }

.greek-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-color-primary-light-3);
  font-weight: 600;
}

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
