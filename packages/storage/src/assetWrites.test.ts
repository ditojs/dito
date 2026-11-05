import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { sql } from 'kysely'
import {
  HttpError,
  createApi,
  defineController,
  type Transaction
} from '@ditojs/server'
import { assets, importAssets, storeAsset } from './assetWrites.ts'
import { releaseAssets } from './assetJobs.ts'
import {
  setupAssetTests,
  db,
  basePath,
  covers,
  archive,
  storages,
  type Api,
  request,
  paths,
  getDb,
  file,
  addImport,
  addAsset,
  getAssets,
  getKeys,
  old
} from './test/assets.ts'

setupAssetTests()

describe('storeAsset()', () => {
  it('stores a file and inserts its unreferenced row', async () => {
    const stored = await storeAsset(db, covers, {
      name: 'a.txt',
      data: Buffer.from('a')
    })
    expect(await covers.listKeys()).toEqual([stored.key])
    const rows = await db.selectFrom('asset').selectAll().execute()
    expect(rows).toMatchObject([
      { key: stored.key, file: stored, storage: 'covers' }
    ])
    expect(rows[0].unreferenced_since).toEqual(rows[0].created_at)
  })

  it('removes the file when the insert fails', async () => {
    await expect(
      storeAsset(db.withSchema('missing'), covers, {
        name: 'a.txt',
        data: Buffer.from('a')
      })
    ).rejects.toThrow(/does not exist/)
    expect(await covers.listKeys()).toEqual([])
  })
})

// Sets `c.var.db` to the transaction during `fn`, as ORM packages do.
const kyselyTransaction: Transaction = (c, fn) =>
  db.transaction().execute(async trx => {
    const previous = c.var.db
    c.set('db', trx)
    try {
      return await fn()
    } finally {
      c.set('db', previous)
    }
  })

describe('assets()', () => {
  let received: any

  function setup() {
    const books = defineController({
      path: 'books',
      authorize: true,
      mixins: [assets({ table: 'book', paths, storages, db: getDb })],
      actions: {
        post: async ({ body, c }) => {
          received = body
          if (body.fail) throw new Error('Failed write')
          if (body.conflict) {
            // A failed query aborts the transaction, as a failed flush does.
            await sql`select * from missing`.execute(getDb(c)).catch(() => {
              throw new HttpError(409)
            })
          }
          return body
        }
      }
    })
    return createApi({
      controllers: [books],
      adapter: { connect: () => db, transaction: kyselyTransaction },
      getUser: async () => null,
      onError: () => {}
    })
  }

  const post = (api: Api, body: unknown) =>
    request(api, '/books', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })

  it('answers files without asset row and import source with 400', async () => {
    const response = await post(setup(), { cover: file('a') })
    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(await response.json()).toMatchObject({
      status: 400,
      message: `Unable to import asset from foreign source: 'a.png' ('a')`
    })
  })

  it('takes the properties of files from their asset rows', async () => {
    await addAsset('a', { since: old })
    const response = await post(setup(), {
      cover: { key: 'a', name: 'invoice.pdf', url: 'javascript:alert(1)' }
    })
    expect(response.status).toBe(200)
    expect(received.cover).toEqual(file('a'))
    expect(await getAssets()).toEqual([{ key: 'a', unreferenced_since: null }])
  })

  it('copies files of other storages under new keys', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { storage: 'archive' })
    await post(setup(), { pages: [{ images: [file('a')] }] })
    const [copy] = received.pages[0].images
    expect(copy).toMatchObject({ name: 'a.png', size: 1 })
    expect(copy.key).not.toBe('a')
    expect(await covers.listKeys()).toEqual([copy.key])
    expect(await getKeys()).toContain(copy.key)
  })

  it('imports files from allowed sources under new keys', async () => {
    const source = await addImport('source.txt', 'Source')
    const response = await post(setup(), {
      cover: { key: 'other', name: 'source.txt', url: `file://${source}` }
    })
    expect(response.status).toBe(200)
    expect(received.cover).toEqual({
      key: expect.stringMatching(/\.txt$/),
      name: 'source.txt',
      type: 'application/octet-stream',
      size: 6,
      url: `https://example.com/${received.cover.key}`
    })
    expect(await covers.readFile(received.cover)).toEqual(
      Buffer.from('Source')
    )
  })

  it('waits for a release of a file that the write uses', async () => {
    await covers.addFile(file('released'), Buffer.from('Cover'))
    await addAsset('released', { since: old })
    let response: ReturnType<typeof post>
    await db.transaction().execute(async trx => {
      await releaseAssets({ db: trx, storages, deleteUnusedAfter: 0 })
      response = post(setup(), { cover: file('released') })
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    expect((await response!).status).toBe(400)
  })

  it('rejects sources outside of `allowedImports`', async () => {
    const api = setup()
    for (const url of [
      'https://other.com/a.png',
      `file://${basePath}/imports/../secret.txt`
    ]) {
      const response = await post(api, { cover: { key: 'a', url } })
      expect(response.status).toBe(400)
    }
    expect(await getAssets()).toEqual([])
  })

  it('removes imported files when the write fails', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { storage: 'archive' })
    const response = await post(setup(), { cover: file('a'), fail: true })
    expect(response.status).toBe(500)
    expect(await covers.listKeys()).toEqual([])
    expect(await getKeys()).toEqual(['a'])
  })

  it('keeps the answer of a write that fails in the database', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { storage: 'archive' })
    const response = await post(setup(), { cover: file('a'), conflict: true })
    expect(response.status).toBe(409)
    expect(await covers.listKeys()).toEqual([])
    expect(await getKeys()).toEqual(['a'])
  })

  it('keeps the answer when the removal of a file fails', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { storage: 'archive' })
    vi.spyOn(covers, 'removeFile').mockRejectedValue(new Error('Failed'))
    const response = await post(setup(), { cover: file('a'), conflict: true })
    expect(response.status).toBe(409)
  })

  it('answers redirects of import sources with 400', async () => {
    const requests: string[] = []
    const server = http.createServer((req, res) => {
      requests.push(req.url!)
      res.writeHead(302, { Location: '/secret' }).end()
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const response = await post(setup(), {
      cover: { key: 'a', url: `http://127.0.0.1:${port}/imports/a.png` }
    })
    server.close()
    expect(response.status).toBe(400)
    expect(requests).toEqual(['/imports/a.png'])
  })

  it('refuses values at asset paths that are no stored files', async () => {
    const api = setup()
    const url = 'https://other.com/a.png'
    for (const cover of [{ name: 'a.png', url }, { key: 5, url }, 'a.png']) {
      for (const value of [cover, [cover]]) {
        const response = await post(api, { cover: value })
        expect(response.status).toBe(400)
        const { type, errors } = await response.json()
        expect(type).toBe('BodyValidation')
        expect(Object.keys(errors)[0]).toMatch(/^cover/)
      }
    }
    expect(await getAssets()).toEqual([])
  })

  it('accepts empty values at asset paths', async () => {
    const response = await post(setup(), { cover: null })
    expect(response.status).toBe(200)
  })

  it('holds no lock while it fetches an import', async () => {
    await covers.addFile(file('a'), Buffer.from('a'))
    await addAsset('a')
    let isLocked: boolean | undefined
    const server = http.createServer(async (req, res) => {
      isLocked = await db
        .transaction()
        .execute(trx =>
          sql`select 1 from asset where key = 'a' for update nowait`.execute(
            trx
          )
        )
        .then(
          () => false,
          () => true
        )
      res.end('b')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const response = await post(setup(), {
      cover: [
        file('a'),
        { key: 'b', url: `http://127.0.0.1:${port}/imports/b.png` }
      ]
    })
    server.close()
    expect(response.status).toBe(200)
    expect(isLocked).toBe(false)
  })

  it('refuses a file that a release deletes during the imports', async () => {
    await covers.addFile(file('a'), Buffer.from('a'))
    await addAsset('a')
    const server = http.createServer(async (req, res) => {
      await db.deleteFrom('asset').where('key', '=', 'a').execute()
      res.end('b')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const response = await post(setup(), {
      cover: [
        file('a'),
        { key: 'b', url: `http://127.0.0.1:${port}/imports/b.png` }
      ]
    })
    server.close()
    expect(response.status).toBe(400)
    expect(await covers.listKeys()).toEqual(['a'])
  })

  it('answers failed fetches of imports with 400', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('Timed out', 'TimeoutError'))
    const response = await post(setup(), {
      cover: { key: 'a', url: 'http://127.0.0.1:1/imports/a.png' }
    })
    expect(response.status).toBe(400)
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    fetch.mockRestore()
  })

  it('keeps the marks of files that it only copies', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { since: old, storage: 'archive' })
    await post(setup(), { cover: file('a') })
    expect(await getAssets()).toEqual(
      expect.arrayContaining([
        { key: 'a', unreferenced_since: old },
        { key: received.cover.key, unreferenced_since: null }
      ])
    )
  })

  it('removes imported files when another file is rejected', async () => {
    await archive.addFile(file('a'), Buffer.from('a'))
    await addAsset('a', { storage: 'archive' })
    const response = await post(setup(), {
      cover: file('a'),
      pages: [{ images: [file('b')] }]
    })
    expect(response.status).toBe(400)
    expect(await covers.listKeys()).toEqual([])
    expect(await getKeys()).toEqual(['a'])
  })
})

describe('importAssets()', () => {
  it('imports `file://` files and stores repeated files once', async () => {
    const source = await addImport('source.txt', 'Source')
    const url = `file://${source}`
    const data = {
      cover: { key: 'seed', name: 'source.txt', url },
      pages: [{ images: [{ key: 'seed', name: 'source.txt', url }] }]
    }
    await importAssets(data, { table: 'book', paths, storages, db })
    expect(data.cover.key).not.toBe('seed')
    expect(data.cover.url).toBe(`https://example.com/${data.cover.key}`)
    expect(data.pages[0].images[0]).toEqual(data.cover)
    expect(await covers.readFile(data.cover)).toEqual(Buffer.from('Source'))
    expect(await getKeys()).toEqual([data.cover.key])
  })

  it('skips files from sources that aren`t allowed', async () => {
    const data = { cover: { key: 'seed', url: 'https://other.com/a.png' } }
    await importAssets(data, { table: 'book', paths, storages, db })
    expect(data.cover).toEqual({ key: 'seed', url: 'https://other.com/a.png' })
    expect(await getAssets()).toEqual([])
  })
})
