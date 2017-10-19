import ResponseError from './ResponseError'

export default class QueryError extends ResponseError {
  constructor(message, statusCode = 400) {
    super(message, statusCode)
  }
}
