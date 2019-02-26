import { Storage } from './Storage'

export class S3Storage extends Storage {
  static type = 's3'

  constructor(config) {
    super(config)
    this.multer = null
  }
}
