import { ResponseError } from './ResponseError'

export class QueryError extends ResponseError {
  constructor(message, status = 400) {
    super(message, status)
  }
}
