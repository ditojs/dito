import { ResponseError } from './ResponseError'

export class QueryError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Query error', status: 400 })
  }
}
