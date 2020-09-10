import path from 'path'
import mime from 'mime-types'
import dataUriToBuffer from 'data-uri-to-buffer'
import { v4 as uuidv4 } from 'uuid'
import { isString } from '@ditojs/utils'

const SYMBOL_STORAGE = Symbol('storage')
const SYMBOL_DATA = Symbol('data')

export class AssetFile {
  constructor(originalName, data, mimeType) {
    // TODO: If we do file migration, why not switch to:
    // name -> storedName
    // originalName -> name
    this.name = AssetFile.getUniqueFilename(originalName)
    this.originalName = originalName
    // Set `mimeType` before `data`, so it can be used as default in `set data`
    this.mimeType = mimeType
    this.data = data
  }

  get storage() {
    return this[SYMBOL_STORAGE] || null
  }

  set storage(storage) {
    setHiddenProperty(this, SYMBOL_STORAGE, storage)
  }

  get data() {
    return this[SYMBOL_DATA] || null
  }

  set data(data) {
    if (isString(data)) {
      if (data.startsWith('data:')) {
        data = dataUriToBuffer(data)
        this.mimeType ||= data.type || mime.lookup(this.name)
      } else {
        data = Buffer.from(data)
        this.mimeType ||= mime.lookup(this.name) || 'text/plain'
      }
    } else {
      // Buffer & co.
      data = Buffer.isBuffer(data) ? data : Buffer.from(data)
      this.mimeType ||= (
        data.mimeType ||
        mime.lookup(this.name) ||
        'application/octet-stream'
      )
    }
    this.size = Buffer.byteLength(data)
    setHiddenProperty(this, SYMBOL_DATA, data)
  }

  async read() {
    return this.storage?.readFile(this) || null
  }

  static convert(object, storage) {
    Object.setPrototypeOf(object, AssetFile.prototype)
    object.storage = storage
    return object
  }

  static create({ originalName, data, mimeType }) {
    return new AssetFile(originalName, data, mimeType)
  }

  static getUniqueFilename(filename) {
    return `${uuidv4()}${path.extname(filename)}`
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
