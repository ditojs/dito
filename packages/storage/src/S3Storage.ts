// aws-lite names its methods after the S3 API:
/* eslint-disable new-cap */
import { isIP } from 'node:net'
import {
  Storage,
  type AssetFile,
  type FileData,
  type StorageOptions
} from './Storage.ts'

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
  // The S3 params of stored objects, such as `{ ACL: 'public-read' }`.
  params?: Record<string, unknown>
}

type S3Method = (params: Record<string, any>) => Promise<any>

// The methods of aws-lite's S3 client that the storage calls.
export interface S3Client {
  PutObject: S3Method
  CreateMultipartUpload: S3Method
  UploadPart: S3Method
  CompleteMultipartUpload: S3Method
  AbortMultipartUpload: S3Method
  GetObject: S3Method
  DeleteObject: S3Method
  ListObjectsV2: S3Method
}

export class S3Storage extends Storage {
  bucket: string
  params: Record<string, unknown>
  #options: S3StorageOptions['s3']
  #client: Promise<S3Client> | null = null

  constructor({ bucket, s3, params = {}, ...rest }: S3StorageOptions) {
    super(rest)
    this.bucket = bucket
    this.params = params
    this.#options = s3
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
    const { default: awsLite } = await import('@aws-lite/client')
    const { default: s3Plugin } = await import('@aws-lite/s3')
    const client = await awsLite({
      endpoint: this.#getOrigin().href,
      region,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      plugins: [s3Plugin]
    })
    // The S3 plugin adds `S3`, which the client's types don't know.
    return (client as unknown as { S3: S3Client }).S3
  }

  #getOrigin() {
    const { endpoint, region } = this.#options
    return new URL(endpoint ?? `https://s3.${region}.amazonaws.com`)
  }

  override getFileUrl(file: AssetFile) {
    return this.getUrl(file.key)
  }

  // Puts files of one part in one request, and uploads larger ones in parts
  // with our own loop, as `S3.Upload()` of aws-lite can't take streams of
  // unknown length yet (aws-lite issue #222).
  async addFile(file: AssetFile, data: FileData) {
    const s3 = await this.getClient()
    const object = { Bucket: this.bucket, Key: file.key }
    const params = { ...object, ...this.params, ContentType: file.type }
    const parts = getParts(data)
    const { value: first = Buffer.alloc(0) } = await parts.next()
    const second = await parts.next()
    if (second.done) {
      await s3.PutObject({ ...params, Body: first })
    } else {
      const { UploadId } = await s3.CreateMultipartUpload(params)
      try {
        const Parts: { PartNumber: number; ETag: string }[] = []
        const uploadPart = async (Body: Buffer) => {
          const PartNumber = Parts.length + 1
          const { ETag } = await s3.UploadPart({
            ...object,
            UploadId,
            PartNumber,
            Body
          })
          Parts.push({ PartNumber, ETag })
        }
        await uploadPart(first)
        await uploadPart(second.value)
        for await (const part of parts) {
          await uploadPart(part)
        }
        await s3.CompleteMultipartUpload({
          ...object,
          UploadId,
          MultipartUpload: { Parts }
        })
      } catch (error) {
        // Throw the error of the upload, not the one of its abort:
        await s3.AbortMultipartUpload({ ...object, UploadId }).catch(() => {})
        throw error
      }
    }
  }

  async removeFile(file: AssetFile) {
    const s3 = await this.getClient()
    await s3.DeleteObject({ Bucket: this.bucket, Key: file.key })
  }

  async readFile(file: AssetFile): Promise<Buffer> {
    const s3 = await this.getClient()
    const { Body } = await s3.GetObject({
      Bucket: this.bucket,
      Key: file.key,
      // Never let aws-lite parse JSON or XML files:
      rawResponsePayload: true
    })
    return Body
  }

  async listKeys() {
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
}

const partSize = 8 * 1024 * 1024

// Splits the data into parts of `partSize`, and a last one with the rest. The
// parts are views of the chunks, and only those of several chunks are copies.
async function* getParts(data: FileData) {
  let chunks: Buffer[] = []
  let length = 0
  for await (const chunk of Buffer.isBuffer(data) ? [data] : data) {
    let rest = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    while (length + rest.byteLength >= partSize) {
      const end = partSize - length
      yield joinChunks([...chunks, rest.subarray(0, end)])
      rest = rest.subarray(end)
      chunks = []
      length = 0
    }
    if (rest.byteLength > 0) {
      chunks.push(rest)
      length += rest.byteLength
    }
  }
  if (length > 0) {
    yield joinChunks(chunks)
  }
}

function joinChunks(chunks: Buffer[]) {
  return chunks.length > 1 ? Buffer.concat(chunks) : chunks[0]
}
