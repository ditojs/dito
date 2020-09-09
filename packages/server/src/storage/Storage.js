import path from 'path'
import multer from '@koa/multer'
import { URL } from 'url'
import { ImageSizeTransform } from './ImageSizeTransform'
import { ReadableClone } from './ReadableClone'
import { hyphenate, toPromiseCallback } from '@ditojs/utils'
import { AssetFile } from './AssetFile'

const storageClasses = {}

export class Storage {
  constructor(app, config) {
    this.app = app
    this.config = config
    this.name = config.name
    this.url = config.url
    this.path = config.path
    // The actual multer storage object.
    this.storage = null
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

  getUploadStorage(config) {
    // Returns a storage that inherits from this.storage but overrides
    // _handleFile to pass on `settings` to the call of `handleUpload()`
    return this.storage
      ? Object.setPrototypeOf({
        _handleFile: async (req, file, callback) => {
          try {
            callback(null, await this._handleUpload(req, file, config))
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

  getUniqueFilename(filename) {
    return AssetFile.getUniqueFilename(filename)
  }

  convertFile(file) {
    const name = this._getFileName(file)
    // Convert multer file object to our own file object format:
    return {
      name,
      ...this._getStorageProperties(name, file),
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

  async addFile(file, buffer) {
    const addedFile = await this._addFile(file, buffer)
    return AssetFile.convert({
      ...file,
      ...this._getStorageProperties(file.name, addedFile)
    }, this)
  }

  async removeFile(file) {
    await this._removeFile(file)
  }

  async readFile(file) {
    return this._readFile(file)
  }

  isImageFile(file) {
    return file.mimetype.startsWith('image/')
  }

  areFilesEqual(file1, file2) {
    return !!(
      file1 &&
      file2 &&
      file1.name === file2.name &&
      file1.originalName === file2.originalName &&
      file1.mimeType === file2.mimeType &&
      file1.size === file2.size &&
      this._areFilesEqual(file1, file2)
    )
  }

  _getUrl(...parts) {
    return this.url
      ? new URL(path.posix.join(...parts), this.url).toString()
      : undefined // So that it doesn't show up in JSON data.
  }

  _getPath(...parts) {
    return this.path
      ? path.join(this.path, ...parts)
      : undefined // So that it doesn't show up in JSON data.
  }

  // @overridable
  _getFileName(_file) {}

  // @overridable
  _getStorageProperties(_name, _file) {}

  // @overridable
  _extractStorageProperties(_file) {}

  // @overridable
  async _addFile(_file, _buffer) {}

  // @overridable
  async _removeFile(_file) {}

  // @overridable
  async _readFile(_file) {}

  // @overridable
  _areFilesEqual(_file1, _file2) {
    return false
  }

  async _handleUpload(req, file, config) {
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
        this._handleFile(req, file, stream1).finally(() => stream1.destroy()),
        this._getImageSize(stream2).finally(() => stream2.destroy())
      ])
      if (size) {
        const { width, height } = size
        res.width = width
        res.height = height
      }
      return res
    } else {
      return this._handleFile(req, file)
    }
  }

  _handleFile(req, file, stream = null) {
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

  _getImageSize(stream) {
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
}
