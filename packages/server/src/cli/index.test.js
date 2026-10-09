import { vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { stripVTControlCharacters } from 'util'
import * as db from './db/index.js'
import startConsole from './console.js'
import execute from './index.js'

vi.mock('./db/index.js', () => ({
  migrate: vi.fn(async () => true),
  createMigration: vi.fn(async () => true),
  seed: vi.fn(async () => false)
}))

vi.mock('./console.js', () => ({
  default: vi.fn(async () => true)
}))

vi.mock('knex', () => ({
  default: vi.fn(config => ({ isKnex: true, config }))
}))

let dir
let argv
let exit
let errors

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-cli-'))
  argv = process.argv
  exit = vi.spyOn(process, 'exit').mockImplementation(() => {})
  errors = []
  vi.spyOn(console, 'error').mockImplementation(message =>
    errors.push(stripVTControlCharacters(String(message)))
  )
})

afterEach(async () => {
  process.argv = argv
  vi.restoreAllMocks()
  vi.clearAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

async function writeModule(filename, code) {
  const file = path.join(dir, filename)
  await fs.writeFile(file, code)
  return file
}

function run(...args) {
  process.argv = ['node', 'dito', ...args]
  return execute()
}

describe('dito cli', () => {
  it('runs nested commands with the default export of the module', async () => {
    const file = await writeModule(
      'app.js',
      'export default { name: "library" }'
    )
    await run('db:create_migration', file, 'create_books', 'Book', 'Author')
    expect(db.createMigration).toHaveBeenCalledWith(
      { name: 'library' },
      'create_books',
      'Book',
      'Author'
    )
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('resolves the module path relative to the working directory', async () => {
    await writeModule('app.js', 'export default "library"')
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    await run('db:seed', 'app.js')
    cwd.mockRestore()
    expect(db.seed).toHaveBeenCalledWith('library')
  })

  it('exits with 1 when the command does not return true', async () => {
    const file = await writeModule('app.js', 'export default {}')
    await run('db:seed', file)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('creates knex instances from config objects', async () => {
    const file = await writeModule(
      'config.js',
      'export default { knex: { client: "pg" } }'
    )
    await run('db:migrate', file)
    expect(db.migrate).toHaveBeenCalledWith({
      isKnex: true,
      config: { client: 'pg' }
    })
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('calls exported functions to get the argument', async () => {
    const file = await writeModule(
      'config.js',
      'export default async () => ({ knex: { client: "sqlite3" } })'
    )
    await run('db:migrate', file)
    expect(db.migrate).toHaveBeenCalledWith({
      isKnex: true,
      config: { client: 'sqlite3' }
    })
  })

  it('starts the console', async () => {
    const file = await writeModule('app.js', 'export default "app"')
    await run('console', file)
    expect(startConsole).toHaveBeenCalledWith('app')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('silences the app while importing it', async () => {
    const file = await writeModule(
      'app.js',
      'export default process.env.DITO_SILENT'
    )
    const silent = process.env.DITO_SILENT
    process.env.DITO_SILENT = 'false'
    try {
      await run('db:seed', file)
      expect(db.seed).toHaveBeenCalledWith('true')
      expect(process.env.DITO_SILENT).toBe('false')
    } finally {
      process.env.DITO_SILENT = silent
    }
  })

  it('restores an unset DITO_SILENT after importing', async () => {
    const file = await writeModule('app.js', 'export default {}')
    const silent = process.env.DITO_SILENT
    delete process.env.DITO_SILENT
    try {
      await run('db:seed', file)
      expect(process.env.DITO_SILENT).toBeUndefined()
    } finally {
      if (silent === undefined) {
        delete process.env.DITO_SILENT
      } else {
        process.env.DITO_SILENT = silent
      }
    }
  })

  it('reports unknown commands', async () => {
    await run('library:list', 'app.js')
    expect(errors[0]).toMatch(/^Error: Unknown command: library:list/)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('reports missing commands', async () => {
    await run()
    expect(errors[0]).toMatch(/^Error: Unknown command: undefined/)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('reports partial commands that are not functions', async () => {
    await run('db', 'app.js')
    expect(errors[0]).toMatch(/^Error: Unknown command: db/)
  })

  it('reports errors with their details', async () => {
    const file = await writeModule('app.js', 'export default {}')
    db.migrate.mockRejectedValueOnce(
      Object.assign(new Error('relation "book" does not exist'), {
        detail: 'Run the migrations first.'
      })
    )
    await run('db:migrate', file)
    expect(errors[0]).toMatch(
      /^Run the migrations first\.\nError: relation "book" does not exist/
    )
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('reports thrown values that are not errors', async () => {
    const file = await writeModule('app.js', 'export default {}')
    db.migrate.mockRejectedValueOnce('Database is locked')
    await run('db:migrate', file)
    expect(errors).toEqual(['Database is locked'])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('reports modules that fail to import', async () => {
    await run('db:migrate', path.join(dir, 'missing.js'))
    expect(errors[0]).toMatch(/Cannot find module|Failed to load/)
    expect(exit).toHaveBeenCalledWith(1)
  })
})
