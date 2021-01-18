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
    // _handleFile to pass on `config` to the call of `handleUpload()`
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

  getUniqueKey(name) {
    return AssetFile.getUniqueKey(name)
  }

  convertAssetFile(file) {
    return AssetFile.convert(file, this)
  }

  convertStorageFile(storageFile) {
    // Convert multer file object to our own file object format:
    return {
      key: storageFile.key,
      name: storageFile.originalname,
      type: storageFile.mimetype,
      size: storageFile.size,
      url: this._getFileUrl(storageFile),
      // In case `config.readImageSize` is set:
      width: storageFile.width,
      height: storageFile.height
    }
  }

  convertStorageFiles(storageFiles) {
    return storageFiles.map(storageFile => this.convertStorageFile(storageFile))
  }

  async addFile(file, buffer) {
    const storageFile = await this._addFile(file, buffer)
    file.size = Buffer.byteLength(buffer)
    file.url = this._getFileUrl(storageFile)
    // TODO: Support `config.readImageSize`, but this can only be done onces
    // there are separate storage instances per model assets config!
    return this.convertAssetFile(file)
  }

  async removeFile(file) {
    await this._removeFile(file)
  }

  async readFile(file) {
    return this._readFile(file)
  }

  async listKeys() {
    return this._listKeys()
  }

  getFilePath(file) {
    return this._getFilePath(file)
  }

  getFileUrl(file) {
    return this._getFileUrl(file)
  }

  isImageFile(file) {
    return file.mimetype.startsWith('image/')
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
  _getFilePath(_file) {}

  // @overridable
  _getFileUrl(_file) {}

  // @overridable
  async _addFile(_file, _buffer) {}

  // @overridable
  async _removeFile(_file) {}

  // @overridable
  async _readFile(_file) {}

  // @overridable
  async _listKeys() {}

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
        res.width = size.width
        res.height = size.height
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
