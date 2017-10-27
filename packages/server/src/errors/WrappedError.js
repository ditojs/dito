import ResponseError from './ResponseError'

export default class WrappedError extends ResponseError {
  constructor(error, statusCode = 400) {
    super({
      message: error.message,
      ...error
    }, statusCode)
    this.stack = error.stack
  }
}
