import path from 'path'
import { URL } from 'url'
import crypto from 'crypto'
import multer from '@koa/multer'
import picomatch from 'picomatch'
import { PassThrough } from 'stream'
import { readMediaAttributes } from 'leather'
import { hyphenate, isString, toPromiseCallback } from '@ditojs/utils'
import { AssetFile } from './AssetFile.js'
import { AssetError } from '../errors/AssetError.js'
import { resolveFileUrl } from '../utils/asset.js'

const storageClasses = {}

// NOTE: Videos with their index at the end, which isn't optimized for the web,
// need more than the head, and are stored without dimensions when larger.
const headLength = 8 * 1024 * 1024

export class Storage {
  isInitialized = false

  constructor(app, name, config) {
    this.app = app
    this.name = name
    this.config = config
    this.url = config.url
    this.path = config.path
    // Files of public storages have a `url`. Storages with `url` are public
    // unless `config.public` is `false`.
    this.isPublic = config.public ?? !!config.url
    // Use a default concurrency of 8 for storage IO, e.g. the importing of
    // foreign assets.
    this.concurrency = config.concurrency ?? 8
    // The actual multer storage object.
    this.storage = null
  }

  // Internal, called by the application: storage implementations set
  // themselves up here, like `DiskStorage` and `S3Storage`. Their subclasses
  // override `initialize()`, which stays empty, so they never need to call
  // super.
  // @overridable
  async setup() {}

  // @overridable
  async initialize() {}

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
      ? Object.setPrototypeOf(
          {
            _handleFile: async (req, file, callback) => {
              try {
                callback(null, await this._handleUpload(req, file, config))
              } catch (err) {
                callback(err)
              }
            }
          },
          this.storage
        )
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
    // Files of storages without `url` have no url to match.
    if (!isString(url)) return false
    return picomatch.isMatch(
      resolveFileUrl(url),
      (this.config.allowedImports || []).map(resolveFileUrl)
    )
  }

  convertAssetFile(file, { trusted = false } = {}) {
    const isInstance = file instanceof AssetFile
    // Files from allowed sources keep their `url`, as imports fetch their data
    // from it. `AssetFile` instances that are converted again keep theirs, as
    // they can be such imports.
    const shouldKeepUrl = (
      !trusted && (
        isInstance ||
        this.isImportSourceAllowed(file.url)
      )
    )
    if (!trusted && !isInstance) {
      if (!this.verifyAssetFile(file)) {
        if (!shouldKeepUrl) {
          throw new AssetError(
            `Invalid asset signature for file '${
              file.name ?? file.key
            }'`
          )
        }
        // Nothing vouches for the keys of unsigned imports, so only accept
        // generated ones:
        if (!(isString(file.key) && generatedKeyRegExp.test(file.key))) {
          throw new AssetError(
            `Invalid asset key for file '${file.name ?? file.key}'`
          )
        }
      }
      // Signatures don't cover data, and imports load their data from `url`,
      // so never take file data from clients:
      delete file.data
    }
    // Remove signature once the data made it to here.
    delete file.signature
    // All other files get the url of this storage, as stored urls can differ
    // from it.
    if (!shouldKeepUrl && isString(file.key)) {
      const url = this.getFileUrl(file)
      if (url) {
        file.url = url
      } else {
        delete file.url
      }
    }
    AssetFile.convert(file, this)
  }

  convertStorageFile(storageFile) {
    // Convert multer file object to our own file object format:
    const file = {
      key: storageFile.key,
      name: storageFile.originalname,
      type: storageFile.mimetype,
      size: storageFile.size,
      url: this.getFileUrl(storageFile),
      // In case `config.readDimensions` is set:
      width: storageFile.width,
      height: storageFile.height
    }
    this.signAssetFile(file)
    return file
  }

  convertStorageFiles(storageFiles) {
    return storageFiles.map(storageFile => this.convertStorageFile(storageFile))
  }

  async addFile(file, data) {
    await this._addFile(file, data)
    file.size = Buffer.byteLength(data)
    // TODO: Support `config.readDimensions`, but this can only be done once
    // there are separate storage instances per model assets config!
    this.convertAssetFile(file, { trusted: true })
    return file
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

  async listFiles() {
    return this._listFiles()
  }

  getFilePath(file) {
    return this._getFilePath(file)
  }

  getFileUrl(file) {
    return this.isPublic ? this._getFileUrl(file) : undefined
  }

  signAssetFile(file) {
    file.signature = this._signAssetFile(file)
  }

  verifyAssetFile(file) {
    // Files without a string key can't carry a valid signature.
    if (isString(file?.key)) {
      const expected = this._signAssetFile(file)
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected, 'hex'),
          Buffer.from(file.signature, 'hex')
        )
      } catch {
        // Catches missing or malformed signatures.
        // Fall through to return false below.
      }
    }
    return false
  }

  _signAssetFile(file) {
    const secret = (
      this.app.keys?.[0] ??
      (Storage._fallbackSecret ??= this._createFallbackSecret())
    )
    const { key, name, type, size, url, width, height } = file
    // `JSON.stringify()` turns missing values into `null`:
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify([key, name, type, size, url, width, height]))
      .digest('hex')
  }

  _createFallbackSecret() {
    console.warn(
      'No app.keys configured for asset signatures. ' +
      'Please note that signatures will not survive ' +
      'process restarts, and users will be unable to ' +
      'update records with asset properties until they ' +
      'reload the page.'
    )
    return crypto.randomBytes(32)
  }

  _getUrl(...parts) {
    return this.url
      ? new URL(path.posix.join(...parts), this.url).toString()
      : undefined // So that it doesn't show up in JSON data.
  }

  _getPath(...parts) {
    return this.path
      ? path.resolve(this.app.basePath, this.path, ...parts)
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

  // @overridable
  async _listFiles() {}

  async _handleUpload(req, file, config) {
    if (
      config.readDimensions &&
      /^(image|video)\//.test(file.mimetype)
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

      const done = (size, hasUploadEnded = false) => {
        file.stream.off('data', onData).off('end', onEnd)
        const stream = new PassThrough()
        if (hasUploadEnded) {
          // Nothing is left to pipe. `data` is still `null` if the upload is
          // empty, which `end()` accepts.
          stream.end(data)
        } else {
          stream.write(data)
          file.stream.pipe(stream)
        }
        resolve({ size, stream })
      }

      const onEnd = () => {
        this.app.emit('error', 'Unable to determine image size')
        done(null, true)
      }

      const onData = chunk => {
        data = data ? Buffer.concat([data, chunk]) : chunk
        let size = null
        try {
          size = readMediaAttributes(data)
        } catch {
          // Ignore errors in `readMediaAttributes()` on partial data.
        }
        // On partial data, sometimes we get results back from leather without
        // actual dimensions, so check for that.
        if (size?.mime && (size.width > 0 || size.height > 0)) {
          done(size)
        } else if (data.length >= headLength) {
          // Give up on media without dimensions in their head, instead of
          // buffering and parsing the whole upload:
          this.app.emit('error', 'Unable to determine image size')
          done(null)
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

// The keys of `AssetFile.getUniqueKey()`: a name, and an extension without
// path or URL delimiters, `%`, whitespace or control characters.
export const generatedKeyRegExp = /^[\w-]{2,}(\.[^\s\p{Cc}./\\:%?#]*)?$/u
