import path from 'path'
import { URL } from 'url'
import crypto from 'crypto'
import multer from '@koa/multer'
import picomatch from 'picomatch'
import { PassThrough } from 'stream'
import { readMediaAttributes } from 'leather'
import { hyphenate, isString, toPromiseCallback } from '@ditojs/utils'
import {
  AssetFile,
  type AssetFileObject,
  type FileData
} from './AssetFile.ts'
import { AssetError } from './AssetError.ts'
import { resolveFileUrl } from '../utils/asset.js'

export interface StorageConfig {
  url?: string
  path?: string
  concurrency?: number
  allowedImports?: string[]
  // The options of the storage implementations, such as `bucket`.
  [key: string]: any
}

// The options of `getUploadHandler()`, passed on to multer.
export interface UploadConfig {
  readDimensions?: boolean
  [key: string]: any
}

const storageClasses: Record<string, typeof Storage> = {}

export class Storage {
  declare static type?: string
  declare static _fallbackSecret?: Buffer

  declare app: any
  declare name: string
  declare config: StorageConfig
  declare url: string | undefined
  declare path: string | undefined
  declare concurrency: number
  declare storage: any

  isInitialized = false

  constructor(app: any, name: string, config: StorageConfig) {
    this.app = app
    this.name = name
    this.config = config
    this.url = config.url
    this.path = config.path
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

  static register(storageClass: typeof Storage) {
    const type = (
      storageClass.type ||
      hyphenate(storageClass.name.match(/^(.*?)(?:Storage|)$/)[1])
    )
    storageClass.type = type
    storageClasses[type] = storageClass
  }

  static get(type: string) {
    return storageClasses[type] || null
  }

  getUploadStorage(config: UploadConfig) {
    // Returns a storage that inherits from this.storage but overrides
    // _handleFile to pass on `config` to the call of `handleUpload()`
    return this.storage
      ? Object.setPrototypeOf(
          {
            _handleFile: async (req: any, file: any, callback: any) => {
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

  getUploadHandler(config: UploadConfig) {
    const storage = this.getUploadStorage(config)
    return storage ? multer({ ...config, storage }).any() : null
  }

  getUniqueKey(name: string) {
    return AssetFile.getUniqueKey(name)
  }

  isImportSourceAllowed(url: unknown) {
    // Files of storages without `url` have no url to match.
    if (!isString(url)) return false
    return picomatch.isMatch(
      resolveFileUrl(url as string),
      (this.config.allowedImports || []).map(resolveFileUrl)
    )
  }

  convertAssetFile(
    file: AssetFileObject & { data?: unknown },
    { trusted = false } = {}
  ) {
    if (!trusted && !(file instanceof AssetFile)) {
      if (!this.verifyAssetFile(file)) {
        if (!this.isImportSourceAllowed(file.url)) {
          throw new AssetError(
            `Invalid asset signature for file '${
              file.name ?? file.key
            }'`
          )
        }
        // Nothing vouches for the keys of unsigned imports, so only accept
        // generated ones:
        if (!(isString(file.key) && importKeyRegExp.test(file.key))) {
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
    AssetFile.convert(file, this)
  }

  convertStorageFile(storageFile: any) {
    // Convert multer file object to our own file object format:
    const file: AssetFileObject = {
      key: storageFile.key,
      name: storageFile.originalname,
      type: storageFile.mimetype,
      size: storageFile.size,
      url: this._getFileUrl(storageFile),
      // In case `config.readDimensions` is set:
      width: storageFile.width,
      height: storageFile.height
    }
    this.signAssetFile(file)
    return file
  }

  convertStorageFiles(storageFiles: any[]) {
    return storageFiles.map(storageFile => this.convertStorageFile(storageFile))
  }

  async addFile(file: AssetFileObject, data: Buffer) {
    await this._addFile(file, data)
    file.size = Buffer.byteLength(data)
    file.url = this._getFileUrl(file)
    // TODO: Support `config.readDimensions`, but this can only be done once
    // there are separate storage instances per model assets config!
    this.convertAssetFile(file, { trusted: true })
    return file
  }

  async removeFile(file: AssetFileObject) {
    await this._removeFile(file)
  }

  async readFile(file: AssetFileObject): Promise<FileData> {
    return this._readFile(file)
  }

  async listKeys(): Promise<string[]> {
    return this._listKeys()
  }

  getFilePath(file: AssetFileObject): string | undefined {
    return this._getFilePath(file)
  }

  getFileUrl(file: AssetFileObject): string | undefined {
    return this._getFileUrl(file)
  }

  signAssetFile(file: AssetFileObject) {
    file.signature = this._signAssetFile(file)
  }

  verifyAssetFile(file: AssetFileObject | null | undefined) {
    // Files without a string key can't carry a valid signature.
    if (isString(file?.key)) {
      const expected = this._signAssetFile(file)
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected, 'hex'),
          Buffer.from(file.signature!, 'hex')
        )
      } catch {
        // Catches missing or malformed signatures.
        // Fall through to return false below.
      }
    }
    return false
  }

  _signAssetFile(file: AssetFileObject) {
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

  _createFallbackSecret(): Buffer {
    console.warn(
      'No app.keys configured for asset signatures. ' +
      'Please note that signatures will not survive ' +
      'process restarts, and users will be unable to ' +
      'update records with asset properties until they ' +
      'reload the page.'
    )
    return crypto.randomBytes(32)
  }

  _getUrl(...parts: string[]) {
    return this.url
      ? new URL(path.posix.join(...parts), this.url).toString()
      : undefined // So that it doesn't show up in JSON data.
  }

  _getPath(...parts: string[]) {
    return this.path
      ? path.resolve(this.app.basePath, this.path, ...parts)
      : undefined // So that it doesn't show up in JSON data.
  }

  // @overridable
  _getFilePath(_file: AssetFileObject): any {}

  // @overridable
  _getFileUrl(_file: AssetFileObject): any {}

  // @overridable
  async _addFile(_file: AssetFileObject, _data: Buffer): Promise<void> {}

  // @overridable
  async _removeFile(_file: AssetFileObject): Promise<void> {}

  // @overridable
  async _readFile(_file: AssetFileObject): Promise<any> {}

  // @overridable
  async _listKeys(): Promise<any> {}

  async _handleUpload(req: any, file: any, config: UploadConfig) {
    if (
      config.readDimensions &&
      /^(image|video)\//.test(file.mimetype)
    ) {
      return this._handleMediaFile(req, file)
    } else {
      return this._handleFile(req, file)
    }
  }

  _handleFile(req: any, file: any, stream: PassThrough | null = null) {
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

  async _handleMediaFile(req: any, file: any) {
    const { size, stream } = await new Promise<{
      size: { width: number, height: number } | null
      stream: PassThrough
    }>(resolve => {
      let data: Buffer | null = null

      const done = (size: any, hasUploadEnded = false) => {
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

      const onData = (chunk: Buffer) => {
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

// The keys of `AssetFile.getUniqueKey()`: a name, and an extension without
// path or URL delimiters, `%`, whitespace or control characters.
const importKeyRegExp = /^[\w-]{2,}(\.[^\s\p{Cc}./\\:%?#]*)?$/u
