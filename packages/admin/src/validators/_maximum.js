export const maximum = {
  validate: (value, maximum) => value <= maximum,
  message(value, maximum) {
    return `must be ${maximum} or less`
  }
}
