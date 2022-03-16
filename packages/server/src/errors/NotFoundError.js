import { ResponseError } from './ResponseError.js'

export class NotFoundError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Not-found error', status: 404 })
  }
}
