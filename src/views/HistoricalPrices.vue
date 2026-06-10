<template>
  <div class="workspace">
    <AppHeader />
    <div class="historical-prices-body">
      <div class="historical-prices-title">历史价格</div>

      <div class="card">
        <div class="card-title">期权查询</div>
        <div class="select-row">
          <div class="field">
            <span class="field-label">行权日</span>
            <el-select
              v-model="selectedDate"
              size="default"
              placeholder="选择行权日"
              clearable
              filterable
              :loading="options.datesLoading"
              @change="handleDateChange"
            >
              <el-option
                v-for="d in options.dates"
                :key="d"
                :label="d"
                :value="d"
              />
            </el-select>
          </div>

          <div class="field flex-2">
            <span class="field-label">期权列表</span>
            <el-select
              v-model="selectedOption"
              size="default"
              placeholder="先选行权日"
              clearable
              filterable
              :disabled="!selectedDate || options.chainLoading"
              :loading="options.chainLoading && !!selectedDate"
              @change="handleOptionChange"
            >
              <el-option
                v-for="opt in currentChain"
                :key="opt.symbol"
                :label="opt.symbol"
                :value="opt.symbol"
              >
                <span class="opt-symbol">{{ opt.symbol }}</span>
                <span class="opt-iv">Delta {{ opt.greeks.delta.toFixed(4) }}</span>
                <span class="opt-iv">Theta {{ opt.greeks.theta.toFixed(4) }}</span>
                <span class="opt-iv">IV {{ opt.greeks.mark_iv.toFixed(1) }}%</span>
              </el-option>
            </el-select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRiskWorkspace } from '../composables/useRiskWorkspace'
import AppHeader from '../components/AppHeader.vue'

const {
  options,
  fetchDates,
  fetchChain,
} = useRiskWorkspace()

const selectedDate = ref('')
const selectedOption = ref('')

const currentChain = computed(() => {
  return (options.chainMap[selectedDate.value] ?? [])
})

function handleDateChange(date: string) {
  selectedOption.value = ''
  if (date) {
    fetchChain(date)
  }
}

function handleOptionChange(symbol: string) {
  if (symbol) {
    console.log('[HistoricalPrices] selected option:', symbol)
  }
}

onMounted(() => {
  fetchDates()
})
</script>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.historical-prices-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.historical-prices-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.card {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-left: 3px solid #faad14;
  border-radius: 8px;
  padding: 14px;
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.select-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.field.flex-2 {
  flex: 2;
}

.field .el-select {
  width: 100%;
}

.field-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.opt-symbol {
  font-size: 12px;
  font-weight: 600;
  margin-right: 8px;
}

.opt-iv {
  font-size: 12px;
  color: var(--el-text-color-disabled);
  padding: 0 10px;
}
</style>
