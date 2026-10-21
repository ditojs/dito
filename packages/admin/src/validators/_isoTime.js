import { isDate, isString } from '@ditojs/utils'

// The `iso-time` format of the server's ajv-formats, also as `Date` objects
// that `DitoTimeField` edits:
export const isoTime = {
  validate: value =>
    isDate(value) ? !isNaN(value) : isString(value) && isIsoTime(value),
  message: 'must be a valid time'
}

const timePattern =
  /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i

function isIsoTime(value) {
  const match = timePattern.exec(value)
  if (match) {
    const hours = +match[1]
    const minutes = +match[2]
    const seconds = +match[3]
    const zoneSign = match[5] === '-' ? -1 : 1
    const zoneHours = +(match[6] || 0)
    const zoneMinutes = +(match[7] || 0)
    if (zoneHours <= 23 && zoneMinutes <= 59) {
      if (hours <= 23 && minutes <= 59 && seconds < 60) {
        return true
      }
      // Leap seconds, at the end of the last minute of the day in UTC:
      const utcMinutes = minutes - zoneMinutes * zoneSign
      const utcHours = hours - zoneHours * zoneSign - (utcMinutes < 0 ? 1 : 0)
      return (
        (utcHours === 23 || utcHours === -1) &&
        (utcMinutes === 59 || utcMinutes === -1) &&
        seconds < 61
      )
    }
  }
  return false
}
