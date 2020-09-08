import path from 'path'
import mime from 'mime-types'
import dataUriToBuffer from 'data-uri-to-buffer'
import { v4 as uuidv4 } from 'uuid'
import { isString } from '@ditojs/utils'

export class AssetFile {
  constructor({ name, data, mimeType }) {
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
    this.originalName = name
    this.name = AssetFile.getUniqueFilename(name)
    this.data = data
    this.mimeType = mimeType
    this.size = Buffer.byteLength(this.data)
  }

  toJSON() {
    const { name, originalName, mimeType, size } = this
    return { name, originalName, mimeType, size }
  }

  static getUniqueFilename(filename) {
    return `${uuidv4()}${path.extname(filename)}`
  }
}
