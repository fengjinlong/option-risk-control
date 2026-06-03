export interface AccountMetrics {
  total_equity_usd: number
  total_margin_balance_usd: number
  total_available_balance_usd: number
  initial_margin_usd: number
  maintenance_margin_usd: number
  margin_utilization_rate: number
  initial_margin_rate: number
}

export interface AccountHealth {
  status: string
  environment: string
  metrics: AccountMetrics
  risk_level: 'SAFE' | 'ATTENTION' | 'HIGH_RISK' | 'CRITICAL'
}

export interface ApiResponse<T> {
  status: string
  data?: T
  message?: string
}

export interface EthOptionsResponse {
  status: string
  asset: string
  total_count: number
  greeks_summary: {
    total_net_delta: number
    total_net_gamma: number
    total_net_vega: number
    total_net_theta: number
  }
  greeks_thresholds: {
    delta_limit: number
    gamma_limit: number
    vega_limit: number
    theta_limit: number
  }
  data: {
    name: string
    side: 'Buy' | 'Sell'
    size: number
    entry_price: number
    current_price: number
    pnl: number
    dte: number
    net_delta: number
    net_gamma: number
    net_vega: number
    net_theta: number
  }[]
}

export interface EthOptionDatesResponse {
  status: string
  total_dates: number
  data: string[]
}

export interface EthOptionsChainApiItem {
  symbol: string
  strike: number
  type: 'Call' | 'Put'
  bid_price: number
  ask_price: number
  mark_price: number
  open_interest: number
  greeks: {
    delta: number
    gamma: number
    vega: number
    theta: number
    mark_iv: number
  }
}

export interface EthOptionsChainResponse {
  status: string
  query_date: string
  total_contracts: number
  data: EthOptionsChainApiItem[]
}

export interface GlobalVolRadarItem {
  symbol: string
  iv_percentile_1y: number
}

export interface GlobalVolRadarResponse {
  status: string
  data: Record<string, {
    current_dvol: number
    iv_percentile_1y: number
    sample_days: number
    status: string
  }>
}

export interface IvRvTrendsResponse1 {
  status: string
  currency: string
  extracted_at_utc: string
  total_curves: number
  data: {
    name: string
    points: {
      x: number
      y: string
    }[]
  }[]
}

export interface AtmVolatilityConeResponse {
  status: string
  currency: string
  cone_type: string
  lookback_days: number
  extracted_at_utc: string
  data: {
    name: string
    points: {
      x: string
      y: string
    }[]
  }[]
}

export interface TermStructureResponse {
  succ: boolean; // 网关层业务处理状态标识（成功时固定返回 true）
  code: number; // 业务状态码（服务端成功处理时固定返回 0）
  message: string; // 错误回执或状态文本提示（请求成功时为空字符串 ""）
  value: {
    name: 'ATM' | '5D Put' | '10D Put' | '25D Put' | '5D Call' | '10D Call' | '25D Call' | string; // 波动率期限曲线的微观 Delta 偏斜特征维度（ATM 为标准平值曲线，5D/10D/25D Put/Call 分别代表不同行权偏斜度的虚值期权隐含波动率线）
    points: {
      x: string; // 坐标轴横轴：标准的期权物理交割到期日字符串（如 "3JUN26", "26JUN26", "26MAR27"，前端渲染前可结合 DTE 算法转化为到期天数轴）
      y: string; // 坐标轴纵轴：该到期日及特定 Delta 维度下的绝对隐含波动率数值（如 "0.5744" 代表 57.44% IV，前端使用前需 parseFloat）
    }[]; // 100%强关联嵌套：当前 Delta 偏斜曲线下沿着时间轴分布的存续到期交割点阵数组
  }[]; // 全嵌套树状全期限全偏斜隐含波动率矩阵曲线数组（前端直接循环此数组即可渲染出包含多条偏斜梯度的期限结构全景走势图）
}

export interface RvMomentumPoint {
  time: string   // 13位毫秒级历史整点时间戳
  value: string // 对应的波动率/动量数值字符串
}

export interface RvMomentumCurve {
  name: '7' | '7M' // "7" = 7D RV 绝对值线，"7M" = RV 动量加速度线
  data: RvMomentumPoint[]
}

export interface RvMomentumResponse {
  succ: boolean
  code: number
  message: string
  value: RvMomentumCurve[]
}

export interface TimeLapseIvPoint {
  x: string // 固定物理交割到期日字符串
  y: string // 偏斜/凸度数值字符串
}

export interface TimeLapseIvCurve {
  name: string // 历史审计快照时间戳（13位毫秒）
  points: TimeLapseIvPoint[]
}

export interface TimeLapseIvResponse {
  succ: boolean
  code: number
  message: string
  value: TimeLapseIvCurve[]
}