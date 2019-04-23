export const max = {
  validate: (value, max) => value <= max,
  message(value, max) {
    return `must be ${max} or less`
  }
}
