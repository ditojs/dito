import { isString } from '@ditojs/utils'

export const pattern = {
  // Patterns are strings, compiled with `u` for Unicode property escapes:
  validate: (value, pattern) => (
    !isString(value) || new RegExp(pattern, 'u').test(value)
  ),
  message: pattern => `must match pattern "${pattern}"`
}
