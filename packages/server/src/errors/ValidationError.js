import { ResponseError } from './ResponseError'
import { isArray } from '@/utils'

export class ValidationError extends ResponseError {
  constructor(modelClass, data, status = 400) {
    // Get a reference to the Dito Validator instance (not the Objection
    // Validator), so we get additional format and keyword definitions.
    const { validator } = modelClass.app || {}
    const errs = data.errors
    // If an array is passed for errors, then it's the Ajv format that first
    // needs to be parsed the same way as Objection does with parseErrors():
    const errorHash = isArray(errs) ? parseErrors(errs) : errs
    // Now convert Objection's `errorHash` format to Dito's, with better
    // processing of nested data-paths, which luckily end up in the hashes'
    // keys. See parseErrors() / parseValidationError() for why `key` is `path`.
    const converted = {}
    for (const [path, errors] of Object.entries(errorHash)) {
      for (let { message, keyword, params } of errors) {
        let property = null
        // Allow custom formats and keywords to override error messages
        if (keyword === 'format') {
          const definition = validator.getFormat(params.format)
          message = definition && definition.message || message
        } else if (keyword === 'required') {
          property = params.missingProperty
          message = 'is a required property'
        } else if (keyword === 'additionalProperties') {
          property = params.additionalProperty
          message = 'is an unsupported additional property'
        } else {
          const definition = validator.getKeyword(keyword)
          message = definition && definition.message || message
        }
        // Produce keys that allow us to better identify nested errors in Admin:
        const key = property && path ? `${path}/${property}` : property || path
        const array = converted[key] || (converted[key] = [])
        array.push({ message, keyword, params })
      }
    }
    super({ ...data, errors: converted }, status)
  }
}

// Emulate behavior of Objection's internal error parsing method for consistency
// `parseValidationError(errors, modelClass)`, so both can use the same post-
// processing after, see above.
function parseErrors(errors) {
  // Convert from Ajv errors array to hash
  const errorHash = {}
  let index = 0
  for (const { message, keyword, params, dataPath } of errors) {
    const key = dataPath.substring(1) ||
      params && (params.missingProperty || params.additionalProperty) ||
      (index++).toString()
    const array = errors[key] || (errors[key] = [])
    array.push({ message, keyword, params })
  }
  return errorHash
}
