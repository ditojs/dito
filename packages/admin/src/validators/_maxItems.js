import { isArray } from '@ditojs/utils'

export const maxItems = {
  validate: (value, maxItems) => !isArray(value) || value.length <= maxItems,
  message: maxItems =>
    maxItems === 1
      ? 'must contain at most one item'
      : `must contain at most ${maxItems} items`
}
