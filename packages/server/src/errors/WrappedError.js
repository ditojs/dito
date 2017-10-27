import { ResponseError } from './ResponseError'

export class WrappedError extends ResponseError {
  constructor(error, status = 400) {
    super({
      message: error.message,
      ...error
    }, status)
    this.stack = error.stack
  }
}
