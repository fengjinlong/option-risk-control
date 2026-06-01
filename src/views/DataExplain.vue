<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
  <div class="workspace">
    <AppHeader />

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

      <!-- IM/MM 分隔标题 -->
      <div class="doc-title">资金健康度指标（IM / MM）动态阈值应用说明书</div>

      <!-- IM 1. IM -->
      <div class="section">
        <div class="section-title">1. 初始保证金 IM 与开仓额度拦截</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">initial_margin_usd</span>
            <span class="def-val">开出当前仓位，交易所根据组合保证金（PM）风险矩阵（模拟标的价格 ±20%、IV ±15% 的最恶劣场景）扣押的开仓刚性押金。</span>
          </div>
          <div class="def-item">
            <span class="def-key">initial_margin_rate</span>
            <span class="def-val">IM 占总保证金资产的百分比（假设当前为 30%，即占用了 30,000 USD）。</span>
          </div>
        </div>

        <div class="warn-label">技术性卡仓风险：IM 占用率 → 100%</div>
        <p><strong>面临问题：</strong>购买力彻底枯竭（Buying Power Exhausted）。当该指标趋近 100% 时，本金已经放满杠杆，虽未爆仓但系统会实施开仓硬拦截。</p>
        <p><strong>📊 数据案例：</strong>交易员在中栏沙盒频繁组装多腿卖方策略，导致 <span class="inline-key">initial_margin_usd</span> 瞬间飙升至 98,000 USD（IM 占用率达 98%）。此时尝试再次提交一腿 ETH 虚值 Call，**该增量单需要新增 3,000 USD 的 IM，总需求（101,000）超过 100,000 底牌，后端直接遭遇交易所网关强平拒单（Order reject: Insufficient available balance），沙盒模拟开仓宣告技术性流产。**</p>
      </div>

      <!-- IM 2. MM -->
      <div class="section">
        <div class="section-title">2. 维持保证金 MM 与清算死线</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">maintenance_margin_usd</span>
            <span class="def-val">全盘头寸生存的最低铁底。组合保证金（PM）模型下，这是交易所允许持仓不被强平的最后底线（假设当前存量持仓静态 MM 为 15,000 USD）。</span>
          </div>
        </div>

        <div class="warn-label">强平熔断风险：资产跌破 MM</div>
        <p><strong>面临问题：</strong>触发强制平仓清算（Forced Liquidation）。一旦市场发生不利波动，MM 需求会由于期权 Gamma 的非线性暴涨而急剧膨胀。如果 MM 需求追上保证金资产，意味着已经无力承担现存仓位的最小潜在亏损。</p>
        <p><strong>📊 数据案例：</strong>标的 ETH 发生黑天鹅级大瀑布，Gamma 暴胀，账户 <span class="inline-key">maintenance_margin_usd</span> 在 5 分钟内从 15,000 USD 疯狂膨胀至 100,005 USD。**此时，最低生存铁底（100,005）无情超越账户保证金总资产（100,000），UTA 账户所有清算托管引擎瞬间激活，系统开始无预警强制砍仓，直到 MM 被拉回资产线以内。**</p>
      </div>

      <!-- IM 3. margin_utilization_rate -->
      <div class="section">
        <div class="section-title">3. 核心保证金利用率（风控核心仪表盘）</div>

        <div class="def-list">
          <div class="def-item">
            <span class="def-key">margin_utilization_rate</span>
            <span class="def-val">计算公式为 MM ÷ 保证金总资产 × 100%。整个风控系统最核心的全局报警指针，直接映射前端的账户健康度进度条。</span>
          </div>
        </div>

        <div class="warn-label">分级风控报警状态（实时水位监控）</div>

        <div class="risk-levels">
          <div class="risk-item safe">
            <span class="risk-range">&lt; 40%</span>
            <span class="risk-name">SAFE（安全）</span>
            <span class="risk-desc">资金效率有提升空间，沙盒可放宽开仓限制。</span>
          </div>
          <div class="risk-item attention">
            <span class="risk-range">40% - 70%</span>
            <span class="risk-name">ATTENTION（警惕）</span>
            <span class="risk-desc">利用率达 65% 时，前端进度条由黄转橙。警告交易员当前仓位已开始累积波动率暴露，中栏沙盒在模拟新开仓时，必须优先评估能降 MM 的对冲单，限制纯裸卖（Short）单的提交。</span>
          </div>
          <div class="risk-item high-risk">
            <span class="risk-range">70% - 90%</span>
            <span class="risk-name">HIGH_RISK（高危）</span>
            <span class="risk-desc">极度危险。任何微小的价格跳空都会引爆强平。</span>
          </div>
          <div class="risk-item critical">
            <span class="risk-range">&gt; 90%</span>
            <span class="risk-name">CRITICAL（临界爆发）</span>
            <span class="risk-desc">风控系统启动最高防线，除"平仓、对冲"外，锁定所有新增风险委托。</span>
          </div>
        </div>
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

.explain-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 32px;
}

.page-title { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); margin-bottom: 20px; text-align: left; }
.doc-title { font-size: 16px; font-weight: 700; color: var(--el-text-color-primary); margin: 28px 0 16px; text-align: left; border-top: 1px solid var(--el-border-color); padding-top: 24px; }

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

.risk-levels { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.risk-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 4px; font-size: 12px; }
.risk-range { font-weight: 700; min-width: 80px; }
.risk-name { font-weight: 700; min-width: 140px; }
.risk-desc { color: var(--el-text-color-regular); }
.risk-item.safe { background: #f0fdf4; border: 1px solid #bbf7d0; }
.risk-item.safe .risk-range { color: #16a34a; }
.risk-item.safe .risk-name { color: #15803d; }
.risk-item.attention { background: #fffbeb; border: 1px solid #fde68a; }
.risk-item.attention .risk-range { color: #d97706; }
.risk-item.attention .risk-name { color: #b45309; }
.risk-item.high-risk { background: #fff1f2; border: 1px solid #fecdd3; }
.risk-item.high-risk .risk-range { color: #dc2626; }
.risk-item.high-risk .risk-name { color: #b91c1c; }
.risk-item.critical { background: #fef2f2; border: 1px solid #fca5a5; }
.risk-item.critical .risk-range { color: #991b1b; }
.risk-item.critical .risk-name { color: #7f1d1d; }
</style>
