import { isString } from '@ditojs/utils'

export const pattern = {
  // Patterns are strings, compiled with `u` as Ajv does:
  validate: (value, pattern) => (
    !isString(value) || new RegExp(pattern, 'u').test(value)
  ),
  message: pattern => `must match pattern "${pattern}"`
}
