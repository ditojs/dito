import { isDate } from '@ditojs/utils'

export function copyDate(date, {
  year = date?.getFullYear() ?? 0,
  month = date?.getMonth() ?? 0,
  day = date?.getDate() ?? 0,
  hour = date?.getHours() ?? 0,
  minute = date?.getMinutes() ?? 0,
  second = date?.getSeconds() ?? 0,
  millisecond = date?.getMilliseconds() ?? 0
} = {}) {
  return new Date(year, month, day, hour, minute, second, millisecond)
}

export function convertDate(date) {
  return isDate(date) ? date : date ? new Date(date) : null
}
