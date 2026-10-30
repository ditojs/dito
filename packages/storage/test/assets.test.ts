import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { Hono } from 'hono'
import {
  createApp,
  defineController,
  problemResponse,
  type DitoContext,
  type Transaction
} from '@ditojs/server-next'
import {
  DiskStorage,
  assets,
  findAssetFiles,
  findAssetUsage,
  findStrayFiles,
  insertAsset,
  releaseAssets,
  scanAssets,
  type AssetFileObject,
  type AssetPath
} from '../src/index.ts'

let basePath: string
let covers: DiskStorage
let archive: DiskStorage
let db: Kysely<any>

const paths: AssetPath[] = [
  { table: 'book', column: 'cover', path: '', storage: 'covers' },
  { table: 'book', column: 'pages', path: '*/images', storage: 'covers' },
  { table: 'book', column: 'notes', path: '**.file', storage: 'covers' }
]

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-assets-'))
  const options = {
    secret: 'secret',
    url: 'https://example.com/',
    nestedFolders: false
  }
  covers = new DiskStorage({
    ...options,
    name: 'covers',
    path: path.join(basePath, 'covers')
  })
  archive = new DiskStorage({
    ...options,
    name: 'archive',
    path: path.join(basePath, 'archive')
  })
  db = new Kysely({ dialect: new SqliteDialect({ database: new Database() }) })
  await db.schema
    .createTable('asset')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('key', 'text', col => col.notNull().unique())
    .addColumn('file', 'text')
    .addColumn('storage', 'text', col => col.notNull())
    .addColumn('count', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('unreferenced_since', 'text')
    .addColumn('created_at', 'text')
    .addColumn('updated_at', 'text')
    .execute()
  await db.schema
    .createTable('book')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('cover', 'text')
    .addColumn('pages', 'text')
    .addColumn('notes', 'text')
    .execute()
})

afterEach(async () => {
  await db.destroy()
  await fs.rm(basePath, { recursive: true, force: true })
})

const file = (key: string): AssetFileObject => ({ key, name: `${key}.png` })

async function addBook(id: number, values: Record<string, unknown>) {
  await db
    .insertInto('book')
    .values({
      id,
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
  { count = 0, since = null as string | null, storage = 'covers' } = {}
) {
  await db
    .insertInto('asset')
    .values({
      key,
      file: JSON.stringify(file(key)),
      storage,
      count,
      unreferenced_since: since,
      updated_at: 'before'
    })
    .execute()
}

const getAssets = () =>
  db
    .selectFrom('asset')
    .select(['key', 'count', 'unreferenced_since', 'updated_at'])
    .orderBy('key')
    .execute()

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
  it('counts the rows that reference each key', async () => {
    // `a` twice in book 1, which counts once, and `b` in two books.
    await addBook(1, {
      cover: file('a'),
      pages: [{ images: [file('a'), file('b')] }]
    })
    await addBook(2, { notes: { items: [{ file: file('b') }] } })
    await addAsset('a', { count: 2 })
    await addAsset('b', { count: 1 })
    const report = await scanAssets({ db, paths })
    expect(report.changed).toEqual([
      { key: 'a', storage: 'covers', from: 2, to: 1 },
      { key: 'b', storage: 'covers', from: 1, to: 2 }
    ])
    expect(report.rows).toBe(2)
    expect(report.missing).toEqual([])
    expect((await getAssets()).map(asset => asset.count)).toEqual([1, 2])
  })

  it('reads JSON stored as text and reports missing assets', async () => {
    // SQLite returns JSON as strings, as Postgres does for `json` columns.
    await addBook(1, { cover: file('a') })
    const report = await scanAssets({ db, paths })
    expect(report.missing).toEqual([{ key: 'a', storage: 'covers' }])
  })

  it('sets and clears `unreferenced_since`', async () => {
    const now = new Date('2026-10-30T12:00:00Z')
    await addBook(1, { cover: file('used') })
    await addAsset('unused', { count: 1 })
    await addAsset('used', { since: '2026-10-01T00:00:00.000Z' })
    await addAsset('old', { since: '2026-10-01T00:00:00.000Z' })
    const report = await scanAssets({ db, paths, now })
    expect(report.unreferenced).toEqual([
      { key: 'unused', storage: 'covers', since: now },
      { key: 'old', storage: 'covers', since: new Date('2026-10-01') }
    ])
    expect(await getAssets()).toEqual([
      {
        key: 'old',
        count: 0,
        unreferenced_since: '2026-10-01T00:00:00.000Z',
        updated_at: 'before'
      },
      {
        key: 'unused',
        count: 0,
        unreferenced_since: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        key: 'used',
        count: 1,
        unreferenced_since: null,
        updated_at: now.toISOString()
      }
    ])
  })

  it('writes nothing in a dry run', async () => {
    await addBook(1, { cover: file('a') })
    await addAsset('a')
    await addAsset('b', { count: 3 })
    const before = await getAssets()
    const report = await scanAssets({ db, paths, dryRun: true })
    expect(report.changed).toHaveLength(2)
    expect(report.unreferenced.map(asset => asset.key)).toEqual(['b'])
    expect(await getAssets()).toEqual(before)
  })

  it('reads tables in pages', async () => {
    for (let id = 1; id <= 25; id++) await addBook(id, { cover: file('a') })
    await addAsset('a')
    const report = await scanAssets({ db, paths })
    expect(report.rows).toBe(25)
    expect(report.changed).toEqual([
      { key: 'a', storage: 'covers', from: 0, to: 25 }
    ])
  })
})

describe('releaseAssets()', () => {
  it('releases assets unreferenced for longer than `after`', async () => {
    const now = new Date('2026-10-30T12:00:00Z')
    for (const key of ['old', 'new', 'used']) {
      await covers.addFile(file(key), Buffer.from(key))
    }
    await addAsset('old', { since: '2026-10-29T23:00:00.000Z' })
    await addAsset('new', { since: '2026-10-30T01:00:00.000Z' })
    await addAsset('used', { since: '2026-10-01T00:00:00.000Z', count: 1 })
    await addAsset('gone', { since: '2026-10-01T00:00:00.000Z' })
    const options = { db, storages: { covers }, after: '12h', now }
    expect(await releaseAssets({ ...options, dryRun: true })).toEqual([
      { key: 'old', storage: 'covers' },
      { key: 'gone', storage: 'covers' }
    ])
    expect(await getAssets()).toHaveLength(4)
    // A file that is already gone is released without an error.
    expect(await releaseAssets(options)).toEqual([
      { key: 'old', storage: 'covers' },
      { key: 'gone', storage: 'covers' }
    ])
    expect((await getAssets()).map(asset => asset.key)).toEqual([
      'new',
      'used'
    ])
    expect((await covers.listKeys()).sort()).toEqual(['new', 'used'])
  })

  it('rejects invalid durations', async () => {
    await expect(
      releaseAssets({ db, storages: {}, after: 'soon' })
    ).rejects.toThrow('Invalid duration: "soon"')
  })
})

describe('findStrayFiles()', () => {
  it('lists files without asset rows', async () => {
    await covers.addFile(file('stray'), Buffer.from('stray'))
    await covers.addFile(file('kept'), Buffer.from('kept'))
    await addAsset('kept')
    expect(await findStrayFiles({ db, storage: covers })).toEqual(['stray'])
  })
})

describe('findAssetUsage()', () => {
  it('lists the rows that reference a key', async () => {
    await addBook(1, { cover: file('a'), pages: [{ images: file('a') }] })
    await addBook(2, { notes: { file: file('a') } })
    await addBook(3, { notes: { other: file('a') }, cover: file('b') })
    // Without escaping, the `_` of `a_` matches any character in LIKE.
    await addBook(4, { cover: file('a_b') })
    expect(await findAssetUsage({ db, paths, key: 'a' })).toEqual([
      { table: 'book', id: 1, column: 'cover' },
      { table: 'book', id: 1, column: 'pages' },
      { table: 'book', id: 2, column: 'notes' }
    ])
    expect(await findAssetUsage({ db, paths, key: 'a_' })).toEqual([])
  })
})

describe('insertAsset()', () => {
  it('inserts unreferenced asset rows without signatures', async () => {
    const signed = { ...file('a'), signature: 'abc' }
    await insertAsset(db, [signed, file('b')], covers)
    const rows = await db.selectFrom('asset').selectAll().execute()
    expect(rows).toMatchObject([
      { key: 'a', storage: 'covers', count: 0 },
      { key: 'b', storage: 'covers', count: 0 }
    ])
    expect(JSON.parse(rows[0].file)).toEqual(file('a'))
    expect(rows[0].unreferenced_since).toBe(rows[0].created_at)
  })
})

describe('assets()', () => {
  const kyselyTransaction: Transaction = (c, fn) =>
    db.transaction().execute(trx => {
      c.set('trx', trx)
      return fn()
    })

  let received: any

  function setup() {
    const books = defineController({
      path: 'books',
      use: [
        assets(paths.slice(0, 2), {
          storages: { covers, archive },
          db: (c: DitoContext) => c.var.trx as Kysely<any>
        })
      ],
      collection: {
        post: async c => {
          const body = await c.req.json()
          received = body
          if (body.fail) throw new Error('Failed write')
          return body
        },
        get: () => ({ cover: file('a') })
      },
      isRow: () => true
    })
    const app = new Hono()
    app.onError(problemResponse)
    app.route(
      '/',
      createApp({
        controllers: [books],
        transaction: kyselyTransaction,
        getUser: async () => null
      })
    )
    return app
  }

  const post = (app: Hono, body: unknown) =>
    app.request('/books', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })

  async function addSignedFile(storage: DiskStorage, key: string) {
    const added = await storage.addFile(file(key), Buffer.from(key))
    const signed = { ...added }
    covers.signAssetFile(signed)
    return signed
  }

  it('answers invalid signatures with 400', async () => {
    const response = await post(setup(), {
      cover: { ...file('a'), signature: 'forged' }
    })
    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe(
      'application/problem+json'
    )
    expect(await response.json()).toMatchObject({
      status: 400,
      detail: `Invalid asset signature for file 'a.png'`
    })
  })

  it('clears `unreferenced_since` of files in the body', async () => {
    const signed = await addSignedFile(covers, 'a')
    await addAsset('a', { since: '2026-10-01T00:00:00.000Z' })
    const response = await post(setup(), { cover: signed })
    expect(response.status).toBe(201)
    // The handler reads the file without its signature.
    const { signature: _, ...unsigned } = signed
    expect(received.cover).toEqual(unsigned)
    expect((await getAssets())[0].unreferenced_since).toBe(null)
  })

  it('copies files of other storages under new keys', async () => {
    const signed = await addSignedFile(archive, 'a')
    await addAsset('a', { storage: 'archive', count: 1 })
    await post(setup(), { pages: [{ images: [signed] }] })
    const [copy] = received.pages[0].images
    expect(copy.key).not.toBe('a')
    expect(await covers.listKeys()).toEqual([copy.key])
    expect((await getAssets()).map(asset => asset.key)).toContain(copy.key)
  })

  it('removes imported files when the write fails', async () => {
    const signed = await addSignedFile(archive, 'a')
    await addAsset('a', { storage: 'archive', count: 1 })
    const response = await post(setup(), { cover: signed, fail: true })
    expect(response.status).toBe(500)
    expect(await covers.listKeys()).toEqual([])
    expect((await getAssets()).map(asset => asset.key)).toEqual(['a'])
  })

  it('rejects files from sources that aren`t allowed', async () => {
    const response = await post(setup(), {
      cover: { ...(await addSignedFile(covers, 'a')) }
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      detail: expect.stringContaining('Unable to import asset')
    })
  })

  it('signs the files that it sends', async () => {
    const response = await setup().request('/books')
    const json = await response.json()
    expect(covers.verifyAssetFile(json.cover)).toBe(true)
  })
})
