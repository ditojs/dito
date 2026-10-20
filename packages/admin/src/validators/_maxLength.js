import { isString } from '@ditojs/utils'

export const maxLength = {
  validate: (value, maxLength) => (
    !isString(value) || [...value].length <= maxLength
  ),
  message: (value, maxLength) =>
    maxLength === 1
      ? 'must be at most one character long'
      : `must be at most ${maxLength} characters long`
}
