export const empty = {
  validatesEmptyValues: true,
  validate: value => !value,
  message: 'must be empty'
}
