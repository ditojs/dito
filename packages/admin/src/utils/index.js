import { isObject } from '@ditojs/utils'

export function hasForm(schema) {
  // Support both single form and multiple forms notation.
  return isObject(schema) && (schema.form || schema.forms)
}
