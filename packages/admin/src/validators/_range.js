export const range = {
  validate: (value, [minimum, maximum]) => value >= minimum && value <= maximum,
  message(value, [minimum, maximum]) {
    return `must be between ${minimum} and ${maximum}`
  }
}
