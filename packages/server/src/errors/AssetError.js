import { ResponseError } from './ResponseError'

export class AssetError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Asset error', status: 400 })
  }
}
