import path from 'path'
import multer from 'koa-multer'
import uuidv4 from 'uuid/v4'
import { hyphenate } from '@ditojs/utils'
import { NotImplementedError } from '@/errors'
import { ImageSizeTransform } from './ImageSizeTransform'
import { CloneableReadable } from './CloneableReadable'

const storageClasses = {}

export class Storage {
  constructor(app, config) {
    this.app = app
    this.config = config
    this.name = config.name
    this.storage = null
  }

  setStorage(storage) {
    this.storage = storage
    // Monkey-patch storage._handleFile to also read image size from the stream
    // and set the file fields accordingly.
    const { _handleFile } = storage
    storage._handleFile = async (req, file, callback) => {
      if (this.isImageFile(file)) {
        // Handle image size detection in parallel with multer file upload:
        try {
          // Override `file.stream` with a cloneable stream.
          const { stream } = file
          Object.defineProperty(file, 'stream', {
            configurable: true,
            enumerable: false,
            value: new CloneableReadable(stream)
          })
          const [size, res] = await Promise.all([
            // Image detection in a promise:
            new Promise(resolve => {
              new CloneableReadable(stream)
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
            }),
            // The original `_handleFile()` as a promise:
            new Promise((resolve, reject) => {
              _handleFile.call(storage, req, file, (err, file) => {
                if (err) {
                  reject(err)
                } else {
                  resolve(file)
                }
              })
            })
          ])
          if (size) {
            const { width, height } = size
            res.width = width
            res.height = height
          }
          callback(null, res)
        } catch (err) {
          callback(err)
        }
      } else {
        return _handleFile.call(storage, req, file, callback)
      }
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
