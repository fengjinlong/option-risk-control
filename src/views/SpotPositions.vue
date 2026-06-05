<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import {
  useSpotPortfolio,
  type TransactionSide,
} from '../composables/useSpotPortfolio'
import {
  toBig,
  ZERO,
  add,
  sub,
  mul,
  div,
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
        label: { show: false },
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
          itemStyle: { color: getChartColor(index) },
        })),
      },
    ],
  }

  donutChart.setOption(option)
}

watch(donutData, () => { updateDonutChart() }, { deep: true })

// ── lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  initDonutChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  donutChart?.dispose()
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

function priceChangeClass(change24h: number): string {
  if (change24h > 0) return 'price-up'
  if (change24h < 0) return 'price-down'
  return ''
}

function formatPriceChange(change24h: number): string {
  const prefix = change24h > 0 ? '+' : ''
  return prefix + change24h.toFixed(2) + '%'
}

// ══════════════════════════════════════════════════════════════════════════════
// 交易记录弹窗
// ══════════════════════════════════════════════════════════════════════════════

const txModalVisible = ref(false)
const txModalTicker = ref('')
const txModalCurrentQty = ref('0')
const txModalLivePrice = ref('0')
const txSide = ref<TransactionSide>('buy')
const txPriceInput = ref('')
const txQtyInput = ref('')
const txAmountInput = ref('')
const txInputMode = ref<'qty' | 'amount'>('qty')
const txError = ref('')

function openTxModal(ticker: string) {
  const h = getHolding(ticker)
  txModalTicker.value = ticker
  txModalCurrentQty.value = h?.qty || '0.0000'
  txModalLivePrice.value = livePrices[ticker]?.price || '0'
  txSide.value = 'buy'
  txPriceInput.value = txModalLivePrice.value
  txQtyInput.value = ''
  txAmountInput.value = ''
  txInputMode.value = 'qty'
  txError.value = ''
  txModalVisible.value = true
}

function useLivePrice() {
  txPriceInput.value = txModalLivePrice.value
}

function syncAmount() {
  if (!txPriceInput.value || !txQtyInput.value) {
    txAmountInput.value = ''
    return
  }
  txAmountInput.value = formatDisplay(mul(txPriceInput.value, txQtyInput.value))
}

function syncQty() {
  if (!txPriceInput.value || !txAmountInput.value) {
    txQtyInput.value = ''
    return
  }
  const p = toBig(txPriceInput.value)
  if (p.eq(ZERO)) { txQtyInput.value = ''; return }
  txQtyInput.value = formatDisplay(div(txAmountInput.value, txPriceInput.value))
}

watch(txQtyInput, () => { if (txInputMode.value === 'qty') syncAmount() })
watch(txAmountInput, () => { if (txInputMode.value === 'amount') syncQty() })
watch(txPriceInput, () => {
  if (txInputMode.value === 'qty') syncAmount(); else syncQty()
})

function validateTx(): boolean {
  txError.value = ''
  if (!txPriceInput.value) { txError.value = '请输入价格'; return false }
  const p = toBig(txPriceInput.value)
  if (p.lte(ZERO)) { txError.value = '价格必须大于 0'; return false }
  if (txInputMode.value === 'qty') {
    if (!txQtyInput.value) { txError.value = '请输入数量'; return false }
    const q = toBig(txQtyInput.value)
    if (q.lte(ZERO)) { txError.value = '数量必须大于 0'; return false }
    if (txSide.value === 'sell') {
      const cur = toBig(txModalCurrentQty.value)
      if (q.gt(cur)) { txError.value = `卖出数量不能超过持仓 ${txModalCurrentQty.value}`; return false }
    }
  } else {
    if (!txAmountInput.value) { txError.value = '请输入金额'; return false }
    const a = toBig(txAmountInput.value)
    if (a.lte(ZERO)) { txError.value = '金额必须大于 0'; return false }
    if (txSide.value === 'sell') {
      const cur = toBig(txModalCurrentQty.value)
      if (cur.eq(ZERO)) { txError.value = '没有可卖持仓'; return false }
      const maxAmt = mul(txModalCurrentQty.value, txPriceInput.value)
      if (a.gt(maxAmt)) { txError.value = `卖出金额不能超过 ${formatDisplay(maxAmt)} USDT`; return false }
    }
  }
  return true
}

function confirmTx() {
  if (!validateTx()) return
  if (txInputMode.value === 'qty') syncAmount()
  else syncQty()
  addTransaction(txModalTicker.value, txSide.value, txPriceInput.value,
    txQtyInput.value, txAmountInput.value)
  txModalVisible.value = false
  ElMessage.success(`${txSide.value === 'buy' ? '买入' : '卖出'}记录成功`)
}

// ══════════════════════════════════════════════════════════════════════════════
// 历史记录弹窗
// ══════════════════════════════════════════════════════════════════════════════

const historyModalVisible = ref(false)
const historyModalTicker = ref('')
const historyModalTransactions = ref<any[]>([])
const historyDeleteConfirmId = ref<string | null>(null)

function openHistoryModal(ticker: string) {
  const h = getHolding(ticker)
  historyModalTicker.value = ticker
  historyModalTransactions.value = [...(h?.transactions || [])].sort((a, b) => b.timestamp - a.timestamp)
  historyDeleteConfirmId.value = null
  historyModalVisible.value = true
}

function deleteHistoryTx(txId: string) {
  if (historyDeleteConfirmId.value === txId) {
    deleteTransaction(historyModalTicker.value, txId)
    const h = getHolding(historyModalTicker.value)
    historyModalTransactions.value = [...(h?.transactions || [])].sort((a, b) => b.timestamp - a.timestamp)
    historyDeleteConfirmId.value = null
    ElMessage.success('交易已删除')
  } else {
    historyDeleteConfirmId.value = txId
    ElMessage.warning('再次点击确认删除')
    setTimeout(() => { if (historyDeleteConfirmId.value === txId) historyDeleteConfirmId.value = null }, 3000)
  }
}

function formatTxTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ══════════════════════════════════════════════════════════════════════════════
// 添加标的弹窗
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'AAVE']
const addTokenModalVisible = ref(false)
const addTokenSearch = ref('')

const addTokenAvailable = computed(() =>
  ALL_TOKENS.filter(t => !holdingsDirect.find(h => h.ticker === t) && t.toLowerCase().includes(addTokenSearch.value.toLowerCase()))
)

function selectAddToken(ticker: string) {
  addTicker(ticker)
  ElMessage.success(`${ticker} 已添加`)
  addTokenModalVisible.value = false
  addTokenSearch.value = ''
}

// ══════════════════════════════════════════════════════════════════════════════
// 删除标的弹窗
// ══════════════════════════════════════════════════════════════════════════════

const deleteModalVisible = ref(false)
const deleteModalTicker = ref('')

function openDeleteModal(ticker: string) {
  deleteModalTicker.value = ticker
  deleteModalVisible.value = true
}

function confirmDelete() {
  removeTicker(deleteModalTicker.value)
  ElMessage.success(`${deleteModalTicker.value} 已移除`)
  deleteModalVisible.value = false
}

// ══════════════════════════════════════════════════════════════════════════════
// 表格数据
// ══════════════════════════════════════════════════════════════════════════════

const tableData = computed(() => {
  return holdingsDirect.map(h => {
    const livePrice = livePrices[h.ticker]?.price || '0'
    const pnl = getHoldingPnL(h.ticker)
    const pnlPct = getHoldingPnLPercent(h.ticker)
    const currentValue = mul(h.qty, livePrice)
    return { ticker: h.ticker, qty: h.qty, avgCost: h.avgCost, currentPrice: livePrice, pnl, pnlPct, currentValue, txCount: h.transactions.length }
  })
})
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="spot-body">
      <!-- 顶部统计卡片 -->
      <div class="dashboard-section">
        <div class="stat-card">
          <div class="stat-label">净资产 (NAV)</div>
          <div class="stat-value primary">{{ formatUsd(nav) }}</div>
          <div class="stat-sub">持仓成本: {{ formatUsd(totalCostBasis) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">浮动盈亏</div>
          <div class="stat-value" :class="pnlClass(totalPnL)">{{ formatPnl(totalPnL) }}</div>
          <div class="stat-sub">{{ formatPnlPercent(totalPnL) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">资产配置</div>
          <div class="donut-wrapper">
            <div ref="donutRef" class="donut-chart"></div>
            <div v-if="donutData.length === 0" class="donut-empty">暂无持仓</div>
          </div>
        </div>
      </div>

      <!-- 实时价格墙 -->
      <div class="ticker-section">
        <div class="section-header">
          <span class="section-title">实时价格</span>
          <el-button size="small" type="primary" @click="addTokenModalVisible = true">
            <el-icon><Plus /></el-icon>添加标的
          </el-button>
        </div>
        <div class="ticker-grid">
          <div v-for="item in holdingsDirect" :key="item.ticker" class="ticker-item"
            :class="priceChangeClass(livePrices[item.ticker]?.change24h || 0)">
            <div class="ticker-symbol">{{ item.ticker }}</div>
            <div class="ticker-price">${{ formatPrice(livePrices[item.ticker]?.price) }}</div>
            <div class="ticker-change">{{ formatPriceChange(livePrices[item.ticker]?.change24h || 0) }}</div>
          </div>
        </div>
      </div>

      <!-- 持仓明细表格 -->
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
                <td class="col-asset"><span class="asset-name">{{ row.ticker }}</span></td>
                <td class="col-qty"><span class="mono">{{ formatQty(row.qty) }}</span></td>
                <td class="col-cost"><span class="mono">${{ formatPrice(row.avgCost) }}</span></td>
                <td class="col-price">
                  <span class="mono" :class="priceChangeClass(livePrices[row.ticker]?.change24h || 0)">
                    ${{ formatPrice(row.currentPrice) }}
                  </span>
                </td>
                <td class="col-value"><span class="mono">{{ formatUsd(row.currentValue) }}</span></td>
                <td class="col-pnl">
                  <div class="pnl-cell" :class="pnlClass(row.pnl)">
                    <span class="pnl-value">{{ formatPnl(row.pnl) }}</span>
                    <span class="pnl-pct">{{ formatPnlPercent(row.pnlPct) }}</span>
                  </div>
                </td>
                <td class="col-actions">
                  <div class="action-buttons">
                    <el-button type="primary" size="small" @click="openTxModal(row.ticker)">记录</el-button>
                    <el-button type="info" size="small" plain @click="openHistoryModal(row.ticker)">历史 ({{ row.txCount }})</el-button>
                    <el-button type="danger" size="small" plain @click="openDeleteModal(row.ticker)">删除</el-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════════
         交易记录弹窗
         ══════════════════════════════════════════════════════════════════════════ -->
    <el-dialog v-model="txModalVisible" :title="`记录交易 - ${txModalTicker}`" width="480px" :close-on-click-modal="false">
      <div class="tx-form">
        <div class="form-row">
          <label>方向</label>
          <el-radio-group v-model="txSide" size="large">
            <el-radio-button value="buy">买入</el-radio-button>
            <el-radio-button value="sell">卖出</el-radio-button>
          </el-radio-group>
        </div>

        <div class="form-row">
          <label>价格 (USDT)</label>
          <div class="price-row">
            <el-input v-model="txPriceInput" type="number" placeholder="0.00" :precision="8" step="0.01" />
            <el-button size="small" @click="useLivePrice" type="primary" plain>使用现价</el-button>
          </div>
        </div>

        <div class="form-row">
          <label>输入模式</label>
          <el-radio-group v-model="txInputMode" size="small">
            <el-radio-button value="qty">数量 → 金额</el-radio-button>
            <el-radio-button value="amount">金额 → 数量</el-radio-button>
          </el-radio-group>
        </div>

        <div class="form-row" v-if="txInputMode === 'qty'">
          <label>数量 ({{ txModalTicker }}) <span class="hint">当前: {{ txModalCurrentQty }}</span></label>
          <el-input v-model="txQtyInput" type="number" placeholder="0.00000000" :precision="8" step="0.00000001" />
        </div>

        <div class="form-row" v-if="txInputMode === 'amount'">
          <label>金额 (USDT)</label>
          <el-input v-model="txAmountInput" type="number" placeholder="0.00" :precision="4" step="0.01" />
        </div>

        <div class="form-row calculated">
          <label>{{ txInputMode === 'qty' ? '金额 (USDT)' : `数量 (${txModalTicker})` }}</label>
          <div class="calc-value">{{ txInputMode === 'qty' ? (txAmountInput || '0.0000') : (txQtyInput || '0.00000000') }}</div>
        </div>

        <div v-if="txError" class="error-msg">
          <el-icon><WarningFilled /></el-icon> {{ txError }}
        </div>
      </div>
      <template #footer>
        <el-button @click="txModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmTx">{{ txSide === 'buy' ? '记录买入' : '记录卖出' }}</el-button>
      </template>
    </el-dialog>

    <!-- ══════════════════════════════════════════════════════════════════════════
         历史记录弹窗
         ══════════════════════════════════════════════════════════════════════════ -->
    <el-dialog v-model="historyModalVisible" :title="`交易历史 - ${historyModalTicker}`" width="720px">
      <el-table :data="historyModalTransactions" stripe size="small" v-if="historyModalTransactions.length > 0">
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTxTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column label="方向" width="80">
          <template #default="{ row }">
            <el-tag :type="row.side === 'buy' ? 'success' : 'danger'" size="small">
              {{ row.side === 'buy' ? '买入' : '卖出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="价格 (USDT)" width="120">
          <template #default="{ row }">{{ formatDisplay(row.price) }}</template>
        </el-table-column>
        <el-table-column label="数量" width="140">
          <template #default="{ row }">{{ formatDisplay(row.qty, 8) }}</template>
        </el-table-column>
        <el-table-column label="金额 (USDT)" width="120">
          <template #default="{ row }">{{ formatDisplay(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button :type="historyDeleteConfirmId === row.id ? 'danger' : 'info'" :danger="historyDeleteConfirmId === row.id" size="small" @click="deleteHistoryTx(row.id)">
              {{ historyDeleteConfirmId === row.id ? '确认删除' : '删除' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="empty-state">
        <p>暂无交易记录</p>
      </div>
      <template #footer>
        <el-button @click="historyModalVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ══════════════════════════════════════════════════════════════════════════
         添加标的弹窗
         ══════════════════════════════════════════════════════════════════════════ -->
    <el-dialog v-model="addTokenModalVisible" title="添加标的" width="400px">
      <div class="add-token-form">
        <el-input v-model="addTokenSearch" placeholder="搜索..." prefix-icon="Search" clearable />
        <div class="token-list">
          <div v-for="ticker in addTokenAvailable" :key="ticker" class="token-item" @click="selectAddToken(ticker)">
            <span class="token-symbol">{{ ticker }}</span>
          </div>
          <div v-if="addTokenAvailable.length === 0" class="empty-result">
            <p v-if="addTokenSearch">没有匹配 "{{ addTokenSearch }}"</p>
            <p v-else>所有可选标的已添加</p>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ══════════════════════════════════════════════════════════════════════════
         删除确认弹窗
         ══════════════════════════════════════════════════════════════════════════ -->
    <el-dialog v-model="deleteModalVisible" title="确认删除" width="400px">
      <p>确定删除 <strong>{{ deleteModalTicker }}</strong> 及其所有交易记录？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="deleteModalVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.workspace { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--el-bg-color); }
.spot-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }

.dashboard-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.stat-card { background: var(--el-fill-color-light); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.stat-label { font-size: 13px; color: var(--el-text-color-secondary); font-weight: 500; }
.stat-value { font-size: 28px; font-weight: 700; font-family: var(--el-font-family); color: var(--el-text-color-primary); }
.stat-value.primary { color: var(--el-color-primary); }
.stat-value.pnl-positive { color: var(--el-color-success); }
.stat-value.pnl-negative { color: var(--el-color-danger); }
.stat-sub { font-size: 12px; color: var(--el-text-color-secondary); }

.donut-wrapper { position: relative; height: 140px; }
.donut-chart { width: 100%; height: 100%; }
.donut-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--el-text-color-secondary); font-size: 13px; }

.ticker-section { background: var(--el-fill-color-light); border-radius: 12px; padding: 16px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-title { font-size: 15px; font-weight: 600; color: var(--el-text-color-primary); }
.ticker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.ticker-item { background: var(--el-bg-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--el-border-color-light); transition: border-color 0.2s; cursor: pointer; }
.ticker-item:hover { border-color: var(--el-border-color); }
.ticker-symbol { font-weight: 600; font-size: 13px; color: var(--el-text-color-primary); }
.ticker-price { font-size: 15px; font-weight: 600; font-family: var(--el-font-family); color: var(--el-text-color-primary); }
.ticker-change { font-size: 12px; color: var(--el-text-color-secondary); }
.ticker-item.price-up .ticker-change, .ticker-item.price-up .ticker-price { color: var(--el-color-success); }
.ticker-item.price-down .ticker-change, .ticker-item.price-down .ticker-price { color: var(--el-color-danger); }

.table-section { background: var(--el-fill-color-light); border-radius: 12px; padding: 16px; }
.table-wrapper { overflow-x: auto; }
.holdings-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.holdings-table th, .holdings-table td { padding: 12px 8px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); }
.holdings-table th { font-weight: 600; color: var(--el-text-color-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.holdings-table tbody tr:hover { background: var(--el-fill-color-lighter); }
.asset-name { font-weight: 700; color: var(--el-color-primary); }
.mono { font-family: var(--el-font-family); }
.col-qty, .col-cost, .col-price, .col-value, .col-pnl { text-align: right; }
.pnl-cell { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.pnl-value { font-weight: 600; font-family: var(--el-font-family); }
.pnl-pct { font-size: 11px; opacity: 0.8; }
.pnl-positive .pnl-value, .pnl-positive.pnl-value { color: var(--el-color-success); }
.pnl-negative .pnl-value, .pnl-negative.pnl-value { color: var(--el-color-danger); }
.pnl-cell.pnl-positive .pnl-pct { color: var(--el-color-success); }
.pnl-cell.pnl-negative .pnl-pct { color: var(--el-color-danger); }
.price-up { color: var(--el-color-success) !important; }
.price-down { color: var(--el-color-danger) !important; }
.col-actions { text-align: center; }
.action-buttons { display: flex; gap: 4px; justify-content: center; }

/* 弹窗表单 */
.tx-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-row > label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); display: flex; align-items: center; gap: 8px; }
.hint { font-weight: 400; color: var(--el-text-color-secondary); font-size: 12px; }
.price-row { display: flex; gap: 8px; }
.price-row .el-input { flex: 1; }
.calculated { padding: 12px; background: var(--el-fill-color-light); border-radius: 8px; }
.calc-value { font-size: 18px; font-weight: 600; color: var(--el-color-primary); font-family: var(--el-font-family); }
.error-msg { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: var(--el-color-danger-light-9); color: var(--el-color-danger); border-radius: 6px; font-size: 13px; }

.add-token-form { display: flex; flex-direction: column; gap: 16px; }
.token-list { max-height: 300px; overflow-y: auto; border: 1px solid var(--el-border-color); border-radius: 8px; }
.token-item { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; }
.token-item:hover { background: var(--el-fill-color-light); }
.token-item:not(:last-child) { border-bottom: 1px solid var(--el-border-color-light); }
.token-symbol { font-weight: 600; font-size: 14px; }
.empty-result { padding: 24px; text-align: center; color: var(--el-text-color-secondary); }
.empty-result p { margin: 0; font-size: 13px; }
.empty-state { padding: 48px; text-align: center; color: var(--el-text-color-secondary); }

@media (max-width: 1024px) { .dashboard-section { grid-template-columns: 1fr 1fr; } }
@media (max-width: 768px) { .dashboard-section { grid-template-columns: 1fr; } .ticker-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); } }
</style>
