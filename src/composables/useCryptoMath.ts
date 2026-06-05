import Big from 'big.js'

export const ZERO = new Big(0)
export const FOUR_DP = 4
export const EIGHT_DP = 8

export function toBig(val: string | number | Big | undefined | null): Big {
  if (val === undefined || val === null || val === '') return ZERO
  try {
    return new Big(val)
  } catch {
    return ZERO
  }
}

export function formatDisplay(val: Big | number | string, dp: number = FOUR_DP): string {
  const b = val instanceof Big ? val : toBig(val)
  return b.toFixed(dp)
}

export function formatNav(val: Big | number | string): string {
  const b = val instanceof Big ? val : toBig(val)
  const fixed = b.toFixed(4)
  const parts = fixed.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return intPart + '.' + parts[1]
}

export function add(a: string | number | Big, b: string | number | Big): Big {
  return toBig(a).plus(toBig(b))
}

export function sub(a: string | number | Big, b: string | number | Big): Big {
  return toBig(a).minus(toBig(b))
}

export function mul(a: string | number | Big, b: string | number | Big): Big {
  return toBig(a).times(toBig(b))
}

export function div(a: string | number | Big, b: string | number | Big): Big {
  const divisor = toBig(b)
  if (divisor.eq(ZERO)) return ZERO
  return toBig(a).div(divisor)
}

export function gt(a: string | number | Big, b: string | number | Big): boolean {
  return toBig(a).gt(toBig(b))
}

export function lt(a: string | number | Big, b: string | number | Big): boolean {
  return toBig(a).lt(toBig(b))
}

export function gte(a: string | number | Big, b: string | number | Big): boolean {
  return toBig(a).gte(toBig(b))
}

export function eq(a: string | number | Big, b: string | number | Big): boolean {
  return toBig(a).eq(toBig(b))
}

export function abs(val: string | number | Big): Big {
  const b = toBig(val)
  return b.lt(ZERO) ? b.times(-1) : b
}

export function neg(val: string | number | Big): Big {
  return toBig(val).times(-1)
}

export function clamp(val: string | number | Big, min: string | number | Big, max: string | number | Big): Big {
  const b = toBig(val)
  const minB = toBig(min)
  const maxB = toBig(max)
  if (b.lt(minB)) return minB
  if (b.gt(maxB)) return maxB
  return b
}
