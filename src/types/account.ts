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
