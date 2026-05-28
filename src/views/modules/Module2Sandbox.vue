<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRiskWorkspace, type Leg } from '../../composables/useRiskWorkspace'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const { legs, addLeg, removeLeg, updateLeg, resetSandbox, commitSandbox } =
  useRiskWorkspace()

const symbols = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'SOL-27JUN25', 'BTC-27JUN25']
const expiries = ['25JUN25', '27JUN25', '25SEP25', '26DEC25']

const selectedSymbol = ref('BTC-PERP')
const selectedExpiry = ref('27JUN25')

// ── 交易基因表单 ────────────────────────────────────────────────────────────────
const geneForm = reactive({
  baseline_equity: 0,
  max_total_drawdown_pct: 0,
  monthly_loss_limit: 0,
  max_daily_drawdown_pct: 0,
  extreme_iv_ceiling: 0,
  extreme_iv_shift: 0,
})

const geneFields = [
  { key: 'baseline_equity', label: '账户净值 (USD)', suffix: '', step: 100, min: 0, decimals: 2, readonly: true },
  { key: 'max_total_drawdown_pct', label: '总资产最大回撤', suffix: '%', step: 0.5, min: 0, decimals: 1, readonly: false },
  { key: 'monthly_loss_limit', label: '月度亏损限额 (USD)', suffix: '', step: 500, min: 0, decimals: 2, readonly: false },
  { key: 'max_daily_drawdown_pct', label: '每日最大回撤', suffix: '%', step: 0.5, min: 0, decimals: 1, readonly: false },
  { key: 'extreme_iv_ceiling', label: '极端 IV', suffix: '', step: 5, min: 0, decimals: 1, readonly: false },
  { key: 'extreme_iv_shift', label: '极端 IV 波动', suffix: '%', step: 5, min: 0, decimals: 1, readonly: false },
] as const

const geneLoading = ref(false)

async function fetchGene() {
  geneLoading.value = true
  try {
    const data = await request.get<typeof geneForm>('/api/v1/config')
    Object.assign(geneForm, data)
  } catch {
    // 接口未通时保持默认值
  } finally {
    geneLoading.value = false
  }
}

async function handleGeneSave() {
  try {
    await request.post('/api/v1/config/save', { ...geneForm })
    ElMessage.success('交易基因参数已保存')
  } catch {
    // error already handled by interceptor
  }
}

onMounted(() => fetchGene())

// ── Leg helpers ──────────────────────────────────────────────────────────────
const ivHint = (leg: Leg) => {
  const labels: Record<string, string> = { low: 'Low IV', mid: 'Mid IV', high: 'High IV' }
  return `${labels[leg.ivStatus] ?? '—'} · 摩擦成本 ≈ ${(leg.liquidityCost * 100).toFixed(1)} bps`
}

const directionStyle = (d: string) => ({
  '--dir-color': d === 'buy' ? '#52c41a' : '#ff4d4f',
})
</script>

<template>
  <div class="module2">
    <div class="section-title">
      <span class="dot orange"></span>
      Strategy Sandbox
    </div>

    <!-- ── 交易基因 ── -->
    <div class="card" v-loading="geneLoading">
      <div class="card-title">交易基因</div>
      <div class="gene-grid">
        <div v-for="field in geneFields" :key="field.key" class="gene-field">
          <label class="gene-label">{{ field.label }}</label>
          <div class="gene-input-row">
            <el-input-number v-model="(geneForm as any)[field.key]" :min="field.min" :step="field.step"
              :precision="field.decimals" size="small" controls-position="right"
              :disabled="geneLoading || field.readonly" />
            <span v-if="field.suffix" class="gene-suffix">{{ field.suffix }}</span>
          </div>
        </div>
      </div>
      <div class="gene-save">
        <el-button type="primary" size="small" :loading="geneLoading" @click="handleGeneSave">
          保存参数
        </el-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-select v-model="selectedSymbol" size="small" placeholder="Select Symbol">
        <el-option v-for="s in symbols" :key="s" :label="s" :value="s" />
      </el-select>
      <el-select v-model="selectedExpiry" size="small" placeholder="Expiry">
        <el-option v-for="e in expiries" :key="e" :label="e" :value="e" />
      </el-select>
    </div>

    <!-- Legs -->
    <div class="legs-container">
      <transition-group name="leg-slide" tag="div" class="legs-list">
        <div v-for="(leg, idx) in legs" :key="leg.id" class="leg-card" :style="directionStyle(leg.direction)">
          <div class="leg-header">
            <span class="leg-index">Leg {{ idx + 1 }}</span>
            <el-button size="small" type="danger" plain circle @click="removeLeg(leg.id)">
              ✕
            </el-button>
          </div>

          <!-- Direction -->
          <div class="leg-row">
            <span class="leg-label">方向</span>
            <el-radio-group :model-value="leg.direction" size="small"
              @update:model-value="updateLeg(leg.id, { direction: $event })">
              <el-radio-button value="buy">
                <span class="dir-text buy">🟢 Buy</span>
              </el-radio-button>
              <el-radio-button value="sell">
                <span class="dir-text sell">🔴 Sell</span>
              </el-radio-button>
            </el-radio-group>
          </div>

          <!-- Type -->
          <div class="leg-row">
            <span class="leg-label">类型</span>
            <el-radio-group :model-value="leg.type" size="small"
              @update:model-value="updateLeg(leg.id, { type: $event })">
              <el-radio-button value="call">Call</el-radio-button>
              <el-radio-button value="put">Put</el-radio-button>
            </el-radio-group>
          </div>

          <!-- Strike + Size -->
          <!-- <div class="leg-row">
            <span class="leg-label">Strike</span>
            <el-input-number :model-value="leg.strike" size="small" :min="1000" :max="200000" :step="500" :precision="0"
              @update:model-value="updateLeg(leg.id, { strike: $event as number })" />
          </div> -->
          <div class="leg-row">
            <span class="leg-label">Size</span>
            <el-input-number :model-value="leg.size" size="small" :min="0.1" :max="100" :step="0.1" :precision="1"
              @update:model-value="updateLeg(leg.id, { size: $event as number })" />
          </div>

          <!-- IV hint -->
          <div class="iv-hint">{{ ivHint(leg) }}</div>
        </div>
      </transition-group>

      <div v-if="legs.length === 0" class="empty-state">
        <span>暂无策略腿</span>
        <span>点击下方按钮添加</span>
      </div>
    </div>

    <!-- Add leg -->
    <el-button class="add-btn" type="primary" plain size="small" @click="addLeg">
      + 添加 Leg
    </el-button>

    <!-- Controls -->
    <div class="controls">
      <el-button size="small" @click="resetSandbox">🔄 重置沙盒</el-button>
      <el-button type="primary" size="small" @click="commitSandbox">
        🚀 开始全矩阵风险评估
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.module2 {
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

.dot.orange {
  background: #faad14;
}

/* ── Card ── */
.card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-left: 3px solid #faad14;
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

/* ── Gene form ── */
.gene-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  margin-bottom: 12px;
}

.gene-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gene-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.gene-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gene-input-row .el-input-number {
  width: 100%;
}

.gene-suffix {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.gene-save {
  display: flex;
  justify-content: flex-end;
}

/* ── Filters ── */
.filter-bar {
  display: flex;
  gap: 8px;
}

.legs-container {
  flex: 1;
}

.legs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leg-card {
  background: var(--el-fill-color-light);
  border: 1.5px solid var(--dir-color, var(--el-border-color));
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s;
}

.leg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.leg-index {
  font-size: 11px;
  font-weight: 700;
  color: var(--dir-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.leg-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.leg-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  width: 40px;
  flex-shrink: 0;
}

.dir-text {
  font-size: 12px;
}

.dir-text.buy {
  color: #52c41a;
}

.dir-text.sell {
  color: #ff4d4f;
}

.iv-hint {
  font-size: 10px;
  color: var(--el-text-color-disabled);
  padding-left: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 120px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.add-btn {
  width: 100%;
}

.controls {
  display: flex;
  gap: 8px;
}

.controls .el-button {
  flex: 1;
}

/* Transition */
.leg-slide-enter-active,
.leg-slide-leave-active {
  transition: all 0.25s ease;
}

.leg-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.leg-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
