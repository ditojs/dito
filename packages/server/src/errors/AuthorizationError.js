import { ResponseError } from './ResponseError'

export class AuthorizationError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Unauthorized Access', status: 401 })
  }
}
