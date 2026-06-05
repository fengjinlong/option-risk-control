<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { toBig, ZERO, mul, div, formatDisplay, gt, lt, eq, gte } from '../../composables/useCryptoMath'
import type { TransactionSide } from '../../composables/useSpotPortfolio'

const props = defineProps<{
  visible: boolean
  ticker: string
  currentQty: string
  livePrice: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'confirm', payload: { side: TransactionSide; price: string; qty: string; amount: string }): void
}>()

// Local state
const side = ref<TransactionSide>('buy')
const priceInput = ref('')
const qtyInput = ref('')
const amountInput = ref('')
const inputMode = ref<'qty' | 'amount'>('qty')
const errorMsg = ref('')

const price = computed(() => priceInput.value || '')
const qty = computed(() => qtyInput.value || '')
const amount = computed(() => amountInput.value || '')

function syncAmount() {
  if (!price.value || !qty.value) {
    amountInput.value = ''
    return
  }
  const p = toBig(price.value)
  const q = toBig(qty.value)
  amountInput.value = formatDisplay(mul(p, q))
}

function syncQty() {
  if (!price.value || !amount.value) {
    qtyInput.value = ''
    return
  }
  const p = toBig(price.value)
  const a = toBig(amount.value)
  if (p.eq(ZERO)) {
    qtyInput.value = ''
    return
  }
  qtyInput.value = formatDisplay(div(a, p))
}

watch(qtyInput, () => {
  if (inputMode.value === 'qty') {
    syncAmount()
  }
})

watch(amountInput, () => {
  if (inputMode.value === 'amount') {
    syncQty()
  }
})

watch(priceInput, () => {
  if (inputMode.value === 'qty') {
    syncAmount()
  } else {
    syncQty()
  }
})

watch(() => props.visible, (val) => {
  if (val) {
    resetForm()
  }
})

function resetForm() {
  side.value = 'buy'
  priceInput.value = props.livePrice || ''
  qtyInput.value = ''
  amountInput.value = ''
  inputMode.value = 'qty'
  errorMsg.value = ''
}

function useCurrentPrice() {
  priceInput.value = props.livePrice || ''
}

function validate(): boolean {
  errorMsg.value = ''

  if (!priceInput.value) {
    errorMsg.value = '请输入价格'
    return false
  }

  const p = toBig(priceInput.value)
  if (p.lte(ZERO)) {
    errorMsg.value = '价格必须大于 0'
    return false
  }

  if (inputMode.value === 'qty') {
    if (!qtyInput.value) {
      errorMsg.value = '请输入数量'
      return false
    }
    const q = toBig(qtyInput.value)
    if (q.lte(ZERO)) {
      errorMsg.value = '数量必须大于 0'
      return false
    }
    if (side.value === 'sell') {
      const current = toBig(props.currentQty)
      if (gt(q, current)) {
        errorMsg.value = `卖出数量不能超过持仓数量。当前持仓: ${props.currentQty}`
        return false
      }
    }
  } else {
    if (!amountInput.value) {
      errorMsg.value = '请输入金额'
      return false
    }
    const a = toBig(amountInput.value)
    if (a.lte(ZERO)) {
      errorMsg.value = '金额必须大于 0'
      return false
    }
    if (side.value === 'sell') {
      const current = toBig(props.currentQty)
      if (current.eq(ZERO)) {
        errorMsg.value = '没有可卖的持仓'
        return false
      }
      const priceB = toBig(priceInput.value)
      const maxAmount = mul(current, priceB)
      if (gt(a, maxAmount)) {
        errorMsg.value = `卖出金额不能超过持仓价值。最大金额: ${formatDisplay(maxAmount)} USDT`
        return false
      }
    }
  }

  return true
}

function handleConfirm() {
  if (!validate()) return

  if (inputMode.value === 'qty') {
    syncAmount()
  } else {
    syncQty()
  }

  emit('confirm', {
    side: side.value,
    price: priceInput.value,
    qty: inputMode.value === 'qty' ? qtyInput.value : qtyInput.value,
    amount: amountInput.value,
  })
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="`记录交易 - ${ticker}`"
    width="480px"
    :close-on-click-modal="false"
  >
    <div class="tx-form">
      <!-- 方向 -->
      <div class="form-row">
        <label>方向</label>
        <el-radio-group v-model="side" size="large">
          <el-radio-button value="buy">买入</el-radio-button>
          <el-radio-button value="sell">卖出</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 价格 -->
      <div class="form-row">
        <label>价格 (USDT)</label>
        <div class="price-row">
          <el-input
            v-model="priceInput"
            type="number"
            placeholder="0.00"
            :precision="8"
            step="0.01"
          />
          <el-button size="small" @click="useCurrentPrice" type="primary" plain>
            使用现价
          </el-button>
        </div>
      </div>

      <!-- 输入模式 -->
      <div class="form-row">
        <label>输入模式</label>
        <el-radio-group v-model="inputMode" size="small">
          <el-radio-button value="qty">输入数量 → 计算金额</el-radio-button>
          <el-radio-button value="amount">输入金额 → 计算数量</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 数量 (模式A) -->
      <div class="form-row" v-if="inputMode === 'qty'">
        <label>
          数量 ({{ ticker }})
          <span class="hint">当前持仓: {{ currentQty }}</span>
        </label>
        <el-input
          v-model="qtyInput"
          type="number"
          placeholder="0.00000000"
          :precision="8"
          step="0.00000001"
        />
      </div>

      <!-- 金额 (模式B) -->
      <div class="form-row" v-if="inputMode === 'amount'">
        <label>
          金额 (USDT)
          <span class="hint">最大: {{ formatDisplay(mul(currentQty || '0', price || '0')) }}</span>
        </label>
        <el-input
          v-model="amountInput"
          type="number"
          placeholder="0.00"
          :precision="4"
          step="0.01"
        />
      </div>

      <!-- 计算结果 -->
      <div class="form-row calculated">
        <label>{{ inputMode === 'qty' ? '金额 (USDT)' : `数量 (${ticker})` }}</label>
        <div class="calculated-value">
          {{ inputMode === 'qty' ? (amountInput || '0.0000') : (qtyInput || '0.00000000') }}
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="error-msg">
        <el-icon><WarningFilled /></el-icon>
        {{ errorMsg }}
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm">
        {{ side === 'buy' ? '记录买入' : '记录卖出' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tx-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row > label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint {
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.price-row {
  display: flex;
  gap: 8px;
}

.price-row .el-input {
  flex: 1;
}

.calculated {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.calculated-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  font-family: var(--el-font-family);
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border-radius: 6px;
  font-size: 13px;
}
</style>
