import { ResponseError } from './ResponseError'

export class NotImplementedError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Method not implemented', status: 404 })
  }
}
