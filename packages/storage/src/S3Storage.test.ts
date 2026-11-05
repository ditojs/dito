import awsLite from '@aws-lite/client'
import { S3Storage, type S3StorageOptions } from './S3Storage.ts'

const { testing } = awsLite

// S3 can't be reached in tests, so aws-lite's testing mode handles the requests
// of the real client with these mocks of a bucket:
const objects = new Map<string, any>()
let pages: Record<string, any> = {}

beforeEach(() => {
  objects.clear()
  pages = {}
  testing.enable()
  testing.mock('S3.PutObject', ({ Key, Body, ...params }: any) => {
    objects.set(Key, { ...getObjectParams(params), Body: Buffer.from(Body) })
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
  const { Bucket, ACL, ContentType, CacheControl } = params
  return Object.fromEntries(
    Object.entries({ Bucket, ACL, ContentType, CacheControl }).filter(
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
    s3: s3Config,
    params: { ACL: 'public-read' },
    bucket: 'library-covers',
    ...options
  })
}

describe('S3Storage', () => {
  describe('constructor', () => {
    it('creates the aws-lite S3 client on first use', async () => {
      const storage = createS3Storage()
      expect(storage.bucket).toBe('library-covers')
      const client = await storage.getClient()
      expect(client.PutObject).toBeTypeOf('function')
      expect(await storage.getClient()).toBe(client)
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

  describe('file operations', () => {
    it('puts stored files into the bucket with the params', async () => {
      const storage = createS3Storage({
        params: { ACL: 'public-read', CacheControl: 'max-age=60' }
      })
      const file = await storage.store({
        name: 'Front Cover.TXT',
        type: 'text/plain',
        data: Buffer.from('Front')
      })
      expect(file.key).toMatch(/^[0-9a-f-]{36}\.txt$/)
      expect(file.size).toBe(5)
      expect(objects.get(file.key)).toEqual({
        Bucket: 'library-covers',
        ACL: 'public-read',
        ContentType: 'text/plain',
        CacheControl: 'max-age=60',
        Body: Buffer.from('Front')
      })
      expect(file.url).toBe(
        `https://library-covers.sos-ch-dk-2.exo.io/${file.key}`
      )
    })

    it('reads files raw', async () => {
      const storage = createS3Storage()
      const file = await storage.store({
        name: 'cover.json',
        type: 'application/json',
        data: Buffer.from('{"a":1}')
      })
      const buffer = await storage.readFile(file)
      expect(getRequests('GetObject')[0].rawResponsePayload).toBe(true)
      expect(buffer.toString()).toBe('{"a":1}')
    })

    it('deletes removed files from the bucket', async () => {
      const storage = createS3Storage()
      const file = await storage.store({
        name: 'a.txt',
        data: Buffer.from('a')
      })
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
