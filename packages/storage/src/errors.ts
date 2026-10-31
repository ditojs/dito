import { HttpError } from '@ditojs/server-next'

// Errors of asset files that clients send, such as forged signatures or keys
// outside the storage. They answer 400 with the message as the detail.
export class AssetError extends HttpError {
  constructor(message: string) {
    super(400, { detail: message })
    this.name = 'AssetError'
  }
}
