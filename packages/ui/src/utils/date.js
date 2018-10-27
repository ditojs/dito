import { isDate, pick } from '@ditojs/utils'

export function copyDate(date,
  { year, month, day, hour, minute, second, millisecond } = {}
) {
  return new Date(
    pick(year, date && date.getFullYear(), 0),
    pick(month, date && date.getMonth(), 0),
    pick(day, date && date.getDate(), 0),
    pick(hour, date && date.getHours(), 0),
    pick(minute, date && date.getMinutes(), 0),
    pick(second, date && date.getSeconds(), 0),
    pick(millisecond, date && date.getMilliseconds(), 0)
  )
}

export function convertDate(date) {
  return isDate(date) ? date : date ? new Date(date) : null
}
