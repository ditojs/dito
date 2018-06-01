import { isDate, pick } from '@ditojs/utils'

export function copyDate(date,
  { year, month, day, hours, minutes, seconds, milliseconds } = {}
) {
  return new Date(
    pick(year, date && date.getFullYear(), 0),
    pick(month, date && date.getMonth(), 0),
    pick(day, date && date.getDate(), 0),
    pick(hours, date && date.getHours(), 0),
    pick(minutes, date && date.getMinutes(), 0),
    pick(seconds, date && date.getSeconds(), 0),
    pick(milliseconds, date && date.getMilliseconds(), 0)
  )
}

export function convertDate(date) {
  return isDate(date) ? date : date ? new Date(date) : null
}
