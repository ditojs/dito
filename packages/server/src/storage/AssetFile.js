import path from 'path'
import mime from 'mime-types'
import dataUriToBuffer from 'data-uri-to-buffer'
import { v4 as uuidv4 } from 'uuid'
import { isString } from '@ditojs/utils'

const SYMBOL_STORAGE = Symbol('storage')
const SYMBOL_DATA = Symbol('data')

export class AssetFile {
  constructor(name, data, type) {
    this.key = AssetFile.getUniqueKey(name)
    this.name = name
    // Set `type` before `data`, so it can be used as default in `set data`
    this.type = type
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
        data = dataUriToBuffer(data)
        this.type ||= data.type || mime.lookup(this.name)
      } else {
        data = Buffer.from(data)
        this.type ||= mime.lookup(this.name) || 'text/plain'
      }
    } else {
      // Buffer & co.
      data = Buffer.isBuffer(data) ? data : Buffer.from(data)
      this.type ||= (
        data.type ||
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
    return object
  }

  static create({ name, data, type }) {
    return new AssetFile(name, data, type)
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
