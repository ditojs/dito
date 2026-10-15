export const validate = {
  // The setting calls the schema's `validate()`, which returns `false` or a
  // message to fail:
  validate: (value, validate) => validate(value) ?? true,
  message: 'is invalid'
}
