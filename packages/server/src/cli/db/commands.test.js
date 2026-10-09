import { vi } from 'vitest'
import { stripVTControlCharacters } from 'util'
import { listAssetConfig, migrate, reset, rollback, unlock } from './index.js'

let info

beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function getOutput() {
  return info.mock.calls
    .map(args => stripVTControlCharacters(args.join(' ')))
    .join('\n')
}

// Creates a knex-like object whose `migrate.rollback()` returns the given
// results in sequence, and an empty batch after that.
function createKnex({ latest = [0, []], rollbacks = [] } = {}) {
  const results = [...rollbacks]
  return {
    migrate: {
      latest: vi.fn(async () => latest),
      rollback: vi.fn(async () => results.shift() ?? [0, []]),
      forceFreeMigrationsLock: vi.fn(async () => {})
    }
  }
}

describe('migrate()', () => {
  it('runs the latest migrations and lists them', async () => {
    const knex = createKnex({
      latest: [3, ['01_create_books.js', '02_create_authors.js']]
    })
    expect(await migrate(knex)).toBe(true)
    expect(knex.migrate.latest).toHaveBeenCalledTimes(1)
    expect(getOutput()).toBe(
      'Batch 3 run: 2 migrations\n01_create_books.js\n02_create_authors.js'
    )
  })

  it('reports when the database is up to date', async () => {
    expect(await migrate(createKnex())).toBe(true)
    expect(getOutput()).toBe('Already up to date')
  })
})

describe('rollback()', () => {
  it('rolls back the last batch and lists its migrations', async () => {
    const knex = createKnex({ rollbacks: [[2, ['02_create_authors.js']]] })
    expect(await rollback(knex)).toBe(true)
    expect(knex.migrate.rollback).toHaveBeenCalledTimes(1)
    expect(getOutput()).toBe(
      'Batch 2 rolled back: 1 migrations\n02_create_authors.js'
    )
  })

  it('reports when there is nothing to roll back', async () => {
    expect(await rollback(createKnex())).toBe(true)
    expect(getOutput()).toBe('Already at the base migration')
  })
})

describe('reset()', () => {
  it('rolls back all batches and migrates again', async () => {
    const knex = createKnex({
      rollbacks: [
        [2, ['03_add_isbn.js']],
        [1, ['01_create_books.js', '02_create_authors.js']]
      ],
      latest: [
        1,
        ['01_create_books.js', '02_create_authors.js', '03_add_isbn.js']
      ]
    })
    expect(await reset(knex)).toBe(true)
    expect(knex.migrate.rollback).toHaveBeenCalledTimes(3)
    expect(knex.migrate.latest).toHaveBeenCalledTimes(1)
    expect(getOutput()).toBe(
      [
        'Batches 2,1 rolled back: 3 migrations',
        '03_add_isbn.js',
        '01_create_books.js',
        '02_create_authors.js',
        'Batch 1 run: 3 migrations',
        '01_create_books.js',
        '02_create_authors.js',
        '03_add_isbn.js'
      ].join('\n')
    )
  })

  it('uses the singular for a single rolled back batch', async () => {
    const knex = createKnex({ rollbacks: [[1, ['01_create_books.js']]] })
    await reset(knex)
    expect(getOutput()).toMatch(/^Batch 1 rolled back: 1 migrations\n/)
  })

  it('reports when there is nothing to roll back', async () => {
    const knex = createKnex()
    await reset(knex)
    expect(getOutput()).toBe(
      'Already at the base migration\nAlready up to date'
    )
  })
})

describe('unlock()', () => {
  it('frees the migrations lock', async () => {
    const knex = createKnex()
    expect(await unlock(knex)).toBe(true)
    expect(knex.migrate.forceFreeMigrationsLock).toHaveBeenCalledTimes(1)
    expect(getOutput()).toBe('Successfully unlocked the migrations lock table')
  })
})

describe('listAssetConfig()', () => {
  function createApp() {
    return {
      models: { Book: {}, Author: {} },
      getAssetConfig: vi.fn(({ models }) =>
        Object.fromEntries(models.map(name => [name, { cover: 'covers' }]))
      )
    }
  }

  it('prints the asset config of all models', async () => {
    const app = createApp()
    expect(await listAssetConfig(app)).toBe(true)
    expect(app.getAssetConfig).toHaveBeenCalledWith({
      models: ['Book', 'Author'],
      normalizeDbNames: true
    })
    expect(JSON.parse(getOutput())).toEqual({
      Book: { cover: 'covers' },
      Author: { cover: 'covers' }
    })
  })

  it('prints the asset config of the passed models', async () => {
    const app = createApp()
    await listAssetConfig(app, 'Author')
    expect(app.getAssetConfig).toHaveBeenCalledWith({
      models: ['Author'],
      normalizeDbNames: true
    })
    expect(getOutput()).toBe(
      '{\n  "Author": {\n    "cover": "covers"\n  }\n}'
    )
  })
})
