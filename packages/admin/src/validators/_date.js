import { isDate } from '@ditojs/utils'
import { convertToDate } from '../utils/date.js'

// Dates are edited as `Date` objects, but code can write invalid ones, or
// strings that aren't dates:
export const date = {
  validate: value => {
    const date = convertToDate(value)
    return isDate(date) && !isNaN(date)
  },
  message: 'must be a valid date'
}
