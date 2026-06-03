<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'
import type { AtmVolatilityV2Response } from '../../types/account'

const chartRef = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

function parseExpiry(s: string) {
  const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }
  const match = s.match(/^(\d+)([A-Z]{3})(\d+)$/)
  if (!match) return new Date(9999, 11, 31)
  return new Date(2000 + parseInt(match[3]), months[match[2]] ?? 0, parseInt(match[1]))
}

function sortExpiries(arr: string[]) {
  return [...arr].sort((a, b) => parseExpiry(a).getTime() - parseExpiry(b).getTime())
}

function updateChart(data: AtmVolatilityV2Response['value']) {
  if (!chart.value || !data.length) return

  // 按 timeMilli 升序排列（最老 -> 最新）
  const sorted = [...data].sort((a, b) => a.timeMilli - b.timeMilli)

  // Now = sorted[sorted.length - 1]，T-1 = sorted[sorted.length - 2]（如果存在）
  const nowData = sorted[sorted.length - 1]
  const t1Data = sorted.length >= 2 ? sorted[sorted.length - 2] : null

  // 只取 ATM IV 曲线
  const nowAtm = nowData?.lineGraphList.find(l => l.name === 'ATM IV')
  const t1Atm = t1Data?.lineGraphList.find(l => l.name === 'ATM IV')

  if (!nowAtm && !t1Atm) return

  // 到期日升序
  const allPoints = [...(nowAtm?.points ?? []), ...(t1Atm?.points ?? [])]
  const xData = sortExpiries([...new Set(allPoints.map(p => p.x))])

  const colors = ['#ff4da2', '#73d13d']
  const series: echarts.SeriesOption[] = []

  if (nowAtm) {
    series.push({
      name: 'Now',
      type: 'line',
      data: xData.map(x => {
        const pt = nowAtm.points.find(p => p.x === x)
        return pt != null ? parseFloat((parseFloat(pt.y) * 100).toFixed(2)) : null
      }),
      smooth: true,
      connectNulls: false,
      color: colors[0],
      lineStyle: { color: colors[0] },
    })
  }

  if (t1Atm) {
    series.push({
      name: 'T-1',
      type: 'line',
      data: xData.map(x => {
        const pt = t1Atm.points.find(p => p.x === x)
        return pt != null ? parseFloat((parseFloat(pt.y) * 100).toFixed(2)) : null
      }),
      smooth: true,
      connectNulls: false,
      color: colors[1],
      lineStyle: { color: colors[1] },
    })
  }

  chart.value.setOption({
    title: {
      text: 'ETH ATM IV 期限结构',
      textStyle: { fontSize: 13, fontWeight: 700 },
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { align: 'left' },
      formatter: (params: any[]) => {
        const expiry = params[0]?.axisValue
        const rows = params
          .map(p => `${p.marker} ${p.seriesName}: ${p.value != null ? p.value + '%' : '--'}`)
          .join('<br/>')
        return `${expiry}<br/>${rows}`
      },
    },
    legend: {
      data: series.map(s => s.name),
      top: 46,
      textStyle: { fontSize: 10 },
    },
    grid: { left: 40, right: 20, top: 80, bottom: 28 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
    },
    series,
  })
}

async function fetchData() {
  loading.value = true
  try {
    const res = await request.get('/api/v1/market/atm-vol-v2') as AtmVolatilityV2Response
    if (res.succ && res.value) {
      updateChart(res.value)
    }
  } finally {
    loading.value = false
  }
}

function onResize() {
  chart.value?.resize()
}

onMounted(() => {
  if (!chartRef.value) return
  chart.value = echarts.init(chartRef.value)
  fetchData()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chart.value?.dispose()
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
