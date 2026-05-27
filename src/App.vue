<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()

const currentRoute = computed(() => route.name)

const navigate = (name: string) => {
  router.push({ name })
}
</script>

<template>
  <el-menu
    mode="horizontal"
    :ellipsis="false"
    class="nav-menu"
    :default-active="String(currentRoute)"
  >
    <div class="logo">Option Risk Control</div>
    <div class="flex-grow" />
    <el-menu-item index="home" @click="navigate('home')">Home</el-menu-item>
    <el-menu-item index="another" @click="navigate('another')">Another</el-menu-item>
    <el-menu-item index="risk" @click="navigate('risk')">Risk Workspace</el-menu-item>
  </el-menu>

  <router-view />
</template>

<style scoped>
.nav-menu {
  padding: 0 24px;
}

.logo {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
  padding: 0 8px;
}

.flex-grow {
  flex-grow: 1;
}
</style>
