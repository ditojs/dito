import { ResponseError } from './ResponseError.js'

export class WrappedError extends ResponseError {
  constructor(error, overrides, defaults = {
    message: 'Wrapped error',
    status: 400
  }) {
    super(
      overrides
        ? Object.setPrototypeOf({ ...overrides }, error)
        : error,
      defaults
    )
    if (error?.stack) {
      this.stack = error.stack
    }
  }
}
