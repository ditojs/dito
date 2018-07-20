import { ResponseError } from './ResponseError'

export class WrappedError extends ResponseError {
  constructor(error, defaults = { message: 'Wrapped error', status: 400 }) {
    super(error, defaults)
    if (error?.stack) {
      this.stack = error.stack
    }
  }
}
