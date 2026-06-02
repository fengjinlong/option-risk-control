<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import ChartIvRv from './charts/ChartIvRv.vue'
import ChartVolCone from './charts/ChartVolCone.vue'
import Chart25dRr from './charts/Chart25dRr.vue'
import Chart25dFly from './charts/Chart25dFly.vue'
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="alert-body">
      <div class="charts-grid">
        <ChartVolCone />
        <ChartIvRv />
        <Chart25dRr />
        <Chart25dFly />
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
  padding: 12px 16px;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
</style>
