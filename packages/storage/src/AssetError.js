import { ResponseError } from './ResponseError.js'

export class AssetError extends ResponseError {
  constructor(error) {
    super(error, { message: 'Asset error', status: 400 })
  }
}
