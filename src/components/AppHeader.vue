<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useRiskWorkspace } from '../composables/useRiskWorkspace'

const router = useRouter()
const { prices, volRadar } = useRiskWorkspace()

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <span class="logo-text">📊</span>
      <span class="title">Pre-trade Risk Workspace</span>
    </div>
    <div class="header-center">
      <el-button type="primary" size="small" @click="go('/')">工作台</el-button>
      <el-button type="primary" size="small" @click="go('/explain')">数据说明</el-button>
      <el-button type="primary" size="small" @click="go('/calculator')">计算器</el-button>
      <!-- 开仓iv预警 -->
      <el-button type="primary" size="small" @click="go('/iv-alert')">开仓IV预警</el-button>
    </div>
    <div class="header-right">
      <el-tag type="success" size="small">BTC IV%: {{ volRadar.data?.BTC?.iv_percentile_1y ?? '--' }}</el-tag>
      <el-tag type="success" size="small">ETH IV%: {{ volRadar.data?.ETH?.iv_percentile_1y ?? '--' }}</el-tag>
      <el-tag type="danger" size="small">BTC: {{ prices.data.data?.BTC ?? '--' }}</el-tag>
      <el-tag type="danger" size="small">ETH: {{ prices.data.data?.ETH ?? '--' }}</el-tag>
      <el-tag type="danger" size="small">SOL: {{ prices.data.data?.SOL ?? '--' }}</el-tag>
      <el-tag type="danger" size="small">LINK: {{ prices.data.data?.LINK ?? '--' }}</el-tag>
      <el-tag type="danger" size="small">CRV: {{ prices.data.data?.CRV ?? '--' }}</el-tag>
      <el-tag type="success" size="small">● LIVE</el-tag>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: var(--el-fill-color);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-text {
  font-size: 18px;
}

.title {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.03em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
