import path from 'path'
import { URL } from 'url'
import multer from '@koa/multer'
import picomatch from 'picomatch'
import imageSize from 'image-size'
import { PassThrough } from 'stream'
import { hyphenate, toPromiseCallback } from '@ditojs/utils'
import { AssetFile } from './AssetFile.js'

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

  isImportSourceAllowed(url) {
    return picomatch.isMatch(url, this.config.allowedImports || [])
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
      return this._handleImageFile(req, file)
    } else {
      return this._handleFile(req, file)
    }
  }

  _handleFile(req, file, stream = null) {
    // Calls the original `storage._handleFile()`, wrapped in a promise:
    return new Promise((resolve, reject) => {
      if (stream) {
        // Replace the original `file.stream` with the pass-through stream:
        Object.defineProperty(file, 'stream', {
          configurable: true,
          enumerable: false,
          value: stream
        })
      }
      this.storage._handleFile(req, file, toPromiseCallback(resolve, reject))
    })
  }

  async _handleImageFile(req, file) {
    const { size, stream } = await new Promise(resolve => {
      let data = null

      const done = size => {
        const stream = new PassThrough()
        stream.write(data)
        file.stream
          .off('data', onData)
          .off('end', onEnd)
          .pipe(stream)
        resolve({ size, stream })
      }

      const onEnd = () => {
        this.app.emit('error', 'Unable to determine image size')
        done(null)
      }

      const onData = chunk => {
        data = data ? Buffer.concat([data, chunk]) : chunk
        const size = imageSize(data)
        if (size) {
          done(size)
        }
      }

      file.stream
        .on('data', onData)
        .on('end', onEnd)
    })

    if (size) {
      file.width = size.width
      file.height = size.height
    }
    return this._handleFile(req, file, stream)
  }
}
