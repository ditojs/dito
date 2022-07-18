import { ResponseError } from './ResponseError.js'

export class NotImplementedError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Method not implemented', status: 404 })
  }
}
