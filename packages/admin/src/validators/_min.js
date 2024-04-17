export const min = {
  validate: (value, min) => value >= min,
  message(value, min) {
    return `must be ${min} or more`
  }
}
