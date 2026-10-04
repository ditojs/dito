/**
 * Formats a date as its local plain date, e.g. `'2026-05-14'`, without the
 * time and time zone of `toISOString()`, which can shift it to another day.
 */
export function formatPlainDate(date) {
  // Use the date parts, as shifting by `getTimezoneOffset()` misses offsets
  // with seconds, e.g. local mean time before 1894 in Europe/Zurich.
  const pad = (number, length = 2) => String(number).padStart(length, '0')
  return [
    pad(date.getFullYear(), 4),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')
}
