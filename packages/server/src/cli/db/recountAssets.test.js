import { vi } from 'vitest'
import { stripVTControlCharacters } from 'util'
import { Application } from '../../app/Application.js'
import { Model } from '../../models/index.js'
import { AssetMixin } from '../../mixins/index.js'
import { AssetFile, Storage } from '../../storage/index.js'
import { recountAssets } from './recountAssets.js'
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

describe('recountAssets()', () => {
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

  // Stores a track that references `artwork` without counting it, as writes
  // that skip the model hooks do:
  async function insertWithoutHooks(name) {
    const file = AssetFile.create({ name, data: name })
    const storage = app.getStorage('memory')
    await storage.addFile(file, Buffer.from(name))
    // Sign a copy like an upload, as `createAssets()` expects:
    const upload = { ...file }
    storage.signAssetFile(upload)
    await app.createAssets(storage, [upload], 0)
    await app.knex(Track.tableName).insert({ artwork: JSON.stringify(file) })
    return file
  }

  it('prints the counts that a dry run would change', async () => {
    const file = await insertWithoutHooks('dry.jpg')
    expect(await recountAssets(app, '--dry-run')).toBe(true)
    expect(output).toEqual([
      `Asset 'dry.jpg' (${file.key}): count 0 → 1`,
      'Would change 1 counts, would create 0 missing assets, ' +
      'found 0 lost files.'
    ])
    expect((await Asset.query().findOne('key', file.key)).count).toBe(0)
  })

  it('changes the counts and prints them', async () => {
    const file = await insertWithoutHooks('wet.jpg')
    expect(await recountAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'wet.jpg' (${file.key}): count 0 → 1`,
      'Changed 1 counts, created 0 missing assets, found 0 lost files.'
    ])
    expect((await Asset.query().findOne('key', file.key)).count).toBe(1)
  })

  it('prints the missing assets that it creates', async () => {
    const file = await insertWithoutHooks('missing.jpg')
    await Asset.query().delete().where('key', file.key)
    expect(await recountAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'missing.jpg' (${file.key}): missing, 1 references`,
      'Changed 0 counts, created 1 missing assets, found 0 lost files.'
    ])
  })

  it('prints the files that are lost from their storage', async () => {
    const file = await insertWithoutHooks('lost.jpg')
    await Asset.query().delete().where('key', file.key)
    app.getStorage('memory').keys.delete(file.key)
    const [track] = await Track.query()
    expect(await recountAssets(app)).toBe(true)
    expect(output).toEqual([
      `Asset 'lost.jpg' (${file.key}): lost from storage 'memory', ` +
      `1 references: Track ${track.id} artwork`,
      'Changed 0 counts, created 0 missing assets, found 1 lost files.'
    ])
    expect(await Asset.query().findOne('key', file.key)).toBeUndefined()
  })
})

describe('recountAssets() with storages that cannot list their keys', () => {
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

  it('rejects files without assets that it cannot check', async () => {
    const file = AssetFile.create({ name: 'unlisted.mp4', data: 'video' })
    await app.knex(Clip.tableName).insert({ video: JSON.stringify(file) })
    await expect(recountAssets(app)).rejects.toThrow(
      `Unable to list the keys of storage 'unlisted'.`
    )
  })
})
