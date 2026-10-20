import { keywords } from '@ditojs/schema'

export const minItems = {
  ...keywords.minItems,
  // Required fields that hold arrays need one item, see `getValidations()`:
  message: (minItems, { required }) =>
    minItems === 1 && required
      ? 'is required'
      : keywords.minItems.message(minItems)
}
