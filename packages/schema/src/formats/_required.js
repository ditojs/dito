export const required = {
  validatesEmptyValues: true,
  validate: value => value != null && value !== '',
  message: 'is required'
}
