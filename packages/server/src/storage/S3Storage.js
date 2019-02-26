import aws from 'aws-sdk'
import multerS3 from 'multer-s3'
import { Storage } from './Storage'

export class S3Storage extends Storage {
  static type = 's3'

  constructor(config) {
    super(config)
    const {
      name,
      s3,
      bucket,
      contentType,
      ...options
    } = config
    this.s3 = new aws.S3(s3)
    this.bucket = bucket
    this.storage = multerS3({
      s3: this.s3,
      bucket,
      contentType: contentType || multerS3.AUTO_CONTENT_TYPE,
      ...options,

      metadata: (req, file, cb) => cb(null, {
        fieldName: file.fieldname
      }),

      key: (req, file, cb) => cb(null, this.getFilename(file))
    })
  }

  getFileIdentifiers(file) {
    return {
      name: file.key,
      path: file.bucket,
      location: file.location
    }
  }

  managesFile(file) {
    return file.path === this.bucket
  }

  async deleteFile(file) {
    await this.execute('deleteObject', {
      Bucket: file.path,
      Key: file.name
    })
  }

  execute(method, params) {
    return new Promise((resolve, reject) => {
      this.s3[method](params, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }
}
