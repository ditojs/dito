import { isString, parsePlainDate, formatPlainDate } from '@ditojs/utils'

// Convert date strings to `Date` objects, plain dates in the local time zone.
// Other strings stay, e.g. times like '14:30':
export function convertToDate(value) {
  const date =
    isString(value) && value
      ? (parsePlainDate(value) ?? new Date(value))
      : null
  return date && !isNaN(date) ? date : value
}

// Serialize dates as ISO strings. Days without a time of day in `date` types
// are sent as plain dates, so they can't shift to another day through time
// zones. Dates with a time keep it, also in `date` types, which only display
// the day of timestamps:
export function serializeDate(date, type) {
  const isDay = (
    type === 'date' &&
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  )
  return isDay ? formatPlainDate(date) : date.toISOString()
}

// Convert times like '14:30:00' to `Date` objects on the first day of 1970, in
// the local time zone unless they have one. Other values stay:
export function convertTimeToDate(value) {
  const date = isString(value) && value ? new Date(`1970-01-01T${value}`) : null
  return date && !isNaN(date) ? date : value
}

// Format the time of the date as 'HH:mm:ss', in the local time zone:
export function formatTime(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(part => `${part}`.padStart(2, '0'))
    .join(':')
}
