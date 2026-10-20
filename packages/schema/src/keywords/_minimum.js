import { isNumber } from '@ditojs/utils'

export const minimum = {
  validate: (value, minimum) => !isNumber(value) || value >= minimum,
  message: minimum => `must be ${minimum} or more`
}
