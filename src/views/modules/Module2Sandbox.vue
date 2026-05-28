<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRiskWorkspace } from '../../composables/useRiskWorkspace'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'
import type { EthOptionsChainApiItem } from '../../types/account'

const {
  groups,
  addGroup,
  removeGroup,
  updateGroup,
  resetGroups,
  options,
  fetchDates,
  fetchChain,
} = useRiskWorkspace()

// ── 交易基因 ────────────────────────────────────────────────────────────────
const geneLoading = ref(false)
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

async function fetchGene() {
  geneLoading.value = true
  try {
    const data = await request.get<typeof geneForm>('/api/v1/config')
    Object.assign(geneForm, data)
  } catch { /* 接口未通时保持默认值 */ }
  finally { geneLoading.value = false }
}

async function handleGeneSave() {
  try {
    await request.post('/api/v1/config/save', { ...geneForm })
    ElMessage.success('交易基因参数已保存')
  } catch { /* handled by interceptor */ }
}

// ── 期权链：根据日期获取列表 ─────────────────────────────────────────────────
function getChain(date: string): EthOptionsChainApiItem[] {
  return (options.chainMap[date] ?? []) as unknown as EthOptionsChainApiItem[]
}

// ── 方向样式 ────────────────────────────────────────────────────────────────
const dirStyle = (d: string) => ({ '--dir-color': d === 'buy' ? '#52c41a' : '#ff4d4f' } as const)

onMounted(() => {
  fetchGene()
  fetchDates()
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

    <!-- ── 策略组列表 ── -->
    <div class="groups-list">
      <transition-group name="group-slide" tag="div">
        <div v-for="(group, idx) in groups" :key="group.id" class="group-card" :style="dirStyle(group.direction)">
          <!-- 组头部 -->
          <div class="group-header">
            <span class="group-title">策略 {{ idx + 1 }}</span>
            <el-button size="small" type="danger" plain circle @click="removeGroup(group.id)">
              ✕
            </el-button>
          </div>

          <!-- 日期 + 期权选择 -->
          <div class="group-row">
            <div class="field">
              <span class="field-label">日期</span>
              <el-select :model-value="group.expiry" size="small" placeholder="选择日期" clearable filterable
                :loading="options.datesLoading"
                @update:model-value="(v: string) => { updateGroup(group.id, { expiry: v, optionName: '' }); if (v) fetchChain(v) }">
                <el-option v-for="d in options.dates" :key="d" :label="d" :value="d" />
              </el-select>
            </div>
            <div class="field flex-2">
              <span class="field-label">期权列表</span>
              <el-select :model-value="group.optionName" size="small" placeholder="先选日期" clearable filterable
                :disabled="!group.expiry || options.chainLoading" :loading="options.chainLoading && !!group.expiry"
                @update:model-value="(v: string) => updateGroup(group.id, { optionName: v })">
                <el-option v-for="opt in getChain(group.expiry)" :key="opt.symbol" :label="opt.symbol"
                  :value="opt.symbol">
                  <span class="opt-symbol">{{ opt.symbol }}</span>
                  <!-- delta -->
                  <span class="opt-iv"> Delta {{ opt.greeks.delta.toFixed(4) }}</span>
                  <!-- gamma -->
                  <!-- <span class="opt-gamma">Gamma {{ opt.greeks.gamma.toFixed(6) }}</span> -->
                  <!-- vega -->
                  <!-- <span class="opt-vega">Vega {{ opt.greeks.vega.toFixed(2) }}</span> -->
                  <!-- theta -->
                  <span class="opt-iv"> Theta {{ opt.greeks.theta.toFixed(4) }}</span>
                  <span class="opt-iv">IV {{ opt.greeks.mark_iv.toFixed(1) }}%</span>
                </el-option>
              </el-select>
            </div>
          </div>

          <!-- 方向 + 数量 -->
          <div class="group-row">
            <div class="field">
              <span class="field-label">方向</span>
              <el-radio-group :model-value="group.direction" size="small"
                @update:model-value="updateGroup(group.id, { direction: $event })">
                <el-radio-button value="buy">
                  <span class="dir-text buy">🟢 买入</span>
                </el-radio-button>
                <el-radio-button value="sell">
                  <span class="dir-text sell">🔴 卖出</span>
                </el-radio-button>
              </el-radio-group>
            </div>
            <div class="field">
              <span class="field-label">数量</span>
              <el-input-number :model-value="group.size" :min="0.1" :max="100" :step="0.1" :precision="1" size="small"
                controls-position="right" @update:model-value="updateGroup(group.id, { size: $event as number })" />
            </div>
          </div>
        </div>
      </transition-group>

      <!-- 空状态 -->
      <div v-if="groups.length === 0" class="empty-state">
        <span>暂无策略</span>
        <span>点击下方按钮添加</span>
      </div>
    </div>

    <!-- 添加策略 -->
    <el-button class="add-btn" type="primary" plain size="small" @click="addGroup">
      + 添加策略
    </el-button>

    <!-- 控制按钮 -->
    <div class="controls">
      <el-button size="small" @click="resetGroups">🔄 重置</el-button>
      <el-button type="primary" size="small">🚀 开始全矩阵风险评估</el-button>
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

/* ── Groups ── */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-card {
  background: var(--el-fill-color-light);
  border: 1.5px solid var(--dir-color, var(--el-border-color));
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--dir-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.group-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.field.flex-2 {
  flex: 2;
}

.field .el-select {
  width: 100%;
}

.field .el-input-number {
  width: 100%;
}

.field-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
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

/* 期权下拉选项 */
.opt-symbol {
  font-size: 12px;
  font-weight: 600;
  margin-right: 8px;
}

.opt-strike {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.opt-iv {
  font-size: 12px;
  color: var(--el-text-color-disabled);
  padding: 0 10px;
}

/* ── Empty ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100px;
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
.group-slide-enter-active,
.group-slide-leave-active {
  transition: all 0.25s ease;
}

.group-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.group-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
