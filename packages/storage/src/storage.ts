import path from 'node:path'
import crypto from 'node:crypto'
import { PassThrough, type Readable } from 'node:stream'
import picomatch from 'picomatch'
import { readMediaAttributes } from 'leather'
import { isString } from '@ditojs/utils'
import {
  AssetFile,
  type AssetFileObject,
  type FileData,
  type FileStorage
} from './asset-file.ts'
import { AssetError } from './errors.ts'

// The base class of storages. Subclasses implement the `_` methods for their
// backend, and the public methods add what all storages share: unique keys,
// urls and the signatures of the files that the server sends to clients.
// Clients send files back with their signature, which proves that the server
// created the file and that its key, name, type, size, url and dimensions are
// unchanged.

export interface StorageOptions {
  // The name of the storage, for asset records and error messages.
  name: string
  // The base url of the stored files.
  url?: string
  // The secret of the file signatures, such as the first of the app's keys.
  secret?: string | Buffer
  // Glob patterns of urls, from which unsigned files may be imported.
  allowedImports?: string[]
  // How many files to store at once, e.g. when importing foreign files.
  concurrency?: number
}

// A file that a client uploads.
export interface Upload {
  name: string
  type?: string
  stream: Readable
}

export interface UploadOptions {
  // Reads the width and height of images and videos.
  readDimensions?: boolean
}

export interface UploadInfo {
  type?: string
  width?: number
  height?: number
}

export abstract class Storage implements FileStorage {
  name: string
  url: string | undefined
  concurrency: number
  allowedImports: string[]
  #secret: string | Buffer | undefined

  constructor({
    name,
    url,
    secret,
    allowedImports = [],
    concurrency = 8
  }: StorageOptions) {
    this.name = name
    this.url = url
    this.allowedImports = allowedImports
    this.concurrency = concurrency
    this.#secret = secret
  }

  getUniqueKey(name: string) {
    return AssetFile.getUniqueKey(name)
  }

  isImportSourceAllowed(url: unknown) {
    // Files of storages without `url` have no url to match.
    if (!isString(url)) return false
    return picomatch.isMatch(
      resolveFileUrl(url as string),
      this.allowedImports.map(resolveFileUrl)
    )
  }

  // Turns the JSON form of a file into an `AssetFile` of this storage. Unless
  // `trusted`, the file needs a valid signature or an allowed import source.
  convertAssetFile(
    file: AssetFileObject & { data?: unknown },
    { trusted = false } = {}
  ): AssetFile {
    if (!trusted && !(file instanceof AssetFile)) {
      if (!this.verifyAssetFile(file)) {
        if (!this.isImportSourceAllowed(file.url)) {
          throw new AssetError(
            `Invalid asset signature for file '${file.name ?? file.key}'`
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
    delete file.signature
    return AssetFile.convert(file, this)
  }

  // Stores an upload under a new key, and returns its signed file object.
  async upload(
    { name, type, stream }: Upload,
    { readDimensions = false }: UploadOptions = {}
  ): Promise<AssetFileObject> {
    const key = this.getUniqueKey(name)
    let width: number | undefined
    let height: number | undefined
    if (readDimensions && type && /^(image|video)\//.test(type)) {
      ;({ width, height, stream } = await readMediaDimensions(stream))
    }
    const result = await this._upload(key, stream, { type, width, height })
    const file: AssetFileObject = {
      key,
      name,
      type: type || result.type || 'application/octet-stream',
      size: result.size,
      url: this._getFileUrl({ key }),
      width,
      height
    }
    this.signAssetFile(file)
    return file
  }

  async addFile(file: AssetFileObject, data: Buffer): Promise<AssetFile> {
    await this._addFile(file, data)
    file.size = Buffer.byteLength(data)
    file.url = this._getFileUrl(file)
    return this.convertAssetFile(file, { trusted: true })
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

  getFilePath(file: AssetFileObject) {
    return this._getFilePath(file)
  }

  getFileUrl(file: AssetFileObject) {
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
        // Missing or malformed signatures.
      }
    }
    return false
  }

  protected _signAssetFile(file: AssetFileObject) {
    if (!this.#secret) {
      throw new Error(
        `Unable to sign asset files of storage '${this.name}' without secret`
      )
    }
    const { key, name, type, size, url, width, height } = file
    // `JSON.stringify()` turns missing values into `null`:
    return crypto
      .createHmac('sha256', this.#secret)
      .update(JSON.stringify([key, name, type, size, url, width, height]))
      .digest('hex')
  }

  protected _getUrl(...parts: string[]) {
    return this.url
      ? new URL(path.posix.join(...parts), this.url).toString()
      : undefined
  }

  // Stores a stream under `key` and returns its size, and its type if the
  // storage detects it. The default reads the stream and adds the data.
  protected async _upload(
    key: string,
    stream: Readable,
    { type }: UploadInfo
  ): Promise<{ size: number; type?: string }> {
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk)
    const data = Buffer.concat(chunks)
    await this._addFile({ key, type }, data)
    return { size: data.length }
  }

  protected _getFilePath(_file: AssetFileObject): string | undefined {
    return undefined
  }

  protected _getFileUrl(_file: AssetFileObject): string | undefined {
    return undefined
  }

  protected abstract _addFile(
    file: AssetFileObject,
    data: Buffer
  ): Promise<void>

  protected abstract _removeFile(file: AssetFileObject): Promise<void>
  protected abstract _readFile(file: AssetFileObject): Promise<FileData>
  protected abstract _listKeys(): Promise<string[]>
}

export function resolveFileUrl(url: string) {
  return url.startsWith('file://')
    ? `file://${path.resolve(url.slice(7))}`
    : url
}

// Reads the dimensions from the start of a media stream, and returns them with
// a stream of all its data.
async function readMediaDimensions(input: Readable): Promise<{
  width?: number
  height?: number
  stream: Readable
}> {
  return new Promise(resolve => {
    let data: Buffer | null = null

    const done = (
      size: { width: number; height: number } | null,
      hasUploadEnded = false
    ) => {
      input.off('data', onData).off('end', onEnd)
      const stream = new PassThrough()
      if (hasUploadEnded) {
        // Nothing is left to pipe. `data` is still `null` if the upload is
        // empty, which `end()` accepts.
        stream.end(data)
      } else {
        stream.write(data)
        input.pipe(stream)
      }
      resolve({ width: size?.width, height: size?.height, stream })
    }

    const onEnd = () => done(null, true)

    const onData = (chunk: Buffer) => {
      data = data ? Buffer.concat([data, chunk]) : chunk
      try {
        const size = readMediaAttributes(data)
        // Partial data can give results without dimensions.
        if (size.mime && (size.width > 0 || size.height > 0)) {
          done(size)
        }
      } catch {
        // `readMediaAttributes()` can throw on partial data.
      }
    }

    input.on('data', onData).on('end', onEnd)
  })
}

// The keys of `AssetFile.getUniqueKey()`: a name, and an extension without
// path or URL delimiters, `%`, whitespace or control characters.
const importKeyRegExp = /^[\w-]{2,}(\.[^\s\p{Cc}./\\:%?#]*)?$/u
