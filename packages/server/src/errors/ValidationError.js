import ResponseError from './ResponseError'
import { isArray } from '@/utils'

export default class ValidationError extends ResponseError {
  constructor(errors, message, statusCode = 400) {
    let index = 0
    if (isArray(errors)) {
      // Convert from Ajv errors array to hash
      const errorHash = {}
      for (const { message, keyword, params, dataPath } of errors) {
        const key = dataPath.substring(1) ||
          params && (params.missingProperty || params.additionalProperty) ||
          (index++).toString()
        errorHash[key] = [{ message, keyword, params }]
      }
      errors = errorHash
    }
    super({
      error: message,
      details: errors
    }, statusCode)
    // TODO: Name this `details` here too?
    this.errors = errors
  }
}
