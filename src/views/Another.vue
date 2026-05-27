<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

const goTo = (name: string) => {
  router.push({ name })
}

const inputValue = ref('')

const handleConfirm = () => {
  if (!inputValue.value.trim()) return
  ElMessage.success(`你输入了: ${inputValue.value}`)
}
</script>

<template>
  <div class="another">
    <el-card shadow="hover" class="card">
      <template #header>
        <div class="card-header">
          <span>Another Page</span>
          <el-tag type="warning">另一个页面</el-tag>
        </div>
      </template>
      <p>这是一个通过路由切换来的页面。</p>
      <el-divider />
      <p>Element Plus 组件示例：</p>
      <div class="demo-row">
        <el-input
          v-model="inputValue"
          placeholder="输入点什么试试"
          style="width: 240px"
          @keyup.enter="handleConfirm"
        />
        <el-button type="primary" @click="handleConfirm">确认</el-button>
      </div>
      <div class="action">
        <el-button @click="goTo('home')">返回首页</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.another {
  padding: 24px;
}

.card {
  max-width: 600px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}

.action {
  margin-top: 20px;
}
</style>
