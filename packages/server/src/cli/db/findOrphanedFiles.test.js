import { vi } from 'vitest'
import { stripVTControlCharacters } from 'util'
import { Application } from '../../app/Application.js'
import { Model } from '../../models/index.js'
import { AssetMixin } from '../../mixins/index.js'
import { Storage } from '../../storage/index.js'
import { findOrphanedFiles } from './findOrphanedFiles.js'
import { createTestKnex } from '../../../../../tests/utils/test-knex.ts'
import { createTestDatabase } from '../../../../../tests/utils/database.ts'

const lastModified = new Date('2026-11-01T10:00:00Z')

class MemoryStorage extends Storage {
  keys = new Set()

  async _removeFile(file) {
    this.keys.delete(file.key)
  }

  async _listFiles() {
    return [...this.keys].map(key => ({ key, lastModified }))
  }
}

class Asset extends AssetMixin(Model) {}

describe('findOrphanedFiles()', () => {
  const app = new Application({
    config: { log: { silent: true }, knex: createTestKnex() },
    models: { Asset }
  })
  const storage = new MemoryStorage(app, 'memory', {})
  app.addStorage(storage)
  let output

  beforeAll(async () => {
    await createTestDatabase(app)
  })

  afterAll(async () => {
    await app.knex.destroy()
  })

  beforeEach(() => {
    output = []
    vi.spyOn(console, 'info').mockImplementation((...args) => {
      output.push(stripVTControlCharacters(args.join(' ')))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints the orphaned files, and removes them with --remove', async () => {
    storage.keys.add('orphaned.txt')
    const line = (
      `File 'orphaned.txt' of storage 'memory': modified ` +
      lastModified.toISOString()
    )
    expect(await findOrphanedFiles(app)).toBe(true)
    expect(output).toEqual([line, 'Found 1 orphaned files.'])
    expect(storage.keys.has('orphaned.txt')).toBe(true)
    output = []
    expect(await findOrphanedFiles(app, '--remove')).toBe(true)
    expect(output).toEqual([line, 'Removed 1 orphaned files.'])
    expect(storage.keys.has('orphaned.txt')).toBe(false)
  })
})
