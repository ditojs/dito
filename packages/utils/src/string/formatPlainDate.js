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
