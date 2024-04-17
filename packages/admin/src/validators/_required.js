export const required = {
  validate: (value, settings, { password }) => (
    (value != null && value !== '') ||
    // Password fields use `undefined` as opposed to `null` when they're set
    // but unchanged, allow this to pass through:
    (password && value === undefined)
  ),
  message: 'is required'
}
