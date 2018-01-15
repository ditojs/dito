import { ResponseError } from './ResponseError'
import { isObject, isString } from '@ditojs/utils'

export class WrappedError extends ResponseError {
  constructor(error, process = str => str) {
    super({
      message: process(isString(error) ? error : error?.message),
      ...(isObject(error) ? error : null)
    }, { message: 'Wrapped error', status: 400 })
    if (error?.stack) {
      this.stack = process(error.stack)
    }
  }
}
