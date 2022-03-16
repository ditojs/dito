import { WrappedError } from './WrappedError.js'
import { isObject } from '@ditojs/utils'

export class RelationError extends WrappedError {
  constructor(error) {
    let overrides
    if (isObject(error)) {
      // Adjust Objection.js error messages to point to the right property.
      const parse = str => str?.replace(/\brelationMappings\b/g, 'relations')
      const { message, stack } = error
      overrides = {
        message: parse(message),
        stack: parse(stack)
      }
    }
    super(error, overrides, { message: 'Relation error', status: 400 })
  }
}
