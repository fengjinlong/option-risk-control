<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()

const currentPath = computed(() => route.path)

const navItems = [
  { path: '/', label: '工作台' },
  { path: '/explain', label: '数据说明' },
  { path: '/calculator', label: '计算器' },
  { path: '/iv-alert', label: '开仓IV预警' },
  { path: '/position-risk', label: '持仓风控评估' },
  { path: '/greed-fear', label: '贪婪恐慌' },
  { path: '/spot-positions', label: '现货持仓' },
]

const prices = reactive({
  BTC: 0,
  ETH: 0,
  SOL: 0,
  LINK: 0,
  CRV: 0,
})

const volRadar = reactive({
  BTC: { iv_percentile_1y: 0 },
  ETH: { iv_percentile_1y: 0 },
})

const symbolModalVisible = ref(false)
const selectedSymbol = ref('BTC')
const savingSymbol = ref(false)

function openSymbolModal() {
  fetchCurrentSymbol()
  symbolModalVisible.value = true
}

async function fetchCurrentSymbol() {
  try {
    const res: any = await request.get('/api/v1/config/symbol')
    if (res?.current_symbol) {
      selectedSymbol.value = res.current_symbol
    }
  } catch (e) {
    // ignore
  }
}

onMounted(async () => {
  try {
    const priceRes: any = await request.get('/api/v1/market/prices')
    if (priceRes?.data) {
      prices.BTC = priceRes.data.BTC ?? 0
      prices.ETH = priceRes.data.ETH ?? 0
      prices.SOL = priceRes.data.SOL ?? 0
      prices.LINK = priceRes.data.LINK ?? 0
      prices.CRV = priceRes.data.CRV ?? 0
    }
    const volRes: any = await request.get('/api/v1/market/global-vol-radar')
    if (volRes?.data.BTC) {
      volRadar.BTC.iv_percentile_1y = volRes.data.BTC.iv_percentile_1y ?? 0
    }
    if (volRes?.data.ETH) {
      volRadar.ETH.iv_percentile_1y = volRes.data.ETH.iv_percentile_1y ?? 0
    }
  } catch (e) {
    // ignore
  }
})

function go(path: string) {
  router.push(path)
}

async function saveSymbol() {
  savingSymbol.value = true
  try {
    await request.patch('/api/v1/config/symbol', { symbol: selectedSymbol.value })
    symbolModalVisible.value = false
    ElMessage.success(`已切换为 ${selectedSymbol.value}`)
    router.go(0)
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '切换失败')
  } finally {
    savingSymbol.value = false
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <span class="logo-text">📊</span>
      <span class="title">Pre-trade Risk</span>
    </div>
    <div class="header-center">
      <el-select :model-value="currentPath" size="small" placeholder="导航" style="width: 140px;" @change="go">
        <el-option v-for="item in navItems" :key="item.path" :label="item.label" :value="item.path" />
      </el-select>
      <el-button type="primary" size="small" @click="openSymbolModal">切换标的</el-button>
    </div>
    <div class="header-right">
      <el-tag type="success" size="small">BTC IV%: {{ volRadar.BTC.iv_percentile_1y || '--' }}</el-tag>
      <el-tag type="success" size="small">ETH IV%: {{ volRadar.ETH.iv_percentile_1y || '--' }}</el-tag>
      <el-tag type="danger" size="small">BTC: {{ prices.BTC || '--' }}</el-tag>
      <el-tag type="danger" size="small">ETH: {{ prices.ETH || '--' }}</el-tag>
      <el-tag type="danger" size="small">SOL: {{ prices.SOL || '--' }}</el-tag>
      <el-tag type="danger" size="small">LINK: {{ prices.LINK || '--' }}</el-tag>
      <el-tag type="danger" size="small">CRV: {{ prices.CRV || '--' }}</el-tag>
      <!-- <el-tag type="success" size="small">● LIVE</el-tag> -->
    </div>
  </header>

  <el-dialog v-model="symbolModalVisible" title="切换标的" width="360px" :close-on-click-modal="false">
    <div class="symbol-picker">
      <el-radio-group v-model="selectedSymbol" style="display: flex; flex-direction: column; gap: 12px;">
        <el-radio value="BTC">BTC</el-radio>
        <el-radio value="ETH">ETH</el-radio>
        <el-radio value="SOL">SOL</el-radio>
      </el-radio-group>
    </div>
    <template #footer>
      <el-button @click="symbolModalVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingSymbol" @click="saveSymbol">保存</el-button>
    </template>
  </el-dialog>
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
  /* gap: 6px; */
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.symbol-picker {
  padding: 8px 0;
}

.symbol-picker .el-radio {
  height: 32px;
  line-height: 32px;
  margin: 0;
}
</style>
