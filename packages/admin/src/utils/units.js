// Unit prefixes in order of their exponent:
const prefixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']

// Base 10 by default (1 kB = 1000 bytes), base 2 uses IEC units (1 KiB):
export function formatFileSize(size, { base = 10 } = {}) {
  const multiplier = getMultiplier(base)
  const absolute = Math.abs(size)
  let exponent = Math.min(
    absolute >= 1 ? Math.floor(Math.log(absolute) / Math.log(multiplier)) : 0,
    prefixes.length - 1
  )
  let amount = roundFileSize(absolute, multiplier, exponent)
  // Rounding can reach the next unit, e.g. 999999 bytes to 1000 kB = 1 MB.
  if (amount >= multiplier && exponent < prefixes.length - 1) {
    amount = roundFileSize(absolute, multiplier, ++exponent)
  }
  const prefix = prefixes[exponent]
  const unit = !prefix
    ? 'B'
    : base === 10
      ? `${prefix}B`
      : `${prefix.toUpperCase()}iB`
  return `${size < 0 ? '-' : ''}${amount} ${unit}`
}

// IEC units like `'10 MiB'` always use base 2. Bit units are case-sensitive
// (`Kb` = kilobit), the byte units aren't.
export function parseFileSize(input, { base = 10 } = {}) {
  const [, amountString, unit] = (
    String(input).match(/^([\d.,]*)\s*(\D*)$/) || []
  )
  const amount = parseFloat(amountString?.replace(',', '.'))
  if (!isFinite(amount)) {
    throw new Error(`Can't interpret file size: ${input}`)
  }
  const multiplier = getMultiplier(/^[kmgtpezy]ib?$/i.test(unit) ? 2 : base)
  const bitMatch = unit.replace(/^bits?$/, 'b').match(/^([KMGTPEZY]?)b$/)
  if (bitMatch) {
    const exponent = prefixes.indexOf(bitMatch[1].replace('K', 'k'))
    return Math.round(amount * multiplier ** exponent / 8)
  }
  const exponent = prefixes.findIndex(
    prefix => (
      prefix.toLowerCase() ===
      unit
        .toLowerCase()
        .replace(/^(bytes?|b)$/, '')
        .replace(/^(\w)(i?b|i)$/, '$1')
    )
  )
  if (exponent >= 0) {
    return Math.round(amount * multiplier ** exponent)
  }
  throw new Error(`Invalid file size unit: ${unit}`)
}

function getMultiplier(base) {
  return base === 10 ? 1000 : 1024
}

// Round bytes to integers, larger units to two decimals:
function roundFileSize(size, multiplier, exponent) {
  const factor = exponent > 0 ? 100 : 1
  return Math.round(size / multiplier ** exponent * factor) / factor
}
