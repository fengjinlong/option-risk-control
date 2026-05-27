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
