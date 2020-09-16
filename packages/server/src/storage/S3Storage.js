import aws from 'aws-sdk'
import axios from 'axios'
import multerS3 from 'multer-s3'
import { Storage } from './Storage'
import { toPromiseCallback } from '@ditojs/utils'

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
    return this._getUrl(file.key) ?? file.url ?? file.location
  }

  // @override
  async _addFile(file, buffer) {
    const data = await this._execute('upload', {
      Bucket: this.bucket,
      ACL: this.acl,
      Key: file.key,
      Body: buffer
    })
    // "Convert" `file` to something looking more like a S3 `storageFile`.
    // For now, only the `location` property is of interest:
    return {
      ...file,
      location: data.Location
    }
  }

  // @override
  async _removeFile(file) {
    await this._execute('deleteObject', {
      Bucket: this.bucket,
      Key: file.key
    })
    // TODO: Check for errors and throw?
  }

  // @override
  async _readFile(file) {
    let data
    let type
    if (file.url) {
      ({
        data,
        'content-type': type
      } = await axios.request({
        method: 'get',
        url: file.url,
        responseType: 'arraybuffer'
      }))
    } else {
      ({
        Body: data,
        ContentType: type
      } = await this._execute('getObject', {
        Bucket: this.bucket,
        Key: file.key
      }))
    }
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    // See `AssetFile.data` setter:
    buffer.type = type
    return buffer
  }

  _execute(method, params) {
    return new Promise((resolve, reject) => {
      this.s3[method](params, toPromiseCallback(resolve, reject))
    })
  }
}
