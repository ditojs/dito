import path from 'node:path'
import { buffer } from 'node:stream/consumers'
import {
  Storage,
  getUniqueKey,
  type AssetFile,
  type FileData,
  type StorageOptions
} from './index.ts'

// A storage that keeps files in memory, to test the shared `Storage` logic.
class MemoryStorage extends Storage {
  dataByKey = new Map<string, Buffer>()

  override getFileUrl(file: AssetFile) {
    return this.getUrl(file.key)
  }

  async addFile(file: AssetFile, data: FileData) {
    this.dataByKey.set(
      file.key,
      Buffer.isBuffer(data) ? data : await buffer(data)
    )
  }

  async removeFile(file: AssetFile) {
    this.dataByKey.delete(file.key)
  }

  async readFile(file: AssetFile) {
    return this.dataByKey.get(file.key)!
  }

  async listKeys() {
    return [...this.dataByKey.keys()]
  }
}

function createStorage(options: Partial<StorageOptions> = {}) {
  return new MemoryStorage({ name: 'memory', ...options })
}

// Creates the start of a PNG file, enough to read its dimensions.
function createPngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  buffer[24] = 8
  buffer[25] = 6
  return buffer
}

const uuidPattern = (
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-' +
  '[0-9a-f]{12}'
)

describe('getUniqueKey()', () => {
  it('creates a uuid key with the lower-cased file extension', () => {
    expect(getUniqueKey('Cover.JPG')).toMatch(
      new RegExp(`^${uuidPattern}\\.jpg$`)
    )
  })

  it('creates a key without extension for names without one', () => {
    expect(getUniqueKey('README')).toMatch(new RegExp(`^${uuidPattern}$`))
  })

  it('creates keys without separators, also for names with backslashes', () => {
    expect(getUniqueKey('a.b\\c')).toMatch(new RegExp(`^${uuidPattern}$`))
  })

  it('creates different keys for the same name', () => {
    expect(getUniqueKey('a.txt')).not.toBe(getUniqueKey('a.txt'))
  })
})

describe('Storage: constructor', () => {
  it('takes its settings from the options', () => {
    const storage = createStorage({
      url: 'https://cdn.example.com/files/'
    })
    expect(storage.name).toBe('memory')
    expect(storage.url).toBe('https://cdn.example.com/files/')
  })
})

describe('Storage: urls', () => {
  it('returns no file urls without url', () => {
    expect(createStorage().getFileUrl({ key: 'a.txt' })).toBeUndefined()
  })

  it('joins file urls with the path of the base url', () => {
    const storage = createStorage({ url: 'https://cdn.example.com/f/' })
    expect(storage.getFileUrl({ key: 'a.txt' })).toBe(
      'https://cdn.example.com/f/a.txt'
    )
  })

  it('joins file urls with a base url without origin', () => {
    const storage = createStorage({ url: '/assets/public/' })
    expect(storage.getFileUrl({ key: 'a.txt' })).toBe('/assets/public/a.txt')
  })
})

describe('Storage: import sources', () => {
  it('matches urls against `allowedImports`', () => {
    const storage = createStorage({
      allowedImports: ['https://images.example.com/**', 'file://imports/*']
    })
    expect(
      storage.isImportSourceAllowed('https://images.example.com/a/b.png')
    ).toBe(true)
    expect(
      storage.isImportSourceAllowed(`file://${path.resolve('imports/a.png')}`)
    ).toBe(true)
    expect(
      storage.isImportSourceAllowed('https://evil.example.com/a.png')
    ).toBe(false)
    expect(storage.isImportSourceAllowed('file:///etc/passwd')).toBe(false)
    expect(storage.isImportSourceAllowed(undefined)).toBe(false)
  })

  it('matches the origin and path of urls only', () => {
    const storage = createStorage({
      allowedImports: ['https://*.example.com/**', 'file:///seed/files/**']
    })
    const isAllowed = (url: string) => storage.isImportSourceAllowed(url)
    expect(isAllowed('https://cdn.example.com/a.png?size=2#top')).toBe(true)
    expect(isAllowed('https://evil.org#.example.com/a.png')).toBe(false)
    expect(isAllowed('https://evil.org?.example.com/a.png')).toBe(false)
    expect(isAllowed('https://cdn.example.com@evil.org/a.png')).toBe(false)
    expect(isAllowed('https://user:secret@cdn.example.com/a.png')).toBe(false)
    expect(isAllowed('not a url')).toBe(false)
    expect(isAllowed('file:///seed/files/a.png')).toBe(true)
    expect(isAllowed('file:///seed/files/../secret')).toBe(false)
    expect(isAllowed('file:///seed/files/%2e%2e/%2e%2e/etc/passwd')).toBe(false)
    expect(isAllowed('file:///seed/files/..%2f..%2fetc/passwd')).toBe(false)
  })

  it('rejects everything without `allowedImports`', () => {
    const storage = createStorage()
    expect(storage.isImportSourceAllowed('https://example.com/a.png')).toBe(
      false
    )
  })
})

describe('Storage: store()', () => {
  it('stores data under a unique key and returns its file object', async () => {
    const storage = createStorage({ url: 'https://cdn.example.com/' })
    const file = await storage.store({
      name: 'Notes.TXT',
      type: 'text/plain',
      data: Buffer.from('Chapter one')
    })
    expect(file).toEqual({
      key: expect.stringMatching(/^[0-9a-f-]{36}\.txt$/),
      name: 'Notes.TXT',
      type: 'text/plain',
      size: 11,
      url: `https://cdn.example.com/${file.key}`
    })
    expect(storage.dataByKey.get(file.key)!.toString()).toBe('Chapter one')
    expect(await storage.listKeys()).toEqual([file.key])
  })

  it('stores files without url when the storage has none', async () => {
    const file = await createStorage().store({
      name: 'a.txt',
      data: Buffer.from('a')
    })
    expect('url' in file).toBe(false)
  })

  it('detects the type without one', async () => {
    const storage = createStorage()
    const store = async (data: Buffer, type?: string) =>
      (await storage.store({ name: 'upload', type, data })).type
    expect(await store(createPngHeader(16, 16))).toBe('image/png')
    expect(
      await store(createPngHeader(16, 16), 'application/octet-stream')
    ).toBe('image/png')
    expect(
      await store(Buffer.from('%PDF-1.4\n%âã\n1 0 obj\n<<>>\nendobj\n'))
    ).toBe('application/pdf')
    expect(await store(Buffer.from('plain text'))).toBe(
      'application/octet-stream'
    )
    expect(await store(Buffer.alloc(0))).toBe('application/octet-stream')
  })

  it('reads the dimensions of images', async () => {
    const storage = createStorage()
    const data = Buffer.concat([
      createPngHeader(320, 200),
      Buffer.from('rest of the image')
    ])
    const file = await storage.store({ name: 'cover.png', data })
    expect(file.width).toBe(320)
    expect(file.height).toBe(200)
    expect(storage.dataByKey.get(file.key)).toEqual(data)
  })

  it('reads the type and the dimensions of streamed data', async () => {
    const storage = createStorage()
    const data = Buffer.concat([
      createPngHeader(320, 200),
      Buffer.from('rest of the image')
    ])
    async function* createData() {
      for (let i = 0; i < data.length; i += 4) yield data.subarray(i, i + 4)
    }
    const file = await storage.store({ name: 'cover', data: createData() })
    expect(file).toMatchObject({
      type: 'image/png',
      size: data.length,
      width: 320,
      height: 200
    })
    expect(storage.dataByKey.get(file.key)).toEqual(data)
  })

  it('stores media files without readable dimensions', async () => {
    const storage = createStorage()
    for (const data of [Buffer.from('not a video'), Buffer.alloc(0)]) {
      const file = await storage.store({
        name: 'clip.mp4',
        type: 'video/mp4',
        data
      })
      expect(file.size).toBe(data.length)
      expect('width' in file).toBe(false)
    }
  })

  it('reads no dimensions of other types', async () => {
    const file = await createStorage().store({
      name: 'a.pdf',
      type: 'application/pdf',
      data: createPngHeader(10, 10)
    })
    expect(file.width).toBeUndefined()
  })
})
