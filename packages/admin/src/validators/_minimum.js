export const minimum = {
  validate: (value, minimum) => value >= minimum,
  message(value, minimum) {
    return `must be ${minimum} or more`
  }
}
