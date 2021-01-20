import aws from 'aws-sdk'
import multerS3 from 'multer-s3'
import { Storage } from './Storage'

export class S3Storage extends Storage {
  static type = 's3'

  constructor(app, config) {
    super(app, config)
    const {
      name,
      s3,
      acl,
      bucket,
      contentType,
      ...options
    } = config
    this.s3 = new aws.S3(s3)
    this.acl = acl
    this.bucket = bucket

    this.storage = multerS3({
      s3: this.s3,
      acl,
      bucket,
      contentType: contentType || multerS3.AUTO_CONTENT_TYPE,
      ...options,

      key: (req, file, cb) => {
        cb(null, this.getUniqueKey(file.originalname))
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
      Body: data,
      ContentType: type
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
