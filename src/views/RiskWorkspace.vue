<script setup lang="ts">
import Module1Context from './modules/Module1Context.vue'
import Module2Sandbox from './modules/Module2Sandbox.vue'
import Module3Evaluation from './modules/Module3Evaluation.vue'
</script>

<template>
  <div class="workspace">
    <header class="workspace-header">
      <div class="header-left">
        <span class="logo-text">📊</span>
        <span class="title">Pre-trade Risk Workspace</span>
      </div>
      <div class="header-right">
        <el-tag type="info" size="small">BTC-PERP</el-tag>
        <el-tag type="success" size="small">● LIVE</el-tag>
      </div>
    </header>

    <div class="workspace-body">
      <!-- Left: Context -->
      <aside class="col col-context">
        <Module1Context />
      </aside>

      <!-- Center: Sandbox -->
      <main class="col col-sandbox">
        <Module2Sandbox />
      </main>

      <!-- Right: Evaluation -->
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
  /* height: 100vh; */
  /* overflow: hidden; */
  background: var(--el-bg-color);
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: var(--el-fill-color);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-text {
  font-size: 18px;
}

.title {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.03em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-body {
  display: grid;
  grid-template-columns: 240px 1fr 360px;
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
