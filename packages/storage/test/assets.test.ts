import fs from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { sql, type Kysely } from 'kysely'
import {
  HttpError,
  createApi,
  defineController,
  type DitoContext,
  type Transaction
} from '@ditojs/server'
import {
  DiskStorage,
  StorageRegistry,
  assetUploads,
  assets,
  createAssets,
  findAssetReferences,
  importAssets,
  releaseAssets,
  runAssetJobs,
  scanAssets,
  storeAsset,
  uploadRoutes,
  type AssetFile,
  type AssetPath
} from '../src/index.ts'
import { findAssetFiles } from '../src/asset-path.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

let db: Kysely<any>
let drop: () => Promise<void>
let basePath: string
let covers: DiskStorage
let archive: DiskStorage
let storages: StorageRegistry

type Api = ReturnType<typeof createApi>

const request = (api: Api, url: string, init?: RequestInit) =>
  api.fetch(new Request(new URL(url, 'http://localhost'), init))

const paths: AssetPath[] = [
  { table: 'book', column: 'cover', path: '', storage: 'covers' },
  { table: 'book', column: 'pages', path: '*/images', storage: 'covers' },
  { table: 'book', column: 'notes', path: '**.file', storage: 'covers' }
]

const getDb = (c: DitoContext) => c.var.db as Kysely<any>

beforeAll(async () => {
  ;({ db, drop } = await createTestDatabase())
  await db.schema
    .createTable('asset')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('key', 'text', col => col.notNull().unique())
    .addColumn('file', 'jsonb')
    .addColumn('storage', 'text', col => col.notNull())
    .addColumn('unreferenced_since', 'timestamptz')
    .addColumn('created_at', 'timestamptz')
    .addColumn('updated_at', 'timestamptz')
    .execute()
  await db.schema
    .createTable('book')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('cover', 'jsonb')
    .addColumn('pages', 'jsonb')
    // node-pg parses `json` columns as well as `jsonb`.
    .addColumn('notes', 'json')
    .execute()
})

afterAll(() => drop())

beforeEach(async () => {
  await sql`truncate asset, book`.execute(db)
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-assets-'))
  const options = { url: 'https://example.com/', nestedFolders: false }
  covers = new DiskStorage({
    ...options,
    name: 'covers',
    path: path.join(basePath, 'covers'),
    allowedImports: [
      `file://${basePath}/imports/*`,
      'http://127.0.0.1:*/imports/*'
    ]
  })
  archive = new DiskStorage({
    ...options,
    name: 'archive',
    path: path.join(basePath, 'archive')
  })
  storages = new StorageRegistry([covers, archive])
})

afterEach(() => fs.rm(basePath, { recursive: true, force: true }))

const file = (key: string): AssetFile => ({ key, name: `${key}.png` })

// Writes a file to the folder that `covers` imports from.
async function addImport(name: string, data: string) {
  const source = path.join(basePath, 'imports', name)
  await fs.mkdir(path.dirname(source), { recursive: true })
  await fs.writeFile(source, data)
  return source
}

async function addBook(id: number, values: Record<string, unknown>) {
  await db
    .insertInto('book')
    .values({
      id,
      // node-pg sends arrays as Postgres arrays, so send JSON.
      ...Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          JSON.stringify(value)
        ])
      )
    })
    .execute()
}

async function addAsset(
  key: string,
  { since = null as Date | null, storage = 'covers' } = {}
) {
  await db
    .insertInto('asset')
    .values({ key, file: file(key), storage, unreferenced_since: since })
    .execute()
}

// MikroORM's driver returns dates as strings.
const getAssets = async () =>
  (
    await db
      .selectFrom('asset')
      .select(['key', 'unreferenced_since'])
      .orderBy('key')
      .execute()
  ).map(({ key, unreferenced_since: since }) => ({
    key,
    unreferenced_since: since && new Date(since)
  }))

const getKeys = async () => (await getAssets()).map(asset => asset.key)

const old = new Date('2026-10-01T00:00:00Z')
const now = new Date('2026-10-30T12:00:00Z')

describe('findAssetFiles()', () => {
  it('finds files at the column itself, also in arrays', () => {
    expect(findAssetFiles(file('a'), '')).toEqual([
      { file: file('a'), path: '' }
    ])
    expect(findAssetFiles([file('a'), null, file('b')], '')).toEqual([
      { file: file('a'), path: '0' },
      { file: file('b'), path: '2' }
    ])
  })

  it('matches `*` on one segment', () => {
    const value = [{ images: [file('a')] }, { images: file('b') }, {}]
    expect(findAssetFiles(value, '*/images')).toEqual([
      { file: file('a'), path: '0/images/0' },
      { file: file('b'), path: '1/images' }
    ])
  })

  it('matches `**` on any depth, also at the top', () => {
    const value = {
      file: file('a'),
      items: [{ file: file('b') }, { nested: { file: file('c') } }]
    }
    expect(findAssetFiles(value, '**.file').map(found => found.path)).toEqual([
      'file',
      'items/0/file',
      'items/1/nested/file'
    ])
    expect(findAssetFiles(value, 'items[**].file')).toHaveLength(2)
  })

  it('skips values without a string key', () => {
    expect(findAssetFiles({ file: 'a.png' }, 'file')).toEqual([])
    expect(findAssetFiles(null, '*/images')).toEqual([])
  })
})

describe('scanAssets()', () => {
  beforeEach(async () => {
    await addBook(1, {
      cover: file('a'),
      pages: [{ images: [file('a'), file('b')] }]
    })
    await addBook(2, { notes: { items: [{ file: file('c') }] } })
    await addAsset('a', { since: old })
    await addAsset('b')
    await addAsset('d')
    await addAsset('e', { since: old })
  })

  it('sets `unreferenced_since` and inserts missing rows', async () => {
    const report = await scanAssets({ db, paths, now })
    expect(report).toMatchObject({
      referenced: [{ key: 'a', storage: 'covers' }],
      unreferenced: [
        { key: 'd', storage: 'covers', since: now },
        { key: 'e', storage: 'covers', since: old }
      ],
      missing: [{ key: 'c', storage: 'covers' }],
      rowCount: 2
    })
    expect(await getAssets()).toEqual([
      { key: 'a', unreferenced_since: null },
      { key: 'b', unreferenced_since: null },
      { key: 'c', unreferenced_since: null },
      { key: 'd', unreferenced_since: now },
      { key: 'e', unreferenced_since: old }
    ])
    const missing = await db
      .selectFrom('asset')
      .select(['file', 'storage'])
      .where('key', '=', 'c')
      .executeTakeFirst()
    expect(missing).toEqual({ file: file('c'), storage: 'covers' })
  })

  it('runs in the transaction that it gets', async () => {
    await db.transaction().execute(async trx => {
      const report = await scanAssets({ db: trx, paths })
      expect(report.missing).toHaveLength(1)
    })
    expect(await getKeys()).toContain('c')
  })

  it('writes nothing in a dry run', async () => {
    const before = await getAssets()
    const report = await scanAssets({ db, paths, dryRun: true, now })
    expect(report.referenced).toHaveLength(1)
    expect(report.missing).toHaveLength(1)
    expect(await getAssets()).toEqual(before)
  })
})

describe('releaseAssets()', () => {
  it('releases assets unreferenced for longer than `after`', async () => {
    for (const key of ['old', 'new', 'used']) {
      await covers.addFile(file(key), Buffer.from(key))
    }
    await addAsset('old', { since: new Date('2026-10-29T23:00:00Z') })
    await addAsset('new', { since: new Date('2026-10-30T01:00:00Z') })
    await addAsset('used')
    await addAsset('gone', { since: old })
    // A file that is already gone is released without an error.
    const released = await releaseAssets({
      db,
      storages,
      deleteUnusedAfter: 12 * 60 * 60 * 1000,
      now
    })
    expect(released.sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: 'gone', storage: 'covers' },
      { key: 'old', storage: 'covers' }
    ])
    expect(await getKeys()).toEqual(['new', 'used'])
    expect((await covers.listKeys()).sort()).toEqual(['new', 'used'])
  })
})

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
      db: { connect: () => db, transaction: kyselyTransaction },
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
    let response: Promise<Response>
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

describe('runAssetJobs()', () => {
  beforeEach(async () => {
    await covers.addFile(file('old'), Buffer.from('old'))
    await addBook(1, { cover: file('used') })
    await addAsset('used', { since: old })
    await addAsset('old', { since: old })
    await addAsset('new')
  })

  const options = () => ({
    db,
    paths,
    storages,
    deleteUnusedAfter: 24 * 60 * 60 * 1000,
    now
  })

  it('scans, then releases the unused assets', async () => {
    const { scan, released } = await runAssetJobs(options())
    expect(scan.referenced).toEqual([{ key: 'used', storage: 'covers' }])
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
    expect(await getKeys()).toEqual(['new', 'used'])
    expect(await covers.listKeys()).toEqual([])
  })

  it('skips the release with `deleteUnusedAfter: false`', async () => {
    const { released } = await runAssetJobs({
      ...options(),
      deleteUnusedAfter: false
    })
    expect(released).toEqual([])
    expect(await getKeys()).toEqual(['new', 'old', 'used'])
  })

  it('returns the assets of the release in a dry run', async () => {
    const before = await getAssets()
    const { released } = await runAssetJobs({ ...options(), dryRun: true })
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
    expect(await getAssets()).toEqual(before)
    expect(await covers.listKeys()).toEqual(['old'])
  })
})

describe('findAssetReferences()', () => {
  beforeEach(async () => {
    await addBook(1, {
      cover: file('a'),
      pages: [{ images: [file('a'), file('b')] }]
    })
    await addBook(2, { notes: { items: [{ file: file('b') }] } })
  })

  it('lists the files at the asset paths with their locations', async () => {
    const references = await findAssetReferences({ db, paths })
    expect(
      references.map(({ key, id, column, dataPath, storage }) => ({
        key,
        id,
        column,
        dataPath,
        storage
      }))
    ).toEqual([
      {
        key: 'a',
        id: 1,
        column: 'cover',
        dataPath: 'cover',
        storage: 'covers'
      },
      {
        key: 'a',
        id: 1,
        column: 'pages',
        dataPath: 'pages/0/images/0',
        storage: 'covers'
      },
      {
        key: 'b',
        id: 1,
        column: 'pages',
        dataPath: 'pages/0/images/1',
        storage: 'covers'
      },
      {
        key: 'b',
        id: 2,
        column: 'notes',
        dataPath: 'notes/items/0/file',
        storage: 'covers'
      }
    ])
    expect(references[0]).toMatchObject({
      table: 'book',
      file: file('a'),
      assetPath: paths[0]
    })
  })

  it('filters by keys, storage and tables', async () => {
    expect(
      (await findAssetReferences({ db, paths, keys: ['b'] })).map(
        reference => reference.dataPath
      )
    ).toEqual(['pages/0/images/1', 'notes/items/0/file'])
    expect(
      await findAssetReferences({ db, paths, storage: 'archive' })
    ).toEqual(
      []
    )
    expect(await findAssetReferences({ db, paths, tables: ['other'] })).toEqual(
      []
    )
  })

  it('assigns each location to the first path that reaches it', async () => {
    const overlapping = [...paths, { ...paths[1], storage: 'archive' }]
    const references = await findAssetReferences({ db, paths: overlapping })
    expect(references).toHaveLength(4)
    expect(references.every(({ storage }) => storage === 'covers')).toBe(true)
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

describe('assetUploads()', () => {
  const uploadPaths: AssetPath[] = [
    ...paths,
    { table: 'book', column: 'back_cover', path: '', storage: 'archive' },
    { table: 'shelf', column: 'label', path: '', storage: 'archive' }
  ]

  function setup({ fail = false } = {}) {
    const options = { table: 'book', paths: uploadPaths, storages, db: getDb }
    const books = defineController({
      path: 'books',
      authorize: true,
      // `assets()` leaves the multipart bodies of the uploads alone.
      mixins: [assets(options), assetUploads(options)],
      ...(fail && {
        middleware: async (_c, next) => {
          await next()
          throw new Error('Failed request')
        }
      })
    })
    return createApi({
      controllers: [books],
      db: { connect: () => db, transaction: kyselyTransaction },
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
    const mixin = assetUploads({ table: 'book', paths, storages, db: getDb })
    expect(() =>
      createApi({ controllers: [{ path: 'books', mixins: [mixin] }] })
    ).toThrow(`'post upload/:path{.+}' has no \`authorize\` in 'books'`)
  })

  it('throws for tables without asset paths', () => {
    expect(() =>
      assetUploads({ table: 'author', paths, storages, db: getDb })
    ).toThrow(`No asset paths for table 'author'`)
  })
})

describe('createAssets()', () => {
  const createBookAssets = () =>
    createAssets({
      paths,
      storages,
      db: getDb,
      deleteUnusedAfter: 24 * 60 * 60 * 1000
    })

  function setup(uploads?: boolean) {
    const books = defineController({
      path: 'books',
      authorize: true,
      mixins: [createBookAssets().mixin('book', { uploads })],
      actions: { post: async ({ body }) => body }
    })
    return createApi({
      controllers: [books],
      db: { connect: () => db, transaction: kyselyTransaction },
      getUser: async () => null,
      onError: () => {}
    })
  }

  it('mixes in the uploads and the asset handling of writes', async () => {
    const api = setup()
    const body = new FormData()
    body.append('file', new File(['Front'], 'front.txt'))
    const response = await request(api, '/books/upload/cover', {
      method: 'POST',
      body
    })
    const [stored] = await response.json()
    expect(stored).toMatchObject({ name: 'front.txt', size: 5 })
    const written = await request(api, '/books', {
      method: 'POST',
      body: JSON.stringify({ cover: { key: stored.key } }),
      headers: { 'Content-Type': 'application/json' }
    })
    expect(written.status).toBe(200)
    expect(await written.json()).toEqual({ cover: stored })
  })

  it('takes the Kysely of `c.var.db` by default', async () => {
    const books = defineController({
      path: 'books',
      authorize: true,
      mixins: [createAssets({ paths, storages }).mixin('book')]
    })
    const api = createApi({
      controllers: [books],
      db: {
        connect: () => ({ getKysely: () => db }),
        transaction: (c, fn) => fn()
      },
      getUser: async () => null,
      onError: () => {}
    })
    const body = new FormData()
    body.append('file', new File(['Front'], 'front.txt'))
    const response = await request(api, '/books/upload/cover', {
      method: 'POST',
      body
    })
    expect((await response.json())[0]).toMatchObject({ name: 'front.txt' })
  })

  it('leaves the uploads out with `uploads: false`', async () => {
    const response = await request(setup(false), '/books/upload/cover', {
      method: 'POST',
      body: new FormData()
    })
    expect(response.status).toBe(404)
  })

  it('stores files in storages by name', async () => {
    const file = await createBookAssets().store(db, 'archive', {
      name: 'report.txt',
      data: Buffer.from('Report')
    })
    expect(await archive.readFile(file)).toEqual(Buffer.from('Report'))
    expect(
      await db.selectFrom('asset').select(['key', 'storage']).execute()
    ).toEqual([{ key: file.key, storage: 'archive' }])
  })

  it('imports the files of a row', async () => {
    const source = await addImport('source.txt', 'Source')
    const data = { cover: { key: 'seed', url: `file://${source}` } }
    await createBookAssets().import(db, 'book', data)
    expect(await getKeys()).toEqual([data.cover.key])
  })

  it('finds references and runs the jobs with the shared options', async () => {
    const assets = createBookAssets()
    await addBook(1, { cover: file('used') })
    await addAsset('used')
    await addAsset('old', { since: old })
    expect(
      (await assets.references(db, { keys: ['used'] })).map(ref => ref.id)
    ).toEqual([1])
    const { released } = await assets.runJobs(db, { dryRun: true, now })
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
  })
})
