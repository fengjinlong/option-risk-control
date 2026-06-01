<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import request from '../utils/request'
import type { IvRvTrendsResponse1 } from '../types/account'
import AppHeader from '../components/AppHeader.vue'

const chartRef = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null
const loading = ref(false)

function formatDate(x: number) {
  const d = new Date(x)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateTime(x: number) {
  const d = new Date(x)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
}

function updateChart(res: IvRvTrendsResponse1) {
  if (!chartInstance) return

  const curves = res.data
  const seriesNames = ['30D ATM IV', '30D RV', '60D ATM IV', '60D RV']

  // 取第一条曲线的时间轴作为 x 轴
  const firstCurve = curves.find(c => seriesNames.includes(c.name))
  const dates = (firstCurve?.points ?? []).map(p => formatDate(p.x))



  const series = seriesNames.map(name => {
    const curve = curves.find(c => c.name === name)
    return {
      name,
      type: 'line' as const,
      data: (curve?.points ?? []).map(p => ({
        value: parseFloat((parseFloat(p.y) * 100).toFixed(2)),
        ts: p.x,
      })),
      smooth: true,
    }
  })

  const option: echarts.EChartsOption = {
    title: {
      text: 'ETH IV vs RV',
      textStyle: { fontSize: 14, fontWeight: 700 },
      subtextStyle: { fontSize: 10, color: '#888' },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const x = formatDateTime(params[0]?.data?.ts ?? params[0]?.axisValue)
        const rows = params.map(p => `${p.marker} ${p.seriesName}: ${p.value}%`).join('<br/>')
        return `${x}<br/>${rows}`
      },
    },
    legend: {
      data: series.map(s => s.name),
      top: 46,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 40, right: 20, top: 80, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '%',
      scale: true,
      axisLabel: { fontSize: 10, formatter: '{value}%' },
    },
    series,
  }
  chartInstance.setOption(option)
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get<IvRvTrendsResponse1>('/api/v1/market/iv-rv-trends')
    updateChart(res as unknown as IvRvTrendsResponse1)
  } finally {
    loading.value = false
  }
}

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  fetchData()
}

onMounted(() => {
  nextTick(() => {
    if (!chartRef.value) return
    chartInstance = echarts.init(chartRef.value)
    fetchData()
  })
})
onUnmounted(() => chartInstance?.dispose())
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="alert-body">
      <div class="page-title">开仓 IV 预警</div>

      <div class="chart-wrap" v-loading="loading">
        <div ref="chartRef" class="chart" />
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

.alert-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  text-align: left;
}

.chart-wrap {
  width: 50%;
}

.chart {
  width: 100%;
  height: 300px;
}
</style>
