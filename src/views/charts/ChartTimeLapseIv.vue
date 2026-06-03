<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'
import type { TimeLapseIvResponse } from '../../types/account'

const chartRef = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

function updateChart(data: TimeLapseIvResponse['value']) {
  if (!chart.value) return

  // 按时间戳升序排列（最老 -> 最新）
  const sorted = [...data].sort((a, b) => Number(a.name) - Number(b.name))

  // 确定 Now / T-1 / T-7 标签（sorted[0] 最老，sorted[2] 最新）
  const LABEL_MAP: Record<number, string> = {
    0: 'T-7',
    1: 'T-1',
    2: 'Now',
  }

  // 到期日升序排序（parseExpiry 辅助）
  function parseExpiry(s: string) {
    const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }
    const match = s.match(/^(\d+)([A-Z]{3})(\d+)$/)
    if (!match) return new Date(9999, 11, 31)
    return new Date(2000 + parseInt(match[3]), months[match[2]] ?? 0, parseInt(match[1]))
  }

  function sortExpiries(arr: string[]) {
    return [...arr].sort((a, b) => parseExpiry(a).getTime() - parseExpiry(b).getTime())
  }

  // x 轴：到期日升序排列
  const xData = sortExpiries((sorted[0]?.points ?? []).map(p => p.x))

  const colors = ['#b6d634', '#73d13d', '#ff4da2']

  const series = sorted.map((curve, idx) => ({
    name: LABEL_MAP[idx] ?? LABEL_MAP[0],
    type: 'line' as const,
    data: xData.map(x => {
      const pt = curve.points.find(p => p.x === x)
      return pt != null ? parseFloat((parseFloat(pt.y) * 100).toFixed(2)) : null
    }),
    smooth: true,
    connectNulls: false,
    color: colors[idx] ?? '#1890ff',
    lineStyle: { color: colors[idx] ?? '#1890ff' },
  }))

  chart.value.setOption({
    title: {
      text: 'ETH 25D RR Time-Lapse IV',
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
    const res = await request.get('/api/v1/market/time-lapse-iv', {
      params: { type: '25d-rr' },
    }) as { succ: boolean; value: TimeLapseIvResponse['value'] }
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
