<script setup lang="ts">
import { ref, computed } from 'vue'
import AppHeader from '../components/AppHeader.vue'

function getDaysFromToday(targetDate: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff)
}

// 输入
const shortDays = ref(30)
const shortIV = ref(20)
const longDays = ref(60)
const longIV = ref(28)

const showResult = ref(false)
const spResultVisible = ref(false)

// 计算
const longT = computed(() => longDays.value / 365)
const shortT = computed(() => shortDays.value / 365)

const fwdIV = computed(() => {
  // 输入 IV 是百分数（28 = 28%），转为小数（0.28）参与计算
  const shortIV_d = shortIV.value / 100
  const longIV_d = longIV.value / 100
  const a = longIV_d * longIV_d * longT.value
  const b = shortIV_d * shortIV_d * shortT.value
  if (a < b) return null
  return Math.sqrt((a - b) / (longT.value - shortT.value)) * 100
})

// FWD_IV / 长期 ATM IV 倍数
const ratio = computed(() => {
  if (fwdIV.value === null) return null
  return fwdIV.value / longIV.value
})

const aa = ref(1)

const diag = computed(() => {
  if (fwdIV.value === null) return { labels: [] as string[], colors: [] as string[] }
  const r = ratio.value!
  const list: string[] = []
  const colors: string[] = []

  if (r > 1.3) {
    list.push('看涨波动率')
    colors.push('danger')
    list.push('存在套利机会')
    colors.push('warning')
  } else if (r < 0.7) {
    list.push('看跌波动率')
    colors.push('danger')
    list.push('存在套利机会')
    colors.push('warning')
  } else {
    list.push('波动率处于常态区间')
    colors.push('success')
  }

  return { labels: list, colors }
})

const diagDesc = computed(() => {
  if (fwdIV.value === null) return ''
  const r = ratio.value!
  if (r > 1.3) return '远期隐含波动率极高，说明市场正在对未来特定区间（短期到期日至长期到期日之间）定价极大的不确定性。事件驱动特征明显。'
  if (r < 0.7) return '远期隐含波动率严重塌陷，说明市场预期未来特定区间极其平静。如果此时近端 IV 很高，说明近端事件过后风险将被迅速完全出清（Volatility Crush）。'
  return '远期隐含波动率与当前期限结构水平基本匹配，未见极端异常定价。'
})

const arbDesc = computed(() => {
  if (fwdIV.value === null) return ''
  const r = ratio.value!
  if (r > 1.3 || r < 0.7) return '远期波动率定价与现阶段平均水平发生显著偏离（偏离度超过 30%）。建议通过构建日历价差期权组合（Calendar Spread）进行波动率期限结构套利。'
  return ''
})

function calc() {
  showResult.value = true
}

// Sell Put 计算器
const spPremium = ref(1.0)
const spStrike = ref(66)
const spExpirationDate = ref<string>('')
const spDays = computed(() => {
  if (!spExpirationDate.value) return 18
  return getDaysFromToday(new Date(spExpirationDate.value))
})
const spCurrentPrice = ref<number | undefined>(undefined)

const spPeriodYield = computed(() => {
  if (spStrike.value === 0) return 0
  return (spPremium.value / spStrike.value) * 100
})

const spAnnualYield = computed(() => {
  if (spDays.value === 0) return 0
  return spPeriodYield.value * (365 / spDays.value)
})

const spNetCost = computed(() => spStrike.value - spPremium.value)

const spMarginOfSafety = computed(() => {
  const cp = spCurrentPrice.value
  if (cp === undefined || cp === null || cp === 0) return null
  return ((cp - spNetCost.value) / cp) * 100
})
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="calc-body">
      <div class="calc-grid">

        <!-- 左侧：波动率远期定价计算器 -->
        <div class="calc-card">
          <div class="page-title">波动率远期定价计算器</div>

          <!-- 输入区 -->
          <div class="section">
            <div class="row">
              <div class="field">
                <label>短期时间（天）</label>
                <el-input-number v-model="shortDays" :min="1" size="small" />
              </div>
              <div class="field">
                <label>短期 ATM IV（%）</label>
                <el-input-number v-model="shortIV" :min="0" :precision="2" size="small" />
              </div>
              <div class="field">
                <label>长期时间（天）</label>
                <el-input-number v-model="longDays" :min="1" size="small" />
              </div>
              <div class="field">
                <label>长期 ATM IV（%）</label>
                <el-input-number v-model="longIV" :min="0" :precision="2" size="small" />
              </div>
            </div>
            <el-button type="primary" size="small" @click="calc">计算 FWD IV</el-button>
          </div>

          <!-- 结果区 -->
          <div v-if="showResult" class="section result">
            <div class="result-title">计算结果</div>

            <div v-if="fwdIV === null" class="alert">
              期限结构严重倒挂，远期方差为负，无法提取实数远期波动率
            </div>

            <template v-else>
              <div class="result-row">
                <div class="result-col">
                  <div class="block-label">📈 数据解析</div>
                  <div class="data-row">短期年化时间 <strong>{{ shortT.toFixed(4) }} 年</strong></div>
                  <div class="data-row">长期年化时间 <strong>{{ longT.toFixed(4) }} 年</strong></div>
                  <div class="data-row">短期 ATM IV <strong>{{ shortIV }}%</strong></div>
                  <div class="data-row">长期 ATM IV <strong>{{ longIV }}%</strong></div>
                </div>

                <div class="result-col">
                  <div class="block-label">🧮 计算过程</div>
                  <div class="formula-block">
                    <div class="formula-step">= sqrt( ({{ (longIV / 100).toFixed(4) }}² × {{ longT.toFixed(4) }} − {{
                      (shortIV / 100).toFixed(4) }}² × {{ shortT.toFixed(4) }}) / {{ (longT - shortT).toFixed(4) }} )
                    </div>
                    <div class="formula-final">= {{ fwdIV.toFixed(2) }}%</div>
                  </div>
                </div>

                <div class="result-col">
                  <div class="block-label">📊 对比诊断</div>
                  <div class="data-row">FWD_IV / 长期 ATM IV <strong>{{ ratio!.toFixed(2) }} 倍</strong></div>
                  <div class="data-row">&lt; 0.7 看跌 &nbsp;|&nbsp; 0.7~1.3 常态 &nbsp;|&nbsp; &gt; 1.3 看涨</div>
                </div>
              </div>

              <div class="result-block conclusion">
                <div class="block-label">🚨 最终交易结论</div>
                <div class="block-content">
                  <el-tag v-for="(label, i) in diag.labels" :key="label" :type="diag.colors[i]" size="small"
                    class="conclusion-tag">
                    {{ label }}
                  </el-tag>
                  <p class="conclusion-desc">{{ diagDesc }}</p>
                  <p v-if="arbDesc" class="conclusion-desc arb">{{ arbDesc }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 右侧：Sell Put 年化收益率计算器 -->
        <div class="calc-card">
          <div class="page-title">Sell Put 年化收益率计算器</div>

          <div class="section">
            <div class="row">
              <div class="field">
                <label>每股权利金（Premium）</label>
                <el-input-number v-model="spPremium" :min="0" :precision="1" size="small" />
              </div>
              <div class="field">
                <label>行权价 / 接货本金（Strike Price）</label>
                <el-input-number v-model="spStrike" :min="0" :precision="2" size="small" />
              </div>
              <div class="field">
                <label>行权日（Expiration Date）</label>
                <el-date-picker v-model="spExpirationDate" type="date" size="small" placeholder="选择行权日"
                  format="YYYY-MM-DD" value-format="YYYY-MM-DD" :clearable="true" />
              </div>
              <div class="field">
                <label>当前股价（可选）</label>
                <el-input-number v-model="spCurrentPrice" :min="0" :precision="2" size="small" placeholder="可选" />
              </div>
            </div>
            <el-button type="primary" size="small" @click="spResultVisible = true">计算收益</el-button>
          </div>

          <!-- 结果 -->
          <div v-if="spResultVisible" class="section result">
            <div class="result-title">计算结果</div>
            <div class="result-row">
              <div class="result-col">
                <div class="block-label">📈 核心指标</div>
                <div class="data-row">期权剩余天数 <strong>{{ spDays }} 天</strong>（距今至 {{ spExpirationDate || '—' }}）</div>
                <div class="data-row">单期收益率 <strong>{{ spPeriodYield.toFixed(2) }}%</strong></div>
                <div class="data-row">年化收益率 <strong class="highlight">{{ spAnnualYield.toFixed(2) }}%</strong></div>
                <div class="data-row">实际持仓成本 <strong>{{ spNetCost.toFixed(2) }}</strong></div>
                <div class="data-row" v-if="spMarginOfSafety !== null">
                  资金安全垫 <strong :class="spMarginOfSafety >= 0 ? 'safe' : 'danger'">{{ spMarginOfSafety.toFixed(2)
                  }}%</strong>
                </div>
                <div class="data-row" v-else>资金安全垫 <span class="dim">—（请填写当前股价）</span></div>
              </div>

              <div class="result-col">
                <div class="block-label">🧮 计算过程</div>
                <div class="formula-block">
                  <div class="formula-step">单期收益率 = {{ spPremium }} / {{ spStrike }} = {{ (spPremium /
                    spStrike).toFixed(4) }}
                  </div>
                  <div class="formula-final">{{ spPeriodYield.toFixed(4) }}%</div>
                </div>
                <div class="formula-block" style="margin-top: 8px;">
                  <div class="formula-step">年化收益率 = {{ spPeriodYield.toFixed(4) }}% × (365 / {{ spDays }})</div>
                  <div class="formula-final highlight">{{ spAnnualYield.toFixed(4) }}%</div>
                </div>
                <div class="formula-block" style="margin-top: 8px;">
                  <div class="formula-step">实际持仓成本 = {{ spStrike }} − {{ spPremium }} = {{ (spStrike -
                    spPremium).toFixed(4) }}
                  </div>
                  <div class="formula-final">{{ spNetCost.toFixed(4) }}</div>
                </div>
              </div>
            </div>

            <div class="result-block conclusion">
              <div class="block-label">📊 交易信号</div>
              <div class="block-content">
                <el-tag :type="spAnnualYield >= 20 ? 'success' : 'info'" size="small">
                  年化 {{ spAnnualYield.toFixed(2) }}%
                </el-tag>
                <p class="conclusion-desc">
                  若被行权接货，实际持仓成本为 <strong>{{ spNetCost.toFixed(2) }}</strong>，相较行权价节省了 <strong>{{ spPremium.toFixed(4)
                  }}</strong> / 股。
                  <span v-if="spMarginOfSafety !== null">
                    当前股价 <strong>{{ spCurrentPrice }}</strong> 较持仓成本高出 <strong>{{ spMarginOfSafety.toFixed(2)
                    }}%</strong>，
                    <span :class="spMarginOfSafety >= 0 ? 'safe' : 'danger'">
                      {{ spMarginOfSafety >= 0 ? '浮盈安全垫充足' : '已处于浮亏状态' }}
                    </span>。
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
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

.calc-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.calc-card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}

.section {
  margin-bottom: 16px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.field label {
  font-size: 11px;
}

/* 结果 */
.result {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 14px;
}

.result-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}

.alert {
  font-size: 13px;
  color: #dc2626;
  font-weight: 600;
}

.result-row {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.result-col {
  flex: 1;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 10px;
}

.result-block {
  margin-bottom: 14px;
}

.result-block:last-child {
  margin-bottom: 0;
}

.block-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
}

.block-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-row {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}

.data-row strong {
  color: var(--el-text-color-primary);
}

/* 公式 */
.formula-block {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--el-text-color-primary);
}

.formula-step {
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.formula-final {
  color: #dc2626;
  font-weight: 700;
  margin-top: 6px;
}

/* 结论 */
.conclusion-tag {
  margin-right: 6px;
  margin-bottom: 6px;
}

.conclusion-desc {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
  line-height: 1.7;
}

.conclusion-desc.arb {
  color: #d97706;
}

.highlight {
  color: #dc2626;
}

.safe {
  color: #16a34a;
}

.danger {
  color: #dc2626;
}

.dim {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}
</style>
