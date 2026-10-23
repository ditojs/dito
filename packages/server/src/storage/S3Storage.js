// aws-lite names its methods after the S3 API:
/* eslint-disable new-cap */
import { isIP } from 'net'
import { callbackify } from 'util'
import { PassThrough, Readable } from 'stream'
import { fileTypeFromBuffer } from 'file-type'
import { readMediaAttributes } from 'leather'
import { isString } from '@ditojs/utils'
import { Storage } from './Storage.js'
import { importPeer } from '../utils/module.js'

export class S3Storage extends Storage {
  static type = 's3'

  s3 = null
  bucket = null
  uploadParams = null

  // @override
  async setup() {
    const { s3: { endpoint, region, credentials } = {}, bucket } = this.config
    if (!bucket) {
      throw new Error(`Missing configuration (bucket) for storage ${this.name}`)
    }
    // Pass everything to aws-lite explicitly, so it never falls back to the
    // environment or `~/.aws`:
    if (!region) {
      throw new Error(
        `Missing configuration (s3.region) for storage ${this.name}`
      )
    }
    if (!(credentials?.accessKeyId && credentials?.secretAccessKey)) {
      throw new Error(
        `Missing configuration (s3.credentials) for storage ${this.name}`
      )
    }
    this.uploadParams = {}
    for (const [name, param] of Object.entries(uploadParamNames)) {
      const value = this.config[name]
      if (value != null) {
        if (!isString(value)) {
          throw new Error(
            `Invalid configuration (${name}) for storage ${this.name}: ` +
            'Only strings are supported.'
          )
        }
        this.uploadParams[param] = value
      }
    }

    // Importing the S3 client is costly, so we only do it when it's used:
    const { default: awsLite } = await importPeer(this, '@aws-lite/client')
    const { default: s3Plugin } = await importPeer(this, '@aws-lite/s3')
    const origin = new URL(endpoint ?? `https://s3.${region}.amazonaws.com`)
    const { S3 } = await awsLite({
      endpoint: origin.href,
      region,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      plugins: [s3Plugin]
    })
    this.s3 = S3
    this.bucket = bucket
    // Without `config.url`, use the url of the bucket, in path-style only for
    // local hosts and buckets with dots in their names, like aws-lite:
    const { protocol, host, hostname } = origin
    this.url ??=
      hostname === 'localhost' || isIP(hostname) || bucket.includes('.')
        ? `${protocol}//${host}/${bucket}/`
        : `${protocol}//${bucket}.${host}/`

    // The multer storage engine of uploads:
    this.storage = {
      _handleFile: callbackify(async (req, file) => {
        const key = this.getUniqueKey(file.originalname)
        const { type, stream } = await getContentType(file)
        // Store the determined width and height as meta-data on the s3 object
        // as well. You never know, it may become useful :)
        const { width, height } = file
        const metadata =
          width != null || height != null
            ? { width: `${width}`, height: `${height}` }
            : null
        const size = await this._upload(key, stream, {
          ContentType: type,
          ...(metadata && { Metadata: metadata })
        })
        return { key, size }
      }),

      _removeFile: callbackify((req, file) => this._removeFile(file))
    }
  }

  // @override
  _getFilePath(_file) {
    // There is no "local" file-path to files on S3.
    return undefined
  }

  // @override
  _getFileUrl(file) {
    return this._getUrl(file.key)
  }

  // @override
  async _addFile(file, data) {
    await this._upload(file.key, data, { ContentType: file.type })
  }

  // @override
  async _removeFile(file) {
    await this.s3.DeleteObject({
      Bucket: this.bucket,
      Key: file.key
    })
    // TODO: Check for errors and throw?
  }

  // @override
  async _readFile(file) {
    const {
      ContentType: type,
      Body: buffer
    } = await this.s3.GetObject({
      Bucket: this.bucket,
      Key: file.key,
      // Never let aws-lite parse JSON or XML files:
      rawResponsePayload: true
    })
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
      result = await this.s3.ListObjectsV2(params)
      for (const { Key: key } of result.Contents ?? []) {
        files.push(key)
      }
      // Continue it if results are truncated.
      params.ContinuationToken = result.NextContinuationToken
    } while (result.IsTruncated)
    return files
  }

  async _upload(key, data, params) {
    const { s3 } = this
    const object = { Bucket: this.bucket, Key: key }
    params = { ...object, ...this.uploadParams, ...params }
    if (data instanceof Readable) {
      // Upload streams of unknown length in parts with our own loop, until
      // aws-lite releases its fix of `S3.Upload()`, which can replace it:
      const { UploadId } = await s3.CreateMultipartUpload(params)
      try {
        const Parts = []
        let size = 0
        for await (const Body of getParts(data, uploadPartSize)) {
          const PartNumber = Parts.length + 1
          const { ETag } = await s3.UploadPart({
            ...object,
            UploadId,
            PartNumber,
            Body
          })
          Parts.push({ PartNumber, ETag })
          size += Body.length
        }
        await s3.CompleteMultipartUpload({
          ...object,
          UploadId,
          MultipartUpload: { Parts }
        })
        return size
      } catch (err) {
        // Throw the error of the upload, not the one of its abort:
        await s3.AbortMultipartUpload({ ...object, UploadId }).catch(() => {})
        throw err
      }
    } else {
      await s3.PutObject({ ...params, Body: data })
      return Buffer.byteLength(data)
    }
  }
}

// The config options of uploads and their S3 params:
const uploadParamNames = {
  acl: 'ACL',
  cacheControl: 'CacheControl',
  contentDisposition: 'ContentDisposition',
  contentEncoding: 'ContentEncoding',
  storageClass: 'StorageClass',
  serverSideEncryption: 'ServerSideEncryption',
  sseKmsKeyId: 'SSEKMSKeyId'
}

const uploadPartSize = 8 * 1024 * 1024

async function* getParts(stream, partSize) {
  let chunks = []
  let length = 0
  let count = 0
  for await (const chunk of stream) {
    chunks.push(chunk)
    length += chunk.length
    while (length >= partSize) {
      const buffer = Buffer.concat(chunks)
      yield buffer.subarray(0, partSize)
      chunks = [buffer.subarray(partSize)]
      length -= partSize
      count++
    }
  }
  // S3 needs at least one part, which may then be empty:
  if (length > 0 || count === 0) {
    yield Buffer.concat(chunks)
  }
}

async function getContentType({ mimetype, stream }) {
  if (mimetype) {
    // 1. Trust file.mimetype if provided.
    return { type: mimetype, stream }
  } else {
    return new Promise(resolve => {
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
        resolve({ type, stream: outStream })
      }

      const onData = chunk => {
        data = data ? Buffer.concat([data, chunk]) : chunk
        if (!firstChunkTypePromise) {
          // 2. Try reading the mimetype from the first chunk. Pause the
          //    stream while the type is detected asynchronously, so no
          //    chunks pass by in the meantime.
          stream.pause()
          firstChunkTypePromise = getFileTypeFromBuffer(chunk).then(type => {
            if (type) {
              done(type)
            } else {
              stream.resume()
            }
            return type
          })
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
    })
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
