import { isNumber } from '@ditojs/utils'
import { parse } from 'parse-duration'

export function getDuration(duration) {
  return isNumber(duration) ? duration : parse(duration)
}

export function addDuration(date, duration) {
  date.setMilliseconds(date.getMilliseconds() + getDuration(duration))
  return date
}

export function subtractDuration(date, duration) {
  return addDuration(date, -getDuration(duration))
}
