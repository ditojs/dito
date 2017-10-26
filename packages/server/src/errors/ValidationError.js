import ResponseError from './ResponseError'
import { isArray } from '@/utils'

export default class ValidationError extends ResponseError {
  constructor(data, statusCode = 400) {
    let index = 0
    if (isArray(data.errors)) {
      // Convert from Ajv errors array to hash
      const errors = {}
      for (const { message, keyword, params, dataPath } of data.errors) {
        const key = dataPath.substring(1) ||
          params && (params.missingProperty || params.additionalProperty) ||
          (index++).toString()
        errors[key] = [{ message, keyword, params }]
      }
      data.errors = errors
    }
    super(data, statusCode)
    this.data = data
  }
}
