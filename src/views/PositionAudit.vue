<script setup lang="ts">
import { ref, computed, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import { ElButton, ElCard, ElRow, ElCol, ElAlert, ElDivider } from 'element-plus'
import * as echarts from 'echarts'

// ---------- 审计状态 ----------
type PositionSide = 'seller' | 'buyer'
const positionSide = ref<PositionSide>('seller')

// 1. IV vs RV
const ivRvAudit = ref<'below' | 'normal'>('normal')

// 2. 7天 RV 势态
const rvMomentumAudit = ref<'cross_up' | 'cross_down' | 'flat' | 'bottom_up'>('cross_down')

// 3. ATM 期限结构
const atmTermAudit = ref<'inflate' | 'collapse'>('collapse')

// 4. 波动率锥
const rrAudit = ref<'high' | 'normal'>('normal')
const flyAudit = ref<'high' | 'normal'>('normal')

// 5. 成交量与行权价分布
const oiWallAudit = ref<'in_wall' | 'outside'>('outside')

// ---------- 得分计算 ----------
const SCORES: Record<string, { seller: number; buyer: number }> = {
  ivRvBelow:   { seller: -15, buyer: +5  },
  ivRvNormal:  { seller:   0, buyer:  0  },
  rvCrossUp:   { seller: -15, buyer: +15 },
  rvCrossDown: { seller: +15, buyer: -15 },
  rvFlat:      { seller: +10, buyer:  -5 },
  rvBottomUp:  { seller:  -5, buyer:  +5 },
  atmInflate:  { seller: -10, buyer: +10 },
  atmCollapse: { seller:   0, buyer:   0 },
  rrHigh:      { seller: +10, buyer: -10 },
  rrNormal:    { seller:   0, buyer:   0 },
  flyHigh:     { seller: +10, buyer: -15 },
  flyNormal:   { seller:   0, buyer:   0 },
  oiInWall:    { seller:  -5, buyer:  -5 },
  oiOutside:   { seller:   0, buyer:   0 },
}

const sellerScore = computed(() => {
  let s = 0
  s += SCORES[ivRvAudit.value === 'below' ? 'ivRvBelow' : 'ivRvNormal'].seller
  s += SCORES[{ cross_up: 'rvCrossUp', cross_down: 'rvCrossDown', flat: 'rvFlat', bottom_up: 'rvBottomUp' }[rvMomentumAudit.value]].seller
  s += SCORES[atmTermAudit.value === 'inflate' ? 'atmInflate' : 'atmCollapse'].seller
  s += SCORES[rrAudit.value  === 'high' ? 'rrHigh'  : 'rrNormal'].seller
  s += SCORES[flyAudit.value === 'high' ? 'flyHigh' : 'flyNormal'].seller
  s += SCORES[oiWallAudit.value === 'in_wall' ? 'oiInWall' : 'oiOutside'].seller
  return s
})

const buyerScore = computed(() => {
  let b = 0
  b += SCORES[ivRvAudit.value === 'below' ? 'ivRvBelow' : 'ivRvNormal'].buyer
  b += SCORES[{ cross_up: 'rvCrossUp', cross_down: 'rvCrossDown', flat: 'rvFlat', bottom_up: 'rvBottomUp' }[rvMomentumAudit.value]].buyer
  b += SCORES[atmTermAudit.value === 'inflate' ? 'atmInflate' : 'atmCollapse'].buyer
  b += SCORES[rrAudit.value  === 'high' ? 'rrHigh'  : 'rrNormal'].buyer
  b += SCORES[flyAudit.value === 'high' ? 'flyHigh' : 'flyNormal'].buyer
  b += SCORES[oiWallAudit.value === 'in_wall' ? 'oiInWall' : 'oiOutside'].buyer
  return b
})

const totalScore = computed(() => {
  return positionSide.value === 'seller' ? sellerScore.value : buyerScore.value
})

const sellerDecision = computed(() => {
  const s = sellerScore.value
  if (s < -40)  return { level: 'danger',  label: '强行减仓', action: '强制减仓 50% 以上，无条件止损离场。' }
  if (s <= -15) return { level: 'warning', label: '暂停新仓', action: '暂停开立任何新头寸，立即修正 Gamma/Delta 对冲，买入尾部保险。' }
  return           { level: 'success', label: '平稳巡航', action: '禁止任何主观情绪化操作，坚定执行原有计划，静等 Theta 收租或 Gamma 兑现。' }
})

const buyerDecision = computed(() => {
  const s = buyerScore.value
  if (s < -40)  return { level: 'danger',  label: '强行减仓', action: '强制减仓 50% 以上，无条件止损离场。' }
  if (s <= -15) return { level: 'warning', label: '暂停新仓', action: '暂停开立任何新头寸，立即修正 Gamma/Delta 对冲，买入尾部保险。' }
  return           { level: 'success', label: '平稳巡航', action: '禁止任何主观情绪化操作，坚定执行原有计划，静等 Theta 收租或 Gamma 兑现。' }
})

const decision = computed(() => {
  return positionSide.value === 'seller' ? sellerDecision.value : buyerDecision.value
})

// ---------- 双指针仪表盘 ----------
const gaugeRef = ref<HTMLDivElement>()
const gaugeChart = shallowRef<echarts.ECharts | null>(null)

function drawGauge() {
  if (!gaugeChart.value) return
  gaugeChart.value.setOption({
    series: [
      {
        name: '卖方',
        type: 'gauge',
        center: ['35%', '55%'],
        radius: '70%',
        min: -60, max: 60,
        startAngle: 200, endAngle: -20,
        splitNumber: 6,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[-40/60, '#f56c6c'], [(-15)/60, '#e6a23c'], [1, '#67c23a']],
          },
        },
        pointer: { length: '55%', width: 6, itemStyle: { color: '#409eff' } },
        axisTick: { distance: -14, length: 5 },
        splitLine: { distance: -18, length: 8 },
        axisLabel: { fontSize: 9, distance: 22 },
        detail: { fontSize: 12, formatter: '{value}', color: '#2c3e50', offsetCenter: [0, '70%'] },
        title: { fontSize: 11, offsetCenter: [0, '90%'] },
        data: [{ value: sellerScore.value, name: '卖方总分' }],
      },
      {
        name: '买方',
        type: 'gauge',
        center: ['65%', '55%'],
        radius: '70%',
        min: -60, max: 60,
        startAngle: 200, endAngle: -20,
        splitNumber: 6,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[-40/60, '#f56c6c'], [(-15)/60, '#e6a23c'], [1, '#67c23a']],
          },
        },
        pointer: { length: '55%', width: 6, itemStyle: { color: '#ff4da2' } },
        axisTick: { distance: -14, length: 5 },
        splitLine: { distance: -18, length: 8 },
        axisLabel: { fontSize: 9, distance: 22 },
        detail: { fontSize: 12, formatter: '{value}', color: '#2c3e50', offsetCenter: [0, '70%'] },
        title: { fontSize: 11, offsetCenter: [0, '90%'] },
        data: [{ value: buyerScore.value, name: '买方总分' }],
      },
    ],
  })
}

watch([ivRvAudit, rvMomentumAudit, atmTermAudit, rrAudit, flyAudit, oiWallAudit], () => {
  drawGauge()
})

// ---------- 审计报告 ----------
const showReport = ref(false)

const reportContent = computed(() => {
  const side = positionSide.value === 'seller' ? '卖方' : '买方'
  const isSeller = positionSide.value === 'seller'

  const expertLines: string[] = []
  const plainLines: string[] = []

  // 1. IV vs RV
  if (ivRvAudit.value === 'below') {
    expertLines.push('IV 贴水流血状态确认：隐含波动率持续低于实际波动率（RV），卖方跨式/宽跨式组合处于贴水侵蚀状态。Vega 敞口呈负值积累，Theta 收取的保费正在被 IV 坍缩加速蚕食。Portfolio Margin 占用将随 IV 下滑而降低，但浮亏兑现窗口正在收窄。')
    plainLines.push('你的卖方仓位正在"贴水流血"——市场给的保费在不断变薄，账户实际上在亏隐含波动率的钱。现在收的 theta 保费还不够弥补 IV 下降带来的浮亏。')
  } else {
    expertLines.push('IV/RV 处于正常溢价区间，卖方 Vega 敞口处于健康正溢价状态。')
    plainLines.push('IV 和 RV 关系正常，卖方持仓的保费溢价合理，没有异常亏损风险。')
  }

  // 2. RV 动量
  const rvAdvices: Record<string, { expert: string; plain: string }> = {
    cross_up:   { expert: 'RV 动量上穿零轴，动能爆发确认。Gamma 敞口将进入非线性加速亏损区域，卖方需立即收紧 Delta 对冲频率。', plain: '波动率开始暴涨！买方的 gamma 要开始发力了，卖方账户会加速亏损。建议立刻减仓或做 Delta 对冲。' },
    cross_down: { expert: 'RV 动量下穿零轴，波动率势能衰竭。卖方可坚定持仓等待 Theta 加速释放。', plain: '波动率开始消停了，卖方可以安心收租 theta，买方这时候要小心别被耗死。' },
    flat:       { expert: 'RV 动量持续走平，市场进入极度低波死寂状态。Theta 衰减效率最大化，卖方处于最佳稳态经营区间。', plain: '市场平静得像死水一样，波动率一动不动。卖方这时候最舒服，躺赚 theta 保费。' },
    bottom_up:  { expert: 'RV 动量底部抬头，潜伏期结束信号出现。卖方应立即进入预警状态，严禁开立任何新卖单头寸。', plain: '波动率可能要动了！卖方要警惕，这时候千万别新开卖单，容易被 gamma 打脸。' },
  }
  expertLines.push(rvAdvices[rvMomentumAudit.value].expert)
  plainLines.push(rvAdvices[rvMomentumAudit.value].plain)

  // 3. ATM 期限结构
  if (atmTermAudit.value === 'inflate') {
    expertLines.push('ATM 期限结构全线膨胀（Now vs T-1），Vega 浮亏已在全线头寸中体现。卖方需关注近月头寸的 Gamma/Delta 突变风险。')
    plainLines.push('整个期限结构的隐含波动率都在涨，你的卖方账户正在全线浮亏。越接近短期的仓位亏得越多。')
  } else {
    expertLines.push('ATM 期限结构平稳或收缩，卖方 Vega 敞口处于可控范围。')
    plainLines.push('波动率期限结构正常，卖方持仓没有额外的 Vega 浮亏压力。')
  }

  // 4. 波动率锥
  if (rrAudit.value === 'high') {
    expertLines.push('25D RR 触及历史 75% 分位，偏斜进入极值区，均值回归概率增大，适合卖方布局反向套利。')
    plainLines.push('市场对看跌期权的需求特别高（RR 偏斜极高），这时候往往意味着恐慌情绪过头了，卖方可以考虑卖波动率反转赚回归的钱。')
  }
  if (flyAudit.value === 'high') {
    expertLines.push('25D FLY 触及历史 95% 分位，尾部恐慌溢价达到极值。卖方（特别是卖跨式）可积极收割高额肥尾保费，但须同步买入尾部保险对冲黑天鹅风险。')
    plainLines.push('市场对极端行情（暴涨暴跌）的恐慌达到了顶峰，大家都在疯狂买保险。卖方这时候卖保险赚得最多，但记得买一份，以防黑天鹅把自己炸了。')
  }

  // 5. OI 墙
  if (oiWallAudit.value === 'in_wall') {
    expertLines.push('标的价格进入大 OI 持仓墙区域，行情在此将受到强阻力/支撑。Delta 敞口面临剧烈摩擦，卖方需动态再平衡对冲。')
    plainLines.push('标的价格正好卡在主力仓位密集区，接下来可能会剧烈震荡洗盘。卖方账户的 Delta 可能会来回大幅摆动，对冲成本会明显上升。')
  }

  return { side, expertLines, plainLines }
})

function generateReport() {
  showReport.value = true
}

function onSideChange() {
  showReport.value = false
}

function onResize() {
  gaugeChart.value?.resize()
}

onMounted(() => {
  if (!gaugeRef.value) return
  gaugeChart.value = echarts.init(gaugeRef.value)
  drawGauge()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  gaugeChart.value?.dispose()
})
</script>

<template>
  <div class="audit-workspace">
    <!-- 顶部决策条 -->
    <div class="decision-bar">
      <div class="score-display" :class="`level-${decision.level}`">
        <span class="score-label">{{ positionSide === 'seller' ? '卖方' : '买方' }}审计总分</span>
        <span class="score-value">{{ totalScore }}</span>
      </div>
      <div class="decision-badge" :class="`badge-${decision.level}`">
        {{ decision.label }}
      </div>
      <div class="decision-action">{{ decision.action }}</div>
    </div>

    <el-row :gutter="16">
      <!-- 左侧审计选项 -->
      <el-col :xs="24" :sm="24" :md="12" :lg="10">
        <!-- 头寸类型选择 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">主营头寸视角</div>
          </template>
          <div class="side-toggle">
            <button
              class="side-btn"
              :class="{ active: positionSide === 'seller' }"
              @click="positionSide = 'seller'; onSideChange()"
            >卖方（Short Vol）</button>
            <button
              class="side-btn"
              :class="{ active: positionSide === 'buyer' }"
              @click="positionSide = 'buyer'; onSideChange()"
            >买方（Long Vol）</button>
          </div>
        </el-card>

        <!-- 1. IV vs RV -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">1. 行权日 IV vs RV 审计</div>
          </template>
          <div class="radio-cards">
            <div
              class="radio-card"
              :class="{ active: ivRvAudit === 'below' }"
              @click="ivRvAudit = 'below'"
            >
              <div class="card-title">IV 跌破 RV</div>
              <div class="card-sub">隐含波动率低于实际波动率，卖方处于贴水流血状态</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 -15</span>
                <span class="score-tag buyer">买方 +5</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: ivRvAudit === 'normal' }"
              @click="ivRvAudit = 'normal'"
            >
              <div class="card-title">IV 正常维持</div>
              <div class="card-sub">IV 维持在 RV 之上，溢价正常</div>
              <div class="card-scores">
                <span class="score-tag neutral">双方 0</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 2. 7天 RV 势态 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">2. 7天 RV 势态审计</div>
          </template>
          <div class="radio-cards">
            <div
              class="radio-card"
              :class="{ active: rvMomentumAudit === 'cross_up' }"
              @click="rvMomentumAudit = 'cross_up'"
            >
              <div class="card-title">黄线上穿零轴</div>
              <div class="card-sub">波动率动量向上突破</div>
              <div class="card-advice">动作：卖方减仓对冲；买方顺势上车</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 -15</span>
                <span class="score-tag buyer">买方 +15</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: rvMomentumAudit === 'cross_down' }"
              @click="rvMomentumAudit = 'cross_down'"
            >
              <div class="card-title">向下转零轴</div>
              <div class="card-sub">波动率动量衰竭</div>
              <div class="card-advice">动作：卖方坚定持仓收租；买方多头撤退</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 +15</span>
                <span class="score-tag buyer">买方 -15</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: rvMomentumAudit === 'flat' }"
              @click="rvMomentumAudit = 'flat'"
            >
              <div class="card-title">零轴下持续走平</div>
              <div class="card-sub">极度死寂行情</div>
              <div class="card-advice">动作：稳态经营，静待 Theta 释放</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 +10</span>
                <span class="score-tag buyer">买方 -5</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: rvMomentumAudit === 'bottom_up' }"
              @click="rvMomentumAudit = 'bottom_up'"
            >
              <div class="card-title">零轴下抬头向上</div>
              <div class="card-sub">潜伏期结束</div>
              <div class="card-advice">动作：进入预警状态，严禁新加卖单</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 -5</span>
                <span class="score-tag buyer">买方 +5</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 3. ATM 期限结构 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">3. ATM 波动率期限结构审计（Now vs T-1）</div>
          </template>
          <div class="radio-cards">
            <div
              class="radio-card"
              :class="{ active: atmTermAudit === 'inflate' }"
              @click="atmTermAudit = 'inflate'"
            >
              <div class="card-title">Now 整体上移</div>
              <div class="card-sub">全线近远期 ATM IV 膨胀</div>
              <div class="card-advice">核心：IV 剧烈膨胀，产生全线 Vega 浮亏</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 -10</span>
                <span class="score-tag buyer">买方 +10</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: atmTermAudit === 'collapse' }"
              @click="atmTermAudit = 'collapse'"
            >
              <div class="card-title">Now 下移或走平</div>
              <div class="card-sub">IV 坍缩或交织</div>
              <div class="card-scores">
                <span class="score-tag neutral">双方 0</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 4. 波动率锥 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">4. 波动率锥审计（结构极值）</div>
          </template>
          <div class="sub-section">
            <div class="sub-label">25D RR（风险反转偏斜）</div>
            <div class="radio-cards compact">
              <div
                class="radio-card"
                :class="{ active: rrAudit === 'high' }"
                @click="rrAudit = 'high'"
              >
                <div class="card-title">触及历史 75% 分位</div>
                <div class="card-sub">偏斜进入高位极值区</div>
                <div class="card-advice">审计：均值回归概率大，适合反向套利</div>
                <div class="card-scores">
                  <span class="score-tag seller">卖方 +10</span>
                  <span class="score-tag buyer">买方 -10</span>
                </div>
              </div>
              <div
                class="radio-card"
                :class="{ active: rrAudit === 'normal' }"
                @click="rrAudit = 'normal'"
              >
                <div class="card-title">正常区间</div>
                <div class="card-scores">
                  <span class="score-tag neutral">双方 0</span>
                </div>
              </div>
            </div>
          </div>
          <el-divider style="margin: 12px 0" />
          <div class="sub-section">
            <div class="sub-label">25D FLY（蝶式尾部恐慌）</div>
            <div class="radio-cards compact">
              <div
                class="radio-card"
                :class="{ active: flyAudit === 'high' }"
                @click="flyAudit = 'high'"
              >
                <div class="card-title">触及历史 95% 分位</div>
                <div class="card-sub">市场对极端尾部风险极度恐慌</div>
                <div class="card-advice">审计：肥尾溢价过高，卖方适合收割高保费</div>
                <div class="card-scores">
                  <span class="score-tag seller">卖方 +10</span>
                  <span class="score-tag buyer">买方 -15</span>
                </div>
              </div>
              <div
                class="radio-card"
                :class="{ active: flyAudit === 'normal' }"
                @click="flyAudit = 'normal'"
              >
                <div class="card-title">正常区间</div>
                <div class="card-scores">
                  <span class="score-tag neutral">双方 0</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 5. OI 墙 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">5. 成交量与行权价分布审计（最近3天盘口）</div>
          </template>
          <div class="radio-cards">
            <div
              class="radio-card"
              :class="{ active: oiWallAudit === 'in_wall' }"
              @click="oiWallAudit = 'in_wall'"
            >
              <div class="card-title">标的价格进入大 OI 持仓墙</div>
              <div class="card-sub">产生强阻力/支撑，行情极易剧烈洗盘</div>
              <div class="card-advice">核心：进入主力和做市商防守阵地，对买卖双方主观方向头寸均产生高摩擦</div>
              <div class="card-scores">
                <span class="score-tag seller">卖方 -5</span>
                <span class="score-tag buyer">买方 -5</span>
              </div>
            </div>
            <div
              class="radio-card"
              :class="{ active: oiWallAudit === 'outside' }"
              @click="oiWallAudit = 'outside'"
            >
              <div class="card-title">未进入大 OI 筹码密集区</div>
              <div class="card-scores">
                <span class="score-tag neutral">双方 0</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 生成报告按钮 -->
        <div class="report-btn-wrap">
          <el-button type="primary" size="large" @click="generateReport">
            生成持仓审计报告
          </el-button>
        </div>
      </el-col>

      <!-- 右侧仪表盘 + 报告 -->
      <el-col :xs="24" :sm="24" :md="12" :lg="14">
        <!-- 双指针仪表盘 -->
        <el-card class="audit-card" shadow="never">
          <template #header>
            <div class="card-header">实时双视角风控仪表盘</div>
          </template>
          <div ref="gaugeRef" class="gauge-chart" />
          <div class="gauge-legend">
            <div class="legend-item">
              <span class="dot" style="background:#f56c6c" /> 红色警报 &lt;-40
            </div>
            <div class="legend-item">
              <span class="dot" style="background:#e6a23c" /> 黄色预警 -40~-15
            </div>
            <div class="legend-item">
              <span class="dot" style="background:#67c23a" /> 绿色安全 &gt;-15
            </div>
          </div>
        </el-card>

        <!-- 审计报告 -->
        <transition name="fade-slide">
          <el-card v-if="showReport" class="audit-card report-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>持仓审计报告</span>
                <span class="report-score" :class="`score-${decision.level}`">
                  {{ positionSide === 'seller' ? '卖方' : '买方' }}总分：{{ totalScore }}
                </span>
              </div>
            </template>
            <el-alert
              :title="decision.label"
              :type="decision.level as any"
              :description="decision.action"
              :closable="false"
              style="margin-bottom:16px"
            />
            <div class="report-section">
              <div class="report-section-title">【专业视点】</div>
              <div
                v-for="(line, i) in reportContent.expertLines"
                :key="i"
                class="report-line"
              >{{ line }}</div>
            </div>
            <el-divider style="margin:12px 0" />
            <div class="report-section">
              <div class="report-section-title">【换成白话】</div>
              <div
                v-for="(line, i) in reportContent.plainLines"
                :key="i"
                class="report-line plain"
              >{{ line }}</div>
            </div>
          </el-card>
        </transition>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.audit-workspace {
  padding: 16px;
  background: #f5f7fa;
  min-height: calc(100vh - 56px);
}

/* 顶部决策条 */
.decision-bar {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}
.score-display.level-danger  .score-value { color: #f56c6c; }
.score-display.level-warning .score-value { color: #e6a23c; }
.score-display.level-success .score-value { color: #67c23a; }

.score-label {
  font-size: 11px;
  color: #909399;
}
.score-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
  color: #2c3e50;
}

.decision-badge {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
}
.badge-danger  { background: #fef0f0; color: #f56c6c; }
.badge-warning { background: #fdf6ec; color: #e6a23c; }
.badge-success { background: #f0f9eb; color: #67c23a; }

.decision-action {
  font-size: 12px;
  color: #606266;
  flex: 1;
}

/* 卡片 */
.audit-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 12px;
}

.card-header {
  font-size: 13px;
  font-weight: 700;
  color: #2c3e50;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 视角切换按钮 */
.side-toggle {
  display: flex;
  gap: 8px;
}
.side-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1.5px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.side-btn:hover {
  border-color: #409eff;
  color: #409eff;
}
.side-btn.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}

/* Radio Card */
.radio-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.radio-cards.compact {
  grid-template-columns: 1fr 1fr;
}

.radio-card {
  border: 1.5px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}
.radio-card:hover {
  border-color: #c0d8ff;
}
.radio-card.active {
  border-color: #409eff;
  border-width: 2px;
  background: #f0f7ff;
}

.card-title {
  font-size: 12px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}
.card-sub {
  font-size: 11px;
  color: #606266;
  margin-bottom: 4px;
}
.card-advice {
  font-size: 10px;
  color: #e6a23c;
  margin-bottom: 4px;
  font-style: italic;
}
.card-scores {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.score-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}
.score-tag.seller  { background: #ecf5ff; color: #409eff; }
.score-tag.buyer   { background: #fff0f7; color: #ff4da2; }
.score-tag.neutral { background: #f4f4f5; color: #909399; }

/* 子分区 */
.sub-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 600;
}

/* 仪表盘 */
.gauge-chart {
  width: 100%;
  height: 220px;
}
.gauge-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  font-size: 11px;
  color: #606266;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* 报告 */
.report-score {
  font-size: 14px;
  font-weight: 800;
}
.report-score.score-danger  { color: #f56c6c; }
.report-score.score-warning { color: #e6a23c; }
.report-score.score-success { color: #67c23a; }

.report-section-title {
  font-size: 13px;
  font-weight: 800;
  color: #409eff;
  margin-bottom: 8px;
}
.report-line {
  font-size: 12px;
  color: #2c3e50;
  line-height: 1.7;
  margin-bottom: 6px;
}
.report-line.plain {
  color: #606266;
  font-size: 12px;
}

.report-btn-wrap {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

/* 过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
