// The setting is a function that checks if a value is among the options:
const enumValidator = {
  validate: (value, isOption) => isOption(value),
  message: 'must be one of the options'
}

// `enum` is a reserved word:
export { enumValidator as enum }
