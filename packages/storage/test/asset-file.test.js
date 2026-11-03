import { AssetFile } from './AssetFile.js'

const uuidPattern = (
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-' +
  '[0-9a-f]{12}'
)

describe('AssetFile', () => {
  describe('getUniqueKey()', () => {
    it('creates a uuid key with the lower-cased file extension', () => {
      expect(AssetFile.getUniqueKey('Cover.JPG')).toMatch(
        new RegExp(`^${uuidPattern}\\.jpg$`)
      )
    })

    it('creates a key without extension for names without one', () => {
      expect(AssetFile.getUniqueKey('README')).toMatch(
        new RegExp(`^${uuidPattern}$`)
      )
    })

    it('creates different keys for the same name', () => {
      expect(AssetFile.getUniqueKey('a.txt')).not.toBe(
        AssetFile.getUniqueKey('a.txt')
      )
    })
  })

  describe('create()', () => {
    it('creates files from text data', () => {
      const file = AssetFile.create({ name: 'notes.md', data: '# Chapter 1' })
      expect(file).toBeInstanceOf(AssetFile)
      expect(file.key).toMatch(/\.md$/)
      expect(file.name).toBe('notes.md')
      expect(file.type).toBe('text/markdown')
      expect(file.size).toBe(11)
      expect(file.data).toEqual(Buffer.from('# Chapter 1'))
    })

    it('falls back to text/plain for text data with unknown names', () => {
      const file = AssetFile.create({ name: 'notes.unknown', data: 'Hi' })
      expect(file.type).toBe('text/plain')
    })

    it('counts the size of text data in bytes', () => {
      const file = AssetFile.create({ name: 'quote.txt', data: 'Café' })
      expect(file.size).toBe(5)
    })

    it('decodes data URIs and takes their type', () => {
      const file = AssetFile.create({
        name: 'pixel',
        data: `data:image/gif;base64,${
          Buffer.from('GIF89a').toString(
            'base64'
          )
        }`
      })
      expect(file.type).toBe('image/gif')
      expect(file.data.toString()).toBe('GIF89a')
      expect(file.size).toBe(6)
    })

    it('takes the type from buffers read from storages', () => {
      const data = Buffer.from('<svg/>')
      data.type = 'image/svg+xml'
      const file = AssetFile.create({ name: 'logo', data })
      expect(file.type).toBe('image/svg+xml')
      expect(file.data).toBe(data)
    })

    it('looks up the type of buffers by name', () => {
      const file = AssetFile.create({
        name: 'cover.png',
        data: Buffer.from([0x89])
      })
      expect(file.type).toBe('image/png')
    })

    it('falls back to application/octet-stream for unknown buffers', () => {
      const file = AssetFile.create({ name: 'blob', data: Buffer.from([1]) })
      expect(file.type).toBe('application/octet-stream')
    })

    it('converts other binary data to buffers', () => {
      const file = AssetFile.create({
        name: 'bytes.bin',
        data: new Uint8Array([1, 2, 3])
      })
      expect(Buffer.isBuffer(file.data)).toBe(true)
      expect([...file.data]).toEqual([1, 2, 3])
      expect(file.size).toBe(3)
    })

    it('prefers an explicitly passed type', () => {
      const file = AssetFile.create({
        name: 'index.html',
        type: 'text/plain',
        data: '<p>Hi</p>'
      })
      expect(file.type).toBe('text/plain')
    })

    it('stores the passed dimensions', () => {
      const file = AssetFile.create({
        name: 'cover.png',
        data: Buffer.from([]),
        width: 320,
        height: 200
      })
      expect(file.width).toBe(320)
      expect(file.height).toBe(200)
    })
  })

  it('does not include the data when serialized', () => {
    const file = AssetFile.create({ name: 'a.txt', data: 'secret' })
    expect(Object.keys(file)).not.toContain('data')
    expect(JSON.parse(JSON.stringify(file))).toEqual({
      key: file.key,
      name: 'a.txt',
      type: 'text/plain',
      size: 6
    })
  })

  it('updates size but keeps the type when replacing data', () => {
    const file = AssetFile.create({ name: 'a.txt', data: 'one' })
    file.data = 'three'
    expect(file.size).toBe(5)
    expect(file.type).toBe('text/plain')
  })

  describe('without a storage', () => {
    it('has no storage, path and data to read', async () => {
      const file = AssetFile.create({ name: 'a.txt', data: 'text' })
      expect(file.storage).toBe(null)
      expect(file.path).toBeUndefined()
      expect(await file.read()).toBe(null)
    })
  })

  describe('convert()', () => {
    it('turns plain objects into files bound to the storage', async () => {
      const storage = {
        getFilePath: file => `/library/${file.key}`,
        readFile: async () => Buffer.from('content')
      }
      const object = { key: 'abc.txt', name: 'a.txt', type: 'text/plain' }
      AssetFile.convert(object, storage)
      expect(object).toBeInstanceOf(AssetFile)
      expect(object.storage).toBe(storage)
      expect(object.path).toBe('/library/abc.txt')
      expect(await object.read()).toEqual(Buffer.from('content'))
      expect(object.data).toBe(null)
      expect(Object.keys(object)).toEqual(['key', 'name', 'type'])
    })
  })
})
