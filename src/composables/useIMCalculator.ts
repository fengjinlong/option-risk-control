/**
 * IM Calculator — Bybit Option Short Margin (普通全仓模式)
 *
 * 变量定义:
 * S             — 标的资产当前指数价格 (ETH index price)
 * K             — 期权行权价格 (strike price)
 * option_type   — 'call' | 'put'
 * size          — 持仓张数 (计算时取绝对值)
 * P_mark        — 期权当前标记价格 (mark price)
 * P_order       — 开仓委托价格 (entry price)
 *
 * 系数 (ETH):
 * max_im_factor — 0.10
 * min_im_factor — 0.05
 * mm_factor     — 0.03
 * liq_fee_rate  — 0.002
 */

export interface IMCalcInput {
  S: number        // ETH index price (当前 ETH 指数价格)
  K: number        // strike price (行权价格)
  optionType: 'call' | 'put'
  direction: 'buy' | 'sell'
  size: number     // position size (持仓张数)
  P_mark: number   // mark price
  P_order: number  // entry / order price
}

export interface IMLegResult {
  symbol: string
  direction: 'buy' | 'sell'
  OTM_Amount: number
  Position_MM: number
  Position_IM_Base: number
  Final_Position_IM: number
  Required_Margin: number   // 页面显示的"所需保证金净变动"
}

export interface IMCalcResult {
  legs: IMLegResult[]
  totalIM: number   // 所有腿 Final_Position_IM 之和
  totalRequiredMargin: number   // 所有腿 Required_Margin 之和
}

const MAX_IM_FACTOR  = 0.10
const MIN_IM_FACTOR  = 0.05
const MM_FACTOR      = 0.03
const LIQ_FEE_RATE   = 0.002

export function calcLegIM(input: IMCalcInput): IMLegResult {
  const { S, K, optionType, direction, size, P_mark, P_order } = input
  const absSize = Math.abs(size)

  // buy 方不需要保证金
  if (direction === 'buy') {
    return {
      symbol: `${optionType} ${K}`,
      direction,
      OTM_Amount: 0,
      Position_MM: 0,
      Position_IM_Base: 0,
      Final_Position_IM: 0,
      Required_Margin: 0,
    }
  }

  // sell 方按 Bybit 公式计算
  const OTM_Amount = optionType === 'call'
    ? Math.max(0, K - S)
    : Math.max(0, S - K)

  // Step 2: Position_MM
  const Position_MM = (Math.max(MM_FACTOR * S, MM_FACTOR * P_mark) + P_mark + LIQ_FEE_RATE * S) * absSize

  // Step 3: Position_IM_Base
  const Position_IM_Base = (
    Math.max(MAX_IM_FACTOR * S - OTM_Amount, MIN_IM_FACTOR * S) + Math.max(P_order, P_mark)
  ) * absSize

  // Step 4: Final_Position_IM
  const Final_Position_IM = Math.max(Position_IM_Base, Position_MM)

  // Step 5: Required_Margin_On_Screen
  const Required_Margin = Final_Position_IM - P_order * absSize

  return {
    symbol: `${optionType} ${K}`,
    direction,
    OTM_Amount:       parseFloat(OTM_Amount.toFixed(4)),
    Position_MM:       parseFloat(Position_MM.toFixed(4)),
    Position_IM_Base:  parseFloat(Position_IM_Base.toFixed(4)),
    Final_Position_IM: parseFloat(Final_Position_IM.toFixed(4)),
    Required_Margin:   parseFloat(Required_Margin.toFixed(4)),
  }
}

export function calcTotalIM(
  inputs: IMCalcInput[],
): IMCalcResult {
  const legs = inputs.map(calcLegIM)
  return {
    legs,
    totalIM:            parseFloat(legs.reduce((s, l) => s + l.Final_Position_IM, 0).toFixed(4)),
    totalRequiredMargin: parseFloat(legs.reduce((s, l) => s + l.Required_Margin, 0).toFixed(4)),
  }
}
