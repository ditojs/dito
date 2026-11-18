import { vi } from 'vitest'
import { stripVTControlCharacters } from 'util'
import { Application } from '../../app/Application.js'
import { Model } from '../../models/index.js'
import { AssetMixin } from '../../mixins/index.js'
import { AssetFile, Storage } from '../../storage/index.js'
import { scanAssets } from './scanAssets.js'
import { createTestKnex } from '../../../../../tests/utils/test-knex.ts'
import { createTestDatabase } from '../../../../../tests/utils/database.ts'

class MemoryStorage extends Storage {
  keys = new Set()

  async _addFile(file) {
    this.keys.add(file.key)
  }

  async _listKeys() {
    return [...this.keys]
  }
}

class Track extends Model {
  static properties = {
    artwork: { type: 'object', nullable: true }
  }

  static assets = {
    artwork: { storage: 'memory' }
  }
}

class Asset extends AssetMixin(Model) {}

describe('scanAssets()', () => {
  const app = new Application({
    config: { log: { silent: true }, knex: createTestKnex() },
    models: { Track, Asset }
  })
  app.addStorage(new MemoryStorage(app, 'memory', {}))
  let output

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await app.knex.destroy()
  })

  beforeEach(async () => {
    await Track.query().truncate()
    await Asset.query().truncate()
    output = []
    vi.spyOn(console, 'info').mockImplementation((...args) => {
      output.push(stripVTControlCharacters(args.join(' ')))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Stores a track that references `artwork` without marking its asset, as
  // writes that skip the model hooks do:
  async function insertWithoutHooks(name) {
    const file = AssetFile.create({ name, data: name })
    const storage = app.getStorage('memory')
    await storage.addFile(file, Buffer.from(name))
    // Sign a copy like an upload, as `createAssets()` expects:
    const upload = { ...file }
    storage.signAssetFile(upload)
    await app.createAssets(storage, [upload])
    await app.knex(Track.tableName).insert({ artwork: JSON.stringify(file) })
    return file
  }

  async function isReferenced(file) {
    const asset = await Asset.query().findOne('key', file.key)
    return !asset.unreferencedSince
  }

  it('prints the assets that a dry run would mark', async () => {
    const file = await insertWithoutHooks('dry.jpg')
    expect(await scanAssets(app, '--dry-run')).toBe(true)
    expect(output).toEqual([
      `Asset 'dry.jpg' (${file.key}): referenced`,
      'Would mark 1 assets as referenced and 0 as unreferenced, ' +
      'would create 0 missing assets, found 0 lost files.'
    ])
    expect(await isReferenced(file)).toBe(false)
  })

  it('marks the assets and prints them', async () => {
    const file = await insertWithoutHooks('wet.jpg')
    expect(await scanAssets(app)).toBe(true)
    expect(await isReferenced(file)).toBe(true)
    await Track.query().delete()
    output = []
    expect(await scanAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'wet.jpg' (${file.key}): unreferenced`,
      'Marked 0 assets as referenced and 1 as unreferenced, ' +
      'created 0 missing assets, found 0 lost files.'
    ])
    expect(await isReferenced(file)).toBe(false)
  })

  it('prints the missing assets that it creates', async () => {
    const file = await insertWithoutHooks('missing.jpg')
    await Asset.query().delete().where('key', file.key)
    expect(await scanAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'missing.jpg' (${file.key}): missing, 1 references`,
      'Marked 0 assets as referenced and 0 as unreferenced, ' +
      'created 1 missing assets, found 0 lost files.'
    ])
  })

  it('prints the files that are lost from their storage', async () => {
    const file = await insertWithoutHooks('lost.jpg')
    await Asset.query().delete().where('key', file.key)
    app.getStorage('memory').keys.delete(file.key)
    const [track] = await Track.query()
    expect(await scanAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'lost.jpg' (${file.key}): lost from storage 'memory', ` +
      `1 references: Track ${track.id} artwork`,
      'Marked 0 assets as referenced and 0 as unreferenced, ' +
      'created 0 missing assets, found 1 lost files.'
    ])
  })
})

describe('scanAssets() with storages that cannot list their keys', () => {
  class UnlistedStorage extends Storage {
    async _addFile() {}
  }

  class Clip extends Model {
    static properties = {
      video: { type: 'object', nullable: true }
    }

    static assets = {
      video: { storage: 'unlisted' }
    }
  }

  class Asset extends AssetMixin(Model) {}

  const app = new Application({
    config: { log: { silent: true }, knex: createTestKnex() },
    models: { Clip, Asset }
  })
  app.addStorage(new UnlistedStorage(app, 'unlisted', {}))

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await app.knex.destroy()
  })

  it('creates the assets of files that it cannot check', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const file = AssetFile.create({ name: 'unlisted.mp4', data: 'video' })
    await app.knex(Clip.tableName).insert({ video: JSON.stringify(file) })
    expect(await scanAssets(app)).toBe(true)
    expect(await Asset.query().findOne('key', file.key)).toMatchObject({
      unreferencedSince: null
    })
  })
})
