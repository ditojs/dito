// aws-lite names its methods after the S3 API:
/* eslint-disable new-cap */
import { isIP } from 'node:net'
import { PassThrough, Readable } from 'node:stream'
import { fileTypeFromBuffer } from 'file-type'
import { readMediaAttributes } from 'leather'
import { isString } from '@ditojs/utils'
import { Storage, type StorageOptions, type UploadInfo } from './storage.ts'
import type { AssetFileObject, FileData } from './asset-file.ts'

// Stores files as objects in an S3 bucket, under their keys. The aws-lite
// client is an optional peer, imported when the storage first needs it.

export interface S3StorageOptions extends StorageOptions {
  bucket: string
  // The settings of the aws-lite S3 client. It reads nothing from the
  // environment or from `~/.aws`.
  s3: {
    // Defaults to `https://s3.${region}.amazonaws.com`.
    endpoint?: string
    region: string
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      sessionToken?: string
    }
  }
  // The canned ACL of stored objects, such as `'public-read'`.
  acl?: string
  cacheControl?: string
  contentDisposition?: string
  contentEncoding?: string
  storageClass?: string
  serverSideEncryption?: string
  sseKmsKeyId?: string
}

type S3Method = (params: Record<string, any>) => Promise<any>

// The methods of aws-lite's S3 client that the storage calls.
export interface S3Client {
  PutObject: S3Method
  GetObject: S3Method
  DeleteObject: S3Method
  ListObjectsV2: S3Method
  CreateMultipartUpload: S3Method
  UploadPart: S3Method
  CompleteMultipartUpload: S3Method
  AbortMultipartUpload: S3Method
}

// The options of uploads and their S3 params:
const uploadParamNames = {
  acl: 'ACL',
  cacheControl: 'CacheControl',
  contentDisposition: 'ContentDisposition',
  contentEncoding: 'ContentEncoding',
  storageClass: 'StorageClass',
  serverSideEncryption: 'ServerSideEncryption',
  sseKmsKeyId: 'SSEKMSKeyId'
} as const

const uploadPartSize = 8 * 1024 * 1024

export class S3Storage extends Storage {
  bucket: string
  uploadParams: Record<string, string>
  #options: S3StorageOptions['s3']
  #client: Promise<S3Client> | null = null

  constructor(options: S3StorageOptions) {
    super(options)
    const { bucket, s3: { endpoint, region, credentials } = {} as never } =
      options
    if (!bucket) {
      throw new Error(`Missing option 'bucket' for storage '${this.name}'`)
    }
    if (!region) {
      throw new Error(`Missing option 's3.region' for storage '${this.name}'`)
    }
    if (!(credentials?.accessKeyId && credentials?.secretAccessKey)) {
      throw new Error(
        `Missing option 's3.credentials' for storage '${this.name}'`
      )
    }
    this.bucket = bucket
    this.#options = options.s3
    this.uploadParams = {}
    for (const [name, param] of Object.entries(uploadParamNames)) {
      const value = options[name as keyof typeof uploadParamNames]
      if (value != null) {
        if (!isString(value)) {
          throw new Error(
            `Invalid option '${name}' for storage '${this.name}': ` +
            'Only strings are supported.'
          )
        }
        this.uploadParams[param] = value
      }
    }
    // Without `url`, use the url of the bucket, in path-style only for local
    // hosts and buckets with dots in their names, like aws-lite:
    const { protocol, host, hostname } = this.#getOrigin()
    this.url ??=
      hostname === 'localhost' || isIP(hostname) || bucket.includes('.')
        ? `${protocol}//${host}/${bucket}/`
        : `${protocol}//${bucket}.${host}/`
  }

  // The aws-lite S3 client, created on first use.
  getClient(): Promise<S3Client> {
    return (this.#client ??= this.#createClient().catch(error => {
      this.#client = null
      throw error
    }))
  }

  async #createClient(): Promise<S3Client> {
    const { region, credentials } = this.#options
    const { default: awsLite } = await importPeer('@aws-lite/client')
    const { default: s3Plugin } = await importPeer('@aws-lite/s3')
    const { S3 } = await awsLite({
      endpoint: this.#getOrigin().href,
      region,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      plugins: [s3Plugin]
    })
    return S3
  }

  #getOrigin() {
    const { endpoint, region } = this.#options
    return new URL(endpoint ?? `https://s3.${region}.amazonaws.com`)
  }

  protected override _getFileUrl(file: AssetFileObject) {
    return this._getUrl(file.key)
  }

  protected override async _upload(
    key: string,
    input: Readable,
    { type, width, height }: UploadInfo
  ) {
    const { type: contentType, stream } = await getContentType(type, input)
    // Store the dimensions as metadata of the object as well:
    const metadata =
      width != null || height != null
        ? { width: `${width}`, height: `${height}` }
        : null
    const size = await this.#put(key, stream, {
      ContentType: contentType,
      ...(metadata && { Metadata: metadata })
    })
    return { size, type: contentType }
  }

  protected async _addFile(file: AssetFileObject, data: Buffer) {
    await this.#put(file.key, data, { ContentType: file.type })
  }

  protected async _removeFile(file: AssetFileObject) {
    const s3 = await this.getClient()
    await s3.DeleteObject({ Bucket: this.bucket, Key: file.key })
  }

  protected async _readFile(file: AssetFileObject) {
    const s3 = await this.getClient()
    const { ContentType: type, Body: buffer } = await s3.GetObject({
      Bucket: this.bucket,
      Key: file.key,
      // Never let aws-lite parse JSON or XML files:
      rawResponsePayload: true
    })
    // See the `AssetFile.data` setter:
    ;(buffer as FileData).type = type
    return buffer as FileData
  }

  protected async _listKeys() {
    const s3 = await this.getClient()
    const keys: string[] = []
    const params: Record<string, unknown> = { Bucket: this.bucket }
    let result
    do {
      result = await s3.ListObjectsV2(params)
      for (const { Key: key } of result.Contents ?? []) {
        keys.push(key)
      }
      params.ContinuationToken = result.NextContinuationToken
    } while (result.IsTruncated)
    return keys
  }

  async #put(
    key: string,
    data: Buffer | Readable,
    params: Record<string, unknown>
  ) {
    const s3 = await this.getClient()
    const object = { Bucket: this.bucket, Key: key }
    params = { ...object, ...this.uploadParams, ...params }
    if (!(data instanceof Readable)) {
      await s3.PutObject({ ...params, Body: data })
      return Buffer.byteLength(data)
    }
    // Upload streams of unknown length in parts with our own loop, until
    // aws-lite releases its fix of `S3.Upload()`, which can replace it:
    const { UploadId } = await s3.CreateMultipartUpload(params)
    try {
      const Parts: { PartNumber: number; ETag: string }[] = []
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
    } catch (error) {
      // Throw the error of the upload, not the one of its abort:
      await s3.AbortMultipartUpload({ ...object, UploadId }).catch(() => {})
      throw error
    }
  }
}

// Optional peers are imported when they are used, with a clear error when
// they aren't installed.
async function importPeer(module: string) {
  try {
    return await import(module)
  } catch (error) {
    throw (error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND'
      ? new Error(`Unable to use 'S3Storage' without '${module}'.`)
      : error
  }
}

async function* getParts(stream: Readable, partSize: number) {
  let chunks: Buffer[] = []
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

// Returns the type of an upload and a stream of all its data: the type that
// the client sent, or else the type detected from the first chunk, or else
// from all data.
async function getContentType(
  type: string | undefined,
  stream: Readable
): Promise<{ type: string; stream: Readable }> {
  if (type) return { type, stream }
  return new Promise(resolve => {
    let data: Buffer | null = null
    let firstChunkTypePromise: Promise<string | null> | null = null

    const done = (type: string, hasUploadEnded = false) => {
      stream.off('data', onData).off('end', onEnd)
      const outStream = new PassThrough()
      if (hasUploadEnded) {
        // Nothing is left to pipe. `data` is still `null` if the upload is
        // empty, which `end()` accepts.
        outStream.end(data)
      } else {
        outStream.write(data)
        stream.pipe(outStream)
      }
      resolve({ type, stream: outStream })
    }

    const onData = (chunk: Buffer) => {
      data = data ? Buffer.concat([data, chunk]) : chunk
      if (!firstChunkTypePromise) {
        // Pause the stream while the type is detected asynchronously, so no
        // chunks pass by in the meantime.
        stream.pause()
        firstChunkTypePromise = getFileType(chunk).then(type => {
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
        const type = data && (await getFileType(data))
        done(type || 'application/octet-stream', true)
      }
    }

    stream.on('data', onData).on('end', onEnd)
  })
}

async function getFileType(buffer: Buffer) {
  try {
    const fileType = await fileTypeFromBuffer(buffer)
    // leather detects more media types than file-type.
    return fileType?.mime || readMediaAttributes(buffer)?.mime || null
  } catch {}
  return null
}
