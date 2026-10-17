import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ModelProperties, StorageConfig } from '@ditojs/server'
import { Model, AssetMixin, AssetFile, Storage } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

// Storage configs are typed per built-in storage type only, so we cast them:
class MemoryStorage extends Storage {
  dataByKey = new Map<string, Buffer>()

  async _addFile(file: AssetFile, data: Buffer) {
    this.dataByKey.set(file.key, data)
  }

  async _removeFile(file: AssetFile) {
    this.dataByKey.delete(file.key)
  }

  async _readFile(file: AssetFile) {
    const data = this.dataByKey.get(file.key)
    if (!data) {
      throw new Error(`Unknown key: '${file.key}'`)
    }
    return data
  }

  async _listKeys() {
    return [...this.dataByKey.keys()]
  }
}

// Model classes are bound to one app, so each test app gets its own classes.
function createDocumentClass() {
  return class Document extends Model {
    declare id: number
    declare file: AssetFile | null

    static override properties: ModelProperties = {
      file: {
        type: 'object',
        nullable: true
      }
    }

    static override assets = {
      file: { storage: 'memory' }
    }
  }
}

function createApp(models: Record<string, any>) {
  const app = createTestApp({ models })
  app.addStorage(new MemoryStorage(app, 'memory', {} as StorageConfig))
  return app
}

describe('asset handling without an Asset model', () => {
  const Document = createDocumentClass()
  const app = createApp({ Document })

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  it('inserts, updates and deletes items with asset data paths', async () => {
    const document = await Document.query().insertAndFetch({
      file: AssetFile.create({ name: 'first.txt', data: 'first' })
    })
    expect(document.file?.name).toBe('first.txt')
    await Document.query().patchAndFetchById(document.id, {
      file: AssetFile.create({ name: 'second.txt', data: 'second' })
    })
    await Document.query().deleteById(document.id)
    expect(await Document.query()).toEqual([])
  })

  it('returns arrays from all asset methods', async () => {
    const storage = app.getStorage('memory')!
    const file = AssetFile.create({ name: 'file.txt', data: 'data' })
    expect(await app.createAssets(storage, [file])).toEqual([])
    expect(
      await app.handleAddedAndRemovedAssets(storage, [file], [], [])
    ).toEqual([])
    expect(await app.addForeignAssets(storage, [file])).toEqual([])
    expect(await app.handleModifiedAssets(storage, [file])).toEqual([])
    expect(await app.releaseUnusedAssets()).toEqual([])
  })
})

describe('asset handling with an Asset model', () => {
  const Document = createDocumentClass()
  class Asset extends AssetMixin(Model) {}
  const app = createApp({ Document, Asset })

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  it('imports added files and counts their references', async () => {
    const document = await Document.query().insertAndFetch({
      file: AssetFile.create({ name: 'counted.txt', data: 'counted' })
    })
    const key = document.file!.key
    const storage = app.getStorage('memory') as MemoryStorage
    expect(storage.dataByKey.get(key)?.toString()).toBe('counted')
    const asset = await Asset.query().findOne('key', key)
    expect(asset).toMatchObject({ count: 1, storage: 'memory' })
  })

  it('runs app overrides of the asset methods on model writes', async () => {
    // Spies replace the methods on the app instance, just like overrides in
    // an Application subclass, and call through to the originals.
    const methodNames = [
      'handleAddedAndRemovedAssets',
      'handleModifiedAssets',
      'addForeignAssets',
      'createAssets',
      'releaseUnusedAssets'
    ] as const
    const spies = methodNames.map(name => vi.spyOn(app, name))
    try {
      const document = await Document.query().insertAndFetch({
        file: AssetFile.create({ name: 'overridden.txt', data: 'before' })
      })
      const modifiedFile = AssetFile.create({
        name: 'overridden.txt',
        data: 'after'
      })
      modifiedFile.key = document.file!.key
      await Document.query().patchById(document.id, { file: modifiedFile })
      for (const spy of spies) {
        expect(spy).toHaveBeenCalled()
      }
      const storage = app.getStorage('memory') as MemoryStorage
      expect(storage.dataByKey.get(modifiedFile.key)?.toString()).toBe('after')
    } finally {
      for (const spy of spies) {
        spy.mockRestore()
      }
    }
  })

  it('warns about modified files that cannot be restored on rollback', async () => {
    const document = await Document.query().insertAndFetch({
      file: AssetFile.create({ name: 'original.txt', data: 'original' })
    })
    const modifiedFile = AssetFile.create({
      name: 'original.txt',
      data: 'modified'
    })
    modifiedFile.key = document.file!.key

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const trx = await Document.startTransaction()
      await Document.query(trx).patchById(document.id, { file: modifiedFile })
      await trx.rollback()
      // The 'rollback' event is emitted by the `createTransaction()`
      // middleware, which is not involved here, so call the listeners directly.
      const error = new Error('Rolled back')
      await Promise.all(
        trx.listeners('rollback').map(listener => listener(error))
      )
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Unable to restore these already modified files: 'original.txt'`
        )
      )
    } finally {
      warn.mockRestore()
    }
  })
})

describe('Application.addStorage()', () => {
  const app = createTestApp()

  afterAll(async () => {
    await destroyTestApp(app)
  })

  it('names the type of an unsupported storage', () => {
    expect(() =>
      app.addStorage(
        { type: 'unknown' } as unknown as StorageConfig,
        'files'
      )
    ).toThrow(
      `Unsupported storage: 'unknown'`
    )
  })
})

describe('Asset handling', () => {
  const Document = createDocumentClass()
  class Asset extends AssetMixin(Model) {}
  const app = createTestApp({ models: { Document, Asset } })
  const allowedImports: string[] = ['https://covers.example.com/**']
  // Without `url`, so that signed files have no url to match the imports.
  const storage = new MemoryStorage(app, 'memory', {
    allowedImports
  } as unknown as StorageConfig)
  app.addStorage(storage)
  let importDirectory: string

  beforeAll(async () => {
    await createTestDatabase(app)
    importDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-import-'))
    allowedImports.push(`file://${importDirectory}/**`)
  })

  afterAll(async () => {
    await destroyTestApp(app)
    await fs.rm(importDirectory, { recursive: true, force: true })
  })

  function createForeignFile(name: string, url?: string) {
    return {
      key: `${name}-${Math.random().toString(36).slice(2)}`,
      name,
      type: 'text/plain',
      ...(url && { url })
    } as AssetFile
  }

  // Stores and signs a file like an upload, as expected by `createAssets()`.
  async function createUploadedFile(name: string, data: string) {
    const file = AssetFile.create({ name, data })
    await storage.addFile(file, Buffer.from(data))
    storage.signAssetFile(file)
    return file
  }

  describe('addForeignAssets()', () => {
    it('imports files from allowed file urls', async () => {
      const filePath = path.join(importDirectory, 'chapter.txt')
      await fs.writeFile(filePath, 'Chapter one')
      const file = createForeignFile('chapter.txt', `file://${filePath}`)
      const info = vi.spyOn(app.logger, 'info').mockImplementation(() => {})
      try {
        const [imported] = await app.addForeignAssets(storage, [file])
        expect(storage.dataByKey.get(file.key)?.toString()).toBe(
          'Chapter one'
        )
        expect(imported).toMatchObject({ key: file.key, size: 11 })
        // The imported file properties are merged back into the passed file.
        expect(file.size).toBe(11)
        expect(storage.verifyAssetFile(file)).toBe(true)
        expect(await Asset.query().findOne('key', file.key)).toMatchObject({
          count: 0,
          storage: 'memory'
        })
        expect(info).toHaveBeenCalledWith(
          expect.stringContaining('is from a foreign source')
        )
      } finally {
        info.mockRestore()
      }
    })

    it('imports files from allowed remote urls', async () => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('Remote cover'))
      const info = vi.spyOn(app.logger, 'info').mockImplementation(() => {})
      const url = 'https://covers.example.com/novel.txt'
      const file = createForeignFile('novel.txt', url)
      try {
        const imported = await app.addForeignAssets(storage, [file])
        expect(fetch).toHaveBeenCalledWith(url)
        expect(imported).toHaveLength(1)
        expect(storage.dataByKey.get(file.key)?.toString()).toBe(
          'Remote cover'
        )
      } finally {
        fetch.mockRestore()
        info.mockRestore()
      }
    })

    it('rejects files from sources that are not allowed', async () => {
      const file = createForeignFile(
        'secret.txt',
        'https://elsewhere.example.com/secret.txt'
      )
      await expect(app.addForeignAssets(storage, [file])).rejects.toThrow(
        `Unable to import asset from foreign source: 'secret.txt' ` +
        `('https://elsewhere.example.com/secret.txt'): ` +
        'The source needs to be explicitly allowed.'
      )
      expect(storage.dataByKey.has(file.key)).toBe(false)
    })

    it('rejects imported files of model writes with other key formats', async () => {
      const fetch = vi.spyOn(globalThis, 'fetch')
      try {
        await expect(
          Document.query().insert({
            file: {
              key: '../escape.txt',
              name: 'escape.txt',
              type: 'text/plain',
              url: 'https://covers.example.com/escape.txt'
            } as AssetFile
          })
        ).rejects.toThrow(`Invalid asset key for file 'escape.txt'`)
        expect(fetch).not.toHaveBeenCalled()
        expect(storage.dataByKey.has('../escape.txt')).toBe(false)
      } finally {
        fetch.mockRestore()
      }
    })

    it('rejects unknown files without data or url', async () => {
      const file = createForeignFile('lost.txt')
      await expect(app.addForeignAssets(storage, [file])).rejects.toThrow(
        `Unable to import asset from foreign source: 'lost.txt' ` +
        `('${file.key}')`
      )
    })

    it('reuses already imported assets for all files with the same key', async () => {
      const [asset]: any[] = await app.createAssets(storage, [
        await createUploadedFile('known.txt', 'known')
      ])
      const first = { key: asset.key, name: 'first.txt' } as AssetFile
      const second = { key: asset.key, name: 'second.txt' } as AssetFile
      const imported = await app.addForeignAssets(storage, [first, second])
      expect(imported).toEqual([])
      expect(first).toMatchObject({ name: 'known.txt', type: 'text/plain' })
      expect(second).toMatchObject({ name: 'known.txt', type: 'text/plain' })
    })
  })

  describe('handleModifiedAssets()', () => {
    it('ignores files without data', async () => {
      const file = createForeignFile('unchanged.txt')
      expect(await app.handleModifiedAssets(storage, [file])).toEqual([])
    })

    it('rejects modified files without an asset', async () => {
      const file = AssetFile.create({ name: 'orphan.txt', data: 'orphan' })
      await expect(app.handleModifiedAssets(storage, [file])).rejects.toThrow(
        `Unable to update modified asset from memory source: 'orphan.txt' ` +
        `('${file.key}')`
      )
    })
  })

  describe('handleAddedAndRemovedAssets()', () => {
    it('schedules the release of unused assets after the cleanup time', async () => {
      const assets = app.config.assets!
      const { cleanupTimeThreshold } = assets
      assets.cleanupTimeThreshold = '1ms'
      const release = vi.spyOn(app, 'releaseUnusedAssets')
      try {
        const [asset]: any[] = await app.createAssets(storage, [
          await createUploadedFile('scheduled.txt', 'scheduled')
        ])
        await app.handleAddedAndRemovedAssets(storage, [asset.file], [], [])
        expect(release).not.toHaveBeenCalled()
        await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1))
        expect(release).toHaveBeenLastCalledWith()
      } finally {
        assets.cleanupTimeThreshold = cleanupTimeThreshold
        release.mockRestore()
      }
    })

    it('schedules no release without cleanup time', async () => {
      const assets = app.config.assets!
      const { cleanupTimeThreshold } = assets
      assets.cleanupTimeThreshold = 0
      const release = vi.spyOn(app, 'releaseUnusedAssets')
      try {
        const [asset]: any[] = await app.createAssets(storage, [
          await createUploadedFile('instant.txt', 'instant')
        ])
        await app.handleAddedAndRemovedAssets(storage, [], [asset.file], [])
        // Give a wrongly scheduled release the time to happen.
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(release).not.toHaveBeenCalled()
      } finally {
        assets.cleanupTimeThreshold = cleanupTimeThreshold
        release.mockRestore()
      }
    })
  })

  describe('releaseUnusedAssets()', () => {
    it('removes unreferenced assets and their files', async () => {
      const file = await createUploadedFile('unused.txt', 'unused')
      await app.createAssets(storage, [file], 0)
      const released: any[] = await app.releaseUnusedAssets({
        timeThreshold: 0
      })
      expect(released.map(asset => asset.key)).toContain(file.key)
      expect(storage.dataByKey.has(file.key)).toBe(false)
      expect(await Asset.query().findOne('key', file.key)).toBeUndefined()
    })

    it('keeps referenced assets', async () => {
      const file = await createUploadedFile('used.txt', 'used')
      await app.createAssets(storage, [file], 1)
      const released: any[] = await app.releaseUnusedAssets({
        timeThreshold: 0
      })
      expect(released.map(asset => asset.key)).not.toContain(file.key)
      expect(await Asset.query().findOne('key', file.key)).toBeDefined()
    })

    it('emits errors of files that cannot be removed', async () => {
      const file = await createUploadedFile('stuck.txt', 'stuck')
      await app.createAssets(storage, [file], 0)
      const error = new Error('Storage is read-only')
      const removeFile = vi
        .spyOn(storage, 'removeFile')
        .mockRejectedValue(error)
      const onError = vi.fn()
      app.on('error', onError)
      try {
        const released: any[] = await app.releaseUnusedAssets({
          timeThreshold: 0
        })
        const asset = released.find(asset => asset.key === file.key)
        expect(asset?.error).toBe(error)
        expect(onError).toHaveBeenCalledWith(error)
        // The asset is deleted nevertheless.
        expect(await Asset.query().findOne('key', file.key)).toBeUndefined()
      } finally {
        app.off('error', onError)
        removeFile.mockRestore()
      }
    })
  })

  describe('rollback handling', () => {
    it('removes imported files again when the transaction is rolled back', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      try {
        const trx = await Document.startTransaction()
        const document = await Document.query(trx).insertAndFetch({
          file: AssetFile.create({ name: 'draft.txt', data: 'draft' })
        })
        const { key } = document.file!
        expect(storage.dataByKey.has(key)).toBe(true)
        await trx.rollback()
        // Emitted by the `createTransaction()` middleware, see above.
        const error = new Error('Rolled back')
        await Promise.all(
          trx.listeners('rollback').map(listener => listener(error))
        )
        expect(storage.dataByKey.has(key)).toBe(false)
        expect(info).toHaveBeenCalledWith(
          `Received 'Error: Rolled back', removing imported files again: ` +
          `'draft.txt'`
        )
      } finally {
        info.mockRestore()
      }
    })
  })
})

describe('asset handling across storages', () => {
  class Book extends Model {
    declare id: number
    declare cover: AssetFile | null
    declare scan: AssetFile | null

    static override properties: ModelProperties = {
      cover: { type: 'object', nullable: true },
      scan: { type: 'object', nullable: true }
    }

    static override assets = {
      cover: { storage: 'covers' },
      scan: { storage: 'scans' }
    }
  }
  class Asset extends AssetMixin(Model) {}
  const app = createTestApp({ models: { Book, Asset } })
  const covers = new MemoryStorage(app, 'covers', {} as StorageConfig)
  const scans = new MemoryStorage(app, 'scans', {} as StorageConfig)
  app.addStorage(covers)
  app.addStorage(scans)

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  // Returns the cover as the admin sends it back, signed:
  async function createCover(data: string) {
    const book = await Book.query().insertAndFetch({
      cover: AssetFile.create({ name: 'cover.txt', data })
    })
    return JSON.parse(JSON.stringify(book)).cover as AssetFile
  }

  it('copies files of other storages under a new key', async () => {
    const cover = await createCover('Emma')
    const info = vi.spyOn(app.logger, 'info').mockImplementation(() => {})
    try {
      // The copy's properties are merged into the passed file:
      const coverKey = cover.key
      const book = await Book.query().insertAndFetch({ scan: cover })
      const { key } = book.scan!
      expect(key).not.toBe(coverKey)
      expect(scans.dataByKey.get(key)?.toString()).toBe('Emma')
      expect(await Asset.query().findOne('key', key)).toMatchObject({
        count: 1,
        storage: 'scans'
      })
      expect(await Asset.query().findOne('key', coverKey)).toMatchObject({
        count: 1,
        storage: 'covers'
      })
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('is from storage')
      )
    } finally {
      info.mockRestore()
    }
  })

  it('reuses files of the same storage', async () => {
    const cover = await createCover('Persuasion')
    const book = await Book.query().insertAndFetch({ cover })
    expect(book.cover!.key).toBe(cover.key)
    expect(covers.dataByKey.get(cover.key)?.toString()).toBe('Persuasion')
    expect(covers.dataByKey.size).toBe(2)
    expect(await Asset.query().findOne('key', cover.key)).toMatchObject({
      count: 2,
      storage: 'covers'
    })
  })
})

describe('asset reference counting', () => {
  class Album extends Model {
    declare id: number
    declare cover: AssetFile | null
    declare photos: AssetFile[] | null
    declare tracks: Track[]

    static override properties: ModelProperties = {
      cover: { type: 'object', nullable: true },
      photos: { type: 'array', items: { type: 'object' }, nullable: true }
    }

    static override relations = {
      tracks: {
        relation: 'hasMany',
        from: 'Album.id',
        to: 'Track.albumId',
        owner: true
      }
    } as any

    static override assets = {
      cover: { storage: 'memory' },
      photos: { storage: 'memory' }
    }
  }

  class Track extends Model {
    declare id: number
    declare albumId: number | null
    declare artwork: AssetFile | null

    static override properties: ModelProperties = {
      albumId: { type: 'integer', nullable: true },
      artwork: { type: 'object', nullable: true }
    }

    static override assets = {
      artwork: { storage: 'memory' }
    }
  }

  class Asset extends AssetMixin(Model) {}
  const app = createApp({ Album, Track, Asset })
  const storage = app.getStorage('memory') as MemoryStorage

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  // Stores a file like the upload route, and returns it as the admin sends it
  // back, signed and not persisted yet:
  async function upload(name: string) {
    const file = AssetFile.create({ name, data: name })
    await storage.addFile(file, Buffer.from(name))
    storage.signAssetFile(file)
    await app.createAssets(storage, [file], 0)
    // Uploads happen before their data is saved, and the release tells never
    // persisted assets by `updatedAt = createdAt`, so backdate both:
    const date = new Date(Date.now() - 1000)
    await Asset.knex()(Asset.tableName)
      .where('key', file.key)
      .update({ createdAt: date, updatedAt: date })
    return copy(file)
  }

  // Copies data like the clipboard, through JSON:
  function copy<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }

  async function getCount(file: AssetFile) {
    const asset = await Asset.query().findOne('key', file.key)
    return asset?.count
  }

  async function withCleanupTimeThreshold(
    threshold: string | number,
    callback: () => Promise<void>
  ) {
    const assets = app.config.assets!
    const { cleanupTimeThreshold } = assets
    assets.cleanupTimeThreshold = threshold
    try {
      await callback()
    } finally {
      assets.cleanupTimeThreshold = cleanupTimeThreshold
    }
  }

  it('counts one asset for an upload stored in several records', async () => {
    const file = await upload('shared.jpg')
    await Album.query().insert({ cover: copy(file) })
    await Album.query().insert({ cover: copy(file) })
    expect(await Asset.query().where('key', file.key)).toHaveLength(1)
    expect(await getCount(file)).toBe(2)
  })

  it('reuses persisted assets stored in other records', async () => {
    const album = await Album.query().insertAndFetch({
      cover: await upload('persisted.jpg')
    })
    const { cover } = copy(album)
    await Album.query().insert({ cover })
    expect(await getCount(cover!)).toBe(2)
  })

  it('counts down when files are replaced or records deleted', async () => {
    const file = await upload('replaced.jpg')
    const first = await Album.query().insertAndFetch({ cover: copy(file) })
    const second = await Album.query().insertAndFetch({ cover: copy(file) })
    const other = await upload('other.jpg')
    await Album.query().patchById(first.id, { cover: other })
    expect(await getCount(file)).toBe(1)
    expect(await getCount(other)).toBe(1)
    await Album.query().deleteById(second.id)
    expect(await getCount(file)).toBe(0)
    await Album.query().patchById(first.id, { cover: null })
    expect(await getCount(other)).toBe(0)
  })

  it('counts each occurrence of a file in one property', async () => {
    const file = await upload('repeated.jpg')
    const album = await Album.query().insertAndFetch({
      photos: [copy(file), copy(file)]
    })
    expect(await getCount(file)).toBe(2)
    await Album.query().patchById(album.id, {
      photos: [copy(file), copy(file), copy(file)]
    })
    expect(await getCount(file)).toBe(3)
    await Album.query().patchById(album.id, { photos: [copy(file)] })
    expect(await getCount(file)).toBe(1)
    await Album.query().patchById(album.id, { photos: [] })
    expect(await getCount(file)).toBe(0)
  })

  it('counts added and removed files of several keys together', async () => {
    const first = await upload('first.jpg')
    const second = await upload('second.jpg')
    const album = await Album.query().insertAndFetch({
      photos: [copy(first), copy(first), copy(second)]
    })
    expect(await getCount(first)).toBe(2)
    expect(await getCount(second)).toBe(1)
    await Album.query().patchById(album.id, {
      photos: [copy(second), copy(second), copy(second)]
    })
    expect(await getCount(first)).toBe(0)
    expect(await getCount(second)).toBe(3)
  })

  it('counts a file stored in several properties of a record', async () => {
    const file = await upload('cover-and-photo.jpg')
    const album = await Album.query().insertAndFetch({
      cover: copy(file),
      photos: [copy(file)]
    })
    expect(await getCount(file)).toBe(2)
    await Album.query().patchById(album.id, { cover: null })
    expect(await getCount(file)).toBe(1)
  })

  it('counts a file stored in several records of a graph', async () => {
    const file = await upload('artwork.jpg')
    const album = await Album.query().insertGraphAndFetch({
      tracks: [{ artwork: copy(file) }, { artwork: copy(file) }]
    })
    expect(await getCount(file)).toBe(2)
    await Track.query().deleteById(album.tracks[0].id)
    expect(await getCount(file)).toBe(1)
    await Track.query().deleteById(album.tracks[1].id)
    expect(await getCount(file)).toBe(0)
  })

  it('counts a file in all records that a query deletes', async () => {
    const file = await upload('deleted.jpg')
    const albums = await Promise.all([
      Album.query().insertAndFetch({ cover: copy(file) }),
      Album.query().insertAndFetch({ cover: copy(file) }),
      Album.query().insertAndFetch({ cover: copy(file) })
    ])
    expect(await getCount(file)).toBe(3)
    const ids = albums.map(album => album.id)
    await Album.query().whereIn('id', ids).delete()
    expect(await getCount(file)).toBe(0)
  })

  it('counts a file in all records that a query patches', async () => {
    const file = await upload('patched.jpg')
    const albums = await Promise.all([
      Album.query().insertAndFetch({ cover: null }),
      Album.query().insertAndFetch({ cover: null })
    ])
    const ids = albums.map(album => album.id)
    await Album.query()
      .whereIn('id', ids)
      .patch({ cover: copy(file) })
    expect(await getCount(file)).toBe(2)
    await Album.query().whereIn('id', ids).patch({ cover: null })
    expect(await getCount(file)).toBe(0)
  })

  it('counts no references for patches without records', async () => {
    const file = await upload('missing.jpg')
    await Album.query().patchById(-1, { cover: copy(file) })
    expect(await getCount(file)).toBe(0)
  })

  it('releases files right after their last reference without cleanup time', async () => {
    await withCleanupTimeThreshold(0, async () => {
      const album = await Album.query().insertAndFetch({
        cover: await upload('released.jpg')
      })
      const { key } = album.cover!
      await Album.query().patchById(album.id, { cover: null })
      expect(await Asset.query().findOne('key', key)).toBeUndefined()
      expect(storage.dataByKey.has(key)).toBe(false)
    })
  })

  it('keeps unsaved uploads for the dangling time without cleanup time', async () => {
    await withCleanupTimeThreshold(0, async () => {
      const pending = await upload('pending.jpg')
      // Saving any other files releases unused assets:
      await Album.query().insert({ cover: await upload('saved.jpg') })
      expect(await getCount(pending)).toBe(0)
      expect(storage.dataByKey.has(pending.key)).toBe(true)
      await Album.query().insert({ cover: pending })
      expect(await getCount(pending)).toBe(1)
    })
  })

  it('keeps released files for the cleanup time', async () => {
    const album = await Album.query().insertAndFetch({
      cover: await upload('restored.jpg')
    })
    // The copy of a deleted record can be stored again:
    const { cover } = copy(album)
    await Album.query().deleteById(album.id)
    expect(await getCount(cover!)).toBe(0)
    await app.releaseUnusedAssets()
    await Album.query().insert({ cover })
    expect(await getCount(cover!)).toBe(1)
  })
})

describe('asset references', () => {
  class Album extends Model {
    declare id: number
    declare cover: AssetFile | null
    declare photos: (AssetFile | null)[] | null

    static override properties: ModelProperties = {
      cover: { type: 'object', nullable: true },
      photos: {
        type: 'array',
        items: { type: 'object', nullable: true },
        nullable: true
      }
    }

    static override assets = {
      cover: { storage: 'memory', readDimensions: true },
      photos: { storage: 'memory' }
    }
  }

  class Track extends Model {
    declare id: number
    declare artwork: AssetFile | null

    static override properties: ModelProperties = {
      artwork: { type: 'object', nullable: true }
    }

    static override assets = {
      artwork: { storage: 'memory' }
    }
  }

  class Clip extends Model {
    declare id: number
    declare hidden: boolean
    declare video: AssetFile | null

    static override properties: ModelProperties = {
      hidden: { type: 'boolean', default: false },
      video: { type: 'object', nullable: true }
    }

    static override scopes = {
      default: (query: any) => query.where('hidden', false)
    }

    static override assets = {
      video: { storage: 'memory' }
    }
  }

  class Page extends Model {
    declare id: number
    declare content: Record<string, any> | null

    static override properties: ModelProperties = {
      content: { type: 'object', nullable: true }
    }

    static override assets = {
      '**.file': { storage: 'memory' },
      '**.files': { storage: 'memory' }
    }
  }

  class Article extends Model {
    declare id: number
    declare content: Record<string, any> | null

    static override properties: ModelProperties = {
      content: { type: 'object', nullable: true }
    }

    // Overlapping data paths that both reach the files of `content.items`:
    static override assets = {
      'content.items[**].file': { storage: 'memory', readDimensions: true },
      '**.file': { storage: 'memory' }
    }
  }

  class Brochure extends Model {
    declare id: number
    declare content: Record<string, any> | null

    static override properties: ModelProperties = {
      content: { type: 'object', nullable: true }
    }

    // Overlapping data paths with different storages:
    static override assets = {
      'content.items[**].file': { storage: 'memory' },
      '**.file': { storage: 'other' }
    }
  }

  class Asset extends AssetMixin(Model) {}
  const app = createApp({
    Album,
    Track,
    Clip,
    Page,
    Article,
    Brochure,
    Asset
  })
  app.addStorage(new MemoryStorage(app, 'other', {} as StorageConfig))
  const storage = app.getStorage('memory') as MemoryStorage

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  // Stores a file like the upload route, and returns it as the admin sends it
  // back, signed and not persisted yet:
  async function upload(name: string) {
    const file = AssetFile.create({ name, data: name })
    await storage.addFile(file, Buffer.from(name))
    storage.signAssetFile(file)
    await app.createAssets(storage, [file], 0)
    // Uploads happen before their data is saved, and the release tells never
    // persisted assets by `updatedAt = createdAt`, so backdate both:
    const date = new Date(Date.now() - 1000)
    await Asset.knex()(Asset.tableName)
      .where('key', file.key)
      .update({ createdAt: date, updatedAt: date })
    return copy(file)
  }

  // Copies data like the clipboard, through JSON:
  function copy<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }

  async function getCount(file: AssetFile) {
    const asset = await Asset.query().findOne('key', file.key)
    return asset?.count
  }

  async function withCleanupTimeThreshold(
    threshold: string | number,
    callback: () => Promise<void>
  ) {
    const assets = app.config.assets!
    const { cleanupTimeThreshold } = assets
    assets.cleanupTimeThreshold = threshold
    try {
      await callback()
    } finally {
      assets.cleanupTimeThreshold = cleanupTimeThreshold
    }
  }

  // Simulates writes that skip the asset hooks, e.g. of scripts and seeds:
  async function insertWithoutHooks(data: Record<string, unknown>) {
    const [row] = await Track.knex()(Track.tableName)
      .insert({ artwork: JSON.stringify(data.artwork) })
      .returning('id')
    return row.id ?? row
  }

  it('finds every place that stores a file', async () => {
    const file = await upload('everywhere.jpg')
    const other = await upload('elsewhere.jpg')
    const album = await Album.query().insertAndFetch({
      cover: copy(file),
      photos: [copy(other), copy(file)]
    })
    const track = await Track.query().insertAndFetch({ artwork: copy(file) })
    const references = await app.getAssetReferences({ keys: [file.key] })
    expect(
      references.map(({ model, id, dataPath, storage }) => ({
        model,
        id,
        dataPath,
        storage
      }))
    ).toEqual(
      expect.arrayContaining([
        { model: 'Album', id: album.id, dataPath: 'cover', storage: 'memory' },
        {
          model: 'Album',
          id: album.id,
          dataPath: 'photos/1',
          storage: 'memory'
        },
        {
          model: 'Track',
          id: track.id,
          dataPath: 'artwork',
          storage: 'memory'
        }
      ])
    )
    expect(references).toHaveLength(3)
    expect(references[0]).toMatchObject({
      key: file.key,
      file: { key: file.key }
    })
  })

  it('includes the asset config that each file was found through', async () => {
    const file = await upload('configured.jpg')
    await Album.query().insert({ cover: copy(file), photos: [copy(file)] })
    const references = await app.getAssetReferences({ keys: [file.key] })
    expect(
      references.map(({ dataPath, config }) => ({ dataPath, config }))
    ).toEqual(
      expect.arrayContaining([
        {
          dataPath: 'cover',
          config: { storage: 'memory', readDimensions: true }
        },
        { dataPath: 'photos/0', config: { storage: 'memory' } }
      ])
    )
  })

  it('matches keys exactly, not as text', async () => {
    const file = await upload('exact.jpg')
    // The name contains the key, which the text search finds:
    const other = await upload('other.jpg')
    await Track.query().insert({
      artwork: { ...copy(other), name: file.key } as AssetFile
    })
    expect(await app.getAssetReferences({ keys: [file.key] })).toEqual([])
  })

  it('finds the references of all files without keys', async () => {
    const file = await upload('listed.jpg')
    await Track.query().insert({ artwork: copy(file) })
    const references = await app.getAssetReferences({ models: ['Track'] })
    expect(references.map(reference => reference.key)).toContain(file.key)
    expect(references.every(reference => reference.model === 'Track')).toBe(
      true
    )
  })

  it('rejects unknown models', async () => {
    await expect(
      app.getAssetReferences({ models: ['Unknown'] })
    ).rejects.toThrow(`Unknown model: 'Unknown'.`)
  })

  it('filters references by storage', async () => {
    const file = await upload('stored.jpg')
    await Track.query().insert({ artwork: copy(file) })
    expect(
      await app.getAssetReferences({ keys: [file.key], storage: 'other' })
    ).toEqual([])
    expect(
      await app.getAssetReferences({ keys: [file.key], storage: 'memory' })
    ).toHaveLength(1)
  })

  it('keeps referenced files and corrects their count', async () => {
    const warn = vi.spyOn(app.logger, 'warn').mockImplementation(() => {})
    try {
      await withCleanupTimeThreshold(0, async () => {
        const file = await upload('missed.jpg')
        const track = await Track.query().insertAndFetch({
          artwork: copy(file)
        })
        await insertWithoutHooks({ artwork: copy(file) })
        // Removing the counted reference would release the file right away:
        await Track.query().deleteById(track.id)
        expect(await getCount(file)).toBe(1)
        expect(storage.dataByKey.has(file.key)).toBe(true)
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('has 1 references but a count of 0')
        )
      })
    } finally {
      warn.mockRestore()
    }
  })

  it('recounts the references of all assets', async () => {
    const missed = await upload('recount-missed.jpg')
    const left = await upload('recount-left.jpg')
    const pending = await upload('recount-pending.jpg')
    await Track.query().insert({ artwork: copy(missed) })
    await insertWithoutHooks({ artwork: copy(missed) })
    const track = await Track.query().insertAndFetch({ artwork: copy(left) })
    await Track.knex()(Track.tableName).where('id', track.id).delete()
    const { changed, missing } = await app.recountAssets()
    const countsByKey = Object.fromEntries(
      changed.map(({ asset, count }) => [asset.key, [asset.count, count]])
    )
    expect(countsByKey[missed.key]).toEqual([1, 2])
    expect(countsByKey[left.key]).toEqual([1, 0])
    expect(countsByKey[pending.key]).toBeUndefined()
    expect(missing).toEqual([])
    expect((await Asset.query().findOne('key', missed.key))?.count).toBe(2)
    expect((await Asset.query().findOne('key', left.key))?.count).toBe(0)
    expect((await app.recountAssets()).changed).toEqual([])
  })

  it('only reports wrong counts in a dry run', async () => {
    const file = await upload('recount-dry.jpg')
    await insertWithoutHooks({ artwork: copy(file) })
    const { changed } = await app.recountAssets({ dryRun: true })
    expect(changed).toContainEqual({
      asset: expect.objectContaining({ key: file.key, count: 0 }),
      count: 1
    })
    expect((await Asset.query().findOne('key', file.key))?.count).toBe(0)
    await app.recountAssets()
  })

  it('creates the missing assets of referenced files', async () => {
    const file = await upload('recount-missing.jpg')
    const track = await Track.query().insertAndFetch({ artwork: copy(file) })
    await Asset.knex()(Asset.tableName).where('key', file.key).delete()
    // Files without assets can't be stored in other places:
    const { artwork } = copy(track)
    await expect(Track.query().insert({ artwork })).rejects.toThrow(
      `Unable to import asset from foreign source: 'recount-missing.jpg'`
    )
    const { missing } = await app.recountAssets()
    expect(missing).toEqual([
      {
        key: file.key,
        references: [expect.objectContaining({ id: track.id })]
      }
    ])
    expect(await Asset.query().findOne('key', file.key)).toMatchObject({
      count: 1,
      storage: 'memory',
      file: { name: 'recount-missing.jpg' }
    })
    await Track.query().insert({ artwork: copy(track).artwork })
    expect((await Asset.query().findOne('key', file.key))?.count).toBe(2)
  })

  it('reports referenced files that are lost from their storage', async () => {
    const file = await upload('recount-lost.jpg')
    const track = await Track.query().insertAndFetch({ artwork: copy(file) })
    await Asset.knex()(Asset.tableName).where('key', file.key).delete()
    storage.dataByKey.delete(file.key)
    const { missing, lost } = await app.recountAssets()
    expect(missing).toEqual([])
    expect(lost).toEqual([
      {
        key: file.key,
        references: [expect.objectContaining({ id: track.id })]
      }
    ])
    expect(await Asset.query().findOne('key', file.key)).toBeUndefined()
  })

  it('finds files of records that default scopes hide', async () => {
    const file = await upload('hidden.mp4')
    await Clip.query().insert({ hidden: true, video: copy(file) })
    const references = await app.getAssetReferences({ keys: [file.key] })
    expect(references).toHaveLength(1)
    expect(references[0]).toMatchObject({ model: 'Clip', dataPath: 'video' })
  })

  it('finds keys that JSON escapes', async () => {
    const file = await upload('quoted."x\\y')
    await Track.query().insert({ artwork: copy(file) })
    expect(
      await app.getAssetReferences({ keys: [file.key] })
    ).toHaveLength(1)
  })

  it('counts and finds files at wildcard data paths', async () => {
    const file = await upload('nested.jpg')
    const page = await Page.query().insertAndFetch({
      content: {
        header: { file: copy(file) },
        items: [{ file: copy(file) }, { text: 'Text' }]
      }
    })
    expect(await getCount(file)).toBe(2)
    const references = await app.getAssetReferences({ keys: [file.key] })
    expect(references.map(reference => reference.dataPath).sort()).toEqual([
      'content/header/file',
      'content/items/0/file'
    ])
    await Page.query().patchById(page.id, { content: {} })
    expect(await getCount(file)).toBe(0)
  })

  it('counts each location of overlapping data paths once', async () => {
    const file = await upload('overlapping.jpg')
    const article = await Article.query().insertAndFetch({
      content: { items: [{ file: copy(file) }] }
    })
    expect(await getCount(file)).toBe(1)
    await Article.query().patchById(article.id, {
      content: { items: [{ file: copy(file) }, { file: copy(file) }] }
    })
    expect(await getCount(file)).toBe(2)
    await Article.query().patchById(article.id, {
      content: { items: [{ file: copy(file) }] }
    })
    expect(await getCount(file)).toBe(1)
    await Article.query().patchById(article.id, { content: { items: [] } })
    expect(await getCount(file)).toBe(0)
    await Article.query().patchById(article.id, {
      content: { items: [{ file: copy(file) }] }
    })
    expect(await getCount(file)).toBe(1)
    await Article.query().deleteById(article.id)
    expect(await getCount(file)).toBe(0)
  })

  it('finds each location of overlapping data paths once, through the first', async () => {
    const file = await upload('overlapping-found.jpg')
    // Skip the asset hooks, to only test how references are found:
    await Article.knex()(Article.tableName).insert({
      content: JSON.stringify({ header: { file }, items: [{ file }, { file }] })
    })
    const references = await app.getAssetReferences({ keys: [file.key] })
    const config = { storage: 'memory', readDimensions: true }
    expect(
      references.map(({ dataPath, config }) => ({ dataPath, config }))
    ).toEqual(
      expect.arrayContaining([
        { dataPath: 'content/items/0/file', config },
        { dataPath: 'content/items/1/file', config },
        { dataPath: 'content/header/file', config: { storage: 'memory' } }
      ])
    )
    expect(references).toHaveLength(3)
  })

  it('filters overlapping data paths by the storage of the first', async () => {
    const file = await upload('overlapping-filtered.jpg')
    // Skip the asset hooks, to only test how references are found:
    await Brochure.knex()(Brochure.tableName).insert({
      content: JSON.stringify({ items: [{ file }] })
    })
    expect(
      await app.getAssetReferences({ keys: [file.key], storage: 'memory' })
    ).toHaveLength(1)
    expect(
      await app.getAssetReferences({ keys: [file.key], storage: 'other' })
    ).toEqual([])
  })

  it('loads files of overlapping data paths with the first storage', async () => {
    const file = await upload('overlapping-loaded.jpg')
    const brochure = await Brochure.query().insertAndFetch({
      content: { items: [{ file: copy(file) }] }
    })
    const loaded = await Brochure.query().findById(brochure.id)
    expect(loaded!.content!.items[0].file.storage.name).toBe('memory')
    const json = loaded!.toJSON()
    expect(storage.verifyAssetFile(json.content!.items[0].file)).toBe(true)
  })

  it('loads and signs the files of loaded records', async () => {
    const cover = await upload('signed-cover.jpg')
    const photo = await upload('signed-photo.jpg')
    const album = await Album.query().insertAndFetch({
      cover: copy(cover),
      photos: [copy(photo), null, copy(photo)]
    })
    expect(await getCount(photo)).toBe(2)
    const loaded = (await Album.query().findById(album.id))!
    const [first, empty, last] = loaded.photos!
    for (const file of [loaded.cover!, first!, last!]) {
      expect(file).toBeInstanceOf(AssetFile)
      expect(file.storage).toBe(storage)
    }
    expect(empty).toBeNull()
    const json = loaded.toJSON()
    const photos = json.photos!
    for (const file of [json.cover!, photos[0]!, photos[2]!]) {
      expect(storage.verifyAssetFile(file)).toBe(true)
    }
    expect(photos[1]).toBeNull()
    // Sign copies, leaving the files of the record untouched:
    expect(loaded.cover).not.toHaveProperty('signature')
    expect(loaded.photos![0]).not.toHaveProperty('signature')
  })

  it('loads and signs the files of wildcard data paths', async () => {
    const file = await upload('signed-nested.jpg')
    const page = await Page.query().insertAndFetch({
      content: {
        header: { file: copy(file) },
        footer: { file: null },
        gallery: { files: [copy(file), copy(file)] }
      }
    })
    const loaded = (await Page.query().findById(page.id))!
    const { header, gallery } = loaded.content!
    for (const loadedFile of [header.file, ...gallery.files]) {
      expect(loadedFile).toBeInstanceOf(AssetFile)
      expect(loadedFile.storage).toBe(storage)
    }
    const content = loaded.toJSON().content!
    for (const signedFile of [content.header.file, ...content.gallery.files]) {
      expect(storage.verifyAssetFile(signedFile)).toBe(true)
    }
    expect(content.footer.file).toBeNull()
    // Sign copies, leaving the files of the record untouched:
    for (const loadedFile of [header.file, ...gallery.files]) {
      expect(loadedFile).toBeInstanceOf(AssetFile)
      expect(loadedFile).not.toHaveProperty('signature')
    }
  })

  it('recounts each location of overlapping data paths once', async () => {
    const file = await upload('overlapping-recount.jpg')
    // Skip the asset hooks, to only test how references are counted:
    await Article.knex()(Article.tableName).insert({
      content: JSON.stringify({ items: [{ file }, { file }] })
    })
    await app.recountAssets()
    expect(await getCount(file)).toBe(2)
  })

  describe('in transactions', () => {
    it('releases unused files once the transaction is committed', async () => {
      await withCleanupTimeThreshold(0, async () => {
        const track = await Track.query().insertAndFetch({
          artwork: await upload('committed.jpg')
        })
        const { key } = track.artwork!
        await Track.transaction(async trx => {
          await Track.query(trx).patchById(track.id, { artwork: null })
          expect(storage.dataByKey.has(key)).toBe(true)
        })
        await vi.waitFor(() => expect(storage.dataByKey.has(key)).toBe(false))
        expect(await Asset.query().findOne('key', key)).toBeUndefined()
      })
    })

    it('keeps the files of rolled back transactions', async () => {
      await withCleanupTimeThreshold(0, async () => {
        const track = await Track.query().insertAndFetch({
          artwork: await upload('rolled-back.jpg')
        })
        const { key } = track.artwork!
        const release = vi.spyOn(app, 'releaseUnusedAssets')
        try {
          await expect(
            Track.transaction(async trx => {
              await Track.query(trx).patchById(track.id, { artwork: null })
              throw new Error('Rolled back')
            })
          ).rejects.toThrow('Rolled back')
          await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
          await release.mock.results[0].value
        } finally {
          release.mockRestore()
        }
        expect(storage.dataByKey.has(key)).toBe(true)
        expect(await getCount(track.artwork!)).toBe(1)
      })
    })

    it('releases once for all writes of a transaction', async () => {
      const first = await upload('first.jpg')
      const second = await upload('second.jpg')
      const release = vi.spyOn(app, 'releaseUnusedAssets')
      try {
        await Track.transaction(async trx => {
          await Track.query(trx).insert({ artwork: first })
          // Nested transactions are released with the outer one:
          await Track.transaction(trx, async trx => {
            await Track.query(trx).insert({ artwork: second })
          })
          expect(release).not.toHaveBeenCalled()
        })
        await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
      } finally {
        release.mockRestore()
      }
    })
  })

  describe('errors of releases', () => {
    // Releases fail on database or storage errors, which we can't cause here:
    function failReleases() {
      return vi
        .spyOn(app, 'releaseUnusedAssets')
        .mockRejectedValue(new Error('Release failed'))
    }

    it('logs them after transactions without error listeners', async () => {
      const file = await upload('logged.jpg')
      const release = failReleases()
      const logError = vi.spyOn(app, 'logError').mockImplementation(() => {})
      try {
        await Track.transaction(async trx => {
          await Track.query(trx).insert({ artwork: file })
        })
        await vi.waitFor(() =>
          expect(logError).toHaveBeenCalledWith(new Error('Release failed'))
        )
      } finally {
        release.mockRestore()
        logError.mockRestore()
      }
    })

    it('emits them after writes, which they do not fail', async () => {
      const file = await upload('emitted.jpg')
      const release = failReleases()
      const onError = vi.fn()
      app.on('error', onError)
      try {
        const track = await Track.query().insertAndFetch({ artwork: file })
        expect(track.artwork).toMatchObject({ key: file.key })
        expect(onError).toHaveBeenCalledWith(new Error('Release failed'))
      } finally {
        app.off('error', onError)
        release.mockRestore()
      }
    })
  })

  it('rejects references to assets released in the meantime', async () => {
    const file = await upload('raced.jpg')
    // A concurrent release needs a second connection, so we release the asset
    // where `addForeignAssets()` would only find it:
    const addForeignAssets = vi
      .spyOn(app, 'addForeignAssets')
      .mockImplementation(async () => {
        await Asset.query().delete().where('key', file.key)
        return []
      })
    try {
      await expect(
        Track.query().insert({ artwork: copy(file) })
      ).rejects.toThrow(`Unable to reference released asset: 'raced.jpg'`)
    } finally {
      addForeignAssets.mockRestore()
    }
  })
})
