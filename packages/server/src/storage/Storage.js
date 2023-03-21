import path from 'path'
import { URL } from 'url'
import multer from '@koa/multer'
import picomatch from 'picomatch'
import { PassThrough } from 'stream'
import { attributes as readMediaAttributes } from 'leather'
import { hyphenate, toPromiseCallback } from '@ditojs/utils'
import { AssetFile } from './AssetFile.js'
import { deprecate } from '../utils/deprecate.js'

const storageClasses = {}

export class Storage {
  initialized = false

  constructor(app, config) {
    this.app = app
    this.config = config
    this.name = config.name
    this.url = config.url
    this.path = config.path
    // Use a default concurrency of 8 for storage IO, e.g. the importing of
    // foreign assets.
    this.concurrency = config.concurrency ?? 8
    // The actual multer storage object.
    this.storage = null
  }

  // @overridable
  async setup() {
  }

  // @overridable
  async initialize() {
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
      // In case `config.readDimensions` is set:
      width: storageFile.width,
      height: storageFile.height
    }
  }

  convertStorageFiles(storageFiles) {
    return storageFiles.map(storageFile => this.convertStorageFile(storageFile))
  }

  async addFile(file, data) {
    await this._addFile(file, data)
    file.size = Buffer.byteLength(data)
    file.url = this._getFileUrl(file)
    // TODO: Support `config.readDimensions`, but this can only be done once
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
  async _addFile(_file, _data) {}

  // @overridable
  async _removeFile(_file) {}

  // @overridable
  async _readFile(_file) {}

  // @overridable
  async _listKeys() {}

  async _handleUpload(req, file, config) {
    if (config.readImageSize) {
      deprecate(
        `config.readImageSize is deprecated in favour of config.readDimensions`
      )
    }
    if (
      (
        config.readDimensions ||
        // TODO: `config.readImageSize` was deprecated in favour of
        // `config.readDimensions` in March 2023. Remove in 1 year.
        config.readImageSize
      ) && /^(image|video)\//.test(file.mimetype)
    ) {
      return this._handleMediaFile(req, file)
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

  async _handleMediaFile(req, file) {
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
        try {
          const size = readMediaAttributes(data)
          // On partial data, sometimes we get results back from leather without
          // actual dimensions, so check for that.
          if (size.mime && (size.width > 0 || size.height > 0)) {
            done(size)
          }
        } catch {
          // Ignore errors in `readMediaAttributes()` on partial data.
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
