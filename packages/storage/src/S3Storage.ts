// aws-lite names its methods after the S3 API:
/* eslint-disable new-cap */
import { isIP } from 'node:net'
import {
  Storage,
  type AssetFile,
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

  async addFile(file: AssetFile, data: Buffer) {
    const s3 = await this.getClient()
    await s3.PutObject({
      Bucket: this.bucket,
      Key: file.key,
      ...this.params,
      ContentType: file.type,
      Body: data
    })
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
