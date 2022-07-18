import { ResponseError } from './ResponseError.js'

export class AuthenticationError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Authentication error', status: 401 })
  }
}
