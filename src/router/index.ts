import { createRouter, createWebHistory } from 'vue-router'
import RiskWorkspace from '../views/RiskWorkspace.vue'
import DataExplain from '../views/DataExplain.vue'
import Calculator from '../views/Calculator.vue'
import IVAlert from '../views/IVAlert.vue'

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
    {
      path: '/calculator',
      name: 'calculator',
      component: Calculator,
    },
    {
      path: '/iv-alert',
      name: 'iv-alert',
      component: IVAlert,
    },
  ],
})

export default router
