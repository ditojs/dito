import { isDate, isString, parsePlainDate } from '@ditojs/utils'
import { getOriginal } from './uid.js'

// Convert date strings to `Date` objects, plain dates in the local time zone.
// Other strings stay, e.g. times like '14:30':
export function convertToDate(value) {
  const date =
    isString(value) && value
      ? (parsePlainDate(value) ?? new Date(value))
      : null
  return date && !isNaN(date) ? date : value
}

// The strings that dates were loaded from. Unchanged dates are sent back as
// they came, so a save doesn't change dates that the user didn't edit, e.g.
// the time of a timestamp in a date field:
const loadedStrings = new WeakMap()

export function convertLoadedDate(value) {
  const date = convertToDate(value)
  if (isDate(date) && isString(value)) {
    loadedStrings.set(date, value)
  }
  return date
}

export function getLoadedString(date) {
  // Drafts of nested forms hold copies of the loaded dates:
  for (let loaded = date; loaded; loaded = getOriginal(loaded)) {
    const string = loadedStrings.get(loaded)
    if (string) {
      return +loaded === +date ? string : null
    }
  }
  return null
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
