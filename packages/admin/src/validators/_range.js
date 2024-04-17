export const range = {
  validate: (value, [min, max]) => value >= min && value <= max,
  message(value, [min, max]) {
    return `must be between ${min} and ${max}`
  }
}
