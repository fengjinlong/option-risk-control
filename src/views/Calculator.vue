<script setup lang="ts">
import { useRiskWorkspace } from '../composables/useRiskWorkspace'
import { useRouter } from 'vue-router'

const router = useRouter()
const { prices } = useRiskWorkspace()
</script>

<template>
  <div class="workspace">
    <header class="workspace-header">
      <div class="header-left">
        <span class="logo-text">📊</span>
        <span class="title">Pre-trade Risk Workspace</span>
      </div>
      <div class="header-right">
        <el-tag type="danger" size="small">BTC: {{ prices.data.data?.BTC ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">ETH: {{ prices.data.data?.ETH ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">SOL: {{ prices.data.data?.SOL ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">LINK: {{ prices.data.data?.LINK ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">CRV: {{ prices.data.data?.CRV ?? '--' }}</el-tag>
        <el-tag type="success" size="small">● LIVE</el-tag>
        <el-button type="primary" size="small" plain @click="router.push('/')">返回工作台</el-button>
      </div>
    </header>

    <div class="calc-body">
      <div class="page-title">计算器</div>
      <p>建设中...</p>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  height: 100vh;
}

.workspace-header {
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

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calc-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 32px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  text-align: left;
}
</style>
