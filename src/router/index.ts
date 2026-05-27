import { createRouter, createWebHistory } from 'vue-router'
import RiskWorkspace from '../views/RiskWorkspace.vue'

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
  ],
})

export default router
