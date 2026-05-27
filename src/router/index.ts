import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Another from '../views/Another.vue'
import RiskWorkspace from '../views/RiskWorkspace.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/another',
      name: 'another',
      component: Another,
    },
    {
      path: '/risk',
      name: 'risk',
      component: RiskWorkspace,
    },
  ],
})

export default router
