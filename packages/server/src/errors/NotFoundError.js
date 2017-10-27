import { ResponseError } from './ResponseError'

export class NotFoundError extends ResponseError {
  constructor(message, status = 404) {
    super(message, status)
  }
}
