<template>
  <div class="workspace">
    <AppHeader />
    <div class="us-stock-body" v-loading="loading">

      <!-- 顶部统计卡片 -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">总成本</div>
          <div class="stat-value primary">${{ formatNav(totalCost) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">浮动盈亏</div>
          <div class="stat-value" :class="totalPnlClass">{{ formatPnl(totalPnl) }}</div>
          <div class="stat-sub" :class="totalPnlClass">{{ formatPnlPct(totalPnlPct) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">标的数量</div>
          <div class="stat-value">{{ stocks.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">更新时间</div>
          <div class="stat-value" style="font-size: 14px; font-weight: 500;">{{ updateTime || '--' }}</div>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button type="primary" size="small" @click="openAddDialog">
          <el-icon>
            <Plus />
          </el-icon>添加标的
        </el-button>
        <el-button size="small" @click="refreshPrices">
          <el-icon>
            <Refresh />
          </el-icon>刷新价格
        </el-button>
        <span v-if="loading" class="loading-tip">正在请求价格...</span>
      </div>

      <!-- 持仓卡片网格 -->
      <div class="stocks-grid" v-if="displayStocks.length > 0">
        <div v-for="item in displayStocks" :key="item.ticker" class="stock-card" :class="item.pnlClass">
          <div class="card-header">
            <span class="ticker-name">{{ item.ticker }}</span>
            <div class="card-actions">
              <button class="icon-btn" @click="openEditDialog(item)" title="编辑">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="icon-btn danger" @click="openDeleteDialog(item.ticker)" title="删除">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
                </svg>
              </button>
            </div>
          </div>

          <div class="card-body">
            <div class="price-row">
              <span class="price-label">现价</span>
              <span class="price-val">${{ formatPrice(item.currentPrice) }}</span>
            </div>
            <div class="price-row">
              <span class="price-label">成本</span>
              <span class="price-val muted">${{ formatPrice(item.costPrice) }}</span>
            </div>
            <div class="price-row">
              <span class="price-label">数量</span>
              <span class="price-val muted">{{ formatQty(item.quantity) }}</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="pnl-row">
              <span class="pnl-label">盈亏</span>
              <span class="pnl-val" :class="item.pnlClass">${{ formatPnl(item.pnl) }}</span>
            </div>
            <div class="pnl-row">
              <span class="pnl-label">收益率</span>
              <span class="pnl-badge" :class="item.pnlClass">{{ formatPnlPct(item.pnlPct) }}</span>
            </div>
          </div>

          <div class="card-error" v-if="item.msg">
            <el-icon>
              <Warning />
            </el-icon>{{ item.msg }}
          </div>
        </div>
      </div>

      <el-empty v-else-if="!loading" description="暂无持仓，请点击上方「添加标的」添加" />

      <!-- 持仓明细表格 -->
      <div class="table-card" v-if="displayStocks.length > 0">
        <div class="table-card-title">持仓明细</div>
        <el-table :data="displayStocks" size="small" stripe table-layout="auto">
          <el-table-column prop="ticker" label="标的" width="90" align="center">
            <template #default="{ row }">
              <el-tag type="primary" effect="dark" size="small">{{ row.ticker }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建日期" width="100" align="center">
            <template #default="{ row }">
              <span class="muted">{{ row.createdAt }}</span>
            </template>
          </el-table-column>
          <el-table-column label="数量" align="center">
            <template #default="{ row }">{{ formatQty(row.quantity) }}</template>
          </el-table-column>
          <el-table-column label="成本价" align="center">
            <template #default="{ row }">${{ formatPrice(row.costPrice) }}</template>
          </el-table-column>
          <el-table-column label="现价" align="center">
            <template #default="{ row }">
              <span v-if="row.currentPrice !== null">${{ formatPrice(row.currentPrice) }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="浮动盈亏" align="center">
            <template #default="{ row }">
              <span :class="['table-pnl', row.pnlClass]">
                ${{ row.currentPrice !== null ? formatPnl(row.pnl) : '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="收益率" align="center">
            <template #default="{ row }">
              <span v-if="row.currentPrice !== null" :class="['table-pct', row.pnlClass]">
                {{ formatPnlPct(row.pnlPct) }}
              </span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" align="center">
            <template #default="{ row }">
              <span class="muted" v-if="row.note">{{ row.note }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-space size="small">
                <el-button type="primary" size="small" plain @click="openEditDialog(row)">编辑</el-button>
                <el-button type="danger" size="small" plain @click="openDeleteDialog(row.id)">删除</el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 添加 / 编辑弹窗 -->
    <el-dialog v-model="formDialog.visible" :title="formDialog.isEdit ? `编辑标的 - ${formDialog.ticker}` : '添加标的'"
      width="440px" :close-on-click-modal="false">
      <div class="form-body">
        <div class="form-row">
          <label>标的代码 <span class="required">*</span></label>
          <el-input v-model="formDialog.ticker" placeholder="如 AAPL、NVDA、TSLA" :disabled="formDialog.isEdit"
            maxlength="10" @input="formDialog.ticker = formDialog.ticker.toUpperCase(); syncQuantity()" />
        </div>
        <div class="form-row">
          <label>成本价 (USD) <span class="required">*</span></label>
          <el-input-number v-model="formDialog.costPrice" :min="0" :precision="4" :step="1" placeholder="0.0000"
            style="width: 100%;" @change="syncQuantity()" />
        </div>
        <div class="form-row">
          <label>总费用 (USD) <span class="required">*</span></label>
          <el-input-number v-model="formDialog.totalAmount" :min="0" :precision="4" :step="1" placeholder="输入总费用，自动计算数量"
            style="width: 100%;" @change="syncQuantity()" />
        </div>
        <div class="form-row computed">
          <label>计算数量</label>
          <div class="calc-value">{{ formDialog.quantity > 0 ? formatQty(formDialog.quantity) : '—' }}</div>
        </div>
        <div class="form-row">
          <label>备注 (可选)</label>
          <el-input v-model="formDialog.note" placeholder="如 2025-01 买入、长期持有等" maxlength="100" />
        </div>
        <div v-if="formDialog.error" class="form-error">{{ formDialog.error }}</div>
      </div>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="confirmFormDialog">保存</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认弹窗 -->
    <el-dialog v-model="deleteDialog.visible" title="确认删除" width="380px">
      <p>确定删除 <strong>{{ deleteDialog.ticker }}</strong> 持仓记录？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="deleteDialog.visible = false">取消</el-button>
        <el-button type="danger" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import request from '../utils/request'

// ── 类型 ─────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string
  ticker: string
  costPrice: number
  quantity: number
  note?: string
  createdAt: string
}

interface StockDisplay extends StockItem {
  currentPrice: number | null
  currentValue: number
  pnl: number
  pnlPct: number
  pnlClass: string
  msg?: string
}

interface ApiPriceItem {
  ticker: string
  close: number | null
  date: string | null
  msg?: string
}

// ── 数据状态 ─────────────────────────────────────────────────────────────────

// 硬编码持仓数据 —— 可在此处增删标的
const stocks = ref<StockItem[]>([
  { id: '1', ticker: 'AAPL', costPrice: 175.50, quantity: 50,   note: '2025-01 长持', createdAt: '2025-01-15' },
  { id: '2', ticker: 'NVDA', costPrice: 480.00, quantity: 10,   note: '',             createdAt: '2025-02-20' },
  { id: '3', ticker: 'TSLA', costPrice: 220.00, quantity: 20,   note: '2024-06 买入', createdAt: '2024-06-10' },
])

const livePrices = ref<Record<string, ApiPriceItem>>({})
const loading = ref(false)
const updateTime = ref('')

// ── 计算属性 ─────────────────────────────────────────────────────────────────

const displayStocks = computed<StockDisplay[]>(() => {
  return stocks.value.map(s => {
    const apiData = livePrices.value[s.ticker]
    const currentPrice = apiData?.close ?? null
    const currentValue = currentPrice !== null ? currentPrice * s.quantity : 0
    const totalCost = s.costPrice * s.quantity
    const pnl = currentPrice !== null ? currentValue - totalCost : 0
    const pnlPct = totalCost > 0 && currentPrice !== null ? (pnl / totalCost) * 100 : 0
    let pnlClass = ''
    if (currentPrice !== null) {
      pnlClass = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : ''
    }
    return {
      ...s,
      currentPrice,
      currentValue,
      pnl,
      pnlPct,
      pnlClass,
      msg: apiData?.msg,
    }
  })
})

const totalCurrentValue = computed(() => displayStocks.value.reduce((sum, s) => sum + s.currentValue, 0))
const totalCost = computed(() => stocks.value.reduce((sum, s) => sum + s.costPrice * s.quantity, 0))
const totalPnl = computed(() => totalCurrentValue.value - totalCost.value)
const totalPnlPct = computed(() => totalCost.value > 0 ? (totalPnl.value / totalCost.value) * 100 : 0)

function totalPnlClass(): string {
  if (totalPnl.value > 0) return 'profit'
  if (totalPnl.value < 0) return 'loss'
  return ''
}

// ── 格式化 ───────────────────────────────────────────────────────────────────

function formatPrice(v: number | null): string {
  if (v === null) return '--'
  return v.toFixed(2)
}

function formatNav(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatQty(v: number): string {
  return v.toFixed(4)
}

function formatPnl(v: number): string {
  const prefix = v > 0 ? '+' : ''
  return prefix + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPnlPct(v: number): string {
  const prefix = v > 0 ? '+' : ''
  return prefix + v.toFixed(2) + '%'
}

// ── 请求价格 ─────────────────────────────────────────────────────────────────

async function refreshPrices() {
  if (stocks.value.length === 0) return
  loading.value = true
  try {
    const tickers = stocks.value.map(s => s.ticker)
    const res: any = await request.post('/api/v1/market/us-stock/prices', { tickers })
    if (res?.data && Array.isArray(res.data)) {
      const map: Record<string, ApiPriceItem> = {}
      for (const item of res.data as ApiPriceItem[]) {
        map[item.ticker] = item
      }
      livePrices.value = map
      updateTime.value = new Date().toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    }
  } catch (e: any) {
    console.error('[UsStockPositions] refreshPrices error:', e)
    ElMessage.error(e.response?.data?.message || '价格请求失败')
  } finally {
    loading.value = false
  }
}

// ── 添加 / 编辑 ──────────────────────────────────────────────────────────────

const formDialog = ref({
  visible: false,
  isEdit: false,
  _id: '',
  ticker: '',
  costPrice: 0,
  quantity: 0,
  totalAmount: 0,
  note: '',
  error: '',
})

function syncQuantity() {
  const d = formDialog.value
  if (d.costPrice > 0 && d.totalAmount > 0) {
    d.quantity = parseFloat((d.totalAmount / d.costPrice).toFixed(4))
  } else {
    d.quantity = 0
  }
}

function openAddDialog() {
  formDialog.value = { visible: true, isEdit: false, _id: '', ticker: '', costPrice: 0, quantity: 0, totalAmount: 0, note: '', error: '' }
}

function openEditDialog(item: StockItem) {
  const amount = item.costPrice * item.quantity
  formDialog.value = {
    visible: true, isEdit: true,
    _id: item.id,
    ticker: item.ticker, costPrice: item.costPrice,
    quantity: item.quantity, totalAmount: parseFloat(amount.toFixed(4)),
    note: item.note || '', error: '',
  }
}

function validateForm(): boolean {
  const d = formDialog.value
  d.error = ''
  if (!d.ticker.trim()) { d.error = '请输入标的代码'; return false }
  if (d.costPrice <= 0) { d.error = '成本价必须大于 0'; return false }
  if (d.totalAmount <= 0) { d.error = '总费用必须大于 0'; return false }
  return true
}

function confirmFormDialog() {
  if (!validateForm()) return
  const d = formDialog.value
  const tickerUpper = d.ticker.trim().toUpperCase()
  const today = new Date().toISOString().slice(0, 10)
  if (d.isEdit) {
    const idx = stocks.value.findIndex(s => s.id === d._id)
    if (idx !== -1) {
      stocks.value[idx] = {
        ...stocks.value[idx],
        costPrice: d.costPrice,
        quantity: d.quantity,
        note: d.note.trim() || undefined,
      }
    }
  } else {
    const record: StockItem = {
      id: Date.now().toString(),
      ticker: tickerUpper,
      costPrice: d.costPrice,
      quantity: d.quantity,
      note: d.note.trim() || undefined,
      createdAt: today,
    }
    stocks.value.push(record)
  }
  d.visible = false
  ElMessage.success(d.isEdit ? `${tickerUpper} 已更新` : `${tickerUpper} 已添加`)
  refreshPrices()
}

// ── 删除 ────────────────────────────────────────────────────────────────────

const deleteDialog = ref({ visible: false, id: '', ticker: '' })

function openDeleteDialog(id: string) {
  const item = stocks.value.find(s => s.id === id)
  deleteDialog.value = { visible: true, id, ticker: item?.ticker ?? '' }
}

function confirmDelete() {
  const idx = stocks.value.findIndex(s => s.id === deleteDialog.value.id)
  if (idx !== -1) {
    const ticker = stocks.value[idx].ticker
    stocks.value.splice(idx, 1)
    delete livePrices.value[ticker]
  }
  deleteDialog.value.visible = false
  ElMessage.success(`已删除`)
}

// ── 生命周期 ─────────────────────────────────────────────────────────────────

onMounted(() => {
  refreshPrices()
})
</script>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--el-bg-color);
}

.us-stock-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 统计行 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--el-border-color-light);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.stat-card {
  background: var(--el-fill-color);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--el-font-family);
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.stat-value.primary {
  color: var(--el-color-primary);
}

.stat-value.profit {
  color: #22c55e;
}

.stat-value.loss {
  color: #ef4444;
}

.stat-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.stat-sub.profit {
  color: #22c55e;
}

.stat-sub.loss {
  color: #ef4444;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 持仓卡片网格 */
.stocks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.stock-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}

.stock-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--el-border-color);
  transition: background 0.2s;
}

.stock-card.profit::before {
  background: #22c55e;
}

.stock-card.loss::before {
  background: #ef4444;
}

.stock-card.profit {
  border-color: rgba(34, 197, 94, 0.3);
}

.stock-card.loss {
  border-color: rgba(239, 68, 68, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticker-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.03em;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
}

.icon-btn:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.icon-btn.danger:hover {
  color: var(--el-color-danger);
  background: var(--el-fill-color);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px solid var(--el-border-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 8px 0;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.price-label {
  color: var(--el-text-color-secondary);
}

.price-val {
  font-weight: 600;
  font-family: var(--el-font-family);
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.price-val.muted {
  color: var(--el-text-color-secondary);
}

.card-footer {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pnl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pnl-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.pnl-val {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--el-font-family);
  color: var(--el-text-color-primary);
}

.pnl-badge {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--el-font-family);
  padding: 2px 7px;
  border-radius: 20px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.pnl-badge.profit {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.pnl-badge.loss {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.profit {
  color: #22c55e !important;
}

.loss {
  color: #ef4444 !important;
}

.card-error {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--el-color-warning);
  background: rgba(230, 162, 60, 0.1);
  padding: 5px 8px;
  border-radius: 4px;
}

/* 表格 */
.table-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 14px;
  flex: 1;
}

.table-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.table-pnl {
  font-weight: 600;
  font-family: var(--el-font-family);
}

.table-pct {
  font-weight: 700;
  font-family: var(--el-font-family);
  font-size: 13px;
}

.muted {
  color: var(--el-text-color-disabled);
}

/* 弹窗表单 */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.required {
  color: var(--el-color-danger);
}

.form-error {
  padding: 8px 12px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border-radius: 6px;
  font-size: 13px;
}

.form-row.computed {
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-light);
}

@media (max-width: 1100px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .stocks-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
