import path from 'path'
import multer from 'koa-multer'
import uuidv4 from 'uuid/v4'
import { URL } from 'url'
import { NotImplementedError } from '@/errors'
import { ImageSizeTransform } from './ImageSizeTransform'
import { ReadableClone } from './ReadableClone'
import { hyphenate, toPromiseCallback } from '@ditojs/utils'

const storageClasses = {}

export class Storage {
  constructor(app, config) {
    this.app = app
    this.config = config
    this.name = config.name
    this.url = config.url
    this.storage = null
  }

  setStorage(storage) {
    this.storage = storage
  }

  async handleUpload(req, file, config) {
    if (config.readImageSize && this.isImageFile(file)) {
      // Handle image size detection in parallel with multer file upload:
      // Create two readable clones of the stream that can be read from
      // simultaneously: The first to override `file.stream` with,
      // the second to run the image size detection on.
      // Pause the original stream until the original `storage._handleFile()` is
      // called, to preserve original stream event behavior.
      const { stream } = file
      stream.pause() // resume() happens in this.handleFile()
      const stream1 = new ReadableClone(stream)
      const stream2 = new ReadableClone(stream)
      const [res, size] = await Promise.all([
        this.handleFile(req, file, stream1).finally(() => stream1.destroy()),
        this.getImageSize(stream2).finally(() => stream2.destroy())
      ])
      if (size) {
        const { width, height } = size
        res.width = width
        res.height = height
      }
      return res
    } else {
      return this.handleFile(req, file)
    }
  }

  handleFile(req, file, stream = null) {
    // Calls the original `storage._handleFile()`, wrapped in a promise:
    return new Promise((resolve, reject) => {
      if (stream) {
        // If there is a ReadableClone stream to read from instead, resume the
        // original stream now and replace `file.stream` with the clone:
        file.stream.resume()
        Object.defineProperty(file, 'stream', {
          configurable: true,
          enumerable: false,
          value: stream
        })
      }
      this.storage._handleFile(req, file, toPromiseCallback(resolve, reject))
    })
  }

  getImageSize(stream) {
    return new Promise(resolve => {
      stream
        .pipe(new ImageSizeTransform())
        .on('size', resolve)
        .on('error', err => {
          // Do not reject with this error, but log it:
          this.app.emit(
            'error',
            `Unable to determine image size: ${err}`
          )
          resolve(null)
        })
    })
  }

  getUploadStorage(config) {
    // Returns a storage that inherits from this.storage but overrides
    // _handleFile to pass on `settings` to the call of `handleUpload()`
    return this.storage
      ? Object.setPrototypeOf({
        _handleFile: async (req, file, callback) => {
          try {
            callback(null, await this.handleUpload(req, file, config))
          } catch (err) {
            callback(err)
          }
        }
      }, this.storage)
      : null
  }

  getUploadHandler(config) {
    const storage = this.getUploadStorage(config)
    return storage ? multer({ ...config, storage }).any() : null
  }

  getFilename(file) {
    return `${uuidv4()}${path.extname(file.originalname)}`
  }

  getUrl(path) {
    return this.url ? new URL(path, this.url).toString() : null
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
