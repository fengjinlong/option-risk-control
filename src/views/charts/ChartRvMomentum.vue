<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'
import type { RvMomentumResponse } from '../../types/account'

const chartRef = ref<HTMLDivElement>()
const rvChart = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

function formatDate(ts: string | number) {
  const d = new Date(Number(ts))
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
}

function updateChart(data: RvMomentumResponse['value']) {
  if (!rvChart.value) return

  const seriesMap: Record<string, { data: (number | null)[]; ts: number[] }> = {}

  for (const curve of data) {
    const label = curve.name === '7' ? '7D RV' : '7D RV 动量'
    seriesMap[label] = { data: [], ts: [] }
    for (const pt of curve.data) {
      seriesMap[label].ts.push(Number(pt.time))
      seriesMap[label].data.push(parseFloat(pt.value))
    }
  }

  // 使用第一条曲线的时间轴作为 x 轴
  const firstKey = Object.keys(seriesMap)[0]
  const xData = firstKey ? seriesMap[firstKey].ts.map(t => formatDate(t)) : []

  const series = Object.entries(seriesMap).map(([name, s], idx) => ({
    name,
    type: 'line' as const,
    data: s.ts.map((t, i) => ({
      value: s.data[i],
      ts: t,
    })),
    smooth: true,
    connectNulls: false,
    yAxisIndex: name.includes('动量') ? 1 : 0,
  }))

  rvChart.value.setOption({
    title: {
      text: 'ETH 7D RV 势态',
      textStyle: { fontSize: 13, fontWeight: 700 },
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const x = formatDate(params[0]?.data?.ts ?? params[0]?.axisValue)
        const rows = params
          .map(p => `${p.marker} ${p.seriesName}: ${p.value != null ? p.value.toFixed(4) : '--'}`)
          .join('<br/>')
        return `${x}<br/>${rows}`
      },
    },
    legend: {
      data: Object.keys(seriesMap),
      top: 46,
      textStyle: { fontSize: 10 },
    },
    grid: { left: 40, right: 20, top: 80, bottom: 24 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        // name: 'RV',
        scale: true,
        axisLabel: { fontSize: 10, formatter: '{value}' },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
      },
      {
        type: 'value',
        // name: '动量',
        scale: true,
        axisLabel: { fontSize: 10, formatter: '{value}' },
        splitLine: { show: false },
      },
    ],
    series: series.map((s, idx) => ({
      ...s,
      color: idx === 0 ? '#1890ff' : '#ff7a00',
      lineStyle: { color: idx === 0 ? '#1890ff' : '#ff7a00' },
    })),
  })
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get<RvMomentumResponse>('/api/v1/market/rv-momentum')
    if (res.succ && res.value) {
      updateChart(res.value)
    }
  } finally {
    loading.value = false
  }
}

function onResize() {
  rvChart.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  rvChart.value = echarts.init(chartRef.value)
  fetchData()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  rvChart.value?.dispose()
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
