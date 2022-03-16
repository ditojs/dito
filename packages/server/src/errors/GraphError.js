import { ResponseError } from './ResponseError.js'

export class GraphError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Graph error', status: 400 })
  }
}
