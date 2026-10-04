import { formatPlainDate } from './formatPlainDate.js'

/**
 * Parses a plain date like `'2026-05-14'` as local midnight, unlike
 * `new Date()`, which parses it as UTC midnight. Returns `null` for anything
 * else, including invalid dates like `'2026-02-30'`.
 */
export function parsePlainDate(string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(string)) {
    // Date-time strings without an offset are parsed as local time.
    const date = new Date(`${string}T00:00`)
    // Reject invalid days, which `Date` rolls over to the next month.
    if (formatPlainDate(date) === string) {
      return date
    }
  }
  return null
}
