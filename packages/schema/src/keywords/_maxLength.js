import { isString } from '@ditojs/utils'

export const maxLength = {
  // Count code points as Ajv does, not UTF-16 units:
  validate: (value, maxLength) => (
    !isString(value) || [...value].length <= maxLength
  ),
  message: maxLength =>
    maxLength === 1
      ? 'must be at most one character long'
      : `must be at most ${maxLength} characters long`
}
