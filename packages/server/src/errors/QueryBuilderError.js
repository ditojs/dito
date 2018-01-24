import { ResponseError } from './ResponseError'

export class QueryBuilderError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Query-builder error', status: 400 })
  }
}
