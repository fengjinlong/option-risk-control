<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const currentPage = ref(route.name as string)

const goTo = (name: string) => {
  currentPage.value = name
  router.push({ name })
}
</script>

<template>
  <div class="home">
    <el-card shadow="hover" class="card">
      <template #header>
        <div class="card-header">
          <span>Home</span>
          <el-tag type="success">当前页面</el-tag>
        </div>
      </template>
      <p>这是首页内容。</p>
      <p>点击下方按钮切换到另一个页面。</p>
      <div class="action">
        <el-button type="primary" @click="goTo('another')">
          前往 Another 页面
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.home {
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

.action {
  margin-top: 20px;
}
</style>
