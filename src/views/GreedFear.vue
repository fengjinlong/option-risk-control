<script setup lang="ts">
import { onMounted, reactive, onUnmounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent } from 'echarts/components'

echarts.use([GaugeChart, CanvasRenderer, TooltipComponent])

// ── Gauge builder ──────────────────────────────────────────────────────────────
function buildGauge(
  el: HTMLDivElement,
  value: number,
  max: number,
  colorStops: { offset: number; color: string }[],
  center: [string, string],
  radius: string,
  pointerColor: string,
  splitLineColor: string,
  tickLineColor: string,
  axisLineColor: string,
        formatFn?: (v: number) => string,
): void {
  const instance = echarts.init(el, undefined, { renderer: 'canvas' })
  const option = {
    animation: true,
    animationDuration: 1200,
  animationEasing: 'cubicOut' as const,
    series: [
      {
        type: 'gauge',
        center,
        radius,
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 12,
            colorStops,
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '62%',
          width: 8,
          offsetCenter: [0, '-10%'],
          itemStyle: {
            color: pointerColor,
            shadowColor: pointerColor,
            shadowBlur: 12,
          },
        },
        axisTick: {
          distance: -18,
          length: 6,
          lineStyle: { color: tickLineColor, width: 1.5 },
        },
        splitLine: {
          distance: -22,
          length: 14,
          lineStyle: { color: splitLineColor, width: 2.5 },
        },
        axisLabel: {
          color: '#94a3b8',
          distance: 12,
          fontSize: 11,
          fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
          formatter: formatFn ?? ((v: number) => (v % 20 === 0 ? String(Math.round(v)) : '')),
        },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `{val|${v.toFixed(1)}}{unit|}`,
          rich: {
            val: {
              fontSize: 36,
              fontWeight: 700,
              color: pointerColor,
              fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
              padding: [0, 4, 0, 0],
            },
            unit: {
              fontSize: 14,
              color: '#94a3b8',
              fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
              verticalAlign: 'bottom',
              padding: [0, 0, 4, 0],
            },
          },
          offsetCenter: [0, '38%'],
        },
        title: {
          show: true,
          offsetCenter: [0, '72%'],
          color: '#64748b',
          fontSize: 11,
          fontFamily: '"JetBrains Mono", "Helvetica Neue", monospace',
        },
        data: [{ value, name: '' }],
      },
    ],
  }
  instance.setOption(option)
}

// ── chart refs ───────────────────────────────────────────────────────────────
let cryptoChart: echarts.ECharts | null = null
let usStockChart: echarts.ECharts | null = null
let vixChart: echarts.ECharts | null = null

// ── progress bar builder ─────────────────────────────────────────────────────
function buildProgressBar(
  el: HTMLDivElement,
  label: string,
  value: number,
  color: string,
): void {
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:11px;color:#94a3b8;font-family:'JetBrains Mono','Helvetica Neue',monospace;">${label}</span>
      <span style="font-size:12px;color:${color};font-weight:700;font-family:'JetBrains Mono','Helvetica Neue',monospace;">${value.toFixed(1)}%</span>
    </div>
    <div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden;">
      <div style="width:${value}%;height:100%;background:${color};border-radius:2px;transition:width 1s ease;"></div>
    </div>`
}

// ── reactive state ────────────────────────────────────────────────────────────
const crypto = reactive({ value: 32, ivRank: 42.5, ivPercentile: 38.1 })
const usStock = reactive({ value: 68, ivRank: 18.2, ivPercentile: 22.4 })
const vix = reactive({ value: 22.5, vixRank: 78.9, vixPercentile: 82.1 })

// ── mount ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  // Crypto Fear & Greed
  buildGauge(
    document.getElementById('gauge-crypto') as HTMLDivElement,
    crypto.value, 100,
    [
      { offset: 0, color: '#EF4444' },
      { offset: 0.2, color: '#EF4444' },
      { offset: 0.4, color: '#F97316' },
      { offset: 0.6, color: '#EAB308' },
      { offset: 0.75, color: '#84CC16' },
      { offset: 1, color: '#22C55E' },
    ],
    ['50%', '55%'], '88%',
    '#F97316', '#334155', '#475569', '#1e293b',
  )
  buildProgressBar(
    document.getElementById('crypto-rank') as HTMLDivElement,
    'IV Rank', crypto.ivRank, '#60a5fa',
  )
  buildProgressBar(
    document.getElementById('crypto-pct') as HTMLDivElement,
    'IV Percentile', crypto.ivPercentile, '#818cf8',
  )

  // US Stock Fear & Greed
  buildGauge(
    document.getElementById('gauge-usstock') as HTMLDivElement,
    usStock.value, 100,
    [
      { offset: 0, color: '#EF4444' },
      { offset: 0.24, color: '#EF4444' },
      { offset: 0.44, color: '#F97316' },
      { offset: 0.55, color: '#EAB308' },
      { offset: 0.75, color: '#84CC16' },
      { offset: 1, color: '#22C55E' },
    ],
    ['50%', '55%'], '88%',
    '#84CC16', '#334155', '#475569', '#1e293b',
  )
  buildProgressBar(
    document.getElementById('usstock-rank') as HTMLDivElement,
    'IV Rank', usStock.ivRank, '#60a5fa',
  )
  buildProgressBar(
    document.getElementById('usstock-pct') as HTMLDivElement,
    'IV Percentile', usStock.ivPercentile, '#818cf8',
  )

  // VIX
  buildGauge(
    document.getElementById('gauge-vix') as HTMLDivElement,
    vix.value, 60,
    [
      { offset: 0, color: '#22C55E' },
      { offset: 0.2, color: '#22C55E' },
      { offset: 0.25, color: '#84CC16' },
      { offset: 0.333, color: '#EAB308' },
      { offset: 0.5, color: '#F97316' },
      { offset: 1, color: '#EF4444' },
    ],
    ['50%', '55%'], '88%',
    '#F97316', '#334155', '#475569', '#1e293b',
  )
  buildProgressBar(
    document.getElementById('vix-rank') as HTMLDivElement,
    'VIX Rank', vix.vixRank, '#f87171',
  )
  buildProgressBar(
    document.getElementById('vix-pct') as HTMLDivElement,
    'VIX Percentile', vix.vixPercentile, '#fb923c',
  )
})

onUnmounted(() => {
  cryptoChart?.dispose()
  usStockChart?.dispose()
  vixChart?.dispose()
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
          <div class="gauge-sentiment fear">恐慌 (Fear)</div>
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
          <div class="gauge-sentiment greed">贪婪 (Greed)</div>
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
          <div class="gauge-sentiment fear">市场恐慌 (Fear)</div>
          <div class="gauge-metrics">
            <div id="vix-rank" class="metric-bar" />
            <div id="vix-pct" class="metric-bar" />
          </div>
        </div>
      </div>

      <!-- ── Comprehensive Market Summary ───────────────────────────── -->
      <div class="summary-panel">
        <div class="summary-title">
          <span class="summary-icon">⚡</span>
          Comprehensive Market Summary · 跨市场量化风控总结
        </div>
        <div class="summary-content">
          <div class="summary-col">
            <div class="col-heading">
              <span class="col-icon">📊</span>专业量化视点
            </div>
            <p>
              当前美股现货情绪录得 <strong>68（贪婪区间）</strong>，而 VIX Percentile 却高达
              <strong>82.1%</strong>，呈现典型的<em>结构性背离</em>。
              这种"表面歌舞升平、机构暗中买保险"的格局，是机构实施
              <strong>尾部风险对冲（Tail-Risk Hedging）</strong>
              的经典信号——机构通过期权组合构建保险链，以较低成本锁定极端行情下的流动性缺口。
            </p>
            <p>
              同时，加密市场已提前进入 <strong>32（恐慌区间）</strong>，IV Percentile 仅
              <strong>38.1%</strong>，表明衍生品市场已充分定价去杠杆清算阶段，
              波动率风险溢价（VRP）持续收窄。
            </p>
          </div>
          <div class="summary-divider" />
          <div class="summary-col">
            <div class="col-heading">
              <span class="col-icon">🗣️</span>交易员风控白话
            </div>
            <p>
              翻译成人话就是：<strong>散户在冲锋，主力在找退路。</strong>
              美股涨得欢，但聪明钱正在悄悄买入看跌期权（Put），
              用期权卖方的话说就是——<em>Gamma Scalp 的空间在变大</em>，
              但尾部对冲的成本（VIX Rank 78.9%）在告诉你：
              <strong>这不是一个可以闭眼梭哈的市场。</strong>
            </p>
            <p>
              <strong>⚠️ 期权卖方和高杠杆交易者注意：</strong>收紧保证金预留，
              不要在高位追涨美股ETF或加密杠杆代币。
              如果你还在裸卖虚值期权，请立即检查你的希腊字母敞口（Greeks Exposure）。
            </p>
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
  height: 100vh;
  background: #020617;
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
  color: #e2e8f0;
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
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 20px;
  padding: 20px 16px 24px;
  backdrop-filter: blur(12px);
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
  margin-bottom: 8px;
}

.gauge-card-label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.04em;
}

.gauge-card-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
}

.gauge-card-badge.greed {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.3);
}

.gauge-card-badge.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.3);
}

.gauge-canvas {
  width: 100%;
  height: 220px;
}

.gauge-sentiment {
  font-size: 13px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Helvetica Neue', monospace;
  letter-spacing: 0.06em;
  margin-top: -8px;
  margin-bottom: 14px;
}

.gauge-sentiment.fear {
  color: #f97316;
}

.gauge-sentiment.greed {
  color: #84cc16;
}

.gauge-metrics {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-bar {
  width: 100%;
}

/* ── Summary Panel ──────────────────────────────────────────────────── */
.summary-panel {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-left: 4px solid #f59e0b;
  border-radius: 20px;
  padding: 20px 24px;
  backdrop-filter: blur(12px);
}

.summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #fbbf24;
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
  background: rgba(51, 65, 85, 0.6);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .summary-divider {
    display: none;
  }
}

.summary-col p {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.75;
  margin-bottom: 10px;
}

.summary-col p:last-child {
  margin-bottom: 0;
}

.summary-col strong {
  color: #e2e8f0;
  font-weight: 700;
}

.summary-col em {
  color: #fbbf24;
  font-style: normal;
}
</style>
