<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps<{
  ticker: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
}>()

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete ${props.ticker} from your watchlist? This will also remove all transaction history for this ticker.`,
      'Delete Confirmation',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )
    emit('confirm')
  } catch {
    // User cancelled
  }
}
</script>

<template>
  <el-button type="danger" plain size="small" @click="handleDelete">
    Delete
  </el-button>
</template>
