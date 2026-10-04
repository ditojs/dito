import { filesize } from 'filesize'

export function formatFileSize(size) {
  return filesize(size, { base: 10 })
}

// Bit units are case-sensitive (`Kb` = kilobit), the byte units aren't.
const bitUnits = ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb']
const byteUnits = ['', 'k', 'm', 'g', 't', 'p', 'e']

/**
 * Parses file sizes like `'10 MB'`, `'1.5G'`, `'512kb'` or `'100 bytes'` into
 * a number of bytes, using base 2 (1 KB = 1024 bytes) unless specified.
 */
export function parseFileSize(input, { base = 2 } = {}) {
  const [, amountString, unit] = (
    String(input).match(/^([\d.,]*)\s*(\D*)$/) || []
  )
  const amount = parseFloat(amountString?.replace(',', '.'))
  if (!isFinite(amount)) {
    throw new Error(`Can't interpret file size: ${input}`)
  }
  const multiplier = base === 10 ? 1000 : 1024
  const bitIndex = bitUnits.indexOf(unit.replace(/^bits?$/, 'b'))
  if (bitIndex >= 0) {
    return Math.round(amount * multiplier ** bitIndex / 8)
  }
  const byteIndex = byteUnits.indexOf(
    unit
      .toLowerCase()
      .replace(/^(bytes?|b)$/, '')
      .replace(/^(\w)(i?b|i)$/, '$1')
  )
  if (byteIndex >= 0) {
    return Math.round(amount * multiplier ** byteIndex)
  }
  throw new Error(`Invalid file size unit: ${unit}`)
}
