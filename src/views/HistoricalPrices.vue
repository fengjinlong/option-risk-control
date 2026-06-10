<template>
  <div class="workspace">
    <AppHeader />
    <div class="historical-prices-body">
      <div class="historical-prices-title">历史价格</div>

      <div class="card">
        <div class="card-title">期权查询</div>
        <div class="select-row">
          <div class="field">
            <span class="field-label">行权日</span>
            <el-select v-model="selectedDate" size="default" placeholder="选择行权日" clearable filterable
              :loading="options.datesLoading" @change="handleDateChange">
              <el-option v-for="d in options.dates" :key="d" :label="d" :value="d" />
            </el-select>
          </div>

          <div class="field flex-2">
            <span class="field-label">期权列表</span>
            <el-select v-model="selectedOption" size="default" placeholder="先选行权日" clearable filterable
              :disabled="!selectedDate || options.chainLoading" :loading="options.chainLoading && !!selectedDate"
              @change="handleOptionChange">
              <el-option v-for="opt in currentChain" :key="opt.symbol" :label="opt.symbol" :value="opt.symbol">
                <span class="opt-symbol">{{ opt.symbol }}</span>
                <span class="opt-iv">Delta {{ opt.greeks.delta.toFixed(4) }}</span>
                <span class="opt-iv">Theta {{ opt.greeks.theta.toFixed(4) }}</span>
                <span class="opt-iv">IV {{ opt.greeks.mark_iv.toFixed(1) }}%</span>
              </el-option>
            </el-select>
          </div>
        </div>
      </div>

      <div v-if="selectedOption" class="charts-row" v-loading="chartLoading">
        <div class="chart-card chart-panel">
          <div ref="priceChartRef" class="chart" />
          <div v-if="!chartLoading && chartData.length === 0" class="empty-chart-overlay">
            暂无数据
          </div>
        </div>
        <div class="chart-card chart-panel">
          <div ref="rangeChartRef" class="chart" />
          <div v-if="!chartLoading && chartData.length === 0" class="empty-chart-overlay">
            暂无数据
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useRiskWorkspace } from '../composables/useRiskWorkspace'
import AppHeader from '../components/AppHeader.vue'

const {
  options,
  fetchDates,
  fetchChain,
} = useRiskWorkspace()

const selectedDate = ref('')
const selectedOption = ref('')
const priceChartRef = ref<HTMLDivElement>()
const rangeChartRef = ref<HTMLDivElement>()
const priceChart = ref<echarts.ECharts | null>(null)
const rangeChart = ref<echarts.ECharts | null>(null)
const chartLoading = ref(false)
const chartData = ref<HistoricalHourItem[]>([])

// const COINDESK_BASE = 'https://data-api.coindesk.com/options/v1/historical/hours'
const COINDESK_BASE = 'https://data-api.coindesk.com/options/v1/historical/days'

interface HistoricalHourItem {
  UNIT: 'HOUR' | string
  TIMESTAMP: number
  OPEN: number
  HIGH: number
  LOW: number
  CLOSE: number
}

interface GetHistoricalHoursResponse {
  Data: HistoricalHourItem[]
}

const currentChain = computed(() => {
  return (options.chainMap[selectedDate.value] ?? [])
})

function handleDateChange(date: string) {
  selectedOption.value = ''
  if (date) {
    fetchChain(date)
  }
}

async function handleOptionChange(symbol: string) {
  if (!symbol) return
  chartData.value = []
  await nextTick()
  await initCharts()
  await fetchHistoricalHours(symbol)
}

async function initCharts() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 50))
  if (priceChartRef.value && !priceChart.value) {
    priceChart.value = echarts.init(priceChartRef.value)
  }
  if (rangeChartRef.value && !rangeChart.value) {
    rangeChart.value = echarts.init(rangeChartRef.value)
  }
}

async function fetchHistoricalHours(instrument: string) {
  chartLoading.value = true
  try {
    const params = new URLSearchParams({
      market: 'bybit',
      instrument,
      groups: 'OHLC',
      limit: '300',
      aggregate: '1',
      fill: 'true',
      apply_mapping: 'true',
    })
    const res = await fetch(`${COINDESK_BASE}?${params}`)
    const json: GetHistoricalHoursResponse = await res.json()
    const sorted = (json.Data ?? []).sort((a, b) => a.TIMESTAMP - b.TIMESTAMP)
    await nextTick()
    chartData.value = sorted
    if (sorted.length > 0) {
      updateCharts(sorted)
    }
  } catch (e) {
    console.error('[HistoricalPrices] fetchHistoricalHours error:', e)
    chartData.value = []
  } finally {
    chartLoading.value = false
  }
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateCharts(data: HistoricalHourItem[]) {
  if (data.length === 0) return

  const timestamps = data.map(d => formatTime(d.TIMESTAMP))
  const commonOpts = {
    tooltip: {
      trigger: 'axis' as const,
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const ts = params[0]?.axisValue
        const rows = params
          .map(p => `${p.marker} ${p.seriesName}: $${p.value?.toFixed(4) ?? '--'}`)
          .join('<br/>')
        return `${ts}<br/>${rows}`
      },
    },
    grid: { left: 56, right: 20, top: 36, bottom: 32 },
    xAxis: {
      type: 'category' as const,
      data: timestamps,
      axisLabel: { fontSize: 9, rotate: 30 },
    },
    yAxis: {
      type: 'value' as const,
      scale: true,
      axisLabel: { fontSize: 10, formatter: (v: number) => '$' + v.toFixed(4) },
      splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
    },
  }

  if (priceChart.value) {
    priceChart.value.setOption({
      title: { text: '最高价 / 最低价', textStyle: { fontSize: 13, fontWeight: 700 } },
      ...commonOpts,
      legend: { top: 8, right: 20, textStyle: { fontSize: 10 } },
      series: [
        {
          name: 'HIGH',
          type: 'line',
          data: data.map(d => d.HIGH),
          smooth: true,
          connectNulls: true,
          color: '#52c41a',
        },
        {
          name: 'LOW',
          type: 'line',
          data: data.map(d => d.LOW),
          smooth: true,
          connectNulls: true,
          color: '#ff4d4f',
        },
      ],
    }, { notMerge: true })
    priceChart.value.resize()
  }

  if (rangeChart.value) {
    const rangeData = data.map(d => +(d.HIGH - d.LOW).toFixed(4))
    rangeChart.value.setOption({
      title: { text: '振幅 (HIGH - LOW)', textStyle: { fontSize: 13, fontWeight: 700 } },
      ...commonOpts,
      yAxis: {
        type: 'value' as const,
        scale: true,
        axisLabel: { fontSize: 10, formatter: (v: number) => v.toFixed(4) },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
      },
      series: [{
        name: '振幅',
        type: 'line',
        data: rangeData,
        smooth: true,
        connectNulls: true,
        color: '#1677ff',
        areaStyle: { color: 'rgba(22,119,255,0.08)' },
      }],
    }, { notMerge: true })
    rangeChart.value.resize()
  }
}

function onResize() {
  priceChart.value?.resize()
  rangeChart.value?.resize()
}

onMounted(() => {
  fetchDates()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  priceChart.value?.dispose()
  rangeChart.value?.dispose()
})
</script>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.historical-prices-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.historical-prices-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

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

.select-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.field.flex-2 {
  flex: 2;
}

.field .el-select {
  width: 100%;
}

.field-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.opt-symbol {
  font-size: 12px;
  font-weight: 600;
  margin-right: 8px;
}

.opt-iv {
  font-size: 12px;
  color: var(--el-text-color-disabled);
  padding: 0 10px;
}

.charts-row {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.chart-card {
  flex: 1;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 8px;
}

.chart {
  width: 100%;
  height: 340px;
}

.chart-panel {
  position: relative;
}

.empty-chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  background: var(--el-fill-color-lighter);
}
</style>
