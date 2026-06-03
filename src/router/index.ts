import { createRouter, createWebHistory } from 'vue-router'
import RiskWorkspace from '../views/RiskWorkspace.vue'
import DataExplain from '../views/DataExplain.vue'
import Calculator from '../views/Calculator.vue'
import IVAlert from '../views/IVAlert.vue'
import PositionRisk from '../views/positionRisk.vue'
import PositionAudit from '../views/PositionAudit.vue'
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
    {
      path: '/position-risk',
      name: 'position-risk',
      component: PositionRisk,
    },
    {
      path: '/position-audit',
      name: 'position-audit',
      component: PositionAudit,
    },
  ],
})

export default router
