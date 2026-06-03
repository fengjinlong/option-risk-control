<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'
import type { IvRvTrendsResponse1 } from '../../types/account'

const chartRef = ref<HTMLDivElement>()
const ivRvChart = shallowRef<echarts.ECharts | null>(null)
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
  if (!ivRvChart.value) return

  const curves = res.data
  const seriesNames = ['30D ATM IV', '30D RV', '60D ATM IV', '60D RV']
  const firstCurve = curves.find(c => c.name === seriesNames[0]) ?? curves[0]
  const xData = (firstCurve?.points ?? []).map(p => p.x)

  const series = seriesNames.map(name => {
    const curve = curves.find(c => c.name === name)
    const pts = curve?.points ?? []
    const ptMap = new Map(pts.map(p => [p.x, p.y]))
    return {
      name,
      type: 'line' as const,
      data: xData.map(ts => {
        const y = ptMap.get(ts)
        return y != null
          ? { value: parseFloat((parseFloat(y) * 100).toFixed(2)), ts }
          : { value: null, ts }
      }),
      smooth: true,
      connectNulls: true,
    }
  })

  ivRvChart.value.setOption({
    title: { text: 'ETH IV vs RV', top: 0, textStyle: { fontSize: 13, fontWeight: 700 } },
    tooltip: {
      trigger: 'axis',
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const x = formatDateTime(params[0]?.data?.ts ?? params[0]?.axisValue)
        const rows = params.map(p => `${p.marker} ${p.seriesName}: ${p.value != null ? p.value + '%' : '--'}`).join('<br/>')
        return `${x}<br/>${rows}`
      },
    },
    legend: { data: series.map(s => s.name), top: 24, type: 'scroll', textStyle: { fontSize: 10 } },
    grid: { left: 40, right: 20, top: 52, bottom: 24 },
    xAxis: { type: 'category', data: xData.map(ts => formatDate(ts)), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: '', scale: true, axisLabel: { fontSize: 10, formatter: '{value}%' } },
    series,
  })
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

function onResize() {
  ivRvChart.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  ivRvChart.value = echarts.init(chartRef.value)
  fetchData()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  ivRvChart.value?.dispose()
})
</script>

<template>
  <div class="chart-card" v-loading="loading">
    <div ref="chartRef" class="chart" />
  </div>
</template>

<style scoped>
.chart-card {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 8px;
}

.chart {
  width: 100%;
  height: 310px;
}
</style>
