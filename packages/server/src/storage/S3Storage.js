import multerS3 from 'multer-s3'
import { fileTypeFromBuffer } from 'file-type'
import { Storage } from './Storage.js'
import { PassThrough } from 'stream'
import consumers from 'stream/consumers'
import { readMediaAttributes } from 'leather'

export class S3Storage extends Storage {
  static type = 's3'

  s3 = null
  acl = null
  bucket = null

  async setup() {
    const {
      name,
      s3,
      acl,
      bucket,
      ...options
    } = this.config

    // "@aws-sdk/client-s3" is a peer-dependency, and importing it costly,
    // so we do it lazily.
    const { S3 } = await import('@aws-sdk/client-s3')
    this.s3 = new S3(s3)
    this.acl = acl
    this.bucket = bucket

    this.storage = multerS3({
      s3: this.s3,
      acl,
      bucket,
      ...options,

      key: (req, file, cb) => {
        cb(null, this.getUniqueKey(file.originalname))
      },

      contentType: (req, file, cb) => {
        const { mimetype, stream } = file
        if (mimetype) {
          // 1. Trust file.mimetype if provided.
          cb(null, mimetype)
        } else {
          let data = null
          let firstChunkTypePromise = null

          const done = (type, hasUploadEnded = false) => {
            stream.off('data', onData).off('end', onEnd)
            const outStream = new PassThrough()
            if (hasUploadEnded) {
              // Nothing is left to pipe. `data` is still `null` if the upload
              // is empty, which `end()` accepts.
              outStream.end(data)
            } else {
              outStream.write(data)
              stream.pipe(outStream)
            }
            cb(null, type, outStream)
          }

          const onData = chunk => {
            data = data ? Buffer.concat([data, chunk]) : chunk
            if (!firstChunkTypePromise) {
              // 2. Try reading the mimetype from the first chunk. Pause the
              //    stream while the type is detected asynchronously, so no
              //    chunks pass by in the meantime.
              stream.pause()
              firstChunkTypePromise = getFileTypeFromBuffer(chunk).then(
                type => {
                  if (type) {
                    done(type)
                  } else {
                    stream.resume()
                  }
                  return type
                }
              )
            }
          }

          const onEnd = async () => {
            // The stream may end while the first chunk is still examined.
            const firstChunkType = await firstChunkTypePromise
            if (!firstChunkType) {
              // 3. If that fails, determine the mimetype using the full data.
              const type = data && (await getFileTypeFromBuffer(data))
              done(type || 'application/octet-stream', true)
            }
          }

          stream.on('data', onData).on('end', onEnd)
        }
      },

      metadata: (req, file, cb) => {
        // Store the determined width and height as meta-data on the s3 object
        // as well. You never know, it may become useful :)
        const { width, height } = file
        if (width != null || height != null) {
          cb(null, {
            width: `${width}`,
            height: `${height}`
          })
        } else {
          cb(null, {})
        }
      }
    })
  }

  // @override
  _getFilePath(_file) {
    // There is no "local" file-path to files on S3.
    return undefined
  }

  // @override
  _getFileUrl(file) {
    return this._getUrl(file.key) ?? file.url
  }

  // @override
  async _addFile(file, data) {
    const result = await this.s3.putObject({
      Bucket: this.bucket,
      ACL: this.acl,
      Key: file.key,
      ContentType: file.type,
      Body: data
    })
    // In `Storage.addFile()` this will get overridden with the result of
    // `_getUrl()` if it exists, but is used as a fallback otherwise,
    // see `_getFileUrl()`.
    file.url = result.Location
  }

  // @override
  async _removeFile(file) {
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: file.key
    })
    // TODO: Check for errors and throw?
  }

  // @override
  async _readFile(file) {
    const {
      ContentType: type,
      Body: stream
    } = await this.s3.getObject({
      Bucket: this.bucket,
      Key: file.key
    })
    const buffer = await consumers.buffer(stream)
    // See `AssetFile.data` setter:
    buffer.type = type
    return buffer
  }

  // @override
  async _listKeys() {
    const files = []
    const params = { Bucket: this.bucket }
    let result
    do {
      result = await this.s3.listObjectsV2(params)
      for (const { Key: key } of result.Contents ?? []) {
        files.push(key)
      }
      // Continue it if results are truncated.
      params.ContinuationToken = result.NextContinuationToken
    } while (result.IsTruncated)
    return files
  }
}

async function getFileTypeFromBuffer(buffer) {
  try {
    const fileType = await fileTypeFromBuffer(buffer)
    // Use leather as fall-back for better media file mime type detection.
    return fileType?.mime || readMediaAttributes(buffer)?.mime || null
  } catch {}
  return null
}
