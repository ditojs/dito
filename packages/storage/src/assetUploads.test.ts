import fs from 'node:fs/promises'
import { createApi, defineController } from '@ditojs/server'
import {
  DiskStorage,
  StorageRegistry,
  createAssets,
  type AssetFile,
  type AssetPath,
  type FileData
} from './index.ts'
import { defineAssetUploads } from './assetUploads.ts'
import {
  setupAssetTests,
  db,
  covers,
  archive,
  storages,
  type Api,
  request,
  paths,
  bookPath,
  getAssets,
  adapter,
  handleAdapter
} from './test/assets.ts'

setupAssetTests()

describe('defineUploads()', () => {
  const uploadPaths: AssetPath[] = [
    ...paths,
    { ...bookPath, column: 'back_cover', path: '', storage: 'archive' },
    {
      entity: class Shelf {},
      table: 'shelf',
      column: 'label',
      path: '',
      storage: 'archive'
    }
  ]
  const bookAssets = () =>
    createAssets({ adapter, paths: uploadPaths, storages })

  function setup({ fail = false } = {}) {
    const books = defineController({
      path: 'books',
      authorize: true,
      mixins: [bookAssets().defineUploads('book')],
      ...(fail && {
        middleware: async (_c, next) => {
          await next()
          throw new Error('Failed request')
        }
      })
    })
    return createApi({
      controllers: [books],
      adapter: handleAdapter,
      getUser: async () => null,
      onError: () => {}
    })
  }

  // Sends the files like the admin's upload component.
  function upload(api: Api, route: string, ...files: File[]) {
    const body = new FormData()
    for (const file of files) body.append('file', file)
    return request(api, `/books/upload/${route}`, { method: 'POST', body })
  }

  it('stores the files and answers with their file objects', async () => {
    const response = await upload(
      setup(),
      'cover',
      new File(['Front'], 'Front Cover.TXT', { type: 'text/plain' }),
      new File(['b'], 'b.txt')
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/)
    const files: AssetFile[] = await response.json()
    expect(files).toEqual([
      {
        key: expect.stringMatching(/^[0-9a-f-]{36}\.txt$/),
        name: 'Front Cover.TXT',
        type: 'text/plain',
        size: 5,
        url: `https://example.com/${files[0].key}`
      },
      expect.objectContaining({ name: 'b.txt' })
    ])
    expect(await covers.readFile(files[0])).toEqual(Buffer.from('Front'))
    expect(await getAssets()).toEqual(
      files
        .map(({ key }) => ({ key, unreferenced_since: expect.any(Date) }))
        .sort((a, b) => a.key.localeCompare(b.key))
    )
  })

  it('detects the type without one from the client', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )
    const response = await upload(
      setup(),
      'cover',
      new File([png], 'cover.png', { type: '' })
    )
    const [uploaded] = await response.json()
    expect(uploaded).toMatchObject({ type: 'image/png', width: 1, height: 1 })
  })

  it('picks the storage of the first path that matches', async () => {
    const api = setup()
    for (const [route, storage] of [
      ['cover', covers],
      ['pages/3/images', covers],
      ['notes/a/b/file', covers],
      ['back-cover', archive],
      ['backCover', archive]
    ] as const) {
      const response = await upload(api, route, new File(['a'], 'a.txt'))
      expect(response.status).toBe(200)
      const [uploaded] = await response.json()
      expect(await storage.listKeys()).toContain(uploaded.key)
    }
    for (const route of ['label', 'pages/images', 'cover/a']) {
      const response = await upload(api, route, new File(['a'], 'a.txt'))
      expect(response.status).toBe(404)
    }
  })

  it('answers with an empty array without files', async () => {
    const body = new FormData()
    body.append('cover', 'text')
    const response = await request(setup(), '/books/upload/cover', {
      method: 'POST',
      body
    })
    expect(await response.json()).toEqual([])
  })

  it('answers bodies that are not multipart with 415', async () => {
    const response = await request(setup(), '/books/upload/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    expect(response.status).toBe(415)
  })

  describe('maxSize', () => {
    // A cover limit of 300 bytes leaves room for the multipart framing around
    // a small file, the default of 1000 bytes for a larger one.
    function setupLimits({
      coverSize = 300,
      defaultSize = 1000
    }: {
      coverSize?: number | string
      defaultSize?: number | string
    } = {}) {
      const limits = createAssets({
        adapter,
        paths: uploadPaths.map(path =>
          path.column === 'cover' ? { ...path, maxSize: coverSize } : path
        ),
        storages,
        maxSize: defaultSize
      })
      const uploads = [{ path: 'drafts/*', storage: 'archive' }]
      return createApi({
        controllers: [
          {
            path: 'books',
            authorize: true,
            mixins: [limits.defineUploads('book', { uploads })]
          }
        ],
        adapter: handleAdapter,
        onError: () => {}
      })
    }

    const small = () => new File(['a'], 'a.txt')
    const large = () => new File(['a'.repeat(500)], 'a.txt')

    it('answers uploads over the limit with 413 and stores nothing', async () => {
      const api = setupLimits()
      const response = await upload(api, 'cover', large())
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({
        status: 413,
        message: 'Content Too Large'
      })
      expect(await getAssets()).toEqual([])
      // Uploads under the limit go through, and are the only stored files:
      const [uploaded] = await (await upload(api, 'cover', small())).json()
      expect(await covers.listKeys()).toEqual([uploaded.key])
      expect(await getAssets()).toEqual([
        { key: uploaded.key, unreferenced_since: expect.any(Date) }
      ])
    })

    it('removes the files and rows of the other files', async () => {
      const response = await upload(setupLimits(), 'cover', small(), large())
      expect(response.status).toBe(413)
      expect(await covers.listKeys()).toEqual([])
      expect(await getAssets()).toEqual([])
    })

    it('limits each file, not the whole body', async () => {
      const files = [new File(['a'.repeat(200)], 'a.txt'), small()]
      const response = await upload(setupLimits(), 'cover', ...files)
      expect(response.status).toBe(200)
      expect(await covers.listKeys()).toHaveLength(2)
    })

    it('applies the default of `createAssets()`', async () => {
      const api = setupLimits()
      for (const route of ['back-cover', 'drafts/1']) {
        expect((await upload(api, route, large())).status).toBe(200)
        const huge = new File(['a'.repeat(1000)], 'a.txt')
        expect((await upload(api, route, huge)).status).toBe(413)
      }
      expect(await archive.listKeys()).toHaveLength(2)
    })

    it('takes sizes with units', async () => {
      const api = setupLimits({ coverSize: '300b', defaultSize: '1kb' })
      expect((await upload(api, 'cover', large())).status).toBe(413)
      expect((await upload(api, 'cover', small())).status).toBe(200)
      expect((await upload(api, 'back-cover', large())).status).toBe(200)
      const huge = new File(['a'.repeat(1000)], 'a.txt')
      expect((await upload(api, 'back-cover', huge)).status).toBe(413)
    })

    it('throws for invalid sizes', () => {
      expect(() => setupLimits({ coverSize: '300 bananas' })).toThrow(
        `Invalid file size unit: 'bananas'`
      )
      expect(() => setupLimits({ defaultSize: 'large' })).toThrow(
        `Invalid file size: 'large'`
      )
    })
  })

  it('streams large files into the storage as they arrive', async () => {
    const megabyte = 1024 * 1024
    let writtenBeforeEnd = 0
    // A multipart body of a 20 MB file, which checks how much of it is on disk
    // before its last megabyte arrives:
    async function* createBody() {
      yield Buffer.from(
        '--boundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename="a.bin"\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n'
      )
      for (let i = 0; i < 20; i++) {
        if (i === 19) {
          const [key] = await covers.listKeys()
          writtenBeforeEnd = key
            ? (await fs.stat(covers.getFilePath({ key }))).size
            : 0
        }
        yield Buffer.alloc(megabyte, i)
      }
      yield Buffer.from('\r\n--boundary--\r\n')
    }
    const chunks = createBody()
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await chunks.next()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      }
    })
    // Requests with streamed bodies need `duplex`, which the DOM types lack:
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
      body,
      duplex: 'half'
    }
    const response = await request(setup(), '/books/upload/cover', init)
    expect(response.status).toBe(200)
    const [uploaded] = await response.json()
    expect(uploaded.size).toBe(20 * megabyte)
    expect(writtenBeforeEnd).toBeGreaterThan(8 * megabyte)
    const data = await covers.readFile(uploaded)
    expect(data[19 * megabyte]).toBe(19)
  })

  it('ends uploads that the client aborts, and removes their files', async () => {
    async function* createBody() {
      const part = (name: string) => (
        '--boundary\r\n' +
        `Content-Disposition: form-data; name="file"; filename="${name}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n'
      )
      yield Buffer.from(`${part('a.bin')}a\r\n${part('b.bin')}`)
      yield Buffer.alloc(1024 * 1024)
      throw new Error('Connection lost')
    }
    const chunks = createBody()
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await chunks.next()
          if (done) {
            controller.close()
          } else {
            controller.enqueue(value)
          }
        } catch (error) {
          controller.error(error)
        }
      }
    })
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
      body,
      duplex: 'half'
    }
    const response = await request(setup(), '/books/upload/cover', init)
    expect(response.status).toBe(400)
    expect(await covers.listKeys()).toEqual([])
    expect(await getAssets()).toEqual([])
  })

  it('stores the files one after another', async () => {
    // Counts the files that the storage writes at the same time:
    class CountingStorage extends DiskStorage {
      writing = 0
      maxWriting = 0

      override async addFile(file: AssetFile, data: FileData) {
        this.maxWriting = Math.max(this.maxWriting, ++this.writing)
        try {
          await super.addFile(file, data)
        } finally {
          this.writing--
        }
      }
    }
    const counting = new CountingStorage({ name: 'covers', path: covers.path })
    const api = createApi({
      controllers: [
        {
          path: 'books',
          authorize: true,
          mixins: [
            defineAssetUploads({
              uploads: [{ path: 'cover', storage: 'covers' }],
              storages: new StorageRegistry([counting]),
              getDb: () => db
            })
          ]
        }
      ],
      onError: () => {}
    })
    const files = ['a', 'b', 'c'].map(name => new File([name], `${name}.txt`))
    const response = await upload(api, 'cover', ...files)
    expect(response.status).toBe(200)
    expect(await counting.listKeys()).toHaveLength(3)
    expect(counting.maxWriting).toBe(1)
  })

  it('answers failing storages with an error after the whole body', async () => {
    // A file where the storage folder should be makes `mkdir()` fail before
    // the storage reads more of the file than the head of `store()`:
    const broken = new DiskStorage({ name: 'covers', path: covers.path })
    await fs.writeFile(broken.path, '')
    const api = createApi({
      controllers: [
        {
          path: 'books',
          authorize: true,
          mixins: [
            defineAssetUploads({
              uploads: [{ path: 'cover', storage: 'covers' }],
              storages: new StorageRegistry([broken]),
              getDb: () => db
            })
          ]
        }
      ],
      onError: () => {}
    })
    const response = await upload(
      api,
      'cover',
      new File([Buffer.alloc(10 * 1024 * 1024)], 'a.bin'),
      new File(['b'], 'b.txt')
    )
    expect(response.status).toBe(500)
    expect(await getAssets()).toEqual([])
  })

  it('commits the asset rows without a transaction', async () => {
    const response = await upload(
      setup({ fail: true }),
      'cover',
      new File(['a'], 'a.txt')
    )
    expect(response.status).toBe(500)
    const [key] = await covers.listKeys()
    expect(await getAssets()).toEqual([
      { key, unreferenced_since: expect.any(Date) }
    ])
  })

  it('removes the stored files when the asset rows fail', async () => {
    const api = createApi({
      controllers: [
        {
          path: 'books',
          authorize: true,
          mixins: [
            defineAssetUploads({
              uploads: [{ path: 'cover', storage: 'covers' }],
              storages,
              // A schema without `asset` table makes the inserts fail.
              getDb: () => db.withSchema('missing')
            })
          ]
        }
      ],
      onError: () => {}
    })
    const response = await upload(
      api,
      'cover',
      new File(['a'], 'a.txt'),
      new File(['b'], 'b.txt')
    )
    expect(response.status).toBe(500)
    expect(await covers.listKeys()).toEqual([])
  })

  it('needs `authorize` on the controller', () => {
    const mixin = bookAssets().defineUploads('book')
    expect(() =>
      createApi({ controllers: [{ path: 'books', mixins: [mixin] }] })
    ).toThrow(
      `Invalid action without \`authorize\`: 'post upload/:path{.+}' in 'books'.`
    )
  })

  it('throws for tables without asset paths', () => {
    expect(() => bookAssets().defineUploads('author')).toThrow(
      `No asset paths for table 'author'`
    )
  })

  it('throws for uploads of unknown storages', () => {
    const uploads = [{ path: 'drafts/*', storage: 'unknown' }]
    expect(() => bookAssets().defineUploads({ uploads })).toThrow(
      `Unknown storage 'unknown'`
    )
  })

  it('adds uploads without asset paths, also without a table', async () => {
    const uploads = [{ path: 'drafts/*', storage: 'archive' }]
    const api = createApi({
      controllers: [
        {
          path: 'books',
          authorize: true,
          mixins: [bookAssets().defineUploads('book', { uploads })]
        },
        {
          path: 'notes',
          authorize: true,
          mixins: [bookAssets().defineUploads({ uploads })]
        }
      ],
      adapter: handleAdapter,
      onError: () => {}
    })
    for (const [route, status] of [
      ['books/upload/cover', 200],
      ['books/upload/drafts/1', 200],
      ['notes/upload/drafts/1', 200],
      ['notes/upload/cover', 404]
    ] as const) {
      const body = new FormData()
      body.append('file', new File(['a'], 'a.txt'))
      const response = await request(api, `/${route}`, { method: 'POST', body })
      expect(response.status).toBe(status)
    }
  })
})
