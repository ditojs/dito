import { isArray } from '@ditojs/utils'

export const minItems = {
  validate: (value, minItems) => !isArray(value) || value.length >= minItems,
  message: minItems =>
    minItems === 1
      ? 'must contain at least one item'
      : `must contain at least ${minItems} items`
}
