import { isString } from '@ditojs/utils'

export function parseFraction(value) {
  const match = (
    isString(value) &&
    value.match(/^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/)
  )
  if (match) {
    const [, dividend, divisor] = match
    return parseFloat(dividend) / parseFloat(divisor)
  } else {
    return parseFloat(value)
  }
}
