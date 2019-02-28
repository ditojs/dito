import path from 'path'
import Stream from 'stream'
import multer from 'koa-multer'
import uuidv4 from 'uuid/v4'
import imageSizeStream from 'image-size-stream'
import { hyphenate } from '@ditojs/utils'
import { NotImplementedError } from '@/errors'

const storageClasses = {}

export class Storage {
  constructor(config) {
    this.config = config
    this.name = config.name
    this.storage = null
  }

  setStorage(storage) {
    this.storage = storage
    // Monkey-patch storage._handleFile to also read image size from the stream
    // and set the file fields accordingly.
    const { _handleFile } = storage
    storage._handleFile = async (req, file, cb) => {
      if (this.isImageFile(file)) {
        const { width, height } = await this.getImageSize(file)
        file.width = width
        file.height = height
      }
      return _handleFile.call(storage, req, file, cb)
    }
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
      size: file.size,
      width: file.width,
      height: file.height
    }
  }

  convertFiles(files) {
    return files.map(file => this.convertFile(file))
  }

  isImageFile(file) {
    return file.mimetype.startsWith('image/')
  }

  async getImageSize(file) {
    // Copy source stream into two PassThrough streams, so one can determine
    // image size while the other can continue processing the upload.
    const stream1 = new Stream.PassThrough()
    const stream2 = new Stream.PassThrough()
    file.stream.pipe(stream1)
    file.stream.pipe(stream2)
    // Override `file.stream` with the copied stream.
    Object.defineProperty(file, 'stream', {
      configurable: true,
      enumerable: false,
      value: stream1
    })
    return new Promise((resolve, reject) => {
      stream2.pipe(
        imageSizeStream()
          .on('size', size => resolve(size))
          .on('error', error => reject(error))
      )
    })
  }

  getFileIdentifiers(_file) {
    // To be implemented in sub-classes.
    throw new NotImplementedError()
  }

  managesFile(_file) {
    // To be implemented in sub-classes.
    throw new NotImplementedError()
  }

  async removeFile(_file) {
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
