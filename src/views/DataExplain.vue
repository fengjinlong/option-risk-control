<script setup lang="ts">
import { useRiskWorkspace } from '../composables/useRiskWorkspace'
import { useRouter } from 'vue-router'

const router = useRouter()
const { prices } = useRiskWorkspace()
</script>

<template>
  <div class="workspace">
    <header class="workspace-header">
      <div class="header-left">
        <span class="logo-text">📊</span>
        <span class="title">Pre-trade Risk Workspace</span>
      </div>
      <div class="header-right">
        <el-tag type="danger" size="small">BTC: {{ prices.data.data?.BTC ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">ETH: {{ prices.data.data?.ETH ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">SOL: {{ prices.data.data?.SOL ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">LINK: {{ prices.data.data?.LINK ?? '--' }}</el-tag>
        <el-tag type="danger" size="small">CRV: {{ prices.data.data?.CRV ?? '--' }}</el-tag>
        <el-tag type="success" size="small">● LIVE</el-tag>
        <el-button type="primary" size="small" plain @click="router.push('/')">返回工作台</el-button>
      </div>
    </header>

    <div class="explain-body">

      <div class="page-title">期权风险指标（Greeks）与动态阈值应用说明书</div>

      <!-- 1. Delta -->
      <div class="section">
        <div class="section-title">1. Delta 敞口与阈值（方向性价格风险）</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">total_net_delta</span>
            <span class="def-val">当前持仓对 ETH 价格变动的整体敏感度（相当于虚拟现货持仓量）。</span>
          </div>
          <div class="def-item">
            <span class="def-key">delta_limit</span>
            <span class="def-val">由每日最大亏损额倒推的方向性持仓最大安全张数（当前硬红线 = 1.84）。</span>
          </div>
        </div>

        <div class="warn-label">超标诊断：实际值 &gt; 阈值</div>
        <p><strong>面临问题：</strong>方向性风险严重过载，已脱离"波动率策略"初衷，退化为高杠杆单边投机。</p>
        <p><strong>📊 数据案例：</strong>交易员违规开仓，导致 <span class="inline-key">total_net_delta</span> 飙升至 15.0（远超 1.84 硬红线）。ETH 突发回调，价格下跌 525 USD：</p>
        <div class="formula">15.0 × 525 = 7,875 USD</div>
        <p>仅此单项的线性亏损，就瞬间击穿 7,712.53 USD 的单日亏损死线，直接引发全盘强平熔断。</p>
      </div>

      <!-- 2. Gamma -->
      <div class="section">
        <div class="section-title">2. Gamma 敞口与阈值（非线性加速度风险）</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">total_net_gamma</span>
            <span class="def-val">标的价格变动时，Delta 敞口发生非线性变异的加速度（风控失控的速度）。</span>
          </div>
          <div class="def-item">
            <span class="def-key">gamma_limit</span>
            <span class="def-val">极端波动交织下，账户能够承受的加速度上限（当前安全阈值 = 0.000884）。</span>
          </div>
        </div>

        <div class="warn-label">超标诊断：实际值 &gt; 阈值</div>
        <p><strong>面临问题：</strong>Delta 变异失控与保证金暴涨威胁。负 Gamma 严重超标（通常由裸卖短期平值期权引起），行情启动会导致亏损呈二次方加速度剧烈飙升。</p>
        <p><strong>📊 数据案例：</strong>账户重仓卖出临期平值 Put，导致 <span class="inline-key">total_net_gamma = -0.0025</span>（远超 0.000884）。ETH 从 3500 USD 暴跌到 3000 USD：</p>
        <div class="formula">½ × |−0.0025| × (500)² = 3,125 USD</div>
        <p>这笔"亏损加速度"产生的 3,125 USD 浮亏，会与 Delta 一阶亏损产生恶性共振，引爆维持保证金（MM），导致账户瞬间触发清算。</p>
      </div>

      <!-- 3. Vega -->
      <div class="section">
        <div class="section-title">3. Vega 敞口与阈值（隐含波动率 / 恐慌风险）</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">total_net_vega</span>
            <span class="def-val">整个期权组合对隐含波动率（IV）变动的敏感资产总额。</span>
          </div>
          <div class="def-item">
            <span class="def-key">vega_limit</span>
            <span class="def-val">账户对市场恐慌抽水（IV 暴涨）的最大极限耐受力（当前阈值 = 154.25，即 IV 每变动 1%，最大允许盈亏波动 154.25 USD）。</span>
          </div>
        </div>

        <div class="warn-label">超标诊断：实际值 &gt; 阈值</div>
        <p><strong>面临问题：</strong>做空波动率（Short Vol）杠杆过高。面临市场突发黑天鹅事件时，隐含波动率暴涨带来的账面亏损风险。</p>
        <p><strong>📊 数据案例：</strong>账户过度卖出远期虚值期权收割权利金，导致 <span class="inline-key">total_net_vega = -350.00 USD</span>（超出 154.25 承受上限）。市场突发暴跌恐慌，大盘 IV 在 1 小时内暴涨 30%：</p>
        <div class="formula">30 × (−350.00) = −10,500 USD</div>
        <p>即使 ETH 价格完全没变，该账户仅因 Vega 这单一维度的恐慌抽水，就产生 −10,500 USD 纯波动率膨胀浮亏，直接击穿 7,712.53 USD 的生存命门。</p>
      </div>

      <!-- 4. Theta -->
      <div class="section">
        <div class="section-title">4. Theta 敞口与阈值（时间价值流逝边界）</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">total_net_theta</span>
            <span class="def-val">期权组合每天自然蒸发（买方损耗）或稳赚（卖方收租）的绝对美金金额。</span>
          </div>
          <div class="def-item">
            <span class="def-key">theta_limit</span>
            <span class="def-val">单日允许的时间价值流逝绝对金额硬死线（当前锁定为 7,712.53 USD / 天）。</span>
          </div>
        </div>

        <div class="warn-label">超标诊断：|实际值| &gt; 阈值</div>
        <p><strong>买方（负 Theta 超标）：</strong>资产处于刚性流血状态。若横盘，资产会快速流失。</p>
        <p><strong>卖方（正 Theta 超标）：</strong>虚假繁荣。底层堆积了过多临期、极度危险的虚值卖方头寸，Gamma 尾部风险已积聚至临界点。</p>
        <p><strong>📊 数据案例：</strong>日内疯狂买入海量超短期末日彩票期权，导致 <span class="inline-key">total_net_theta = -8,500.00 USD</span>（超过 7,712.53 单日最大流血阈值）。即使接下来 24 小时大盘完全横盘：</p>
        <div class="formula">时间无情流逝，刚性蒸发 8,500.00 USD 权利金</div>
        <p>标的尚未启动，账户就因时间磨损在合规层面被迫执行死线斩仓。</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  height: 100vh;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: var(--el-fill-color);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.header-left { display: flex; align-items: center; gap: 8px; }
.logo-text { font-size: 18px; }
.title { font-size: 13px; font-weight: 700; color: var(--el-text-color-primary); letter-spacing: 0.03em; }
.header-right { display: flex; align-items: center; gap: 8px; }

.explain-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 32px;
}

.page-title { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); margin-bottom: 20px; text-align: left; }

.section { margin-bottom: 24px; }

.section-title { font-size: 14px; font-weight: 700; color: var(--el-text-color-primary); border-left: 3px solid #faad14; padding-left: 8px; margin-bottom: 10px; text-align: left; }

.def-list { margin: 8px 0 12px; display: flex; flex-direction: column; gap: 6px; }
.def-item { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 1.6; }
.def-key { font-weight: 700; color: var(--el-text-color-primary); white-space: nowrap; min-width: 160px; }
.def-val { color: var(--el-text-color-regular); }

.inline-key { font-weight: 700; color: var(--el-text-color-primary); }

.warn-label { font-size: 12px; font-weight: 700; color: #dc2626; margin: 8px 0 6px; }

p { font-size: 13px; color: var(--el-text-color-regular); line-height: 1.8; margin: 4px 0; text-align: left; }

.formula { font-family: 'JetBrains Mono', monospace; font-size: 13px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 12px; color: #92400e; display: inline-block; margin: 6px 0; }
</style>
