<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import TransactionModal from '../components/spot/TransactionModal.vue'
import HistoryModal from '../components/spot/HistoryModal.vue'
import DeleteConfirmModal from '../components/spot/DeleteConfirmModal.vue'
import AddTokenModal from '../components/spot/AddTokenModal.vue'
import {
  useSpotPortfolio,
  type TransactionSide,
} from '../composables/useSpotPortfolio'
import {
  toBig,
  ZERO,
  add,
  mul,
  formatDisplay,
  formatNav,
} from '../composables/useCryptoMath'

// ── portfolio state ──────────────────────────────────────────────────────────

const {
  holdings: holdingsDirect,
  livePrices,
  nav,
  totalCostBasis,
  totalPnL,
  donutData,
  getHolding,
  getHoldingPnL,
  getHoldingPnLPercent,
  addTransaction,
  deleteTransaction,
  addTicker,
  removeTicker,
} = useSpotPortfolio()

// ── modals state ──────────────────────────────────────────────────────────────

const txModalVisible = ref(false)
const txModalTicker = ref('')
const txModalCurrentQty = ref('0')
const txModalLivePrice = ref('0')

const historyModalVisible = ref(false)
const historyModalTicker = ref('')
const historyModalTransactions = ref<any[]>([])

const addTokenModalVisible = ref(false)

const deleteModalVisible = ref(false)
const deleteModalTicker = ref('')

// ── chart refs ────────────────────────────────────────────────────────────────

const donutRef = ref<HTMLDivElement | null>(null)
let donutChart: echarts.ECharts | null = null

// ── chart colors ──────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#8b5cf6',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7',
]

function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

// ── donut chart ───────────────────────────────────────────────────────────────

function initDonutChart() {
  if (!donutRef.value) return
  donutChart = echarts.init(donutRef.value)
  updateDonutChart()
}

function updateDonutChart() {
  if (!donutChart) return

  const data = donutData.value
  if (data.length === 0) {
    donutChart.clear()
    return
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const value = params.value
        const ticker = params.name
        const holding = getHolding(ticker)
        if (!holding) return ''
        const qty = holding.qty
        const livePrice = livePrices[ticker]?.price || '0'
        const notionalValue = mul(qty, livePrice)
        return `<strong>${ticker}</strong><br/>
          占比: ${value.toFixed(2)}%<br/>
          数量: ${qty}<br/>
          价值: $${formatNav(notionalValue)}`
      },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        color: 'var(--el-text-color-regular)',
      },
    },
    color: CHART_COLORS,
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: 'var(--el-bg-color-page)',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            formatter: '{b}: {d}%',
          },
        },
        data: data.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            color: getChartColor(index),
          },
        })),
      },
    ],
  }

  donutChart.setOption(option)
}

watch(donutData, () => {
  updateDonutChart()
}, { deep: true })

// ── lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  initDonutChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (donutChart) {
    donutChart.dispose()
    donutChart = null
  }
})

function handleResize() {
  donutChart?.resize()
}

// ── format helpers ────────────────────────────────────────────────────────────

function formatPrice(price: string | undefined): string {
  if (!price) return '0.0000'
  return formatDisplay(price)
}

function formatQty(qty: string): string {
  return formatDisplay(qty)
}

function formatUsd(val: any): string {
  const b = toBig(val || 0)
  return '$' + formatNav(b)
}

function formatPnl(val: any): string {
  const b = toBig(val || 0)
  if (b.eq(ZERO)) return '0.0000'
  const prefix = b.gt(ZERO) ? '+' : ''
  return prefix + formatDisplay(b)
}

function formatPnlPercent(val: any): string {
  const b = toBig(val || 0)
  if (b.eq(ZERO)) return '0.00%'
  const prefix = b.gt(ZERO) ? '+' : ''
  return prefix + formatDisplay(b) + '%'
}

function pnlClass(val: any): string {
  const b = toBig(val || 0)
  if (b.gt(ZERO)) return 'pnl-positive'
  if (b.lt(ZERO)) return 'pnl-negative'
  return ''
}

// ── action handlers ──────────────────────────────────────────────────────────

function openTxModal(ticker: string) {
  const h = getHolding(ticker)
  txModalTicker.value = ticker
  txModalCurrentQty.value = h?.qty || '0.0000'
  txModalLivePrice.value = livePrices[ticker]?.price || '0'
  txModalVisible.value = true
}

function handleTxConfirm(payload: {
  side: TransactionSide
  price: string
  qty: string
  amount: string
}) {
  addTransaction(txModalTicker.value, payload.side, payload.price, payload.qty, payload.amount)
  txModalVisible.value = false
  ElMessage.success(`${payload.side === 'buy' ? '买入' : '卖出'}记录成功`)
}

function openHistoryModal(ticker: string) {
  const h = getHolding(ticker)
  historyModalTicker.value = ticker
  historyModalTransactions.value = h?.transactions || []
  historyModalVisible.value = true
}

function handleHistoryDelete(txId: string) {
  deleteTransaction(historyModalTicker.value, txId)
  const h = getHolding(historyModalTicker.value)
  historyModalTransactions.value = h?.transactions || []
}

function openDeleteModal(ticker: string) {
  deleteModalTicker.value = ticker
  deleteModalVisible.value = true
}

function handleDeleteConfirm() {
  removeTicker(deleteModalTicker.value)
  ElMessage.success(`${deleteModalTicker.value} 已移除`)
  deleteModalVisible.value = false
}

function handleAddToken(ticker: string) {
  addTicker(ticker)
  ElMessage.success(`${ticker} 已添加`)
}

// ── holdings table ───────────────────────────────────────────────────────────

const tableData = computed(() => {
  return holdingsDirect.map(h => {
    const livePrice = livePrices[h.ticker]?.price || '0'
    const pnl = getHoldingPnL(h.ticker)
    const pnlPct = getHoldingPnLPercent(h.ticker)
    const currentValue = mul(h.qty, livePrice)
    const costBasis = mul(h.qty, h.avgCost)

    return {
      ticker: h.ticker,
      qty: h.qty,
      avgCost: h.avgCost,
      currentPrice: livePrice,
      pnl,
      pnlPct,
      currentValue,
      costBasis,
      txCount: h.transactions.length,
    }
  })
})

// ── ticker price change color ────────────────────────────────────────────────

function priceChangeClass(change24h: number): string {
  if (change24h > 0) return 'price-up'
  if (change24h < 0) return 'price-down'
  return ''
}

function formatPriceChange(change24h: number): string {
  const prefix = change24h > 0 ? '+' : ''
  return prefix + change24h.toFixed(2) + '%'
}
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="spot-body">
      <!-- Error Alert -->
      <transition name="el-fade-in">
        <div v-if="false" class="alert-error">
          <el-icon>
            <WarningFilled />
          </el-icon>
          Error message
        </div>
      </transition>

      <!-- Section 1: Top Dashboard - NAV & PnL -->
      <div class="dashboard-section">
        <div class="stat-card nav-card">
          <div class="stat-label">净资产 (NAV)</div>
          <div class="stat-value primary">
            {{ formatUsd(nav) }}
          </div>
          <div class="stat-sub">
            持仓成本: {{ formatUsd(totalCostBasis) }}
          </div>
        </div>

        <div class="stat-card pnl-card">
          <div class="stat-label">浮动盈亏</div>
          <div class="stat-value" :class="pnlClass(totalPnL)">
            {{ formatPnl(totalPnL) }}
          </div>
          <div class="stat-sub">
            {{ formatPnlPercent(totalPnL) }}
          </div>
        </div>

        <div class="stat-card price-card">
          <div class="stat-label">资产配置</div>
          <div class="donut-wrapper">
            <div ref="donutRef" class="donut-chart"></div>
            <div v-if="donutData.length === 0" class="donut-empty">
              暂无持仓
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Middle - Ticker Wall -->
      <div class="ticker-section">
        <div class="section-header">
          <span class="section-title">实时价格</span>
          <el-button size="small" type="primary" @click="addTokenModalVisible = true">
            <el-icon>
              <Plus />
            </el-icon>
            添加标的
          </el-button>
        </div>
        <div class="ticker-grid">
          <div v-for="item in holdingsDirect" :key="item.ticker" class="ticker-item"
            :class="priceChangeClass(livePrices[item.ticker]?.change24h || 0)">
            <div class="ticker-symbol">{{ item.ticker }}</div>
            <div class="ticker-price">
              ${{ formatPrice(livePrices[item.ticker]?.price) }}
            </div>
            <div class="ticker-change">
              {{ formatPriceChange(livePrices[item.ticker]?.change24h || 0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Main Table -->
      <div class="table-section">
        <div class="section-header">
          <span class="section-title">持仓明细</span>
        </div>

        <div class="table-wrapper">
          <table class="holdings-table">
            <thead>
              <tr>
                <th class="col-asset">标的</th>
                <th class="col-qty">数量</th>
                <th class="col-cost">均价</th>
                <th class="col-price">现价</th>
                <th class="col-value">市值</th>
                <th class="col-pnl">浮动盈亏</th>
                <th class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tableData" :key="row.ticker">
                <td class="col-asset">
                  <span class="asset-name">{{ row.ticker }}</span>
                </td>
                <td class="col-qty">
                  <span class="mono">{{ formatQty(row.qty) }}</span>
                </td>
                <td class="col-cost">
                  <span class="mono">${{ formatPrice(row.avgCost) }}</span>
                </td>
                <td class="col-price">
                  <span class="mono" :class="priceChangeClass(livePrices[row.ticker]?.change24h || 0)">
                    ${{ formatPrice(row.currentPrice) }}
                  </span>
                </td>
                <td class="col-value">
                  <span class="mono">{{ formatUsd(row.currentValue) }}</span>
                </td>
                <td class="col-pnl">
                  <div class="pnl-cell" :class="pnlClass(row.pnl)">
                    <span class="pnl-value">{{ formatPnl(row.pnl) }}</span>
                    <span class="pnl-pct">{{ formatPnlPercent(row.pnlPct) }}</span>
                  </div>
                </td>
                <td class="col-actions">
                  <div class="action-buttons">
                    <el-button type="primary" size="small" @click="openTxModal(row.ticker)">
                      记录
                    </el-button>
                    <el-button type="info" size="small" plain @click="openHistoryModal(row.ticker)">
                      历史 ({{ row.txCount }})
                    </el-button>
                    <el-button type="danger" size="small" plain @click="openDeleteModal(row.ticker)">
                      删除
                    </el-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <TransactionModal
      v-model:visible="txModalVisible"
      :ticker="txModalTicker"
      :current-qty="txModalCurrentQty"
      :live-price="txModalLivePrice"
      @confirm="handleTxConfirm"
    />

    <HistoryModal
      v-model:visible="historyModalVisible"
      :ticker="historyModalTicker"
      :transactions="historyModalTransactions"
      @delete="handleHistoryDelete"
    />

    <DeleteConfirmModal
      v-model:visible="deleteModalVisible"
      :ticker="deleteModalTicker"
      @confirm="handleDeleteConfirm"
    />

    <AddTokenModal
      v-model:visible="addTokenModalVisible"
      :existing-tickers="holdingsDirect.map(h => h.ticker)"
      @add="handleAddToken"
    />
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--el-bg-color);
}

.spot-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Dashboard Section */
.dashboard-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.stat-card {
  background: var(--el-fill-color-light);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  font-family: var(--el-font-family);
  color: var(--el-text-color-primary);
}

.stat-value.primary {
  color: var(--el-color-primary);
}

.stat-value.pnl-positive {
  color: var(--el-color-success);
}

.stat-value.pnl-negative {
  color: var(--el-color-danger);
}

.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* Donut Chart */
.donut-wrapper {
  position: relative;
  height: 140px;
}

.donut-chart {
  width: 100%;
  height: 100%;
}

.donut-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* Ticker Section */
.ticker-section {
  background: var(--el-fill-color-light);
  border-radius: 12px;
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ticker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.ticker-item {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--el-border-color-light);
  transition: border-color 0.2s;
}

.ticker-item:hover {
  border-color: var(--el-border-color);
}

.ticker-symbol {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.ticker-price {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--el-font-family);
  color: var(--el-text-color-primary);
}

.ticker-change {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ticker-item.price-up .ticker-change {
  color: var(--el-color-success);
}

.ticker-item.price-down .ticker-change {
  color: var(--el-color-danger);
}

.ticker-item.price-up .ticker-price {
  color: var(--el-color-success);
}

.ticker-item.price-down .ticker-price {
  color: var(--el-color-danger);
}

/* Table Section */
.table-section {
  background: var(--el-fill-color-light);
  border-radius: 12px;
  padding: 16px;
}

.table-wrapper {
  overflow-x: auto;
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.holdings-table th,
.holdings-table td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.holdings-table th {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.holdings-table tbody tr:hover {
  background: var(--el-fill-color-lighter);
}

.asset-name {
  font-weight: 700;
  color: var(--el-color-primary);
}

.mono {
  font-family: var(--el-font-family);
}

.col-qty,
.col-cost,
.col-price,
.col-value {
  text-align: right;
}

.col-pnl {
  text-align: right;
}

.pnl-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.pnl-value {
  font-weight: 600;
  font-family: var(--el-font-family);
}

.pnl-pct {
  font-size: 11px;
  opacity: 0.8;
}

.pnl-positive .pnl-value,
.pnl-positive.pnl-value {
  color: var(--el-color-success);
}

.pnl-negative .pnl-value,
.pnl-negative.pnl-value {
  color: var(--el-color-danger);
}

.pnl-cell.pnl-positive .pnl-pct {
  color: var(--el-color-success);
}

.pnl-cell.pnl-negative .pnl-pct {
  color: var(--el-color-danger);
}

.price-up {
  color: var(--el-color-success) !important;
}

.price-down {
  color: var(--el-color-danger) !important;
}

.col-actions {
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

/* Error Alert */
.alert-error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  padding: 10px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-section {
    grid-template-columns: 1fr 1fr;
  }

  .stat-card.nav-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .dashboard-section {
    grid-template-columns: 1fr;
  }

  .ticker-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style>
