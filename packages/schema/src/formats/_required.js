export const required = {
  validate: value => value != null && value !== '',
  message: 'is required'
}
