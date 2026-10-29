import { isString, parsePlainDate } from '@ditojs/utils'

// Convert date strings to `Date` objects, plain dates in the local time zone.
// Other strings stay, e.g. times like '14:30':
export function convertToDate(value) {
  const date =
    isString(value) && value
      ? (parsePlainDate(value) ?? new Date(value))
      : null
  return date && !isNaN(date) ? date : value
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
