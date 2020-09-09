import path from 'path'
import mime from 'mime-types'
import dataUriToBuffer from 'data-uri-to-buffer'
import { v4 as uuidv4 } from 'uuid'
import { isString } from '@ditojs/utils'

export class AssetFile {
  constructor(name, data, mimeType) {
    if (isString(data)) {
      if (data.startsWith('data:')) {
        data = dataUriToBuffer(data)
        mimeType ||= data.type || mime.lookup(name)
      } else {
        data = Buffer.from(data)
        mimeType ||= mime.lookup(name) || 'text/plain'
      }
    } else {
      // Buffer & co.
      data = Buffer.isBuffer(data) ? data : Buffer.from(data)
      mimeType ||= mime.lookup(name) || 'application/octet-stream'
    }
    this.name = AssetFile.getUniqueFilename(name)
    this.originalName = name
    this.mimeType = mimeType
    this.size = Buffer.byteLength(this.data)
    defineHiddenProperty(this, 'data', data)
  }

  static convert(object, storage) {
    Object.setPrototypeOf(object, AssetFile.prototype)
    defineHiddenProperty(object, 'storage', storage)
    return object
  }

  static create({ name, data, mimeType }) {
    return new AssetFile(name, data, mimeType)
  }

  static getUniqueFilename(filename) {
    return `${uuidv4()}${path.extname(filename)}`
  }
}

function defineHiddenProperty(object, key, value) {
  Object.defineProperty(object, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value
  })
}
