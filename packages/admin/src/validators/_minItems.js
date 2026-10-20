import { isArray } from '@ditojs/utils'

export const minItems = {
  validate: (value, minItems) => !isArray(value) || value.length >= minItems,
  // Required fields that hold arrays need one item, see `getValidations()`:
  message: (value, minItems, { required }) =>
    minItems === 1
      ? required
        ? 'is required'
        : 'must contain at least one item'
      : `must contain at least ${minItems} items`
}
