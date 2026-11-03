import { isNumber } from '@ditojs/utils'

export const range = {
  validate: (value, [minimum, maximum]) => (
    !isNumber(value) || value >= minimum && value <= maximum
  ),
  message: ([minimum, maximum]) => `must be between ${minimum} and ${maximum}`
}
