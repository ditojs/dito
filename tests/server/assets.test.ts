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
