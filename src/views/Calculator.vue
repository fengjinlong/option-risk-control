<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRiskWorkspace } from '../composables/useRiskWorkspace'
import { useRouter } from 'vue-router'

const router = useRouter()
const { prices } = useRiskWorkspace()

// 输入
const shortDays = ref(30)
const shortIV  = ref(20)
const longDays = ref(60)
const longIV   = ref(28)

const showResult = ref(false)

// 计算
const longT  = computed(() => longDays.value / 365)
const shortT = computed(() => shortDays.value / 365)

const fwdIV = computed(() => {
  // 输入 IV 是百分数（28 = 28%），转为小数（0.28）参与计算
  const shortIV_d = shortIV.value / 100
  const longIV_d  = longIV.value  / 100
  const a = longIV_d  * longIV_d  * longT.value
  const b = shortIV_d * shortIV_d * shortT.value
  if (a < b) return null
  return Math.sqrt((a - b) / (longT.value - shortT.value)) * 100
})

// FWD_IV / 长期 ATM IV 倍数
const ratio = computed(() => {
  if (fwdIV.value === null) return null
  return fwdIV.value / longIV.value
})

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
</script>

<template>
  <div class="workspace">
    <header class="workspace-header">
      <div class="header-left">
        <span class="logo-text">📊</span>
        <span class="title">Pre-trade Risk Workspace</span>
      </div>
      <div class="header-actions">
        <el-button type="primary" size="small" @click="router.push('/explain')">数据说明</el-button>
        <el-button type="primary" size="small" plain @click="router.push('/')">返回工作台</el-button>
      </div>
      <div class="header-right">
        <el-tag type="danger" size="small">BTC: {{ prices.data.data?.BTC ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">ETH: {{ prices.data.data?.ETH ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">SOL: {{ prices.data.data?.SOL ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">LINK: {{ prices.data.data?.LINK ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">CRV: {{ prices.data.data?.CRV ?? '--' }}</el-tag>
        <el-tag type="success" size="small">● LIVE</el-tag>
      </div>
    </header>

    <div class="calc-body">
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
          <!-- 数据解析 + 计算过程 + 对比诊断 并排 -->
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
                <div class="formula-step">= sqrt( ({{ (longIV/100).toFixed(4) }}² × {{ longT.toFixed(4) }} − {{ (shortIV/100).toFixed(4) }}² × {{ shortT.toFixed(4) }}) / {{ (longT - shortT).toFixed(4) }} )</div>
                <div class="formula-final">= {{ fwdIV.toFixed(2) }}%</div>
              </div>
            </div>

            <div class="result-col">
              <div class="block-label">📊 对比诊断</div>
              <div class="data-row">FWD_IV / 长期 ATM IV <strong>{{ ratio!.toFixed(2) }} 倍</strong></div>
              <div class="data-row">&lt; 0.7 看跌 &nbsp;|&nbsp; 0.7~1.3 常态 &nbsp;|&nbsp; &gt; 1.3 看涨</div>
            </div>
          </div>

          <!-- 最终结论 -->
          <div class="result-block conclusion">
            <div class="block-label">🚨 最终交易结论</div>
            <div class="block-content">
              <el-tag
                v-for="(label, i) in diag.labels"
                :key="label"
                :type="diag.colors[i]"
                size="small"
                class="conclusion-tag"
              >
                {{ label }}
              </el-tag>
              <p class="conclusion-desc">{{ diagDesc }}</p>
              <p v-if="arbDesc" class="conclusion-desc arb">{{ arbDesc }}</p>
            </div>
          </div>
        </template>
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

.header-left { display: flex; align-items: center; gap: 8px; }
.logo-text { font-size: 18px; }
.title { font-size: 13px; font-weight: 700; color: var(--el-text-color-primary); }
.header-actions { display: flex; align-items: center; gap: 6px; }
.header-right { display: flex; align-items: center; gap: 8px; }

.calc-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.page-title { font-size: 16px; font-weight: 700; color: var(--el-text-color-primary); margin-bottom: 12px; }

.section { margin-bottom: 16px; }

.row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--el-text-color-secondary); }
.field label { font-size: 11px; }

/* 结果 */
.result {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 14px;
}

.result-title { font-size: 14px; font-weight: 700; color: var(--el-text-color-primary); margin-bottom: 12px; }

.alert { font-size: 13px; color: #dc2626; font-weight: 600; }

.result-row { display: flex; gap: 12px; margin-bottom: 14px; }
.result-col { flex: 1; background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 4px; padding: 10px; }

.result-block { margin-bottom: 14px; }
.result-block:last-child { margin-bottom: 0; }

.block-label { font-size: 12px; font-weight: 700; color: var(--el-text-color-primary); margin-bottom: 6px; }

.block-content { display: flex; flex-direction: column; gap: 4px; }

.data-row { display: flex; gap: 6px; font-size: 11px; color: var(--el-text-color-secondary); line-height: 1.7; }
.data-row strong { color: var(--el-text-color-primary); }

/* 公式 */
.formula-block { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 4px; padding: 8px 10px; color: var(--el-text-color-primary); }
.formula-step { color: var(--el-text-color-secondary); margin-top: 4px; }
.formula-final { color: #dc2626; font-weight: 700; margin-top: 6px; }

/* 结论 */
.conclusion-tag { margin-right: 6px; margin-bottom: 6px; }
.conclusion-desc { font-size: 12px; color: var(--el-text-color-regular); margin-top: 4px; line-height: 1.7; }
.conclusion-desc.arb { color: #d97706; }
</style>
