import path from 'path'
import mime from 'mime-types'
import dataUriToBuffer from 'data-uri-to-buffer'
import { v4 as uuidv4 } from 'uuid'
import { isString } from '@ditojs/utils'

const SYMBOL_STORAGE = Symbol('storage')
const SYMBOL_DATA = Symbol('data')

export class AssetFile {
  constructor(originalName, data, mimeType) {
    // TODO: Consider changing names to these?
    // name -> key
    // originalName -> filename
    this.name = AssetFile.getUniqueFilename(originalName)
    this.originalName = originalName
    this.replaceData(data, mimeType)
  }

  get storage() {
    return this[SYMBOL_STORAGE] || null
  }

  get data() {
    return this[SYMBOL_DATA] || null
  }

  replaceData(data, mimeType = this.mimeType) {
    if (isString(data)) {
      if (data.startsWith('data:')) {
        data = dataUriToBuffer(data)
        mimeType ||= data.type || mime.lookup(this.name)
      } else {
        data = Buffer.from(data)
        mimeType ||= mime.lookup(this.name) || 'text/plain'
      }
    } else {
      // Buffer & co.
      data = Buffer.isBuffer(data) ? data : Buffer.from(data)
      mimeType ||= (
        data.mimeType ||
        mime.lookup(this.name) ||
        'application/octet-stream'
      )
    }
    setHiddenProperty(this, SYMBOL_DATA, data)
    this.mimeType = mimeType
    this.size = Buffer.byteLength(data)
  }

  async read() {
    return this.data || this.storage?.readFile(this) || null
  }

  static convert(object, storage) {
    Object.setPrototypeOf(object, AssetFile.prototype)
    setHiddenProperty(object, SYMBOL_STORAGE, storage)
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
