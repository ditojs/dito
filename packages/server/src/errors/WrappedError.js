import { ResponseError } from './ResponseError'
import { isObject, isString } from 'dito-utils'

export class WrappedError extends ResponseError {
  constructor(error, process = str => str, status = 400) {
    if (isString(error)) {
      error = { message: error }
    }
    super({
      message: process(error.message),
      ...error
    }, status)
    this.stack = process(error.stack)
  }
}
