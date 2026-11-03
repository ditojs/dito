import path from 'path'
import mime from 'mime-types'
import { v4 as uuidv4 } from 'uuid'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import { isString } from '@ditojs/utils'
import type { Storage } from './Storage.ts'

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
  signature?: string
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
  declare [SYMBOL_STORAGE]?: Storage;
  declare [SYMBOL_DATA]?: FileData

  constructor({ name, data, type, width, height }: AssetFileOptions) {
    this.key = AssetFile.getUniqueKey(name)
    this.name = name
    // Set `type` before `data`, so it can be used as default in `set data`
    this.type = type!
    this.width = width
    this.height = height
    this.data = data
  }

  get storage(): Storage | null {
    return this[SYMBOL_STORAGE] || null
  }

  get data(): FileData | null {
    return this[SYMBOL_DATA] || null
  }

  set data(data: FileDataInput) {
    if (isString(data)) {
      if (data.startsWith('data:')) {
        const { type, buffer } = dataUriToBuffer(data)
        data = Buffer.from(buffer)
        this.type ||= type || mime.lookup(this.name)
      } else {
        data = Buffer.from(data)
        this.type ||= mime.lookup(this.name) || 'text/plain'
      }
    } else {
      // Buffer & co.
      data = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array)
      this.type ||= (
        (data as FileData).type || // See Storage._readFile()
        mime.lookup(this.name) ||
        'application/octet-stream'
      )
    }
    this.size = Buffer.byteLength(data)
    setHiddenProperty(this, SYMBOL_DATA, data)
  }

  get path(): string | undefined {
    return this.storage?.getFilePath(this)
  }

  async read(): Promise<FileData | null> {
    return this.storage?.readFile(this) || null
  }

  static convert(object: AssetFileObject, storage: Storage) {
    Object.setPrototypeOf(object, AssetFile.prototype)
    setHiddenProperty(object, SYMBOL_STORAGE, storage)
  }

  static create(options: AssetFileOptions) {
    return new AssetFile(options)
  }

  static getUniqueKey(name: string) {
    return `${uuidv4()}${path.extname(name).toLowerCase()}`
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
