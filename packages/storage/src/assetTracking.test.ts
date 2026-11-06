import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { defineEntity, p } from '@mikro-orm/core'
import { createApi } from '@ditojs/server'
import {
  crud,
  createMikroAdapter,
  defineJsonType,
  defineModelController,
  getAssetPaths,
  type MikroAdapter
} from '@ditojs/mikro'
import { createAssets, createStorages, type AssetFile } from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const assetColumn = () =>
  p
    .type(defineJsonType({ assets: [{ path: '', storage: 'covers' }] }))
    .nullable()

const BookSchema = defineEntity({
  name: 'Book',
  tableName: 'book',
  properties: {
    id: p.integer().primary(),
    cover: assetColumn()
  }
})
class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const ShelfSchema = defineEntity({
  name: 'Shelf',
  tableName: 'shelf',
  properties: {
    id: p.integer().primary(),
    label: assetColumn()
  }
})
class Shelf extends ShelfSchema.class {}
ShelfSchema.setClass(Shelf)

const AssetSchema = defineEntity({
  name: 'Asset',
  tableName: 'asset',
  properties: {
    id: p.integer().primary(),
    key: p.string().unique(),
    file: p.json(),
    storage: p.string(),
    unreferencedSince: p.datetime().nullable(),
    createdAt: p.datetime(),
    updatedAt: p.datetime()
  }
})

// Defined before `createAssets()` runs, without any mixin of it.
const books = defineModelController({
  path: 'books',
  entity: Book,
  authorize: true,
  mixins: [crud]
})

let database: Awaited<ReturnType<typeof createTestDatabase>>
let adapter: MikroAdapter
let basePath: string
let assets: ReturnType<typeof createAssets>
let api: ReturnType<typeof createApi>

const write = (method: string, url: string, body: unknown) =>
  api.fetch(
    new Request(new URL(url, 'http://localhost'), {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
  )

const store = (name: string): Promise<AssetFile> =>
  assets.store('covers', { name, data: Buffer.from(name) })

beforeAll(async () => {
  database = await createTestDatabase([Book, Shelf, AssetSchema])
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-assets-'))
  adapter = createMikroAdapter(database.orm)
  assets = createAssets({
    adapter,
    paths: getAssetPaths([Book, Shelf]),
    storages: createStorages({
      covers: { type: 'disk', path: basePath, url: '/covers/' }
    })
  })
  api = createApi({
    controllers: [books],
    adapter,
    onError: () => {}
  })
})

afterAll(async () => {
  await database.drop()
  await fs.rm(basePath, { recursive: true, force: true })
})

beforeEach(() => database.orm.schema.clear())

describe('tracking the files of model controllers', () => {
  it('accepts stored files, on `post` and `patch`', async () => {
    const created = await write('POST', '/books', {
      id: 1,
      cover: { key: (await store('a.txt')).key }
    })
    expect(created.status).toBe(201)
    expect((await created.json()).cover).toMatchObject({ name: 'a.txt' })
    const updated = await write('PATCH', '/books/1', {
      cover: { key: (await store('b.txt')).key }
    })
    expect((await updated.json()).cover).toMatchObject({ name: 'b.txt' })
  })

  it('answers files without a row with 400', async () => {
    const response = await write('POST', '/books', {
      id: 1,
      cover: { key: 'unknown.txt' }
    })
    expect(response.status).toBe(400)
    expect(await database.db.selectFrom('book').selectAll().execute()).toEqual(
      []
    )
  })

  it('answers values that are not files with 400', async () => {
    const response = await write('POST', '/books', { id: 1, cover: 'text' })
    expect(response.status).toBe(400)
    expect((await response.json()).errors).toHaveProperty('cover')
  })

  it('adds no routes', async () => {
    const response = await api.fetch(
      new Request('http://localhost/books/upload/cover', {
        method: 'POST',
        body: new FormData()
      })
    )
    expect(response.status).toBe(404)
  })

  it('takes uploads from the mixin of `defineUploads()`', async () => {
    const uploads = createApi({
      controllers: [
        defineModelController({
          path: 'books',
          entity: Book,
          authorize: true,
          mixins: [crud, assets.defineUploads()]
        })
      ],
      adapter,
      onError: () => {}
    })
    const body = new FormData()
    body.append('file', new File(['Front'], 'front.txt'))
    const response = await uploads.fetch(
      new Request('http://localhost/books/upload/cover', {
        method: 'POST',
        body
      })
    )
    const [file] = await response.json()
    expect(file).toMatchObject({ name: 'front.txt', size: 5 })
  })

  it('finds the paths of the controller in one `defineUploads()`', async () => {
    const mixin = assets.defineUploads()
    const uploads = createApi({
      controllers: [
        defineModelController({
          path: 'books',
          entity: Book,
          authorize: true,
          mixins: [crud, mixin]
        }),
        defineModelController({
          path: 'shelves',
          entity: Shelf,
          authorize: true,
          mixins: [crud, mixin]
        })
      ],
      adapter,
      onError: () => {}
    })
    const upload = (url: string) => {
      const body = new FormData()
      body.append('file', new File(['Front'], 'front.txt'))
      return uploads.fetch(
        new Request(`http://localhost/${url}`, { method: 'POST', body })
      )
    }
    expect((await upload('books/upload/cover')).status).toBe(200)
    expect((await upload('shelves/upload/label')).status).toBe(200)
    expect((await upload('shelves/upload/cover')).status).toBe(404)
  })
})
