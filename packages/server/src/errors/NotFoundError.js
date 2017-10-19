import ResponseError from './ResponseError'

export default class NotFoundError extends ResponseError {
  constructor(message, statusCode = 404) {
    super(message, statusCode)
  }
}
