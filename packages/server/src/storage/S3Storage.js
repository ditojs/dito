import aws from 'aws-sdk'
import multerS3 from 'multer-s3'
import { fileTypeFromBuffer } from 'file-type'
import isSvg from 'is-svg'
import { Storage } from './Storage.js'
import { PassThrough } from 'stream'

export class S3Storage extends Storage {
  static type = 's3'

  constructor(app, config) {
    super(app, config)
    const {
      name,
      s3,
      acl,
      bucket,
      ...options
    } = config
    this.s3 = new aws.S3(s3)
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

          const done = type => {
            const outStream = new PassThrough()
            outStream.write(data)
            stream.pipe(outStream)
            cb(null, type, outStream)
          }

          const onData = chunk => {
            if (!data) {
              // 2. Try reading the mimetype from the first chunk.
              const type = fileTypeFromBuffer(chunk)?.mime
              if (type) {
                stream.off('data', onData)
                done(type)
              } else {
                // 3. If that fails, keep collecting all chunks and determine
                //    the mimetype using the full data.
                stream.once('end', () => {
                  const type = (
                    fileTypeFromBuffer(data)?.mime ||
                    (isSvg(data) ? 'image/svg+xml' : 'application/octet-stream')
                  )
                  done(type)
                })
              }
            }
            data = data ? Buffer.concat([data, chunk]) : chunk
          }

          stream.on('data', onData)
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
  async _addFile(file, buffer) {
    const data = await this.s3.upload({
      Bucket: this.bucket,
      ACL: this.acl,
      Key: file.key,
      ContentType: file.type,
      Body: buffer
    }).promise()
    // "Convert" `file` to something looking more like a S3 `storageFile`.
    // For now, only the `location` property is of interest:
    return {
      ...file,
      location: data.Location
    }
  }

  // @override
  async _removeFile(file) {
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: file.key
    }).promise()
    // TODO: Check for errors and throw?
  }

  // @override
  async _readFile(file) {
    const {
      ContentType: type,
      Body: data
    } = await this.s3.getObject({
      Bucket: this.bucket,
      Key: file.key
    }).promise()
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
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
      result = await this.s3.listObjectsV2(params).promise()
      for (const { Key: key } of result.Contents) {
        files.push(key)
      }
      // Continue it if results are truncated.
      params.ContinuationToken = result.NextContinuationToken
    } while (result.IsTruncated)
    return files
  }
}
