import { formatPlainDate } from './formatPlainDate.js'

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
