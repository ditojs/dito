import path from 'path'
import multer from 'koa-multer'
import uuidv4 from 'uuid/v4'
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
          // Create a readable clone of the stream that can be read from
          // separately from `stream.file`, to run the image size detection on:
          const stream = new ReadableClone(file.stream)
          const [res, size] = await Promise.all([
            // The original `_handleFile()`:
            new Promise((resolve, reject) => {
              _handleFile.call(
                storage, req, file,
                toPromiseCallback(resolve, reject)
              )
            }),
            // Image size detection:
            new Promise(resolve => {
              stream
                .pipe(new ImageSizeTransform())
                .on('size', size => {
                  stream.destroy()
                  resolve(size)
                })
                .on('error', err => {
                  // Do not reject with this error, but log it:
                  this.app.emit(
                    'error',
                    `Unable to determine image size: ${err}`
                  )
                  stream.destroy()
                  resolve(null)
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
