import { createApi, defineController } from '@ditojs/server'
import { createAssets, type AssetFile, type AssetPath } from './index.ts'
import { uploadRoutes } from './assetUploads.ts'
import {
  setupAssetTests,
  db,
  covers,
  archive,
  storages,
  type Api,
  request,
  paths,
  getAssets,
  adapter,
  handleAdapter
} from './test/assets.ts'

setupAssetTests()

describe('defineUploads()', () => {
  const uploadPaths: AssetPath[] = [
    ...paths,
    { table: 'book', column: 'back_cover', path: '', storage: 'archive' },
    { table: 'shelf', column: 'label', path: '', storage: 'archive' }
  ]
  const bookAssets = () =>
    createAssets({ adapter, paths: uploadPaths, storages })

  function setup({ fail = false } = {}) {
    const books = defineController({
      path: 'books',
      authorize: true,
      // `defineWrites()` leaves the multipart bodies of the uploads alone.
      mixins: [
        bookAssets().defineWrites('book'),
        bookAssets().defineUploads('book')
      ],
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
            uploadRoutes({
              uploads: [{ path: 'cover', storage: 'covers' }],
              storages,
              // A schema without `asset` table makes the inserts fail.
              db: () => db.withSchema('missing')
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
    ).toThrow(`'post upload/:path{.+}' has no \`authorize\` in 'books'`)
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
