<script setup lang="ts">
import { computed } from 'vue'
import { useRiskWorkspace } from '../../composables/useRiskWorkspace'
// import { useRiskWorkspace } from '../composables/useRiskWorkspace'

const { state } = useRiskWorkspace()

const mmRatio = computed(() =>
  parseFloat(((state.mm / state.equity) * 100).toFixed(2))
)

const healthColor = computed(() => {
  const r = mmRatio.value
  if (r < 50) return '#52c41a'
  if (r < 80) return '#faad14'
  return '#ff4d4f'
})

const greekRows = computed(() => [
  { label: 'Delta', val: state.delta, unit: '' },
  { label: 'Gamma', val: state.gamma, unit: '' },
  { label: 'Vega', val: state.vega, unit: 'BTC/%' },
  { label: 'Theta', val: state.theta, unit: 'BTC/day' },
])
</script>

<template>
  <div class="module1">
    <div class="section-title">
      <span class="dot green"></span>
      Account Context
    </div>

    <!-- Health -->
    <div class="card">
      <div class="card-title">资金健康度</div>
      <div class="metric-grid">
        <div class="metric">
          <span class="metric-label">Equity</span>
          <span class="metric-value accent">{{ state.equity }} BTC</span>
        </div>
        <div class="metric">
          <span class="metric-label">MM</span>
          <span class="metric-value warn">{{ state.mm }} BTC</span>
        </div>
        <div class="metric">
          <span class="metric-label">IM</span>
          <span class="metric-value">{{ state.im }} BTC</span>
        </div>
      </div>
      <div class="progress-block">
        <div class="progress-label">
          <span>MM / Equity</span>
          <span :style="{ color: healthColor }">{{ mmRatio }}%</span>
        </div>
        <el-progress :percentage="Math.min(mmRatio, 100)" :color="healthColor" :show-text="false" :stroke-width="6" />
      </div>
    </div>

    <!-- Greeks -->
    <div class="card">
      <div class="card-title">现有 Greeks 暴露</div>
      <div class="greek-list">
        <div v-for="row in greekRows" :key="row.label" class="greek-row">
          <span class="greek-label">{{ row.label }}</span>
          <span class="greek-val">{{ row.val.toFixed(3) }} {{ row.unit }}</span>
        </div>
      </div>
    </div>

    <!-- IV Context -->
    <div class="card">
      <div class="card-title">IV 环境基准</div>
      <div class="iv-grid">
        <div class="iv-item">
          <span class="iv-label">DVol</span>
          <el-tag size="small" type="info">{{ state.dvol }}</el-tag>
        </div>
        <div class="iv-item">
          <span class="iv-label">IV Rank</span>
          <el-tag size="small">{{ state.ivRank }}</el-tag>
        </div>
        <div class="iv-item">
          <span class="iv-label">25d Skew</span>
          <el-tag size="small" type="warning">{{ state.skew25d }}</el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module1 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* height: 100%; */
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

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
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

.metric-value.accent {
  color: var(--el-color-primary);
}

.metric-value.warn {
  color: #faad14;
}

.progress-block {
  margin-top: 4px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
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

.greek-label {
  color: var(--el-text-color-secondary);
}

.greek-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-color-primary-light-3);
  font-weight: 600;
}

.iv-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.iv-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.iv-label {
  color: var(--el-text-color-secondary);
}
</style>
