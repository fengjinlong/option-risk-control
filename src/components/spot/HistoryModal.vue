<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { formatDisplay } from '../../composables/useCryptoMath'
import type { Transaction } from '../../composables/useSpotPortfolio'

const props = defineProps<{
  visible: boolean
  ticker: string
  transactions: Transaction[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'delete', txId: string): void
}>()

const confirmDeleteId = ref<string | null>(null)

const sortedTransactions = computed(() => {
  return [...props.transactions].sort((a, b) => b.timestamp - a.timestamp)
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function handleDelete(tx: Transaction) {
  if (confirmDeleteId.value === tx.id) {
    emit('delete', tx.id)
    confirmDeleteId.value = null
    ElMessage.success('交易已删除')
  } else {
    confirmDeleteId.value = tx.id
    ElMessage.warning('再次点击确认删除')
    setTimeout(() => {
      if (confirmDeleteId.value === tx.id) {
        confirmDeleteId.value = null
      }
    }, 3000)
  }
}

function handleClose() {
  confirmDeleteId.value = null
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="`交易历史 - ${ticker}`"
    width="720px"
  >
    <div v-if="sortedTransactions.length === 0" class="empty-state">
      <el-icon :size="48" color="var(--el-text-color-secondary)"><DocumentDelete /></el-icon>
      <p>暂无交易记录</p>
    </div>

    <el-table
      v-else
      :data="sortedTransactions"
      stripe
      style="width: 100%"
      size="small"
    >
      <el-table-column label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>

      <el-table-column label="方向" width="80">
        <template #default="{ row }">
          <el-tag
            :type="row.side === 'buy' ? 'success' : 'danger'"
            size="small"
          >
            {{ row.side === 'buy' ? '买入' : '卖出' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="价格 (USDT)" width="120">
        <template #default="{ row }">
          {{ formatDisplay(row.price) }}
        </template>
      </el-table-column>

      <el-table-column label="数量" width="140">
        <template #default="{ row }">
          {{ formatDisplay(row.qty, 8) }}
        </template>
      </el-table-column>

      <el-table-column label="金额 (USDT)" width="120">
        <template #default="{ row }">
          {{ formatDisplay(row.amount) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button
            :type="confirmDeleteId === row.id ? 'danger' : 'info'"
            :danger="confirmDeleteId === row.id"
            size="small"
            @click="handleDelete(row)"
          >
            {{ confirmDeleteId === row.id ? '确认删除' : '删除' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  gap: 16px;
  color: var(--el-text-color-secondary);
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}
</style>
