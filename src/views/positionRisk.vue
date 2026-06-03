<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import ChartIvRv from './charts/ChartIvRv.vue'
import ChartVolCone from './charts/ChartVolCone.vue'
import Chart25dRr from './charts/Chart25dRr.vue'
import Chart25dFly from './charts/Chart25dFly.vue'
import ChartTermStructure from './charts/ChartTermStructure.vue'
import ChartScore from './charts/ChartScore.vue'
import ChartRvMomentum from './charts/ChartRvMomentum.vue'
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="alert-body">
      <div class="charts-grid">
        <!-- <ChartVolCone /> -->
        <ChartIvRv />
        <ChartRvMomentum />
        <!-- <Chart25dRr /> -->
        <!-- <Chart25dFly /> -->
        <!-- <ChartTermStructure /> -->
        <!-- 评分 -->
      </div>
      <!-- <ChartScore /> -->
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
  padding: 12px 16px;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
</style>
