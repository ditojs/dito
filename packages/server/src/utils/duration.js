import { isNumber } from '@ditojs/utils'
// eslint-disable-next-line import/default
import parseDuration from 'parse-duration'

export function getDuration(duration) {
  return isNumber(duration) ? duration : parseDuration(duration)
}

export function addDuration(date, duration) {
  date.setMilliseconds(date.getMilliseconds() + getDuration(duration))
  return date
}

export function subtractDuration(date, duration) {
  return addDuration(date, -getDuration(duration))
}
