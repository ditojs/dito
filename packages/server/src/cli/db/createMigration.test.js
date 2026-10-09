import { vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { Application } from '../../app/Application.js'
import { Model } from '../../models/Model.js'
import { createMigration } from './createMigration.js'

class Author extends Model {
  static properties = {
    name: {
      type: 'string',
      required: true,
      description: 'The  full\n    name of the author'
    },
    awards: {
      type: 'array',
      default: []
    }
  }
}

class Book extends Model {
  static properties = {
    title: {
      type: 'string',
      required: true,
      unique: 'authorId_title'
    },
    authorId: {
      type: 'integer',
      unsigned: true,
      foreign: true,
      unique: 'authorId_title',
      index: true
    },
    price: {
      type: 'number',
      nullable: true,
      default: 0
    },
    details: {
      type: 'object',
      default: { pages: 0 }
    },
    genre: {
      type: 'string',
      default: 'fiction'
    },
    isAvailable: {
      type: 'boolean',
      default: false
    },
    publishedAt: {
      type: 'timestamp',
      default: 'now()'
    },
    isbn: {
      type: 'string',
      unique: true
    },
    location: {
      type: 'string',
      specificType: 'point'
    },
    excerpt: {
      type: 'string',
      computed: true
    }
  }

  static relations = {
    author: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Author.id'
    },
    tags: {
      relation: 'manyToMany',
      from: 'Book.id',
      to: 'Tag.id'
    }
  }
}

class Tag extends Model {
  static properties = {
    label: {
      type: 'string'
    }
  }

  static relations = {
    books: {
      relation: 'manyToMany',
      from: 'Tag.id',
      to: 'Book.id',
      inverse: true
    }
  }
}

class Chapter extends Model {
  static properties = {
    bookId: {
      type: 'integer',
      foreign: true
    }
  }

  static relations = {
    book: {
      relation: 'belongsTo',
      from: 'Chapter.bookId',
      to: 'Book.id',
      owner: true
    }
  }
}

let basePath
let app

function getMigrationPath(filename) {
  return path.join(basePath, 'migrations', filename)
}

beforeAll(async () => {
  app = new Application({
    config: {
      log: { silent: true },
      knex: { client: 'pg', normalizeDbNames: true }
    },
    models: { Author, Book, Tag, Chapter }
  })
  await app.setupModels()
})

afterAll(async () => {
  await app.knex.destroy()
})

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-migration-'))
  await fs.mkdir(path.join(basePath, 'migrations'))
  app.basePath = basePath
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 4, 5, 6, 7))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await fs.rm(basePath, { recursive: true, force: true })
})

// Returns the lines of the generated table, without the internal `#id` and
// `#ref` columns, see the related `test.fails()` below.
function getTableLines(code, tableName) {
  const match = code.match(
    new RegExp(
      `\\.createTable\\('${tableName}', table => \\{\\n([^]*?)\\n {4}\\}\\)`
    )
  )
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.includes(`'#`))
}

describe('createMigration()', () => {
  it('writes a time-stamped migration file', async () => {
    expect(await createMigration(app, 'create_tags', 'Tag')).toBe(true)
    const files = await fs.readdir(path.join(basePath, 'migrations'))
    expect(files).toEqual(['20260304050607_create_tags.js'])
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(
        `Migration '20260304050607_create_tags.js' successfully created.`
      )
    )
  })

  it('creates up and down functions for the tables', async () => {
    await createMigration(app, 'create_tags', 'Tag')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_tags.js'),
      'utf8'
    )
    expect(code).toMatch(/^\/\*\* @param \{import\('knex'\)\.Knex\} knex \*\//)
    expect(code).toContain(
      'export async function up(knex) {\n' +
      '  await knex.schema\n' +
      `    .createTable('tag', table => {\n` +
      `      table.increments('id').primary()\n` +
      `      table.string('label')\n`
    )
    expect(code).toContain(
      'export async function down(knex) {\n' +
      '  await knex.schema\n' +
      `    .dropTableIfExists('tag')\n` +
      '}'
    )
  })

  it('generates columns for all kinds of property settings', async () => {
    await createMigration(app, 'create_books', 'Book')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_books.js'),
      'utf8'
    )
    expect(getTableLines(code, 'book')).toEqual([
      `table.increments('id').primary()`,
      `table.integer('author_id').unsigned().index()`,
      `.references('id').inTable('author').onDelete('CASCADE')`,
      `table.string('title').notNullable()`,
      `table.double('price').nullable().defaultTo(0)`,
      `table.json('details').defaultTo('{"pages":0}')`,
      `table.string('genre').defaultTo('fiction')`,
      `table.boolean('is_available').defaultTo(false)`,
      `table.timestamp('published_at')` +
      `.defaultTo(knex.raw('CURRENT_TIMESTAMP'))`,
      `table.string('isbn').unique()`,
      `table.specificType('location', 'point')`,
      `table.unique(['author_id', 'title'])`
    ])
    // Computed properties are not stored:
    expect(code).not.toContain('excerpt')
  })

  it('adds normalized descriptions as comments', async () => {
    await createMigration(app, 'create_authors', 'Author')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_authors.js'),
      'utf8'
    )
    expect(getTableLines(code, 'author')).toEqual([
      `table.increments('id').primary()`,
      '// The full name of the author',
      `table.string('name').notNullable()`,
      `table.json('awards').defaultTo('[]')`
    ])
  })

  it('does not cascade deletes of relations that own their data', async () => {
    await createMigration(app, 'create_chapters', 'Chapter')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_chapters.js'),
      'utf8'
    )
    expect(getTableLines(code, 'chapter')).toEqual([
      `table.increments('id').primary()`,
      `table.integer('book_id')`,
      `.references('id').inTable('book')`
    ])
  })

  it('creates join tables for through relations', async () => {
    await createMigration(app, 'create_library', 'Author', 'Book', 'Tag')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_library.js'),
      'utf8'
    )
    const tableNames = [...code.matchAll(/createTable\('(\w+)'/g)].map(
      match => match[1]
    )
    // Join tables are created after all model tables, and only once for both
    // sides of the relation:
    expect(tableNames).toEqual(['author', 'book', 'tag', 'book_tag'])
    expect(getTableLines(code, 'book_tag')).toEqual([
      `table.increments('id').primary()`,
      `table.integer('book_id').unsigned().index()`,
      `.references('id').inTable('book').onDelete('CASCADE')`,
      `table.integer('tag_id').unsigned().index()`,
      `.references('id').inTable('tag').onDelete('CASCADE')`
    ])
    // Tables are dropped in reverse order:
    const dropNames = [...code.matchAll(/dropTableIfExists\('(\w+)'/g)].map(
      match => match[1]
    )
    expect(dropNames).toEqual(['book_tag', 'tag', 'book', 'author'])
  })

  it('creates empty functions without models', async () => {
    await createMigration(app, 'empty')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_empty.js'),
      'utf8'
    )
    expect(code).not.toContain('knex.schema')
    expect(code).toMatch(/export async function up\(knex\) \{\n\s*\n\}/)
  })

  it('throws for unknown models', async () => {
    await expect(
      createMigration(app, 'create_shelves', 'Shelf')
    ).rejects.toThrow(`Model class with name 'Shelf' does not exist`)
  })

  it('does not overwrite existing migrations', async () => {
    const file = getMigrationPath('20260304050607_create_tags.js')
    await fs.writeFile(file, '// Existing')
    expect(await createMigration(app, 'create_tags', 'Tag')).toBe(false)
    expect(await fs.readFile(file, 'utf8')).toBe('// Existing')
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(
        `Migration '20260304050607_create_tags.js' already exists.`
      )
    )
  })

  // Bug: The `#id` and `#ref` properties that Dito.js adds to all models for
  // Objection.js graph references are generated as table columns.
  test.fails('skips the internal `#id` and `#ref` properties', async () => {
    await createMigration(app, 'create_tags', 'Tag')
    const code = await fs.readFile(
      getMigrationPath('20260304050607_create_tags.js'),
      'utf8'
    )
    expect(code).not.toContain(`'#id'`)
    expect(code).not.toContain(`'#ref'`)
  })

  // Bug: `collectModelTables()` is async but not awaited, so errors thrown in
  // it become unhandled rejections and the migration is written regardless.
  test.fails('rejects invalid foreign key relations', async () => {
    const reviewClass = {
      name: 'Review',
      tableName: 'Review',
      definition: {
        properties: {
          bookId: { type: 'integer', foreign: true }
        },
        relations: {
          book: {
            relation: 'belongsTo',
            from: 'Chapter.bookId',
            to: 'Book.id'
          }
        }
      }
    }
    const fakeApp = {
      basePath,
      models: { Review: reviewClass },
      normalizeIdentifier: identifier => identifier
    }
    const unhandledRejections = []
    await captureUnhandledRejections(unhandledRejections, async () => {
      await expect(
        createMigration(fakeApp, 'create_reviews', 'Review')
      ).rejects.toThrow('Invalid relation declaration')
    })
    expect(unhandledRejections).toEqual([])
  })
})

// Temporarily replaces the `unhandledRejection` handlers of the test runner,
// so that the floating rejection in the test above doesn't fail the run.
async function captureUnhandledRejections(reasons, callback) {
  const listeners = process.listeners('unhandledRejection')
  process.removeAllListeners('unhandledRejection')
  const collect = reason => reasons.push(reason)
  process.on('unhandledRejection', collect)
  try {
    await callback().catch(error => {
      reasons.error = error
    })
    // Give Node.js the chance to report unhandled rejections.
    await new Promise(resolve => setTimeout(resolve, 10))
  } finally {
    process.off('unhandledRejection', collect)
    for (const listener of listeners) {
      process.on('unhandledRejection', listener)
    }
  }
  if (reasons.error) {
    throw reasons.error
  }
}
