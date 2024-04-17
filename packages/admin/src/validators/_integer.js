import { isInteger } from '@ditojs/utils'

export const integer = {
  validate: value => isInteger(value),
  message: 'must be whole number'
}
