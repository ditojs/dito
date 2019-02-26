import path from 'path'
import multer from 'koa-multer'
import uuidv4 from 'uuid/v4'
import { hyphenate } from '@ditojs/utils'
import { NotImplementedError } from '@/errors'

const storageClasses = {}

export class Storage {
  constructor(config) {
    this.config = config
    this.name = config.name
  }

  getUploadHandler(config) {
    return this.storage
      ? multer({ ...config, storage: this.storage }).any()
      : null
  }

  getFilename(file) {
    return `${uuidv4()}${path.extname(file.originalname)}`
  }

  convertFile(file) {
    // Convert multer-file object to our own file object format.
    return {
      ...this.getFileIdentifiers(file),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    }
  }

  convertFiles(files) {
    return files.map(file => this.convertFile(file))
  }

  async removeFile(file) {
    if (!this.managesFile(file)) {
      throw new Error(
        `File ${file.name} is not managed by storage ${this.name}`
      )
    }
    await this.deleteFile(file)
  }

  getFileIdentifiers(_file) {
    // To be implemented in sub-classes.
    throw new NotImplementedError()
  }

  managesFile(_file) {
    // To be implemented in sub-classes.
    throw new NotImplementedError()
  }

  async deleteFile(_file) {
    // To be implemented in sub-classes.
    throw new NotImplementedError()
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
