import util from 'util'
import { isNumber } from '@ditojs/utils'
import parseDuration from 'parse-duration'

export function getDuration(duration) {
  return isNumber(duration) ? duration : parseDuration(duration)
}

// Durations are from `min` to `max` ms, or `false` to turn something off where
// `allowFalse` is set:
export function checkDuration(
  name,
  value,
  { min, max = Infinity, allowFalse = false, usage }
) {
  const duration = value === false ? value : getDuration(value)
  if (
    duration === false && allowFalse ||
    isNumber(duration) && duration >= min && duration <= max
  ) {
    return duration
  } else {
    throw new Error(
      `Invalid duration for '${name}': ${util.inspect(value)}. ${usage}`
    )
  }
}

export function addDuration(date, duration) {
  date.setMilliseconds(date.getMilliseconds() + getDuration(duration))
  return date
}

export function subtractDuration(date, duration) {
  return addDuration(date, -getDuration(duration))
}
