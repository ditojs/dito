import { ResponseError } from './ResponseError'

export class WrappedError extends ResponseError {
  constructor(error, process = str => str, status = 400) {
    super({
      message: process(error.message),
      ...error
    }, status)
    this.stack = process(error.stack)
  }
}
