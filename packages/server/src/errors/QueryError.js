import { ResponseError } from './ResponseError'

export class QueryError extends ResponseError {
  constructor(error, status = 400) {
    super(error, status)
  }
}
