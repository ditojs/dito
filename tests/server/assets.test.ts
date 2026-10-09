import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ModelProperties } from '@ditojs/server'
import { Model, AssetMixin, AssetFile, Storage } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

// Storage configs are typed per built-in storage type only.
type UntypedStorageConfig = ConstructorParameters<typeof Storage>[1]

class MemoryStorage extends Storage {
  dataByKey = new Map<string, Buffer>()

  // Give the files urls, see `Storage._getFileUrl()`.
  _getFileUrl(file: AssetFile) {
    return (this as any)._getUrl(file.key)
  }

  async _addFile(file: AssetFile, data: Buffer) {
    this.dataByKey.set(file.key, data)
  }

  async _removeFile(file: AssetFile) {
    this.dataByKey.delete(file.key)
  }

  async _readFile(file: AssetFile) {
    return this.dataByKey.get(file.key)
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
  app.addStorage(new MemoryStorage(app, {} as UntypedStorageConfig), 'memory')
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
        { type: 'unknown' } as unknown as UntypedStorageConfig,
        'files'
      )
    ).toThrow(
      `Unsupported storage: 'unknown'`
    )
  })
})

describe('AssetManager', () => {
  const Document = createDocumentClass()
  class Asset extends AssetMixin(Model) {}
  const app = createTestApp({ models: { Document, Asset } })
  const allowedImports: string[] = ['https://covers.example.com/**']
  // With `allowedImports`, files need urls, see the bug in Storage.test.js.
  const storage = new MemoryStorage(app, {
    url: 'https://files.example.com/',
    allowedImports
  } as unknown as UntypedStorageConfig)
  app.addStorage(storage, 'memory')
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
        // Once immediately in the same transaction, once after the timeout.
        expect(release).toHaveBeenCalledTimes(1)
        await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(2))
        expect(release).toHaveBeenLastCalledWith()
      } finally {
        assets.cleanupTimeThreshold = cleanupTimeThreshold
        release.mockRestore()
      }
    })

    it('releases unused assets only immediately without cleanup time', async () => {
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
        expect(release).toHaveBeenCalledTimes(1)
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
