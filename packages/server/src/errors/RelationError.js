import { WrappedError } from './WrappedError'
import { isObject } from '@ditojs/utils'

export class RelationError extends WrappedError {
  constructor(error) {
    if (isObject(error)) {
      // Adjust objection.js error messages to point to the right property.
      const parse = str => str?.replace(/\brelationMappings\b/g, 'relations')
      const { message, stack } = error
      error = Object.setPrototypeOf({
        message: parse(message),
        stack: parse(stack)
      }, error)
    }
    super(error, { message: 'Relation error', status: 400 })
  }
}
