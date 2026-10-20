import { equals } from '@ditojs/utils'

export const _enum = {
  validate: (value, values) => values.some(entry => equals(entry, value)),
  message: 'must be one of the allowed values'
}
