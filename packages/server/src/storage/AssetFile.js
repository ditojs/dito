import path from 'path'
import mime from 'mime-types'
import { v4 as uuidv4 } from 'uuid'
import { dataUriToBuffer } from 'data-uri-to-buffer'
import { isString } from '@ditojs/utils'

const SYMBOL_STORAGE = Symbol('storage')
const SYMBOL_DATA = Symbol('data')

export class AssetFile {
  constructor({ name, data, type, width, height }) {
    this.key = AssetFile.getUniqueKey(name)
    this.name = name
    // Set `type` before `data`, so it can be used as default in `set data`
    this.type = type
    this.width = width
    this.height = height
    this.data = data
  }

  get storage() {
    return this[SYMBOL_STORAGE] || null
  }

  get data() {
    return this[SYMBOL_DATA] || null
  }

  set data(data) {
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
      data = Buffer.isBuffer(data) ? data : Buffer.from(data)
      this.type ||= (
        data.type || // See Storage._readFile()
        mime.lookup(this.name) ||
        'application/octet-stream'
      )
    }
    this.size = Buffer.byteLength(data)
    setHiddenProperty(this, SYMBOL_DATA, data)
  }

  get path() {
    return this.storage?.getFilePath(this)
  }

  async read() {
    return this.storage?.readFile(this) || null
  }

  static convert(object, storage) {
    Object.setPrototypeOf(object, AssetFile.prototype)
    setHiddenProperty(object, SYMBOL_STORAGE, storage)
  }

  static create(options) {
    return new AssetFile(options)
  }

  static getUniqueKey(name) {
    return `${uuidv4()}${path.extname(name).toLowerCase()}`
  }
}

function setHiddenProperty(object, key, value) {
  Object.defineProperty(object, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value
  })
}
