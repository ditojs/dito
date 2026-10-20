import { isString } from '@ditojs/utils'

export const pattern = {
  // Patterns are strings, as on the server, which compiles them with `u`:
  validate: (value, pattern) => (
    !isString(value) || new RegExp(pattern, 'u').test(value)
  ),
  message: (value, pattern) => `must match pattern "${pattern}"`
}
