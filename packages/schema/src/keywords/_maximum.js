import { isNumber } from '@ditojs/utils'

export const maximum = {
  validate: (value, maximum) => !isNumber(value) || value <= maximum,
  message: maximum => `must be ${maximum} or less`
}
