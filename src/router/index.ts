import { createRouter, createWebHistory } from 'vue-router'
import RiskWorkspace from '../views/RiskWorkspace.vue'
import DataExplain from '../views/DataExplain.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'risk',
      component: RiskWorkspace,
    },
    {
      path: '/risk',
      redirect: '/',
    },
    {
      path: '/explain',
      name: 'explain',
      component: DataExplain,
    },
  ],
})

export default router
