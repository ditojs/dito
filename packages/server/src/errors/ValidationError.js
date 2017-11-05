import { ResponseError } from './ResponseError'
import { isArray } from '@/utils'

export class ValidationError extends ResponseError {
  constructor(modelClass, data, status = 400) {
    if (isArray(data.errors)) {
      // Convert from Ajv errors array to hash
      const errors = {}
      const validator = modelClass.getValidator()
      for (let { message, keyword, params, dataPath } of data.errors) {
        let property = null
        // Allow custom formats and keywords to override error messages
        if (keyword === 'format') {
          const schema = validator.getFormat(params.format)
          message = schema && schema.message || message
        } else if (keyword === 'required') {
          property = params.missingProperty
          message = 'is a required property'
        } else if (keyword === 'additionalProperties') {
          property = params.additionalProperty
          message = 'is an unsupported additional property'
        } else {
          const schema = validator.getKeyword(keyword)
          message = schema && schema.message || message
        }
        // error.dataPath is an absolute JSON pointer, convert to relative by
        // removing first character:
        const path = dataPath.substring(1)
        const key = property && path ? `${path}/${property}` : property || path
        errors[key] = [{ message, keyword, params }]
      }
      data.errors = errors
    }
    super(data, status)
  }
}
