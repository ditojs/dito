import { ResponseError } from './ResponseError'

export class WrappedError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Wrapped error', status: 400 })
    if (error?.stack) {
      this.stack = error.stack
    }
  }
}
