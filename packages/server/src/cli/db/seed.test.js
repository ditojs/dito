import { vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { pathToFileURL } from 'url'
import { promisify, stripVTControlCharacters } from 'util'
import { seed } from './seed.js'

let basePath
let output
let calls

beforeEach(async () => {
  basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-seed-'))
  await fs.mkdir(path.join(basePath, 'seeds'))
  output = []
  calls = []
  const log = (...args) => output.push(stripVTControlCharacters(args.join(' ')))
  vi.spyOn(console, 'info').mockImplementation(log)
  vi.spyOn(console, 'error').mockImplementation(log)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(basePath, { recursive: true, force: true })
})

function createModelClass(name, { failInsert = false } = {}) {
  return {
    name,
    truncate: vi.fn(async options => {
      calls.push(['truncate', name, options])
    }),
    insertGraph: vi.fn(async data => {
      calls.push(['insertGraph', name, data])
      if (failInsert) {
        throw new Error(`Cannot insert into ${name}`)
      }
      return data
    })
  }
}

function writeSeed(filename, content) {
  return fs.writeFile(path.join(basePath, 'seeds', filename), content)
}

function createApp(models) {
  return { basePath, models }
}

describe('seed()', () => {
  it('inserts JSON seed data for the related models', async () => {
    const Author = createModelClass('Author')
    await writeSeed('Author.json', JSON.stringify([{ name: 'Ada' }]))
    expect(await seed(createApp({ Author }))).toBe(true)
    expect(Author.truncate).toHaveBeenCalledWith({ cascade: true })
    expect(Author.insertGraph).toHaveBeenCalledWith([{ name: 'Ada' }])
    expect(output).toEqual(['Author.json: 1 seed records created.'])
  })

  it('finds models by plural and hyphenated seed names', async () => {
    const BookReview = createModelClass('BookReview')
    const Book = createModelClass('Book')
    await writeSeed('books.json', JSON.stringify([{ title: 'A' }]))
    await writeSeed('book-reviews.json', JSON.stringify([{}, {}]))
    await seed(createApp({ Book, BookReview }))
    expect(Book.insertGraph).toHaveBeenCalledWith([{ title: 'A' }])
    expect(BookReview.insertGraph).toHaveBeenCalledWith([{}, {}])
  })

  it('seeds in the order of the app models', async () => {
    const Author = createModelClass('Author')
    const Book = createModelClass('Book')
    const Tag = createModelClass('Tag')
    // Files are read in alphabetical order, but seeded in model order:
    await writeSeed('a-function.js', 'export default () => []')
    await writeSeed('Author.json', '[]')
    await writeSeed('Book.json', '[]')
    await writeSeed('Tag.json', '[]')
    await seed(createApp({ Tag, Book, Author }))
    expect(
      calls.filter(([method]) => method === 'insertGraph').map(([, n]) => n)
    ).toEqual(['Tag', 'Book', 'Author'])
    // Seeds without models are handled last:
    expect(output.at(-1)).toBe('a-function.js: 0 seed records created.')
  })

  it('calls seed functions with the models', async () => {
    const Author = createModelClass('Author')
    await writeSeed(
      'authors.js',
      `export default async function (models) {
        globalThis.seedModels = models
        return [{ name: 'Ada' }, { name: 'Grace' }]
      }`
    )
    try {
      await seed(createApp({ Author }))
      expect(globalThis.seedModels).toEqual({ Author })
      // Seed functions take care of the data themselves:
      expect(Author.truncate).not.toHaveBeenCalled()
      expect(Author.insertGraph).not.toHaveBeenCalled()
      expect(output).toEqual(['authors.js: 2 seed records created.'])
    } finally {
      delete globalThis.seedModels
    }
  })

  it('uses the named exports of seed modules without default export', async () => {
    const Author = createModelClass('Author')
    await writeSeed('Author.js', `export const name = 'Ada'`)
    await seed(createApp({ Author }))
    expect(Author.insertGraph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada' })
    )
  })

  it('reports seeds that do not return records', async () => {
    await writeSeed('setup.js', 'export default () => {}')
    await writeSeed('unknown.json', '{ "title": "A" }')
    await seed(createApp({}))
    expect(output.sort()).toEqual([
      'setup.js: No seed records created.',
      'unknown.json: No seed records created.'
    ])
  })

  it('logs errors and continues with the next seed', async () => {
    const Author = createModelClass('Author', { failInsert: true })
    const Book = createModelClass('Book')
    await writeSeed('Author.json', '[{}]')
    await writeSeed('Book.json', '[{}]')
    expect(await seed(createApp({ Author, Book }))).toBe(true)
    expect(output[0]).toMatch(/^Author\.json: .*Cannot insert into Author/s)
    expect(output[1]).toBe('Book.json: 1 seed records created.')
  })

  it('ignores hidden files and other file types', async () => {
    const Author = createModelClass('Author')
    await writeSeed('.Author.json', '[{}]')
    await writeSeed('Author.txt', '[{}]')
    await seed(createApp({ Author }))
    expect(Author.insertGraph).not.toHaveBeenCalled()
    expect(output).toEqual([])
  })

  it('rejects without a seeds folder', async () => {
    await fs.rm(path.join(basePath, 'seeds'), { recursive: true })
    await expect(seed(createApp({}))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  // Vitest handles JSON imports itself, so loading JSON seeds is only
  // verifiable in a separate, plain Node.js process.
  it('imports JSON seeds in plain Node.js', async () => {
    await writeSeed('Author.json', '[{ "name": "Ada" }]')
    const seedUrl = pathToFileURL(path.resolve(import.meta.dirname, 'seed.js'))
    const script = `
      const { seed } = await import(${JSON.stringify(seedUrl.href)})
      const Author = {
        name: 'Author',
        truncate: async () => {},
        insertGraph: async data => data
      }
      await seed({ basePath: ${JSON.stringify(basePath)}, models: { Author } })
    `
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { env: { ...process.env, NO_COLOR: '1' } }
    )
    expect(stdout).toContain('Author.json: 1 seed records created.')
  })
})
