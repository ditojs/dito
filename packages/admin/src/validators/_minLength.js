import { isString } from '@ditojs/utils'

export const minLength = {
  // Unlike other keywords, the admin applies `minLength` to `''` too:
  validatesEmptyValues: true,
  // Count code points, not UTF-16 units:
  validate: (value, minLength) => (
    !isString(value) || [...value].length >= minLength
  ),
  message: minLength =>
    minLength === 1
      ? 'must not be empty'
      : `must be at least ${minLength} characters long`
}
