<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

// ─── Side ─────────────────────────────────────────────────────────────────────
const side = ref<'seller' | 'buyer'>('seller')

// ─── Part 1: IV Audit ────────────────────────────────────────────────────────
type SkewOption = 'seller_put' | 'seller_call' | 'buyer_call' | 'buyer_put' | null
const ivScoreData = ref({
  ivRvGap: null as number | null,          // 1. IV-RV Gap
  ivPercentile: null as string | null,    // 2. IV Percentile: 'seller_a'(+10)|'seller_b'(-20)|'buyer_c'(+10)
  termStructure: null as number | null,   // 3. Term Structure
  skew: null as SkewOption,               // 4. Skew (single-select)
})

const IV_PERCENTILE_SCORES: Record<string, { seller: number; buyer: number }> = {
  seller_a: { seller: 10, buyer: 0 },
  seller_b: { seller: -20, buyer: 0 },
  buyer_c: { seller: 0, buyer: 10 },
}

const part1SellerScore = computed(() => {
  const sellerPart = [ivScoreData.value.ivRvGap, ivScoreData.value.termStructure]
    .filter(v => v !== null && v > 0)
    .reduce((s, v) => s + (v ?? 0), 0)
  const pct = ivScoreData.value.ivPercentile
  const extra = pct ? (IV_PERCENTILE_SCORES[pct]?.seller ?? 0) : 0
  const skewPart = (ivScoreData.value.skew === 'seller_put' || ivScoreData.value.skew === 'seller_call') ? 10 : 0
  return sellerPart + extra + skewPart
})
const part1BuyerScore = computed(() => {
  const buyerPart = [ivScoreData.value.ivRvGap, ivScoreData.value.termStructure]
    .filter(v => v !== null && v < 0)
    .reduce((s, v) => s + Math.abs(v ?? 0), 0)
  const pct = ivScoreData.value.ivPercentile
  const extra = pct ? (IV_PERCENTILE_SCORES[pct]?.buyer ?? 0) : 0
  const skewPart = (ivScoreData.value.skew === 'buyer_call' || ivScoreData.value.skew === 'buyer_put') ? 10 : 0
  return buyerPart + extra + skewPart
})

const part1SellerStatus = computed(() => {
  const s = part1SellerScore.value
  if (s >= 35) return { label: '优秀', color: '#67c23a' }
  if (s >= 25) return { label: '标准', color: '#409eff' }
  return { label: '恶劣', color: '#f56c6c' }
})
const part1BuyerStatus = computed(() => {
  const s = part1BuyerScore.value
  if (s >= 30) return { label: '进场', color: '#67c23a' }
  if (s >= 20) return { label: '鸡肋', color: '#e6a23c' }
  return { label: '垃圾', color: '#f56c6c' }
})

const part1CurrentStatus = computed(() =>
  side.value === 'seller' ? part1SellerStatus.value : part1BuyerStatus.value
)
const part1CurrentScore = computed(() =>
  side.value === 'seller' ? part1SellerScore.value : part1BuyerScore.value
)

// ─── Part 2: Strategy Selection ──────────────────────────────────────────────
const strategyData = ref({
  confidence: null as number | null,
  ivCost: null as number | null,
  targetSpace: null as number | null,
})

const part2Score = computed(() =>
  [strategyData.value.confidence, strategyData.value.ivCost, strategyData.value.targetSpace]
    .filter(v => v !== null)
    .reduce((s, v) => s + (v ?? 0), 0)
)

const part2Mode = computed(() => {
  const s = part2Score.value
  if (s >= 80) return { label: '单腿模式', color: '#409eff', advice: '保险便宜、信心极强、空间极大。裸买是本分。' }
  if (s >= 50) return { label: '双腿模式', color: '#67c23a', advice: '信心有但保险不便宜。价差（Spread）降低成本，提高胜率。' }
  if (s >= 30) return { label: '三/四腿模式', color: '#e6a23c', advice: '信心一般，市场拉锯。通过铁鹰等复杂结构锁死风险。' }
  return { label: '拒绝开单', color: '#f56c6c', advice: '垃圾模式。空仓是最高级别的风控。' }
})

// ─── Part 3: Liquidity Audit ──────────────────────────────────────────────────
const liquidityData = ref({
  bidAskSpread: null as number | null,
  depthRatio: null as number | null,
  oiVolume: null as number | null,
})

const part3Score = computed(() =>
  [liquidityData.value.bidAskSpread, liquidityData.value.depthRatio, liquidityData.value.oiVolume]
    .filter(v => v !== null)
    .reduce((s, v) => s + (v ?? 0), 0)
)

const part3Action = computed(() => {
  const s = part3Score.value
  if (s >= 25) return {
    label: '允许快速入场',
    sub: '普通限价快速入场，极少时候可用市价。抢占时机优先。',
    color: '#67c23a',
  }
  if (s >= 15) return {
    label: '动态限价入场',
    sub: '使用动态限价中间价 / 冰山策略拉平均价。15 分钟未成交需重新审计。',
    color: '#e6a23c',
  }
  return {
    label: '强行禁止开单',
    sub: '宁可错过，绝不交畸形买路钱。',
    color: '#f56c6c',
  }
})

// ─── Radar Chart ─────────────────────────────────────────────────────────────
const radarRef = ref<HTMLDivElement>()
let radarChart: echarts.ECharts | null = null

function buildRadarOption() {
  return {
    radar: {
      indicator: [
        { name: 'IV 审计', max: 40 },
        { name: '策略选型', max: 100 },
        { name: '流动性', max: 30 },
      ],
      radius: '65%',
      splitNumber: 4,
      axisName: { color: '#303133', fontSize: 12 },
      splitLine: { lineStyle: { color: '#e4e7ed' } },
      splitArea: { areaStyle: { color: ['#fff', '#fafafa'] } },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [part1CurrentScore.value, part2Score.value, part3Score.value],
        name: '审计得分',
        areaStyle: { color: 'rgba(64, 158, 255, 0.25)' },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    }],
  }
}

const radarOption = computed(() => buildRadarOption())

// ─── Total & Final Verdict ────────────────────────────────────────────────────
const totalScore = computed(() => part1CurrentScore.value + part2Score.value + part3Score.value)

const finalVerdict = computed(() => {
  const s = side.value
  const p1 = s === 'seller' ? part1SellerScore.value : part1BuyerScore.value
  const p2 = part2Score.value
  const p3 = part3Score.value
  const total = p1 + p2 + p3
  const mode = part2Mode.value
  const action = part3Action.value
  const status = s === 'seller' ? part1SellerStatus.value : part1BuyerStatus.value

  const pass = p1 > 0 && p2 >= 30 && p3 >= 15
  const label = pass ? '建议开单' : '建议观望'
  const color = pass ? '#67c23a' : '#f56c6c'

  return { total, label, color, mode, action, status, p1, p2, p3, side: s }
})

// ─── Report Panel ──────────────────────────────────────────────────────────
const showReport = ref(false)

// ─── Template Helpers ──────────────────────────────────────────────────────
const skewLabel = computed(() => {
  const s = ivScoreData.value.skew
  if (s === 'seller_put' || s === 'buyer_call') return '正向偏斜（Put 端 IV 更高）'
  if (s === 'seller_call' || s === 'buyer_put') return '负向偏斜（Call 端 IV 更高）'
  return '偏斜未定义'
})
const termLabel = computed(() =>
  ivScoreData.value.termStructure !== null && ivScoreData.value.termStructure > 0
    ? 'Contango（升水）有利于卖方收取时间价值'
    : 'Backwardation（贴水）表明近期恐慌溢价抬升'
)
const ivPercentileLabel = computed(() => {
  const p = ivScoreData.value.ivPercentile
  if (p === 'seller_a') return '有利于卖方的溢价压缩区间'
  if (p === 'seller_b') return '极端高估，IV 随时可能崩跌，负分警示'
  if (p === 'buyer_c') return 'IV 极低，买方天堂'
  return ''
})
const ivCostWarning = computed(() =>
  strategyData.value.ivCost === 30 ? 'IV 极便宜，Vega 敞口巨大，轻仓买入可在 IV 扩张时享受利润非线性增长。' : ''
)
const targetSpaceWarning = computed(() =>
  strategyData.value.targetSpace === 0 ? '区间震荡行情下买入期权，Theta 会持续抽走权利金，需严格控制持仓周期。' : ''
)

// ─── ECharts Init ──────────────────────────────────────────────────────────────
function initRadar() {
  if (!radarRef.value) return
  radarChart = echarts.init(radarRef.value)
  radarChart.setOption(radarOption.value)
}

function updateRadar() {
  if (!radarChart) return
  radarChart.setOption(radarOption.value, true)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  nextTick(() => initRadar())
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  radarChart?.dispose()
  window.removeEventListener('resize', onResize)
})

function onResize() {
  radarChart?.resize()
}

watch([part1CurrentScore, part2Score, part3Score], () => {
  nextTick(() => updateRadar())
})
</script>

<template>
  <div class="score-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <span class="header-icon">📊</span>
        <div>
          <h1 class="page-title">期权交易前置审计与策略选型评分卡</h1>
          <p class="page-sub">Options Trading Pre-Audit & Strategy Scoring Card</p>
        </div>
      </div>
      <div class="header-right">
        <div class="verdict-badge" :style="{ background: finalVerdict.color }">
          {{ finalVerdict.label }}
        </div>
        <div class="total-score">{{ totalScore }}<span>分</span></div>
      </div>
    </div>

    <!-- Side Toggle -->
    <div class="side-toggle-row">
      <div class="section-label">审计立场</div>
      <div class="side-toggle">
        <button :class="['toggle-btn', { active: side === 'seller' }]" @click="side = 'seller'">
          🐻 卖方（做空波动率）
        </button>
        <button :class="['toggle-btn', { active: side === 'buyer' }]" @click="side = 'buyer'">
          🐂 买方（做多波动率）
        </button>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- Left Column: Three Audit Parts -->
      <el-col :xs="24" :sm="24" :md="15" :lg="15" :xl="15">

        <!-- Part 1: IV Audit -->
        <div class="audit-card">
          <div class="card-header">
            <span class="part-tag">第一部分</span>
            <h2 class="card-title">IV 计分审计表</h2>
            <div class="score-badge" :style="{ color: part1CurrentStatus.color }">
              {{ part1CurrentScore }}分
            </div>
          </div>
          <div class="status-bar" :style="{ borderColor: part1CurrentStatus.color }">
            <span class="status-dot" :style="{ background: part1CurrentStatus.color }"></span>
            {{ side === 'seller' ? '卖方' : '买方' }}评分 · {{ part1CurrentStatus.label }}
          </div>

          <div class="audit-items compact">
            <!-- Item 1: IV-RV Gap -->
            <div class="audit-item">
              <div class="item-label">1. 行权日 IV-RV 价差</div>
              <el-radio-group :model-value="ivScoreData.ivRvGap" @update:model-value="ivScoreData.ivRvGap = $event"
                class="radio-row">
                <el-radio :value="7">A. 大于 5% → 卖方 +7</el-radio>
                <el-radio :value="10">B. 大于 10% → 卖方 +10</el-radio>
                <el-radio :value="-10">C. 小于 0% → 买方 +10</el-radio>
              </el-radio-group>
            </div>

            <!-- Item 2: IV Percentile -->
            <div class="audit-item">
              <div class="item-label">2. 行权日波动率锥 IV 百分位</div>
              <el-radio-group :model-value="ivScoreData.ivPercentile"
                @update:model-value="ivScoreData.ivPercentile = $event" class="radio-row">
                <el-radio value="seller_a">A. 50% ~ 80% → 卖方 +10</el-radio>
                <el-radio value="seller_b">B. 大于 90% → 卖方 -20 ⚠️</el-radio>
                <el-radio value="buyer_c">C. 小于 25% → 买方 +10</el-radio>
              </el-radio-group>
            </div>

            <!-- Item 3: Term Structure -->
            <div class="audit-item">
              <div class="item-label">3. 期限结构 Term Structure</div>
              <el-radio-group :model-value="ivScoreData.termStructure"
                @update:model-value="ivScoreData.termStructure = $event" class="radio-row">
                <el-radio :value="10">A. 远期升水（Contango）→ 卖方 +10</el-radio>
                <el-radio :value="-10">B. 远期贴水（Backwardation）→ 买方 +10</el-radio>
              </el-radio-group>
            </div>

            <!-- Item 4: Skew -->
            <div class="audit-item">
              <div class="item-label">4. 微笑曲面 Skew（25D Put - 25D Call）</div>
              <el-radio-group :model-value="ivScoreData.skew" @update:model-value="ivScoreData.skew = $event"
                class="radio-row">
                <el-radio value="seller_put">A. 数值 &gt; 0 且计划卖 Put → 卖方 +10</el-radio>
                <el-radio value="seller_call">B. 数值 &lt; 0 且计划卖 Call → 卖方 +10</el-radio>
                <el-radio value="buyer_call">C. 数值 &gt; 0 且计划买 Call → 买方 +10</el-radio>
                <el-radio value="buyer_put">D. 数值 &lt; 0 且计划买 Put → 买方 +10</el-radio>
              </el-radio-group>
            </div>
          </div>

          <!-- Part 1 Assessment -->
          <div class="assessment-row">
            <div class="assessment-item seller" :class="{ active: side === 'seller' }">
              <span class="ass-label">卖方</span>
              <span class="ass-score" :style="{ color: part1SellerStatus.color }">{{ part1SellerScore }}分</span>
              <span class="ass-tag" :style="{ color: part1SellerStatus.color }">{{ part1SellerStatus.label }}</span>
            </div>
            <div class="assessment-item buyer" :class="{ active: side === 'buyer' }">
              <span class="ass-label">买方</span>
              <span class="ass-score" :style="{ color: part1BuyerStatus.color }">{{ part1BuyerScore }}分</span>
              <span class="ass-tag" :style="{ color: part1BuyerStatus.color }">{{ part1BuyerStatus.label }}</span>
            </div>
          </div>
        </div>

        <!-- Part 2: Strategy Selection -->
        <div class="audit-card">
          <div class="card-header">
            <span class="part-tag">第二部分</span>
            <h2 class="card-title">策略选型审计</h2>
            <div class="score-badge" :style="{ color: part2Mode.color }">
              {{ part2Score }}分 · {{ part2Mode.label }}
            </div>
          </div>
          <div class="advice-bar" :style="{ background: part2Mode.color + '18', borderColor: part2Mode.color }">
            {{ part2Mode.advice }}
          </div>

          <div class="audit-items compact">
            <!-- Weight A: Confidence -->
            <div class="audit-item">
              <div class="item-label">A. 主观信心强度 <span class="weight-tag">权重 40 分</span></div>
              <el-radio-group :model-value="strategyData.confidence"
                @update:model-value="strategyData.confidence = $event" class="radio-row">
                <el-radio :value="40">40分 · 极其强烈：明确日线突破 + 重大基本面支撑（建议：单腿，追求爆发力）</el-radio>
                <el-radio :value="20">20分 · 中等经营：趋势在但上方有阻力，阴涨阶段（建议：双腿，降低损耗）</el-radio>
                <el-radio :value="10">10分 · 试探性：感觉要变盘但信号不明显（建议：三/四腿组合，锁死风险）</el-radio>
              </el-radio-group>
            </div>

            <!-- Weight B: IV Cost -->
            <div class="audit-item">
              <div class="item-label">B. IV 成本定价 <span class="weight-tag">权重 30 分</span></div>
              <el-radio-group :model-value="strategyData.ivCost" @update:model-value="strategyData.ivCost = $event"
                class="radio-row">
                <el-radio :value="30">30分 · IV 极便宜（IV 百分位 &lt; 25%）：建议买方单腿</el-radio>
                <el-radio :value="15">15分 · IV 中等（IV 百分位 25% ~ 75%）：必须双腿价差</el-radio>
                <el-radio :value="0">0分 · IV 极贵（IV 百分位 &gt; 75%）：严禁裸买，做卖方或铁鹰/铁蝶</el-radio>
              </el-radio-group>
            </div>

            <!-- Weight C: Target Space -->
            <div class="audit-item">
              <div class="item-label">C. 目标空间审计 <span class="weight-tag">权重 30 分</span></div>
              <el-radio-group :model-value="strategyData.targetSpace"
                @update:model-value="strategyData.targetSpace = $event" class="radio-row">
                <el-radio :value="30">30分 · 星辰大海，上方无阻力：单腿，不封死盈利上限</el-radio>
                <el-radio :value="10">10分 · 阶梯运动，阻力位明显：双腿垂直价差</el-radio>
                <el-radio :value="0">0分 · 区间震荡，鸟笼行情：三/四腿，两端卖出锁死利润</el-radio>
              </el-radio-group>
            </div>
          </div>
        </div>

        <!-- Part 3: Liquidity Audit -->
        <div class="audit-card">
          <div class="card-header">
            <span class="part-tag">第三部分</span>
            <h2 class="card-title">流动性与盘口审计</h2>
            <div class="score-badge" :style="{ color: part3Action.color }">
              {{ part3Score }}分 · {{ part3Action.label }}
            </div>
          </div>
          <div class="advice-bar" :style="{ background: part3Action.color + '18', borderColor: part3Action.color }">
            {{ part3Action.sub }}
          </div>

          <div class="audit-items compact">
            <!-- Cost Audit -->
            <div class="audit-item">
              <div class="item-label">1. 成本审计：BP 价差量化 <span class="weight-tag">权重 15 分</span></div>
              <el-radio-group :model-value="liquidityData.bidAskSpread"
                @update:model-value="liquidityData.bidAskSpread = $event" class="radio-row">
                <el-radio :value="15">15分 · 15 BP 以内：机构级流动性极佳</el-radio>
                <el-radio :value="10">10分 · 15 ~ 30 BP：标准入场区，甜点位</el-radio>
                <el-radio :value="5">5分 · 30 ~ 60 BP：警示，严禁吃单，必须挂中间价等待</el-radio>
                <el-radio :value="0">0分 · &gt; 60 BP：自杀式交易，流动性黑洞</el-radio>
              </el-radio-group>
            </div>

            <!-- Depth Audit -->
            <div class="audit-item">
              <div class="item-label">2. 深度审计：承载力风险量化 <span class="weight-tag">权重 10 分</span></div>
              <el-radio-group :model-value="liquidityData.depthRatio"
                @update:model-value="liquidityData.depthRatio = $event" class="radio-row">
                <el-radio :value="10">10分 · 比率 &gt; 10倍：极深，大单不引盘口异动</el-radio>
                <el-radio :value="7">7分 · 5 ~ 10倍：稳健，支持快速一次性成交</el-radio>
                <el-radio :value="3">3分 · 2 ~ 5倍：较薄，必须分步慢速拆单</el-radio>
                <el-radio :value="0">0分 · &lt; 2倍：盘口极脆，拒绝冲击</el-radio>
              </el-radio-group>
            </div>

            <!-- OI Audit -->
            <div class="audit-item">
              <div class="item-label">3. 退出审计：未平仓合约量 OI <span class="weight-tag">权重 5 分</span></div>
              <el-radio-group :model-value="liquidityData.oiVolume"
                @update:model-value="liquidityData.oiVolume = $event" class="radio-row">
                <el-radio :value="5">5分 · OI &gt; 500 枚：密集活跃区，无滞销风险</el-radio>
                <el-radio :value="3">3分 · OI 100 ~ 500 枚：流动性尚可</el-radio>
                <el-radio :value="0">0分 · OI &lt; 100 枚：流动性枯竭，清算风险极高</el-radio>
              </el-radio-group>
            </div>
          </div>
        </div>

        <!-- Generate Report Button -->
        <div class="action-row">
          <button class="generate-btn" @click="showReport = !showReport">
            生成综合审计报告
          </button>
        </div>
      </el-col>

      <!-- Right Column: Radar & Scoreboard -->
      <el-col :xs="24" :sm="24" :md="9" :lg="9" :xl="9">

        <!-- Radar Chart -->
        <div class="audit-card radar-card">
          <div class="card-header">
            <span class="part-tag">实时评分</span>
            <h2 class="card-title">审计雷达图</h2>
          </div>
          <div ref="radarRef" class="radar-chart"></div>
        </div>

        <!-- Score Breakdown -->
        <div class="audit-card">
          <div class="card-header">
            <h2 class="card-title">分项得分明细</h2>
          </div>
          <div class="score-list">
            <div class="score-row">
              <span class="score-name">① IV 审计</span>
              <div class="score-bar-wrap">
                <div class="score-bar"
                  :style="{ width: (part1CurrentScore / 40 * 100) + '%', background: part1CurrentStatus.color }"></div>
              </div>
              <span class="score-val" :style="{ color: part1CurrentStatus.color }">{{ part1CurrentScore }} / 40</span>
            </div>
            <div class="score-row">
              <span class="score-name">② 策略选型</span>
              <div class="score-bar-wrap">
                <div class="score-bar" :style="{ width: (part2Score / 100 * 100) + '%', background: part2Mode.color }">
                </div>
              </div>
              <span class="score-val" :style="{ color: part2Mode.color }">{{ part2Score }} / 100</span>
            </div>
            <div class="score-row">
              <span class="score-name">③ 流动性</span>
              <div class="score-bar-wrap">
                <div class="score-bar" :style="{ width: (part3Score / 30 * 100) + '%', background: part3Action.color }">
                </div>
              </div>
              <span class="score-val" :style="{ color: part3Action.color }">{{ part3Score }} / 30</span>
            </div>
            <div class="score-row total-row">
              <span class="score-name">综合总分</span>
              <div class="score-bar-wrap">
                <div class="score-bar total-bar"
                  :style="{ width: (totalScore / 170 * 100) + '%', background: finalVerdict.color }"></div>
              </div>
              <span class="score-val total-val" :style="{ color: finalVerdict.color }">{{ totalScore }} / 170</span>
            </div>
          </div>
        </div>

        <!-- Report Toggle -->
        <div class="report-toggle">
          <button class="toggle-report-btn" @click="showReport = !showReport">
            {{ showReport ? '收起报告 ↑' : '展开报告 ↓' }}
          </button>
        </div>

        <!-- Report Panel (inline) -->
        <div v-if="showReport" class="audit-card report-panel">
          <div class="card-header">
            <h2 class="card-title">综合审计报告</h2>
            <span class="modal-sub">立场：{{ finalVerdict.side === 'seller' ? '🐻 卖方' : '🐂 买方' }}</span>
          </div>

          <div class="report-body">

            <!-- Score Summary -->
            <div class="report-score-row">
              <div class="rs-item">
                <span class="rs-label">① IV 审计</span>
                <span class="rs-val" :style="{ color: part1CurrentStatus.color }">{{ part1CurrentScore }}分</span>
                <span class="rs-tag"
                  :style="{ color: part1CurrentStatus.color, borderColor: part1CurrentStatus.color }">{{
                    part1CurrentStatus.label }}</span>
              </div>
              <div class="rs-item">
                <span class="rs-label">② 策略选型</span>
                <span class="rs-val" :style="{ color: part2Mode.color }">{{ part2Score }}分</span>
                <span class="rs-tag" :style="{ color: part2Mode.color, borderColor: part2Mode.color }">{{
                  part2Mode.label }}</span>
              </div>
              <div class="rs-item">
                <span class="rs-label">③ 流动性</span>
                <span class="rs-val" :style="{ color: part3Action.color }">{{ part3Score }}分</span>
                <span class="rs-tag" :style="{ color: part3Action.color, borderColor: part3Action.color }">{{
                  part3Action.label }}</span>
              </div>
              <div class="rs-item rs-total">
                <span class="rs-label">综合</span>
                <span class="rs-val" :style="{ color: finalVerdict.color }">{{ totalScore }}分</span>
                <span class="rs-tag" :style="{ color: finalVerdict.color, borderColor: finalVerdict.color }">{{
                  finalVerdict.label }}</span>
              </div>
            </div>

            <!-- Professional View -->
            <div class="report-section">
              <div class="rs-header professional">
                <span class="rs-icon">🎯</span>
                <h3>专业视点</h3>
              </div>
              <div class="report-text">
                <template v-if="finalVerdict.side === 'seller'">
                  <p v-if="part1SellerScore >= 25">
                    当前 IV 曲面处于
                    <strong>{{ part1CurrentStatus.label }}</strong> 区间（卖方得分 {{ part1SellerScore }} 分）。
                    IV 微笑曲线呈 {{ skewLabel }}，远期结构为 {{ termLabel }}。
                    Vega 敞口在当前 IV 百分位下处于 <strong>{{ ivPercentileLabel }}</strong>。
                  </p>
                  <p v-else>
                    ⚠️ IV 审计得分低于 25，IV 溢价安全垫不足。卖方在此环境下需承受 Vega 敞口压缩利润、Gamma 突然跳升引发账户剧烈波动的高风险。
                    当前不满足"标准"入场窗口，建议等待更好的 IV 回归均值机会。
                  </p>
                  <p>
                    策略层面，{{ part2Mode.label }}（{{ part2Score }} 分）：
                    {{ part2Mode.advice }}
                    {{ strategyData.confidence !== null && strategyData.confidence < 20
                      ? '需注意：当前信心不足，Gamma 方向不明，任何大波动都可能反向撕裂价差组合。' : '' }} {{ strategyData.ivCost !== null &&
                        strategyData.ivCost === 0 ? 'IV 极贵时做卖方有内在优势，但需严格计算 Portfolio Margin 占用，避免 Gamma Squeeze。' : '' }}
                      </p>
                      <p>
                        流动性维度（得分 {{ part3Score }} / 30）：
                        {{ part3Action.sub }}
                        {{ part3Score < 15 ? '⚠️ 在此流动性下开单将面临严重的 Bid-Ask Spread 磨损和无法及时退出风险，强制止损代价极高。' : '' }} 建议执行时使用 {{
                          part3Score >= 25 ? '标准限价单快速入场' : '冰山委托 / 中间价挂单' }}。
                      </p>
                </template>
                <template v-else>
                  <p v-if="part1BuyerScore >= 20">
                    当前 IV 曲面处于
                    <strong>{{ part1CurrentStatus.label }}</strong> 区间（买方得分 {{ part1BuyerScore }} 分）。
                    {{ ivScoreData.ivRvGap !== null && ivScoreData.ivRvGap < 0
                      ? 'IV-RV 存在负向价差，实际波动率（RV）高于隐含波动率（IV），存在潜在的 Gamma 爆发机会。' : '' }} {{
                        ivScoreData.ivPercentile === 'buyer_c' ? 'IV 百分位低于 25%，期权定价极其便宜，Vega 对买方极为有利。' : '' }} 远期结构为 {{
                        ivScoreData.termStructure !== null && ivScoreData.termStructure < 0 ? 'Backwardation（贴水）'
                          : 'Contango（升水）' }}， {{ ivScoreData.termStructure !== null && ivScoreData.termStructure < 0
                        ? '近期 IV 被恐慌溢价推高，买方在此入场可享受 IV 扩张带来的 Vega 双重收益。' : '远期 IV 相对偏高，注意 Theta 损耗节奏。' }} </p>
                      <p v-else>
                        ⚠️ 买方评分低于 20，IV 环境或空间不足以支撑买方头寸的 Theta 损耗。Gamma 爆发力不足。
                        当前判定为"{{ part1CurrentStatus.label }}"行情，强行买入将面临持续的时间价值衰减（Negative Theta）。
                      </p>
                      <p>
                        策略层面，{{ part2Mode.label }}（{{ part2Score }} 分）：
                        {{ part2Mode.advice }}
                        {{ ivCostWarning }}
                        {{ targetSpaceWarning }}
                      </p>
                      <p>
                        流动性维度（得分 {{ part3Score }} / 30）：
                        {{ part3Action.sub }}
                        {{ part3Score < 15 ? '⚠️ 低流动性下买入后若行情不利，将面临无流动性的平仓困境，无法有效止损。' : '' }} </p>
                </template>
              </div>
            </div>

            <!-- Plain Language -->
            <div class="report-section">
              <div class="rs-header plain">
                <span class="rs-icon">🗣️</span>
                <h3>换成大白话</h3>
              </div>
              <div class="report-text">
                <template v-if="finalVerdict.side === 'seller'">
                  <p v-if="part1SellerScore >= 25">
                    说人话：现在 IV 有点高（或者说相对合理），你卖期权能收到不少权利金。波动率后期如果降下来（这对买方来说是坏事），你卖的那些期权就会贬值，你就能把这笔权利金装进口袋。
                    就像保险公司收保费，只要不出大灾难（波动不大），你就赚钱。
                    当前分 {{ part1SellerScore }}，{{ part1CurrentStatus.label }}，{{ ivScoreData.termStructure !== null &&
                      ivScoreData.termStructure > 0 ? '市场在慢慢涨（Contango），卖远月合约可以稳定收钱。' :
                      '市场近期很恐慌（Backwardation），卖近月期权溢价高但风险也大。' }}
                  </p>
                  <p v-else>
                    ⚠️ 说人话：现在 IV 太低（溢价薄），或者市场波动预期大（IV 可能暴涨），卖期权收到的保费根本不够cover后期的损失。
                    就像保费收太便宜，理赔一次就亏光了。这时候做卖方是刀口舔血，{{ finalVerdict.side === 'seller' ? '强烈建议歇一歇。' : '' }}
                  </p>
                  <p>
                    策略建议：{{ part2Mode.label }}——
                    {{ part2Mode.advice }}
                    {{ strategyData.confidence !== null && strategyData.confidence < 20 ? '你的信心一般，别all in。' : '' }} {{
                      strategyData.ivCost !== null && strategyData.ivCost === 0 ? 'IV很贵，你如果这时候去卖期权，就是在高价出货，有优势。' : '' }}
                      </p>
                      <p>
                        手续费方面：{{ part3Action.label }}——
                        {{ part3Action.sub }}
                        {{ part3Score < 25 ? '手续费太贵了，你赚的钱可能还不够交手续费和滑点，净收益会被严重侵蚀。' : '这点手续费对你的交易来说不算什么，干就完了。' }} </p>
                </template>
                <template v-else>
                  <p v-if="part1BuyerScore >= 20">
                    说人话：现在期权价格很便宜，IV 百分位低，市场还没开始暴涨，你用很少的钱就能买到期权（权利金低）。
                    一旦行情真的启动了（Delta 变化），期权价格会涨得飞快（Gamma 效应），
                    而且 IV 可能会跟着涨（Vega），相当于双重收益。
                    就像在打折季买入了暴涨股期权，现在入场时机不错。
                  </p>
                  <p v-else>
                    ⚠️ 说人话：现在期权价格不够便宜，或者行情不够清晰，Theta（时间价值）每天都在偷偷扣你的钱。
                    你买的期权可能方向看对了，但还没等到暴涨，时间价值就损耗光了，最后还是亏。
                    这就是"{{ part1CurrentStatus.label }}"行情，空仓观望是上策。
                  </p>
                  <p>
                    策略建议：{{ part2Mode.label }}——
                    {{ part2Mode.advice }}
                    {{ strategyData.targetSpace !== null && strategyData.targetSpace === 0 ?
                      '市场在来回震荡，买期权在这种行情下会持续亏时间价值，赔率不划算。' : '' }}
                  </p>
                  <p>
                    流动性方面：{{ part3Action.label }}——
                    {{ part3Action.sub }}
                    {{ part3Score < 15 ? '买完以后如果想止损，可能根本找不到人接盘，只能自己压价卖，血亏。' : '流动性够好，进出自由。' }} </p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
/* ─── Page Layout ─────────────────────────────────────────────────────────── */
.score-page {
  padding: 20px;
  background: #f0f2f5;
  min-height: 100vh;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 8px;
  padding: 16px 24px;
  margin-bottom: 16px;
  border: 1px solid #e4e7ed;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 28px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}

.page-sub {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.verdict-badge {
  padding: 6px 16px;
  border-radius: 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.total-score {
  font-size: 32px;
  font-weight: 800;
  color: #2c3e50;
  line-height: 1;
}

.total-score span {
  font-size: 14px;
  font-weight: 400;
  color: #909399;
  margin-left: 2px;
}

/* ─── Side Toggle ────────────────────────────────────────────────────────── */
.side-toggle-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  white-space: nowrap;
}

.side-toggle {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 8px 20px;
  border: 2px solid #dcdfe6;
  border-radius: 20px;
  background: #fff;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

.toggle-btn:hover:not(.active) {
  border-color: #409eff;
  color: #409eff;
}

/* ─── Audit Cards ────────────────────────────────────────────────────────── */
.audit-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.part-tag {
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
  flex: 1;
}

.score-badge {
  font-size: 14px;
  font-weight: 800;
  flex-shrink: 0;
}

/* ─── Status Bar ─────────────────────────────────────────────────────────── */
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.advice-bar {
  padding: 8px 12px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 13px;
  color: #303133;
  margin-bottom: 16px;
  line-height: 1.5;
}

/* ─── Audit Items ────────────────────────────────────────────────────────── */
.audit-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audit-items.compact {
  gap: 10px;
}

.audit-item {
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 12px;
}

.audit-items.compact .audit-item {
  padding-bottom: 10px;
}

.audit-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.item-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  line-height: 1.4;
  text-align: left;
}

.audit-items.compact .item-label {
  margin-bottom: 6px;
}

.weight-tag {
  font-size: 11px;
  color: #909399;
  font-weight: 400;
  margin-left: 6px;
}

/* Radio Row (horizontal wrap) */
.radio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Radio Cards (vertical list) */
.radio-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ─── Part 1 Assessment Row ──────────────────────────────────────────────── */
.assessment-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
}

.assessment-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1.5px solid #e4e7ed;
  background: #fafafa;
  transition: all 0.2s;
}

.assessment-item.active {
  border-color: currentColor;
  background: #fff;
}

.ass-label {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
}

.ass-score {
  font-size: 18px;
  font-weight: 800;
  flex: 1;
}

.ass-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: currentColor;
  color: #fff;
}

/* ─── Action Row ─────────────────────────────────────────────────────────── */
.action-row {
  margin-bottom: 16px;
}

.generate-btn {
  width: 100%;
  padding: 14px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}

.generate-btn:hover {
  background: #66b1ff;
}

/* ─── Radar ──────────────────────────────────────────────────────────────── */
.radar-card {
  margin-bottom: 16px;
}

.radar-chart {
  width: 100%;
  height: 260px;
}

/* ─── Score List ─────────────────────────────────────────────────────────── */
.score-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-name {
  font-size: 13px;
  color: #606266;
  width: 80px;
  flex-shrink: 0;
}

.score-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f0f2f5;
  border-radius: 4px;
  overflow: hidden;
}

.score-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease, background 0.3s;
}

.total-bar {
  height: 10px;
}

.score-val {
  font-size: 13px;
  font-weight: 700;
  width: 66px;
  text-align: right;
  flex-shrink: 0;
}

.total-row {
  padding-top: 14px;
  border-top: 1px solid #f0f2f5;
}

.total-val {
  font-size: 15px;
}

/* ─── Report Panel ────────────────────────────────────────────────────────── */
.report-toggle {
  margin-bottom: 10px;
}

.toggle-report-btn {
  width: 100%;
  padding: 10px;
  background: #f5f7fa;
  border: 1.5px solid #e4e7ed;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-report-btn:hover {
  background: #ecf5ff;
  border-color: #409eff;
}

.report-body {
  padding: 16px 0 0;
  /* max-height: 60vh; */
  /* overflow-y: auto; */
}

/* Score Summary Row */
.report-score-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.rs-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  text-align: center;
  border: 1.5px solid #e4e7ed;
}

.rs-total {
  background: #f0f6ff;
  border-color: #409eff;
}

.rs-label {
  font-size: 11px;
  color: #909399;
  font-weight: 600;
}

.rs-val {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.rs-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  display: inline-block;
  align-self: center;
  color: #fff;
}

/* Report Sections */
.report-section {
  margin-bottom: 16px;
}

.rs-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.rs-header.professional {
  background: #ecf5ff;
  border-left: 3px solid #409eff;
}

.rs-header.plain {
  background: #f0f6ff;
  border-left: 3px solid #67c23a;
}

.rs-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #2c3e50;
}

.rs-icon {
  font-size: 16px;
}

.report-text {
  padding: 0 4px;
}

.report-text p {
  margin: 0 0 10px;
  font-size: 13px;
  color: #303133;
  line-height: 1.8;
}

.report-text p:last-child {
  margin-bottom: 0;
}

.report-text strong {
  color: #409eff;
  font-weight: 700;
}
</style>
