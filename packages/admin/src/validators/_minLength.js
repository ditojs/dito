import { isString } from '@ditojs/utils'

export const minLength = {
  // Unlike other validators, `minLength` also rejects empty strings:
  validatesEmptyValues: true,
  // Count code points like the server, not UTF-16 units like `maxlength`:
  validate: (value, minLength) => (
    !isString(value) || [...value].length >= minLength
  ),
  message: (value, minLength) =>
    minLength === 1
      ? 'must not be empty'
      : `must be at least ${minLength} characters long`
}
