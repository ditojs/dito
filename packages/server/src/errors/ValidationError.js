import { ResponseError } from './ResponseError'
import { isArray } from '@/utils'

export class ValidationError extends ResponseError {
  constructor(modelClass, data, options = {}, status = 400) {
    // Get a reference to the Dito Validator instance (not the Objection
    // Validator), so we get additional format and keyword definitions.
    const { validator } = modelClass.app || {}
    const errs = data.errors
    // If an array is passed for errors, then it's the Ajv format that first
    // needs to be parsed the same way as Objection does with parseErrors():
    const errorHash = isArray(errs) ? parseErrors(errs, options) : errs
    // Now convert Objection's `errorHash` format to Dito's, with better
    // processing of nested data-paths, which luckily end up in the hashes'
    // keys. See parseErrors() / parseValidationError() for why `key` is `path`.
    const errors = {}
    // Ajv produces duplicate validation errors sometimes, filter them out here.
    const duplicates = {}
    for (const [key, error] of Object.entries(errorHash)) {
      if (isArray(error)) {
        for (let { message, keyword, params } of error) {
          let property = null
          // Allow custom formats and keywords to override error messages
          if (keyword === 'format') {
            const definition = validator.getFormat(params.format)
            message = definition?.message || message
          } else if (keyword === 'required') {
            property = params.missingProperty
            message = 'is a required property'
          } else if (keyword === 'additionalProperties') {
            property = params.additionalProperty
            message = 'is an unsupported additional property'
          } else {
            const definition = validator.getKeyword(keyword)
            if (definition?.macro) {
              // Skip keywords that are only delegating to other keywords.
              continue
            }
            message = definition?.message || message
          }
          // Produce keys that allow better detection of nested errors in Admin:
          const errorKey = property && key && key !== property
            ? `${key}/${property}`
            : property || key
          const fullKey = `${errorKey}_${keyword}`
          if (!duplicates[fullKey]) {
            const array = errors[errorKey] || (errors[errorKey] = [])
            // Use unshift instead of push, just like Objection.js, so that we
            // get the natural sequence of errors again, see:
            // https://github.com/Vincit/objection.js/pull/605
            array.unshift({ message, keyword, params })
            duplicates[fullKey] = true
          }
        }
      } else {
        errors[key] = error
      }
    }
    super({ ...data, errors }, status)
  }
}

// Emulate behavior of Objection's internal error parsing method for consistency
// `parseValidationError(errors, modelClass)`, so both can use the same post-
// processing after, see above.
// NOTE: We don't inverse error sequence on multiple errors per property, so
// there still is a slight difference to Objection.
function parseErrors(errors, options) {
  // Convert from Ajv errors array to hash
  const errorHash = {}
  let index = 0
  for (const { message, keyword, params, dataPath } of errors) {
    let key = dataPath.substring(1) ||
      params?.missingProperty || params?.additionalProperty ||
      (index++).toString()
    // Adjust dataPaths to reflect nested validation in Objection.
    if (options.dataPath) {
      key = `${options.dataPath.substring(1)}/${key}`
    }
    const array = errorHash[key] || (errorHash[key] = [])
    array.push({ message, keyword, params })
  }
  return errorHash
}
