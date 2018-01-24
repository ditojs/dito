import { ResponseError } from './ResponseError'

export class ModelError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Model error', status: 400 })
  }
}
