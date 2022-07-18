import { ResponseError } from './ResponseError.js'

export class ValidationError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Validation error', status: 400 })
  }
}
