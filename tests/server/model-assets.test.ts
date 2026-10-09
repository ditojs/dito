import type { ModelProperties } from '@ditojs/server'
import { Model, AssetFile, Storage } from '@ditojs/server'
import { vi } from 'vitest'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

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

class Cookbook extends Model {
  declare id: number
  declare title: string
  declare cover: AssetFile | null

  static override properties: ModelProperties = {
    title: { type: 'string' },
    cover: { type: 'object', nullable: true }
  }

  static override assets = {
    cover: { storage: 'memory' }
  }
}

describe('Model asset hooks', () => {
  const app = createTestApp({ models: { Cookbook } })
  app.addStorage(new MemoryStorage(app, {} as UntypedStorageConfig), 'memory')

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips the asset handling of writes without asset data', async () => {
    const cookbook = await Cookbook.query().insertAndFetch({
      title: 'Soups'
    } as any)
    const handleAssetFileChanges = vi.spyOn(
      (app as any).assetManager,
      'handleAssetFileChanges'
    )
    await Cookbook.query().patchAndFetchById(cookbook.id, {
      title: 'Stews'
    } as any)
    expect(handleAssetFileChanges).not.toHaveBeenCalled()
  })

  it('handles the asset files of writes with asset data', async () => {
    const cookbook = await Cookbook.query().insertAndFetch({
      title: 'Soups'
    } as any)
    const handleAssetFileChanges = vi.spyOn(
      (app as any).assetManager,
      'handleAssetFileChanges'
    )
    await Cookbook.query().patchAndFetchById(cookbook.id, {
      cover: AssetFile.create({ name: 'cover.txt', data: 'cover' })
    } as any)
    expect(handleAssetFileChanges).toHaveBeenCalledOnce()
    expect(handleAssetFileChanges.mock.calls[0][0]).toMatchObject({
      dataPaths: ['cover']
    })
  })
})
