<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const ALL_TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'AAVE']

const props = defineProps<{
  visible: boolean
  existingTickers: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'add', ticker: string): void
}>()

const searchQuery = ref('')

const availableTokens = computed(() => {
  return ALL_TOKENS.filter(ticker =>
    !props.existingTickers.includes(ticker) &&
    ticker.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

watch(() => props.visible, (val) => {
  if (val) {
    searchQuery.value = ''
  }
})

function handleSelect(ticker: string) {
  emit('add', ticker)
  emit('update:visible', false)
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="添加标的"
    width="400px"
  >
    <div class="add-token-modal">
      <el-input
        v-model="searchQuery"
        placeholder="搜索..."
        prefix-icon="Search"
        clearable
      />

      <div class="token-list">
        <div
          v-for="ticker in availableTokens"
          :key="ticker"
          class="token-item"
          @click="handleSelect(ticker)"
        >
          <span class="token-symbol">{{ ticker }}</span>
        </div>

        <div v-if="availableTokens.length === 0" class="empty-result">
          <p v-if="searchQuery">没有匹配的标的 "{{ searchQuery }}"</p>
          <p v-else>所有可选标的已添加</p>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.add-token-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.token-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.token-item {
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s;
}

.token-item:hover {
  background: var(--el-fill-color-light);
}

.token-item:not(:last-child) {
  border-bottom: 1px solid var(--el-border-color-light);
}

.token-symbol {
  font-weight: 600;
  font-size: 14px;
}

.empty-result {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.empty-result p {
  margin: 0;
  font-size: 13px;
}
</style>
