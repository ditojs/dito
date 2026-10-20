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
