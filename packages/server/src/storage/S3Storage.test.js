import { vi } from 'vitest'
import { PassThrough, Readable } from 'stream'
import consumers from 'stream/consumers'
import { S3Storage } from './S3Storage.js'
import { AssetFile } from './AssetFile.js'
import { Storage } from './index.js'

const s3Clients = []

vi.mock('@aws-sdk/client-s3', () => ({
  S3: class S3 {
    objects = new Map()
    pages = null

    constructor(config) {
      this.config = config
      s3Clients.push(this)
    }

    async putObject(params) {
      this.objects.set(params.Key, params)
      return { Location: `https://bucket.s3.example.com/${params.Key}` }
    }

    async deleteObject(params) {
      this.objects.delete(params.Key)
      return {}
    }

    async getObject({ Key }) {
      const { Body, ContentType } = this.objects.get(Key)
      return { ContentType, Body: Readable.from([Body]) }
    }

    async listObjectsV2(params) {
      const page = this.pages[params.ContinuationToken ?? 'first']
      return { ...page, params: { ...params } }
    }
  }
}))

beforeEach(() => {
  s3Clients.length = 0
})

async function createS3Storage(config = {}) {
  const storage = new S3Storage(
    { keys: ['secret'], basePath: '/app' },
    {
      name: 'covers',
      type: 's3',
      s3: { region: 'eu-central-1' },
      acl: 'public-read',
      bucket: 'library-covers',
      ...config
    }
  )
  await storage.setup()
  return storage
}

function callStorage(storage, method, file) {
  return new Promise((resolve, reject) => {
    storage.storage[method]({}, file, (err, ...args) =>
      err ? reject(err) : resolve(args)
    )
  })
}

function createPngHeader(width, height) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

describe('S3Storage', () => {
  it('is registered as the `s3` storage type', () => {
    expect(Storage.get('s3')).toBe(S3Storage)
  })

  describe('setup()', () => {
    it('creates the S3 client with the `s3` config', async () => {
      const storage = await createS3Storage()
      expect(s3Clients).toHaveLength(1)
      expect(storage.s3).toBe(s3Clients[0])
      expect(storage.s3.config).toEqual({ region: 'eu-central-1' })
      expect(storage.acl).toBe('public-read')
      expect(storage.bucket).toBe('library-covers')
    })

    it('configures multer-s3 with the client, bucket and acl', async () => {
      const storage = await createS3Storage()
      expect(storage.storage.s3).toBe(storage.s3)
      const [bucket] = await callStorage(storage, 'getBucket', {})
      expect(bucket).toBe('library-covers')
      const [acl] = await callStorage(storage, 'getAcl', {})
      expect(acl).toBe('public-read')
    })

    it('passes on additional options to multer-s3', async () => {
      const storage = await createS3Storage({ cacheControl: 'max-age=60' })
      const [cacheControl] = await callStorage(storage, 'getCacheControl', {})
      expect(cacheControl).toBe('max-age=60')
    })
  })

  describe('uploads', () => {
    it('creates unique keys with the file extension', async () => {
      const storage = await createS3Storage()
      const [key] = await callStorage(storage, 'getKey', {
        originalname: 'Front Cover.PNG'
      })
      expect(key).toMatch(/^[0-9a-f-]{36}\.png$/)
    })

    it('trusts the mime-type of the uploaded file', async () => {
      const storage = await createS3Storage()
      const [type, stream] = await callStorage(storage, 'getContentType', {
        mimetype: 'image/jpeg',
        stream: new PassThrough()
      })
      expect(type).toBe('image/jpeg')
      expect(stream).toBeUndefined()
    })

    it('detects the mime-type from the full data if needed', async () => {
      const storage = await createS3Storage()
      const header = createPngHeader(16, 16)
      const rest = Buffer.from('pixels')
      // The first chunk alone is too short to detect the type:
      const stream = Readable.from([
        header.subarray(0, 10),
        header.subarray(10),
        rest
      ])
      const [type, outStream] = await callStorage(storage, 'getContentType', {
        stream
      })
      expect(type).toBe('image/png')
      expect(await consumers.buffer(outStream)).toEqual(
        Buffer.concat([header, rest])
      )
    })

    it('falls back to application/octet-stream for unknown data', async () => {
      const storage = await createS3Storage()
      const stream = Readable.from([Buffer.from('plain'), Buffer.from(' text')])
      const [type, outStream] = await callStorage(storage, 'getContentType', {
        stream
      })
      expect(type).toBe('application/octet-stream')
      expect((await consumers.buffer(outStream)).toString()).toBe(
        'plain text'
      )
    })

    // Bug: when the type is detected from the first chunk, `done()` writes the
    // still `null` data to the pass-through stream, which throws.
    test.fails('detects the mime-type from the first chunk', async () => {
      const storage = await createS3Storage()
      const stream = new PassThrough()
      const promise = callStorage(storage, 'getContentType', { stream })
      // Emit the chunk directly, so a thrown error surfaces here and not as an
      // uncaught exception.
      expect(() => stream.emit('data', createPngHeader(16, 16))).not.toThrow()
      stream.emit('end')
      const [type] = await promise
      expect(type).toBe('image/png')
    })

    // Bug: `fileTypeFromBuffer()` of `file-type` returns a promise, so reading
    // `.mime` from it always yields `undefined`, and only the leather fallback
    // for media files is used.
    test.fails('detects non-media types with file-type', async () => {
      const storage = await createS3Storage()
      const stream = Readable.from([
        Buffer.from('%PDF-1.4\n%âã\n1 0 obj\n<<>>\nendobj\n')
      ])
      const [type] = await callStorage(storage, 'getContentType', { stream })
      expect(type).toBe('application/pdf')
    })

    it('stores the dimensions as metadata', async () => {
      const storage = await createS3Storage()
      const [metadata] = await callStorage(storage, 'getMetadata', {
        width: 320,
        height: 200
      })
      expect(metadata).toEqual({ width: '320', height: '200' })
    })

    it('stores no metadata without dimensions', async () => {
      const storage = await createS3Storage()
      const [metadata] = await callStorage(storage, 'getMetadata', {})
      expect(metadata).toEqual({})
    })
  })

  describe('file operations', () => {
    it('puts added files into the bucket', async () => {
      const storage = await createS3Storage()
      const file = AssetFile.create({ name: 'blurb.txt', data: 'Blurb' })
      await storage.addFile(file, file.data)
      expect(storage.s3.objects.get(file.key)).toEqual({
        Bucket: 'library-covers',
        ACL: 'public-read',
        Key: file.key,
        ContentType: 'text/plain',
        Body: file.data
      })
      // Without a configured url, the location returned by S3 is used:
      expect(file.url).toBe(`https://bucket.s3.example.com/${file.key}`)
      expect(file.size).toBe(5)
      expect(file.path).toBeUndefined()
    })

    it('prefers the configured url over the S3 location', async () => {
      const storage = await createS3Storage({
        url: 'https://covers.example.com/'
      })
      const file = AssetFile.create({ name: 'blurb.txt', data: 'Blurb' })
      await storage.addFile(file, file.data)
      expect(file.url).toBe(`https://covers.example.com/${file.key}`)
    })

    it('reads files with their content type', async () => {
      const storage = await createS3Storage()
      const file = AssetFile.create({ name: 'cover', data: 'image' })
      file.type = 'image/webp'
      await storage.addFile(file, file.data)
      const buffer = await storage.readFile(file)
      expect(buffer.toString()).toBe('image')
      expect(buffer.type).toBe('image/webp')
      // The type is picked up when creating new files from the data:
      expect(AssetFile.create({ name: 'copy', data: buffer }).type).toBe(
        'image/webp'
      )
    })

    it('deletes removed files from the bucket', async () => {
      const storage = await createS3Storage()
      const file = AssetFile.create({ name: 'a.txt', data: 'a' })
      await storage.addFile(file, file.data)
      const deleteObject = vi.spyOn(storage.s3, 'deleteObject')
      await storage.removeFile(file)
      expect(deleteObject).toHaveBeenCalledWith({
        Bucket: 'library-covers',
        Key: file.key
      })
      expect(storage.s3.objects.size).toBe(0)
    })

    it('lists keys across truncated result pages', async () => {
      const storage = await createS3Storage()
      const listObjectsV2 = vi.spyOn(storage.s3, 'listObjectsV2')
      storage.s3.pages = {
        first: {
          Contents: [{ Key: 'a.png' }, { Key: 'b.png' }],
          IsTruncated: true,
          NextContinuationToken: 'second'
        },
        second: {
          IsTruncated: true,
          NextContinuationToken: 'third'
        },
        third: {
          Contents: [{ Key: 'c.png' }],
          IsTruncated: false
        }
      }
      expect(await storage.listKeys()).toEqual(['a.png', 'b.png', 'c.png'])
      expect(listObjectsV2).toHaveBeenCalledTimes(3)
      const tokens = (
        await Promise.all(
          listObjectsV2.mock.results.map(result => result.value)
        )
      ).map(result => result.params.ContinuationToken)
      expect(tokens).toEqual([undefined, 'second', 'third'])
    })

    it('lists no keys for empty buckets', async () => {
      const storage = await createS3Storage()
      storage.s3.pages = { first: { IsTruncated: false } }
      expect(await storage.listKeys()).toEqual([])
    })
  })
})
