import { PassThrough, Readable } from 'node:stream'
import awsLite from '@aws-lite/client'
import {
  AssetFile,
  S3Storage,
  type S3StorageOptions,
  type UploadOptions
} from '../src/index.ts'

const { testing } = awsLite
const MB = 1024 * 1024

// S3 can't be reached in tests, so aws-lite's testing mode answers the
// requests of the real client with these mocks of a bucket instead:
const objects = new Map<string, any>()
const uploads = new Map<string, { params: any; parts: Buffer[] }>()
let pages: Record<string, any> = {}

beforeEach(() => {
  objects.clear()
  uploads.clear()
  pages = {}
  testing.enable()
  testing.mock('S3.PutObject', ({ Key, Body, ...params }: any) => {
    objects.set(Key, { ...getObjectParams(params), Body: Buffer.from(Body) })
    return {}
  })
  testing.mock('S3.CreateMultipartUpload', (params: any) => {
    const UploadId = `upload-${uploads.size + 1}`
    uploads.set(UploadId, { params, parts: [] })
    return { UploadId }
  })
  testing.mock('S3.UploadPart', ({ UploadId, PartNumber, Body }: any) => {
    uploads.get(UploadId)!.parts.push(Body)
    return { ETag: `"etag-${PartNumber}"` }
  })
  testing.mock('S3.CompleteMultipartUpload', ({ UploadId }: any) => {
    const {
      params: { Key, ...params },
      parts
    } = uploads.get(UploadId)!
    objects.set(Key, { ...getObjectParams(params), Body: Buffer.concat(parts) })
    uploads.delete(UploadId)
    return {}
  })
  testing.mock('S3.AbortMultipartUpload', ({ UploadId }: any) => {
    uploads.delete(UploadId)
    return {}
  })
  testing.mock('S3.GetObject', ({ Key }: any) => {
    const { Body, ContentType } = objects.get(Key)
    return { Body, ContentType }
  })
  testing.mock('S3.DeleteObject', ({ Key }: any) => {
    objects.delete(Key)
    return {}
  })
  testing.mock('S3.ListObjectsV2', ({ ContinuationToken }: any) => {
    return pages[ContinuationToken ?? 'first']
  })
})

afterAll(() => {
  testing.disable()
})

// Leave out the params that aws-lite adds to requests:
function getObjectParams(params: any) {
  const { Bucket, ACL, ContentType, Metadata, CacheControl } = params
  return Object.fromEntries(
    Object.entries({ Bucket, ACL, ContentType, Metadata, CacheControl }).filter(
      ([, value]) => value !== undefined
    )
  )
}

function getRequests(method: string): any[] {
  return testing.getAllRequests(`S3.${method}`).map(({ request }) => request)
}

const s3Config = {
  endpoint: 'https://sos-ch-dk-2.exo.io',
  region: 'ch-dk-2',
  credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
}

function createS3Storage(options: Partial<S3StorageOptions> = {}) {
  return new S3Storage({
    name: 'covers',
    secret: 'secret',
    s3: s3Config,
    acl: 'public-read',
    bucket: 'library-covers',
    ...options
  })
}

function uploadFile(
  storage: S3Storage,
  { name, type, chunks }: { name: string; type?: string; chunks: Buffer[] },
  options?: UploadOptions
) {
  return storage.upload({ name, type, stream: Readable.from(chunks) }, options)
}

function createChunks(size: number, chunkSize = 64 * 1024) {
  const chunks: Buffer[] = []
  for (let offset = 0; offset < size; offset += chunkSize) {
    chunks.push(Buffer.alloc(Math.min(chunkSize, size - offset), offset % 251))
  }
  return chunks
}

function createPngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

describe('S3Storage', () => {
  describe('constructor', () => {
    it('creates the aws-lite S3 client on first use', async () => {
      const storage = createS3Storage()
      expect(storage.bucket).toBe('library-covers')
      expect(storage.uploadParams).toEqual({ ACL: 'public-read' })
      const client = await storage.getClient()
      expect(client.PutObject).toBeTypeOf('function')
      expect(await storage.getClient()).toBe(client)
    })

    it('throws without bucket', () => {
      expect(() => createS3Storage({ bucket: undefined })).toThrow(
        `Missing option 'bucket' for storage 'covers'`
      )
    })

    it('throws without credentials', () => {
      expect(() =>
        createS3Storage({ s3: { region: 'eu-central-1' } as any })
      ).toThrow(`Missing option 's3.credentials' for storage 'covers'`)
    })

    it('throws without region', () => {
      expect(() =>
        createS3Storage({ s3: { credentials: s3Config.credentials } as any })
      ).toThrow(`Missing option 's3.region' for storage 'covers'`)
    })

    it('throws on upload options that are not strings', () => {
      expect(() =>
        createS3Storage({ cacheControl: (() => '') as any })
      ).toThrow(
        `Invalid option 'cacheControl' for storage 'covers': ` +
        'Only strings are supported.'
      )
    })
  })

  describe('urls', () => {
    it('prefers the configured url', async () => {
      const storage = createS3Storage({
        url: 'https://covers.example.com/'
      })
      expect(storage.getFileUrl({ key: 'a.png' })).toBe(
        'https://covers.example.com/a.png'
      )
    })

    it('uses the virtual-hosted url of the bucket', async () => {
      const storage = createS3Storage()
      expect(storage.getFileUrl({ key: 'a.png' })).toBe(
        'https://library-covers.sos-ch-dk-2.exo.io/a.png'
      )
    })

    it('uses the AWS endpoint of the region without `s3.endpoint`', async () => {
      const storage = createS3Storage({
        s3: { ...s3Config, endpoint: undefined, region: 'eu-central-1' }
      })
      expect(storage.getFileUrl({ key: 'a.png' })).toBe(
        'https://library-covers.s3.eu-central-1.amazonaws.com/a.png'
      )
    })

    it('uses path-style urls for local hosts and dotted buckets', async () => {
      const local = createS3Storage({
        s3: { ...s3Config, endpoint: 'http://localhost:4566' }
      })
      expect(local.getFileUrl({ key: 'a.png' })).toBe(
        'http://localhost:4566/library-covers/a.png'
      )
      const dotted = createS3Storage({ bucket: 'covers.example.com' })
      expect(dotted.getFileUrl({ key: 'a.png' })).toBe(
        'https://sos-ch-dk-2.exo.io/covers.example.com/a.png'
      )
    })
  })

  describe('uploads', () => {
    it('stores uploads under unique keys with the file extension', async () => {
      const storage = createS3Storage()
      const result = await uploadFile(storage, {
        name: 'Front Cover.TXT',
        type: 'text/plain',
        chunks: [Buffer.from('Front')]
      })
      expect(result.key).toMatch(/^[0-9a-f-]{36}\.txt$/)
      expect(result.size).toBe(5)
      expect(objects.get(result.key)).toEqual({
        Bucket: 'library-covers',
        ACL: 'public-read',
        ContentType: 'text/plain',
        Body: Buffer.from('Front')
      })
      expect(storage.verifyAssetFile(result)).toBe(true)
      expect(result.url).toBe(
        `https://library-covers.sos-ch-dk-2.exo.io/${result.key}`
      )
    })

    it('uploads streams in parts of 8 MB', async () => {
      const storage = createS3Storage()
      const chunks = createChunks(20 * MB)
      const { key, size } = await uploadFile(storage, {
        name: 'sample.bin',
        type: 'application/octet-stream',
        chunks
      })
      expect(size).toBe(20 * MB)
      expect(getRequests('UploadPart').map(({ Body }) => Body.length)).toEqual(
        [8 * MB, 8 * MB, 4 * MB]
      )
      expect(getRequests('CompleteMultipartUpload')[0].MultipartUpload).toEqual(
        {
          Parts: [
            { PartNumber: 1, ETag: '"etag-1"' },
            { PartNumber: 2, ETag: '"etag-2"' },
            { PartNumber: 3, ETag: '"etag-3"' }
          ]
        }
      )
      // Compare large buffers with `equals()`, as `toEqual()` is too slow:
      expect(objects.get(key).Body.equals(Buffer.concat(chunks))).toBe(true)
      expect(uploads.size).toBe(0)
    })

    it('uploads streams of exactly one part in one part', async () => {
      const storage = createS3Storage()
      const { size } = await uploadFile(storage, {
        name: 'sample.bin',
        type: 'application/octet-stream',
        chunks: createChunks(8 * MB)
      })
      expect(size).toBe(8 * MB)
      expect(getRequests('UploadPart')).toHaveLength(1)
    })

    it('uploads empty streams as one empty part', async () => {
      const storage = createS3Storage()
      const { key, size } = await uploadFile(storage, {
        name: 'empty.txt',
        type: 'text/plain',
        chunks: []
      })
      expect(size).toBe(0)
      expect(getRequests('UploadPart').map(({ Body }) => Body)).toEqual([
        Buffer.alloc(0)
      ])
      expect(objects.get(key).Body).toEqual(Buffer.alloc(0))
    })

    it('aborts failed multipart uploads', async () => {
      const storage = createS3Storage()
      testing.mock('S3.UploadPart', () => {
        throw new Error('Connection lost')
      })
      await expect(
        uploadFile(storage, {
          name: 'sample.bin',
          type: 'application/octet-stream',
          chunks: [Buffer.from('data')]
        })
      ).rejects.toThrow('Connection lost')
      expect(getRequests('AbortMultipartUpload')).toHaveLength(1)
      expect(uploads.size).toBe(0)
      expect(objects.size).toBe(0)
    })

    it('removes uploaded files', async () => {
      const storage = createS3Storage()
      const file = await uploadFile(storage, {
        name: 'a.txt',
        type: 'text/plain',
        chunks: [Buffer.from('a')]
      })
      await storage.removeFile(file)
      expect(objects.size).toBe(0)
    })

    it('applies the upload options to all uploaded objects', async () => {
      const storage = createS3Storage({ cacheControl: 'max-age=60' })
      const { key } = await uploadFile(storage, {
        name: 'a.txt',
        type: 'text/plain',
        chunks: [Buffer.from('a')]
      })
      expect(objects.get(key).CacheControl).toBe('max-age=60')
      expect(getRequests('CreateMultipartUpload')[0]).toMatchObject({
        ACL: 'public-read',
        CacheControl: 'max-age=60'
      })
    })

    it('detects the mime-type from the full data if needed', async () => {
      const storage = createS3Storage()
      const header = createPngHeader(16, 16)
      const rest = Buffer.from('pixels')
      // The first chunk alone is too short to detect the type:
      const { key } = await uploadFile(storage, {
        name: 'cover',
        chunks: [header.subarray(0, 10), header.subarray(10), rest]
      })
      expect(objects.get(key)).toMatchObject({
        ContentType: 'image/png',
        Body: Buffer.concat([header, rest])
      })
    })

    it('detects the mime-type from the first chunk', async () => {
      const storage = createS3Storage()
      const stream = new PassThrough()
      const promise = storage.upload({ name: 'cover', stream })
      // Emit the chunk directly, so a thrown error surfaces here and not as an
      // uncaught exception.
      const header = createPngHeader(16, 16)
      expect(() => stream.emit('data', header)).not.toThrow()
      stream.end()
      const { key } = await promise
      // The first chunk still reaches the uploaded object:
      expect(objects.get(key)).toMatchObject({
        ContentType: 'image/png',
        Body: header
      })
    })

    it('detects non-media types with file-type', async () => {
      const storage = createS3Storage()
      const { key } = await uploadFile(storage, {
        name: 'document',
        chunks: [Buffer.from('%PDF-1.4\n%âã\n1 0 obj\n<<>>\nendobj\n')]
      })
      expect(objects.get(key).ContentType).toBe('application/pdf')
    })

    it('falls back to application/octet-stream for unknown data', async () => {
      const storage = createS3Storage()
      const { key } = await uploadFile(storage, {
        name: 'notes',
        chunks: [Buffer.from('plain'), Buffer.from(' text')]
      })
      expect(objects.get(key)).toMatchObject({
        ContentType: 'application/octet-stream',
        Body: Buffer.from('plain text')
      })
    })

    it('falls back for unknown data in a single chunk', async () => {
      const storage = createS3Storage()
      // The stream ends while the first chunk is still examined:
      const { key } = await uploadFile(storage, {
        name: 'notes',
        chunks: [Buffer.from('plain text')]
      })
      expect(objects.get(key)).toMatchObject({
        ContentType: 'application/octet-stream',
        Body: Buffer.from('plain text')
      })
    })

    it('falls back for empty uploads', async () => {
      const storage = createS3Storage()
      const { key } = await uploadFile(storage, {
        name: 'empty',
        chunks: []
      })
      expect(objects.get(key)).toMatchObject({
        ContentType: 'application/octet-stream',
        Body: Buffer.alloc(0)
      })
    })

    it('stores the dimensions as metadata', async () => {
      const storage = createS3Storage()
      const header = createPngHeader(320, 200)
      const result = await uploadFile(
        storage,
        { name: 'cover.png', type: 'image/png', chunks: [header] },
        { readDimensions: true }
      )
      expect(result).toMatchObject({ width: 320, height: 200 })
      expect(objects.get(result.key).Metadata).toEqual({
        width: '320',
        height: '200'
      })
    })

    it('stores no metadata without dimensions', async () => {
      const storage = createS3Storage()
      const { key } = await uploadFile(storage, {
        name: 'cover.png',
        type: 'image/png',
        chunks: [createPngHeader(16, 16)]
      })
      expect(objects.get(key).Metadata).toBeUndefined()
    })
  })

  describe('file operations', () => {
    it('puts added files into the bucket', async () => {
      const storage = createS3Storage({ cacheControl: 'max-age=60' })
      const file = AssetFile.create({ name: 'blurb.txt', data: 'Blurb' })
      await storage.addFile(file, file.data!)
      expect(objects.get(file.key)).toEqual({
        Bucket: 'library-covers',
        ACL: 'public-read',
        ContentType: 'text/plain',
        CacheControl: 'max-age=60',
        Body: Buffer.from('Blurb')
      })
      expect(getRequests('CreateMultipartUpload')).toHaveLength(0)
      expect(file.url).toBe(
        `https://library-covers.sos-ch-dk-2.exo.io/${file.key}`
      )
      expect(file.size).toBe(5)
      expect(file.path).toBeUndefined()
    })

    it('puts added files larger than a part in one request', async () => {
      const storage = createS3Storage()
      const data = Buffer.concat(createChunks(9 * MB))
      const file = AssetFile.create({ name: 'sample.bin', data })
      await storage.addFile(file, file.data!)
      expect(objects.get(file.key).Body.equals(data)).toBe(true)
      expect(getRequests('PutObject')).toHaveLength(1)
      expect(file.size).toBe(9 * MB)
    })

    it('reads files raw with their content type', async () => {
      const storage = createS3Storage()
      const file = AssetFile.create({ name: 'cover.json', data: '{"a":1}' })
      file.type = 'application/json'
      await storage.addFile(file, file.data!)
      const buffer = await storage.readFile(file)
      expect(getRequests('GetObject')[0].rawResponsePayload).toBe(true)
      expect(buffer.toString()).toBe('{"a":1}')
      expect(buffer.type).toBe('application/json')
      // The type is picked up when creating new files from the data:
      expect(AssetFile.create({ name: 'copy', data: buffer }).type).toBe(
        'application/json'
      )
    })

    it('deletes removed files from the bucket', async () => {
      const storage = createS3Storage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data!)
      await storage.removeFile(file)
      expect(getRequests('DeleteObject')).toMatchObject([
        { Bucket: 'library-covers', Key: file.key }
      ])
      expect(objects.size).toBe(0)
    })

    it('lists keys across truncated result pages', async () => {
      const storage = createS3Storage()
      pages = {
        first: {
          Contents: [{ Key: 'a.png' }, { Key: 'b.png' }],
          IsTruncated: true,
          NextContinuationToken: 'second'
        },
        second: {
          Contents: [],
          IsTruncated: true,
          NextContinuationToken: 'third'
        },
        third: {
          Contents: [{ Key: 'c.png' }],
          IsTruncated: false
        }
      }
      expect(await storage.listKeys()).toEqual(['a.png', 'b.png', 'c.png'])
      expect(
        getRequests('ListObjectsV2').map(
          ({ ContinuationToken }) => ContinuationToken
        )
      ).toEqual([undefined, 'second', 'third'])
    })

    it('lists no keys for empty buckets', async () => {
      const storage = createS3Storage()
      pages = { first: { Contents: [], IsTruncated: false } }
      expect(await storage.listKeys()).toEqual([])
    })
  })
})
