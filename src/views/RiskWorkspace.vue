<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import Module1Context from './modules/Module1Context.vue'
import Module2Sandbox from './modules/Module2Sandbox.vue'
import Module3Evaluation from './modules/Module3Evaluation.vue'
import { useRiskWorkspace } from '../composables/useRiskWorkspace'

const { fetchHealth, fetchPrices, fetchVolRadar } = useRiskWorkspace()

onMounted(() => {
  fetchHealth()
  fetchPrices()
  fetchVolRadar()
})
</script>

<template>
  <div class="workspace">
    <AppHeader />

    <div class="workspace-body">
      <aside class="col col-context">
        <Module1Context />
      </aside>

      <main class="col col-sandbox">
        <Module2Sandbox />
      </main>

      <aside class="col col-eval">
        <Module3Evaluation />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}

.workspace-body {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  flex: 1;
  overflow: hidden;
}

.col {
  overflow: hidden;
  border-right: 1px solid var(--el-border-color);
}

.col:last-child {
  border-right: none;
}

.col-context {
  background: var(--el-fill-color-lighter);
}

.col-sandbox {
  background: var(--el-bg-color);
}

.col-eval {
  background: var(--el-fill-color-lighter);
}
</style>
