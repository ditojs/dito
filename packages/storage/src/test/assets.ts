import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sql, type Kysely } from 'kysely'
import type { Adapter, DitoContext, createApi } from '@ditojs/server'
import {
  DiskStorage,
  StorageRegistry,
  type AssetFile,
  type AssetPath
} from '../index.ts'
import { createTestDatabase } from '../../../../tests/utils/database.ts'

// The database, the storages and the helpers of the asset tests. Each test
// file calls `setupAssetTests()`, which creates them in its hooks.

export let db: Kysely<any>
let drop: () => Promise<void>
export let basePath: string
export let covers: DiskStorage
export let archive: DiskStorage
export let storages: StorageRegistry

export type Api = ReturnType<typeof createApi>

export const request = (api: Api, url: string, init?: RequestInit) =>
  api.fetch(new Request(new URL(url, 'http://localhost'), init))

class Book {}

export const bookPath = { entity: Book, table: 'book' }

export const paths: AssetPath[] = [
  { ...bookPath, column: 'cover', path: '', storage: 'covers' },
  { ...bookPath, column: 'pages', path: '*/images', storage: 'covers' },
  { ...bookPath, column: 'notes', path: '**.file', storage: 'covers' }
]

export const getKysely = (c?: DitoContext) => c!.var.em as Kysely<any>

export function setupAssetTests() {
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
}

export const file = (key: string): AssetFile => ({ key, name: `${key}.png` })

// Writes a file to the folder that `covers` imports from.
export async function addImport(name: string, data: string) {
  const source = path.join(basePath, 'imports', name)
  await fs.mkdir(path.dirname(source), { recursive: true })
  await fs.writeFile(source, data)
  return source
}

export async function addBook(id: number, values: Record<string, unknown>) {
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

export async function addAsset(
  key: string,
  { since = null as Date | null, storage = 'covers' } = {}
) {
  await db
    .insertInto('asset')
    .values({ key, file: file(key), storage, unreferenced_since: since })
    .execute()
}

// MikroORM's driver returns dates as strings.
export const getAssets = async () =>
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

export const getKeys = async () => (await getAssets()).map(asset => asset.key)

export const old = new Date('2026-10-01T00:00:00Z')
export const now = new Date('2026-10-30T12:00:00Z')

// The adapter of `createAssets()`, and one of `createApi()` whose request
// handles have a Kysely, as the entity managers of `@ditojs/mikro` do.
export const adapter = {
  getKysely: (c?: DitoContext) => (c ? (c.var.em as any).getKysely() : db)
}
export const handleAdapter: Partial<Adapter> = {
  connect: () => ({ getKysely: () => db }),
  transact: (c, fn) =>
    db.transaction().execute(async trx => {
      const previous = c.var.em
      c.set('em', { getKysely: () => trx })
      try {
        return await fn()
      } finally {
        c.set('em', previous)
      }
    })
}
