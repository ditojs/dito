import { isNumber } from '../base/index.js'

const millisecondsByUnit = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
}

// The long forms of the units, also taken in the plural:
const unitsByName = {
  millisecond: 'ms',
  second: 's',
  minute: 'm',
  hour: 'h',
  day: 'd',
  week: 'w'
}

// Numbers and strings without a unit are milliseconds. Units combine, as in
// `'1h30m'`, and can be written out, as in `'2 days'`.
export function parseDuration(input) {
  if (isNumber(input)) return input
  const string = String(input).trim()
  const parts = /^(\d*\.?\d+\s*[a-z]*\s*)+$/i.test(string)
    ? [...string.matchAll(/(\d*\.?\d+)\s*([a-z]*)/gi)]
    : []
  const duration = parts.reduce(
    (sum, [, amount, unit]) => (
      sum + parseFloat(amount) * getMilliseconds(unit, parts.length === 1)
    ),
    0
  )
  if (parts.length > 0 && isFinite(duration)) {
    return Math.round(duration)
  }
  throw new Error(`Invalid duration: '${input}'.`)
}

// Only a single amount goes without a unit, so `'1h30'` stays invalid. Unknown
// units make the duration `NaN`.
function getMilliseconds(unit, isSingle) {
  const name = unit.toLowerCase()
  const key = unitsByName[name.replace(/s$/, '')] ?? name
  return name
    ? Object.hasOwn(millisecondsByUnit, key)
      ? millisecondsByUnit[key]
      : NaN
    : isSingle
      ? 1
      : NaN
}
