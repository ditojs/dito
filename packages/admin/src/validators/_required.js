import { isArray } from '@ditojs/utils'

export const required = {
  // Empty arrays are no value either, as lists and fields with multiple values
  // hold `[]` when nothing is selected or added:
  validate: (value, settings, { password }) => (
    (value != null && value !== '' && !(isArray(value) && !value.length)) ||
    // Password fields use `undefined` as opposed to `null` when they're set
    // but unchanged, allow this to pass through:
    (password && value === undefined)
  ),
  message: 'is required'
}
