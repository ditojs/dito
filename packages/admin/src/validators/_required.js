import { formats } from '@ditojs/schema'

export const required = {
  ...formats.required,
  validate: (value, setting, { password }) => (
    formats.required.validate(value) ||
    // Password fields use `undefined` as opposed to `null` when they're set
    // but unchanged, allow this to pass through:
    password && value === undefined
  )
}
