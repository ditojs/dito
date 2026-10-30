import path from 'node:path'
import crypto from 'node:crypto'
import mime from 'mime-types'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import { isString } from '@ditojs/utils'

// A stored file as it appears in JSON data: the storage key, and the name,
// type and size of the file. The storage that holds the file and its data stay
// hidden, so they never reach JSON.

// Buffers read from storages carry the content type of the stored file.
export type FileData = Buffer & { type?: string }

export type FileDataInput = string | FileData | Uint8Array | ArrayBuffer

// The JSON form of a stored file.
export interface AssetFileObject {
  key: string
  name?: string
  type?: string
  size?: number
  url?: string
  width?: number
  height?: number
  // Set on files that the server sends, see `Storage.signAssetFile()`.
  signature?: string
}

// What a file needs from the storage that holds it.
export interface FileStorage {
  getFilePath(file: AssetFileObject): string | undefined
  readFile(file: AssetFileObject): Promise<FileData>
}

const SYMBOL_STORAGE = Symbol('storage')
const SYMBOL_DATA = Symbol('data')

export interface AssetFileOptions {
  name: string
  data: FileDataInput
  type?: string
  width?: number
  height?: number
}

export class AssetFile implements AssetFileObject {
  declare key: string
  declare name: string
  declare type: string
  declare size: number
  declare url?: string
  declare width?: number
  declare height?: number
  declare signature?: string;
  declare [SYMBOL_STORAGE]?: FileStorage;
  declare [SYMBOL_DATA]?: FileData

  constructor({ name, data, type, width, height }: AssetFileOptions) {
    this.key = AssetFile.getUniqueKey(name)
    this.name = name
    // Set `type` before `data`, so `set data` only fills in missing types.
    this.type = type!
    this.width = width
    this.height = height
    this.data = data
  }

  get storage(): FileStorage | null {
    return this[SYMBOL_STORAGE] || null
  }

  get data(): FileData | null {
    return this[SYMBOL_DATA] || null
  }

  set data(data: FileDataInput) {
    let buffer: FileData
    if (isString(data)) {
      if (data.startsWith('data:')) {
        const parsed = dataUriToBuffer(data)
        buffer = Buffer.from(parsed.buffer)
        this.type ||= parsed.type || mime.lookup(this.name) || ''
      } else {
        buffer = Buffer.from(data)
        this.type ||= mime.lookup(this.name) || 'text/plain'
      }
    } else {
      buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array)
      this.type ||= (
        buffer.type ||
        mime.lookup(this.name) ||
        'application/octet-stream'
      )
    }
    this.size = Buffer.byteLength(buffer)
    setHiddenProperty(this, SYMBOL_DATA, buffer)
  }

  get path(): string | undefined {
    return this.storage?.getFilePath(this)
  }

  async read(): Promise<FileData | null> {
    return (await this.storage?.readFile(this)) || null
  }

  // Turns the JSON form of a file into an `AssetFile` in place, bound to the
  // storage that holds it.
  static convert(object: AssetFileObject, storage: FileStorage): AssetFile {
    Object.setPrototypeOf(object, AssetFile.prototype)
    setHiddenProperty(object, SYMBOL_STORAGE, storage)
    return object as AssetFile
  }

  static create(options: AssetFileOptions) {
    return new AssetFile(options)
  }

  // A random UUID and the lower-cased extension of the name.
  static getUniqueKey(name: string) {
    return `${crypto.randomUUID()}${path.extname(name).toLowerCase()}`
  }
}

function setHiddenProperty(object: object, key: symbol, value: unknown) {
  Object.defineProperty(object, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value
  })
}
