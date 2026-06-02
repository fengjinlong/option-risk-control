<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'
import type { TermStructureResponse } from '../../types/account'

const chartRef = ref<HTMLDivElement>()
const termChart = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

function parseDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d+)([A-Z]{3})(\d+)$/)
  if (!match) return new Date(9999, 11, 31)
  const day = parseInt(match[1])
  const month = MONTH_MAP[match[2]] ?? 0
  const year = 2000 + parseInt(match[3])
  return new Date(year, month, day)
}

function updateChart(data: TermStructureResponse['value']) {
  if (!termChart.value) return

  const allDates = [...new Set(data.flatMap(d => d.points.map(p => p.x)))]
    .sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime())

  const getY = (name: string) => {
    const curve = data.find(d => d.name === name)
    const map = new Map((curve?.points ?? []).map(p => [p.x, p.y]))
    return allDates.map(date => {
      const val = map.get(date)
      return val !== undefined ? parseFloat((parseFloat(val) * 100).toFixed(2)) : null
    })
  }

  const series = [
    { name: 'ATM', y: getY('ATM'), color: '#1890ff' },
    { name: '25D Put', y: getY('25D Put'), color: '#ff4da2' },
    { name: '25D Call', y: getY('25D Call'), color: '#73d13d' },
  ]

  const xData = allDates

  termChart.value.setOption({
    title: {
      text: 'ETH IV Term Structure',
      textStyle: { fontSize: 13, fontWeight: 700 },
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const t = params[0]?.axisValue
        const sorted = [...params].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        const rows = sorted.map(p =>
          `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background:${p.color};"></span> ${p.seriesName}: ${p.value}%`
        ).join('<br/>')
        return `${t}<br/>${rows}`
      },
    },
    legend: {
      data: series.map(s => s.name),
      top: 46, textStyle: { fontSize: 10 },
    },
    grid: { left: 40, right: 20, top: 80, bottom: 24 },
    xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 10, formatter: '{value}%' } },
    series: series.map(s => ({
      name: s.name,
      type: 'line' as const,
      data: s.y,
      smooth: true,
      connectNulls: true,
      color: s.color,
      lineStyle: { color: s.color },
    })),
  })
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get<TermStructureResponse>('/api/v1/market/term-structure')
    if (res.succ && res.value) {
      updateChart(res.value)
    }
  } finally {
    loading.value = false
  }
}

function onResize() {
  termChart.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  termChart.value = echarts.init(chartRef.value)
  fetchData()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  termChart.value?.dispose()
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
