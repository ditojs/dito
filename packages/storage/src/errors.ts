import { HTTPException } from 'hono/http-exception'

// Errors of asset files that clients send, such as forged signatures or keys
// outside the storage. Hono and `problemResponse()` answer them with 400.
export class AssetError extends HTTPException {
  constructor(message: string) {
    super(400, { message })
    this.name = 'AssetError'
  }
}
