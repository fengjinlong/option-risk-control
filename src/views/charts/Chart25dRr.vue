<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'

const chartRef = ref<HTMLDivElement>()
const skewChart = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

interface SkewVolConeItem {
  name: string
  points: { x: string; y: string }[]
}

function updateChart(data: SkewVolConeItem[]) {
  if (!skewChart.value) return

  const tenors = (data[0]?.points ?? []).map(p => p.x)

  const getY = (name: string) => {
    const curve = data.find(d => d.name === name)
    return (curve?.points ?? []).map(p => parseFloat((parseFloat(p.y) * 100).toFixed(2)))
  }

  const currentY = getY('Current')
  const lastLive = currentY[currentY.length - 1] ?? '--'

  const series = [
    { name: 'Maximum', y: getY('Maximum'), color: '#5070dd', dashed: false },
    { name: '75%', y: getY('75%'), color: '#73d13d', dashed: false },
    { name: 'Median', y: getY('Median'), color: '#1890ff', dashed: false },
    { name: '25%', y: getY('25%'), color: '#faad14', dashed: false },
    { name: 'Minimum', y: getY('Minimum'), color: '#b6d634', dashed: false },
    { name: 'Current', y: currentY, color: '#ff4da2', dashed: true },
  ]

  skewChart.value.setOption({
    title: {
      text: 'ETH 25D RR Volatility Cone 6M',
      textStyle: { fontSize: 13, fontWeight: 700 },
      subtextStyle: { fontSize: 10, color: '#f5d126' },
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const t = params[0]?.axisValue
        const rows = params.map(p => `${p.marker} ${p.seriesName}: ${p.value}%`).join('<br/>')
        return `${t}<br/>${rows}`
      },
    },
    legend: {
      data: series.map(s => s.name),
      top: 46, textStyle: { fontSize: 10 },
    },
    // grid: { left: 40, right: 20, top: 52, bottom: 24 },
    grid: { left: 40, right: 20, top: 80, bottom: 24 },
    xAxis: { type: 'category', data: tenors, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: '', scale: true, axisLabel: { fontSize: 10, formatter: '{value}%' } },
    series: series.map(s => ({
      name: s.name,
      type: 'line' as const,
      data: s.y,
      smooth: true,
      lineStyle: { color: s.color, type: s.dashed ? ('dashed' as const) : ('solid' as const) },
    })),
  })
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get<{ succ: boolean; value: SkewVolConeItem[] }>('/api/v1/market/skew-vol-cone', {
      params: { currency: 'ETH', type: '25d-rr' },
    })
    if (res.succ && res.value) {
      updateChart(res.value)
    }
  } finally {
    loading.value = false
  }
}

function onResize() {
  skewChart.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  skewChart.value = echarts.init(chartRef.value)
  fetchData()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  skewChart.value?.dispose()
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
