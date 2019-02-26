import multer from 'koa-multer'
import { hyphenate } from '@ditojs/utils'

const storageClasses = {}

export class Storage {
  constructor(config) {
    this.config = config
    this.name = config.name
  }

  getUploadHandler(config) {
    return this.multer
      ? multer({ ...config, storage: this.multer }).any()
      : null
  }

  static register(storageClass) {
    const type = (
      storageClass.type ||
      hyphenate(storageClass.name.match(/^(.*?)(?:Storage|)$/)[1])
    )
    storageClass.type = type
    storageClasses[type] = storageClass
  }

  static get(type) {
    return storageClasses[type] || null
  }
}
