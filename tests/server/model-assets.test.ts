import type { ModelProperties, StorageConfig } from '@ditojs/server'
import { Model, AssetFile, Storage } from '@ditojs/server'
import { vi } from 'vitest'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

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
  app.addStorage(new MemoryStorage(app, 'memory', {} as StorageConfig))

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
    const handleAssets = vi.spyOn(app, 'handleAddedAndRemovedAssets')
    await Cookbook.query().patchAndFetchById(cookbook.id, {
      title: 'Stews'
    } as any)
    expect(handleAssets).not.toHaveBeenCalled()
  })

  it('handles the asset files of writes with asset data', async () => {
    const cookbook = await Cookbook.query().insertAndFetch({
      title: 'Soups'
    } as any)
    const handleAssets = vi.spyOn(app, 'handleAddedAndRemovedAssets')
    const cover = AssetFile.create({ name: 'cover.txt', data: 'cover' })
    await Cookbook.query().patchAndFetchById(cookbook.id, { cover } as any)
    expect(handleAssets).toHaveBeenCalledOnce()
    const [storage, addedFiles] = handleAssets.mock.calls[0]
    expect(storage.name).toBe('memory')
    expect(addedFiles).toEqual([cover])
  })
})
