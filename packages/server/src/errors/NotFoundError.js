import { ResponseError } from './ResponseError'

export class NotFoundError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Not-found error', status: 404 })
  }
}
