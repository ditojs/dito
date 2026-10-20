import { isNumber } from '@ditojs/utils'

export const multipleOf = {
  // Divide as Ajv does without `multipleOfPrecision`, float errors included:
  validate: (value, multipleOf) => (
    !isNumber(value) || Number.isInteger(value / multipleOf)
  ),
  message: multipleOf => `must be a multiple of ${multipleOf}`
}
