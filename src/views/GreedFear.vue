<script setup lang="ts">
import { onMounted, reactive, onUnmounted, ref, computed } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent } from 'echarts/components'
import request from '../utils/request'

echarts.use([GaugeChart, CanvasRenderer, TooltipComponent])

// ── API types ─────────────────────────────────────────────────────────────────
interface MacroSentimentRadarResponse {
  status: string
  extracted_at_utc: string
  crypto_market: {
    status: 'success' | 'failed'
    error_msg?: string
    current_value: number
    year_min: number
    year_max: number
    sentiment_rank_pct: number
    sentiment_percentile_pct: number
  }
  us_stock_market: {
    status: 'success' | 'failed'
    error_msg?: string
    current_value: number
    year_min: number
    year_max: number
    sentiment_rank_pct: number
    sentiment_percentile_pct: number
  }
}

interface VixRiskRadarResponse {
  status: 'success' | 'failed'
  is_live_data_streaming: boolean
  error_msg?: string
  metrics: {
    live_vix_price: number
    rolling_1y_min: number
    rolling_1y_max: number
    vix_rank_style_pct: number
    vix_percentile_style_pct: number
    sample_size_days: number
  }
}

interface MarketAnalysisResponse {
  summary: string
  risk_tier: 'Low' | 'Medium' | 'High' | 'Extreme'
  cross_market_divergence: {
    professional_view: string
    plain_language: string
  }
  margin_and_liquidation_test: {
    professional_view: string
    plain_language: string
  }
  execution_matrix: string
}

// ── parse markdown table to array ─────────────────────────────────────────────
interface ExecutionRow {
  [key: string]: string
}

function parseMarkdownTable(markdown: string): { headers: string[]; rows: ExecutionRow[] } {
  const lines = markdown.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  // 解析表头 (去除 | 并过滤空字符串)
  const headers = lines[0].split('|').map(h => h.trim()).filter(h => h && !h.match(/^-+$/))

  // 跳过分隔行 (第二行通常是 |---|---|)
  const dataLines = lines.slice(2)
  const rows: ExecutionRow[] = dataLines.map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    const row: ExecutionRow = {}
    headers.forEach((header, i) => {
      row[header] = cells[i] || ''
    })
    return row
  })

  return { headers, rows }
}

// ── Two-layer gauge builder (bg arc + colored progress arc) ──────────────────
function gaugeColorAt(stops: { offset: number; color: string }[], ratio: number): string {
  for (let i = 0; i < stops.length; i++) {
    if (ratio <= stops[i].offset) return stops[i].color
  }
  return stops[stops.length - 1].color
}

function buildGauge(
  el: HTMLDivElement,
  value: number,
  max: number,
  colorStops: { offset: number; color: string }[],
  pointerColor: string,
  reversed?: boolean,
): echarts.ECharts {
  const instance = echarts.init(el, undefined, { renderer: 'canvas' })
  const safeValue = Math.min(value, max * 0.9999)
  const progressRatio = safeValue / max

  // Build reversed stops: never mutate colorStops.
  // For reversed, we want low ratio → last stop color, high ratio → first stop color.
  // Simply map each offset to 1 - offset (swaps which end it refers to),
  // without reversing the stop order.
  const stops = reversed
    ? colorStops.map(s => ({ offset: 1 - s.offset, color: s.color }))
    : colorStops
  const currentColor = gaugeColorAt(stops, progressRatio)

  const option = {
    animation: true,
    animationDuration: 1400,
    animationEasing: 'cubicOut' as const,
    series: [
      // Layer 1 – background arc
      {
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: { width: 16, color: [[1, '#bfdbfe']], roundCap: true },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { show: false },
        title: { show: false },
        data: [{ value: 0 }],
      },
      // Layer 2 – tick marks + pointer + center detail
      {
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: { width: 16, color: [[1, 'transparent']], roundCap: true },
        },
        progress: {
          show: true,
          width: 16,
          roundCap: true,
          itemStyle: { color: currentColor },
        },
        axisTick: {
          distance: -22,
          length: 8,
          lineStyle: { color: '#93c5fd', width: 1.5 },
        },
        splitLine: {
          distance: -26,
          length: 14,
          lineStyle: { color: '#60a5fa', width: 2.5 },
        },
        axisLabel: {
          color: '#60a5fa',
          distance: 14,
          fontSize: 11,
          fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
          formatter: (v: number) => (v % 25 === 0 ? String(Math.round(v)) : ''),
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '65%',
          width: 6,
          offsetCenter: [0, '-8%'],
          itemStyle: {
            color: pointerColor,
            shadowColor: pointerColor,
            shadowBlur: 16,
          },
        },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `{val|${v.toFixed(1)}}{unit|}`,
          rich: {
            val: {
              fontSize: 38,
              fontWeight: 800,
              color: pointerColor,
              fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
              padding: [0, 6, 0, 0],
            },
            unit: {
              fontSize: 14,
              color: '#60a5fa',
              fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
              verticalAlign: 'bottom',
              padding: [0, 0, 6, 0],
            },
          },
          offsetCenter: [0, '42%'],
        },
        title: {
          show: true,
          offsetCenter: [0, '75%'],
          color: '#3b82f6',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
        },
        data: [{ value: safeValue, name: '' }],
      },
      // Layer 3 – transparent bridge (prevents flash)
      {
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[progressRatio, 'transparent']],
            roundCap: true,
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { show: false },
        title: { show: false },
        data: [{ value: 0 }],
      },
      // Layer 4 – colored progress arc (0 → current value)
      {
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '92%',
        startAngle: 210,
        endAngle: 210 - 240 * progressRatio,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: { width: 16, color: [[progressRatio, currentColor]], roundCap: true },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { show: false },
        title: { show: false },
        data: [{ value: 0 }],
      },
    ],
  }
  instance.setOption(option)
  return instance
}

// ── chart instances ────────────────────────────────────────────────────────────
let charts: echarts.ECharts[] = []

// ── progress bar ─────────────────────────────────────────────────────────────
function buildProgressBar(
  el: HTMLDivElement,
  label: string,
  value: number,
  color: string,
): void {
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:11px;color:#6b7280;font-family:'JetBrains Mono','Helvetica Neue',monospace;">${label}</span>
      <span style="font-size:13px;color:${color};font-weight:800;font-family:'JetBrains Mono','Helvetica Neue',monospace;">${value.toFixed(1)}%</span>
    </div>
    <div style="height:4px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
      <div style="width:${value}%;height:100%;background:${color};border-radius:3px;transition:width 1.2s cubic-bezier(0.4,0,0.2,1);"></div>
    </div>`
}

// ── sentiment label (Crypto / US Stock) ────────────────────────────────────────
function fgSentimentLabel(value: number): string {
  if (value <= 20) return '极度恐慌 (Extreme Fear)'
  if (value <= 40) return '恐慌 (Fear)'
  if (value <= 60) return '中性 (Neutral)'
  if (value <= 75) return '贪婪 (Greed)'
  return '极度贪婪 (Extreme Greed)'
}

function fgSentimentClass(value: number): string {
  if (value <= 40) return 'fear'
  if (value <= 60) return 'neutral'
  if (value <= 75) return 'greed'
  return 'extreme-greed'
}

function fgSentimentColor(value: number): string {
  if (value <= 20) return '#166534'
  if (value <= 40) return '#16A34A'
  if (value <= 60) return '#D97706'
  if (value <= 75) return '#EA580C'
  return '#991B1B'
}

// ── VIX sentiment (低值=自满/贪婪, 高值=恐慌) ──────────────────────────────────
function vixSentimentLabel(value: number): string {
  if (value <= 12) return '极度自满 (Extreme Complacency)'
  if (value <= 15) return '乐观/贪婪 (Greed)'
  if (value <= 20) return '中性 (Neutral)'
  if (value <= 30) return '市场恐慌 (Fear)'
  return '极度恐慌 (Extreme Fear)'
}

function vixSentimentClass(value: number): string {
  if (value <= 15) return 'greed'
  if (value <= 20) return 'neutral'
  return 'fear'
}

function vixSentimentColor(value: number): string {
  if (value <= 12) return '#991B1B'
  if (value <= 15) return '#EA580C'
  if (value <= 20) return '#D97706'
  if (value <= 30) return '#16A34A'
  return '#166534'
}

// ── reactive state ────────────────────────────────────────────────────────────
const crypto = reactive({
  value: 0, yearMin: 0, yearMax: 100,
  ivRank: 0, ivPercentile: 0,
})
const usStock = reactive({
  value: 0, yearMin: 0, yearMax: 100,
  ivRank: 0, ivPercentile: 0,
})
const vix = reactive({ value: 0, vixRank: 0, vixPercentile: 0 })

const loading = ref(true)
const apiError = ref('')
const lastUpdated = ref('')

// ── market analysis state ─────────────────────────────────────────────────────
const marketAnalysis = ref<MarketAnalysisResponse | null>(null)
const analysisLoading = ref(false)
const analysisError = ref('')

// ── computed: parse execution matrix table ────────────────────────────────────
const executionMatrix = computed(() => {
  if (!marketAnalysis.value?.execution_matrix) return null
  return parseMarkdownTable(marketAnalysis.value.execution_matrix)
})

// ── update UI from data ───────────────────────────────────────────────────────
function renderCrypto(data: MacroSentimentRadarResponse['crypto_market']) {
  crypto.value = data.current_value
  crypto.yearMin = data.year_min
  crypto.yearMax = data.year_max
  crypto.ivRank = data.sentiment_rank_pct
  crypto.ivPercentile = data.sentiment_percentile_pct

  const el = document.getElementById('gauge-crypto') as HTMLDivElement
  if (el) {
    charts[0]?.dispose()
    charts[0] = buildGauge(
      el,
      crypto.value, 100,
      [
        { offset: 0, color: '#166534' },
        { offset: 0.20, color: '#166534' },
        { offset: 0.20, color: '#16A34A' },
        { offset: 0.40, color: '#16A34A' },
        { offset: 0.40, color: '#D97706' },
        { offset: 0.60, color: '#D97706' },
        { offset: 0.60, color: '#EA580C' },
        { offset: 0.75, color: '#EA580C' },
        { offset: 0.75, color: '#991B1B' },
        { offset: 1, color: '#991B1B' },
      ],
      '#16A34A',
    )
  }
  buildProgressBar(document.getElementById('crypto-rank') as HTMLDivElement, 'IV Rank', crypto.ivRank, '#818cf8')
  buildProgressBar(document.getElementById('crypto-pct') as HTMLDivElement, 'IV Percentile', crypto.ivPercentile, '#f87171')

  const sentimentEl = document.getElementById('crypto-sentiment')
  if (sentimentEl) {
    sentimentEl.textContent = fgSentimentLabel(crypto.value)
    sentimentEl.className = `gauge-sentiment ${fgSentimentClass(crypto.value)}`
    sentimentEl.style.color = fgSentimentColor(crypto.value)
  }
}

function renderUsStock(data: MacroSentimentRadarResponse['us_stock_market']) {
  usStock.value = data.current_value
  usStock.yearMin = data.year_min
  usStock.yearMax = data.year_max
  usStock.ivRank = data.sentiment_rank_pct
  usStock.ivPercentile = data.sentiment_percentile_pct

  const el = document.getElementById('gauge-usstock') as HTMLDivElement
  if (el) {
    charts[1]?.dispose()
    charts[1] = buildGauge(
      el,
      usStock.value, 100,
      [
        { offset: 0, color: '#166534' },
        { offset: 0.24, color: '#166534' },
        { offset: 0.24, color: '#16A34A' },
        { offset: 0.44, color: '#16A34A' },
        { offset: 0.44, color: '#D97706' },
        { offset: 0.55, color: '#D97706' },
        { offset: 0.55, color: '#EA580C' },
        { offset: 0.75, color: '#EA580C' },
        { offset: 0.75, color: '#991B1B' },
        { offset: 1, color: '#991B1B' },
      ],
      '#EA580C',
    )
  }
  buildProgressBar(document.getElementById('usstock-rank') as HTMLDivElement, 'IV Rank', usStock.ivRank, '#818cf8')
  buildProgressBar(document.getElementById('usstock-pct') as HTMLDivElement, 'IV Percentile', usStock.ivPercentile, '#22c55e')

  const sentimentEl = document.getElementById('usstock-sentiment')
  if (sentimentEl) {
    sentimentEl.textContent = fgSentimentLabel(usStock.value)
    sentimentEl.className = `gauge-sentiment ${fgSentimentClass(usStock.value)}`
    sentimentEl.style.color = fgSentimentColor(usStock.value)
  }
}

function renderVix(data: VixRiskRadarResponse['metrics']) {
  vix.value = data.live_vix_price
  vix.vixRank = data.vix_rank_style_pct
  vix.vixPercentile = data.vix_percentile_style_pct

  const el = document.getElementById('gauge-vix') as HTMLDivElement
  if (el) {
    charts[2]?.dispose()
    charts[2] = buildGauge(
      el,
      vix.value, 60,
      [
        { offset: 0, color: '#991B1B' },
        { offset: 0.20, color: '#991B1B' },
        { offset: 0.20, color: '#EA580C' },
        { offset: 0.25, color: '#EA580C' },
        { offset: 0.25, color: '#D97706' },
        { offset: 0.333, color: '#D97706' },
        { offset: 0.333, color: '#16A34A' },
        { offset: 0.50, color: '#16A34A' },
        { offset: 0.50, color: '#166534' },
        { offset: 1, color: '#166534' },
      ],
      vixSentimentColor(vix.value),
      true,
    )
  }
  buildProgressBar(document.getElementById('vix-rank') as HTMLDivElement, 'VIX Rank', vix.vixRank, '#f87171')
  buildProgressBar(document.getElementById('vix-pct') as HTMLDivElement, 'VIX Percentile', vix.vixPercentile, '#fb923c')

  const sentimentEl = document.getElementById('vix-sentiment')
  if (sentimentEl) {
    sentimentEl.textContent = vixSentimentLabel(vix.value)
    sentimentEl.className = `gauge-sentiment ${vixSentimentClass(vix.value)}`
    sentimentEl.style.color = vixSentimentColor(vix.value)
  }
}

// ── fetch data ───────────────────────────────────────────────────────────────
async function fetchData() {
  try {
    const [sentimentData, vixData] = await Promise.all([
      request.get('/api/v1/market/macro-sentiment-radar') as Promise<MacroSentimentRadarResponse>,
      request.get('/api/v1/market/vix-risk-radar') as Promise<VixRiskRadarResponse>,
    ])

    if (sentimentData.status === 'success') {
      if (sentimentData.crypto_market.status === 'success') {
        renderCrypto(sentimentData.crypto_market)
      }
      if (sentimentData.us_stock_market.status === 'success') {
        renderUsStock(sentimentData.us_stock_market)
      }
      lastUpdated.value = sentimentData.extracted_at_utc
    }

    if (vixData.status === 'success') {
      renderVix(vixData.metrics)
    }

    apiError.value = ''
  } catch (err: any) {
    apiError.value = err?.message ?? '数据加载失败'
  } finally {
    loading.value = false
  }
}

// ── copy data to clipboard ──────────────────────────────────────────────────────
async function copyData() {
  const data = {
    timestamp: new Date().toISOString(),
    crypto: {
      value: crypto.value,
      ivRank: crypto.ivRank,
      ivPercentile: crypto.ivPercentile,
    },
    usStock: {
      value: usStock.value,
      ivRank: usStock.ivRank,
      ivPercentile: usStock.ivPercentile,
    },
    vix: {
      value: vix.value,
      vixRank: vix.vixRank,
      vixPercentile: vix.vixPercentile,
    },
  }

  try {
    const text = JSON.stringify(data, null, 2)
    await navigator.clipboard.writeText(text)
    // 复制成功后发送分析请求
    await fetchMarketAnalysis()
    const { ElMessage } = await import('element-plus')
    ElMessage.success('数据已复制并分析')
  } catch {
    const { ElMessage } = await import('element-plus')
    ElMessage.error('操作失败，请重试')
  }
}

// ── fetch market analysis ──────────────────────────────────────────────────────
async function fetchMarketAnalysis() {
  if (crypto.value === 0 && usStock.value === 0 && vix.value === 0) return

  analysisLoading.value = true
  analysisError.value = ''

  try {
    const data = {
      timestamp: new Date().toISOString(),
      crypto: {
        value: crypto.value,
        ivRank: crypto.ivRank,
        ivPercentile: crypto.ivPercentile,
      },
      usStock: {
        value: usStock.value,
        ivRank: usStock.ivRank,
        ivPercentile: usStock.ivPercentile,
      },
      vix: {
        value: vix.value,
        vixRank: vix.vixRank,
        vixPercentile: vix.vixPercentile,
      },
    }

    const res = await request.post('/api/v1/market/analyze', data) as MarketAnalysisResponse
    marketAnalysis.value = res
  } catch (err: any) {
    analysisError.value = err?.message ?? '分析请求失败'
  } finally {
    analysisLoading.value = false
  }
}

// ── mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchData()
})

onUnmounted(() => {
  charts.forEach((c) => c?.dispose())
  charts = []
})
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="greed-fear-body">
      <div class="greed-fear-title">跨市场恐惧贪婪 &amp; 波动率仪表盘</div>

      <!-- ── 3-column gauge grid ──────────────────────────────────────── -->
      <div class="grid-cols-3 gap-6">
        <!-- Card 1: Crypto Fear & Greed -->
        <div class="gauge-card">
          <div class="gauge-card-header">
            <span class="gauge-card-label">Crypto Fear &amp; Greed</span>
            <span class="gauge-card-badge">加密市场</span>
          </div>
          <div id="gauge-crypto" class="gauge-canvas" />
          <div id="crypto-sentiment" class="gauge-sentiment">–</div>
          <div class="gauge-metrics">
            <div id="crypto-rank" class="metric-bar" />
            <div id="crypto-pct" class="metric-bar" />
          </div>
        </div>

        <!-- Card 2: US Stock Fear & Greed -->
        <div class="gauge-card">
          <div class="gauge-card-header">
            <span class="gauge-card-label">US Stock Fear &amp; Greed</span>
            <span class="gauge-card-badge greed">美股市场</span>
          </div>
          <div id="gauge-usstock" class="gauge-canvas" />
          <div id="usstock-sentiment" class="gauge-sentiment">–</div>
          <div class="gauge-metrics">
            <div id="usstock-rank" class="metric-bar" />
            <div id="usstock-pct" class="metric-bar" />
          </div>
        </div>

        <!-- Card 3: VIX -->
        <div class="gauge-card">
          <div class="gauge-card-header">
            <span class="gauge-card-label">CBOE VIX Index</span>
            <span class="gauge-card-badge warning">波动率</span>
          </div>
          <div id="gauge-vix" class="gauge-canvas" />
          <div id="vix-sentiment" class="gauge-sentiment" />
          <div class="gauge-metrics">
            <div id="vix-rank" class="metric-bar" />
            <div id="vix-pct" class="metric-bar" />
          </div>
        </div>
      </div>

      <!-- ── Status bar ──────────────────────────────────────────────── -->
      <div class="status-bar">
        <template v-if="loading">
          <span class="status-loading">⏳ 数据加载中...</span>
        </template>
        <template v-else-if="apiError">
          <span class="status-error">⚠️ {{ apiError }}</span>
        </template>
        <template v-else>
          <span class="status-ok">✅ 数据已更新</span>
          <span class="status-time">· 最后刷新: {{ lastUpdated }}</span>
        </template>
        <el-button type="success" class="status-copy" @click="copyData">📋 分析数据</el-button>
      </div>

      <!-- ── Comprehensive Market Summary ───────────────────────────── -->
      <div class="summary-panel" v-if="marketAnalysis">
        <div class="summary-title">
          <span class="summary-icon">⚡</span>
          Comprehensive Market Summary · 跨市场量化风控总结
          <span :class="['risk-tier-badge', `risk-tier-${marketAnalysis.risk_tier.toLowerCase()}`]">
            {{ marketAnalysis.risk_tier }}
          </span>
        </div>

        <!-- 一句话总结 -->
        <div class="summary-main">
          <div class="summary-main-label">🎯 风控总监冷酷一句话</div>
          <p class="summary-main-text">{{ marketAnalysis.summary }}</p>
        </div>

        <div class="summary-content">
          <!-- 跨市场情绪背离剖析 -->
          <div class="summary-col">
            <div class="col-heading">
              <span class="col-icon">📊</span>跨市场情绪背离剖析
            </div>
            <div class="analysis-block">
              <div class="analysis-label professional">⚡ 专业视点</div>
              <p v-html="marketAnalysis.cross_market_divergence.professional_view.replace(/\n/g, '<br>')" />
            </div>
            <div class="analysis-block">
              <div class="analysis-label plain">⚡ 换成白话</div>
              <p v-html="marketAnalysis.cross_market_divergence.plain_language.replace(/\n/g, '<br>')" />
            </div>
          </div>

          <div class="summary-divider" />

          <!-- 压力测试与保证金架构 -->
          <div class="summary-col">
            <div class="col-heading">
              <span class="col-icon">🧪</span>压力测试与保证金架构
            </div>
            <div class="analysis-block">
              <div class="analysis-label professional">⚡ 专业视点</div>
              <p v-html="marketAnalysis.margin_and_liquidation_test.professional_view.replace(/\n/g, '<br>')" />
            </div>
            <div class="analysis-block">
              <div class="analysis-label plain">⚡ 换成白话</div>
              <p v-html="marketAnalysis.margin_and_liquidation_test.plain_language.replace(/\n/g, '<br>')" />
            </div>
          </div>
        </div>

        <!-- 执行矩阵 -->
        <div class="execution-matrix" v-if="executionMatrix">
          <div class="col-heading">
            <span class="col-icon">📋</span>落地执行矩阵建议
          </div>
          <div class="table-wrapper">
            <table class="execution-table">
              <thead>
                <tr>
                  <th v-for="header in executionMatrix.headers" :key="header">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in executionMatrix.rows" :key="idx">
                  <td v-for="header in executionMatrix.headers" :key="header">{{ row[header] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div class="summary-panel" v-else-if="analysisLoading">
        <div class="analysis-loading">
          <span class="analysis-loading-text">⏳ AI 分析中...</span>
        </div>
      </div>

      <!-- Error state -->
      <div class="summary-panel" v-else-if="analysisError">
        <div class="analysis-error">
          <span>⚠️ {{ analysisError }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
  overflow: hidden;
}

.greed-fear-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.greed-fear-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.05em;
}

.grid-cols-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 900px) {
  .grid-cols-3 {
    grid-template-columns: 1fr;
  }
}

/* ── Gauge Card ─────────────────────────────────────────────────────── */
.gauge-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 24px;
  padding: 20px 16px 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.gauge-card-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.gauge-card-label {
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.gauge-card-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.03em;
}

.gauge-card-badge.greed {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border-color: rgba(34, 197, 94, 0.2);
}

.gauge-card-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border-color: rgba(245, 158, 11, 0.2);
}

.gauge-canvas {
  width: 100%;
  height: 200px;
}

.gauge-sentiment {
  font-size: 13px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.06em;
  margin-top: -4px;
  margin-bottom: 12px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  padding: 0 4px;
}

.status-loading {
  color: #60a5fa;
}

.status-error {
  color: #ef4444;
}

.status-ok {
  color: #22c55e;
}

.status-time {
  color: #9ca3af;
}

.status-copy {
  margin-left: auto;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
}



.gauge-metrics {
  width: 100%;
  padding: 0 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-bar {
  width: 100%;
}

/* ── Summary Panel ──────────────────────────────────────────────────── */
.summary-panel {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-left: 4px solid #f59e0b;
  border-radius: 20px;
  padding: 20px 24px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.05);
}

.summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #92400e;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-icon {
  font-size: 16px;
}

.summary-content {
  display: flex;
  gap: 24px;
}

@media (max-width: 768px) {
  .summary-content {
    flex-direction: column;
  }
}

.summary-col {
  flex: 1;
}

.col-heading {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.col-icon {
  font-size: 14px;
}

.summary-divider {
  width: 1px;
  background: rgba(203, 213, 225, 0.8);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .summary-divider {
    display: none;
  }
}

.summary-col p {
  font-size: 13px;
  color: #475569;
  line-height: 1.75;
  margin-bottom: 10px;
}

.summary-col p:last-child {
  margin-bottom: 0;
}

.summary-col strong {
  color: #1e293b;
  font-weight: 700;
}

.summary-col em {
  color: #b45309;
  font-style: normal;
}

/* ── Risk Tier Badge ─────────────────────────────────────────────────── */
.risk-tier-badge {
  margin-left: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.risk-tier-low {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.risk-tier-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.risk-tier-high {
  background: rgba(249, 115, 22, 0.15);
  color: #ea580c;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.risk-tier-extreme {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* ── Summary Main ─────────────────────────────────────────────────────── */
.summary-main {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.summary-main-label {
  font-size: 10px;
  font-weight: 700;
  color: #3b82f6;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.summary-main-text {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.7;
  margin: 0;
}

/* ── Analysis Block ────────────────────────────────────────────────────── */
.analysis-block {
  margin-bottom: 12px;
}

.analysis-block:last-child {
  margin-bottom: 0;
}

.analysis-label {
  font-size: 10px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.analysis-label.professional {
  color: #7c3aed;
}

.analysis-label.plain {
  color: #0891b2;
}

.analysis-block p {
  font-size: 13px;
  color: #475569;
  line-height: 1.75;
  margin: 0 0 8px;
}

.analysis-block p:last-child {
  margin-bottom: 0;
}

/* ── Execution Matrix ──────────────────────────────────────────────────── */
.execution-matrix {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(203, 213, 225, 0.5);
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 12px;
}

.execution-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
}

.execution-table th {
  background: rgba(59, 130, 246, 0.1);
  color: #1e40af;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid rgba(59, 130, 246, 0.2);
  font-weight: 700;
  white-space: nowrap;
}

.execution-table td {
  padding: 10px 12px;
  border: 1px solid rgba(203, 213, 225, 0.5);
  color: #374151;
  line-height: 1.6;
}

.execution-table tr:hover td {
  background: rgba(59, 130, 246, 0.03);
}

/* ── Analysis Loading & Error ─────────────────────────────────────────── */
.analysis-loading {
  text-align: center;
  padding: 40px 20px;
}

.analysis-loading-text {
  font-size: 14px;
  color: #60a5fa;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
}

.analysis-error {
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
  color: #ef4444;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
}
</style>
