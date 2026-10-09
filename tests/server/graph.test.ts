import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
// @ts-expect-error -- The graph processor is internal and not exported by the
// package, so it comes without type declarations.
import { DitoGraphProcessor } from '../../packages/server/src/graph/index.js'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Author extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }
}

class Shelf extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }
}

class Genre extends Model {
  declare id: number
  declare name: string
  declare rank: number

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    // The extra property of the `BookGenre` pivot table:
    rank: { type: 'integer', computed: true, nullable: true }
  }
}

class Chapter extends Model {
  declare id: number
  declare title: string
  declare position: number
  declare bookId: number
  declare book: Book | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    position: { type: 'integer' },
    bookId: { type: 'integer', foreign: true, nullable: true }
  }

  static override relations = {
    book: {
      relation: 'belongsTo',
      from: 'Chapter.bookId',
      to: 'Book.id',
      nullable: true
    }
  } as any

  static override scopes = {
    ordered: (query: any) => query.orderBy('position')
  }
}

class Book extends Model {
  declare id: number
  declare title: string
  declare authorId: number | null
  declare shelfId: number | null
  declare featuredChapterId: number | null
  declare author: Author | null
  declare shelf: Shelf | null
  declare chapters: Chapter[]
  declare featuredChapter: Chapter | null
  declare genres: Genre[]

  static override properties: ModelProperties = {
    title: { type: 'string', required: true }
  }

  static override relations = {
    author: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Author.id',
      nullable: true
    },
    // Shelves are always created along with the book, never related:
    shelf: {
      relation: 'belongsTo',
      from: 'Book.shelfId',
      to: 'Shelf.id',
      nullable: true,
      graphOptions: { relate: false }
    },
    chapters: {
      relation: 'hasMany',
      from: 'Book.id',
      to: 'Chapter.bookId',
      scope: 'ordered',
      owner: true
    },
    featuredChapter: {
      relation: 'belongsTo',
      from: 'Book.featuredChapterId',
      to: 'Chapter.id',
      nullable: true
    },
    genres: {
      relation: 'manyToMany',
      from: 'Book.id',
      to: 'Genre.id',
      through: {
        from: 'BookGenre.bookId',
        to: 'BookGenre.genreId',
        extra: ['rank']
      }
    }
  } as any
}

// Graphs of references are partial data, so skip their validation:
function createBookGraph(json: object): Book {
  return Book.fromJson(json, { skipValidation: true })
}

describe('Dito.js graph handling', () => {
  const app = createTestApp({
    models: { Author, Shelf, Genre, Chapter, Book }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.knex.schema.createTable('BookGenre', table => {
      table.increments('id').primary()
      table.integer('bookId')
      table.integer('genreId')
      table.integer('rank')
    })
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(async () => {
    for (const table of [
      'BookGenre',
      'Book',
      'Chapter',
      'Genre',
      'Shelf',
      'Author'
    ]) {
      await app.knex(table).del()
    }
  })

  async function getBookGenreRows(bookId: number) {
    return app
      .knex('BookGenre')
      .where({ bookId })
      .select('genreId', 'rank')
      .orderBy('genreId')
  }

  describe('DitoGraphProcessor', () => {
    const upsertOptions = {
      relate: true,
      unrelate: true,
      insertMissing: true
    }

    it('collects relation paths for options overridden by relations', () => {
      const processor = new DitoGraphProcessor(
        Book,
        {
          title: 'Dune',
          author: { id: 1 },
          shelf: { name: 'Fiction' },
          chapters: [{ title: 'One' }],
          genres: [{ id: 2 }]
        },
        upsertOptions,
        { processOverrides: true }
      )
      expect(processor.getOptions()).toEqual({
        relate: ['author', 'genres'],
        // `shelf` only overrides `relate`, so `unrelate` falls back to the
        // global option there:
        unrelate: ['author', 'shelf', 'genres'],
        insertMissing: true
      })
    })

    it('only collects override paths for relations present in the data', () => {
      const processor = new DitoGraphProcessor(
        Book,
        { title: 'Dune', chapters: [] },
        upsertOptions,
        { processOverrides: true }
      )
      expect(processor.getOptions()).toEqual({
        relate: [],
        unrelate: [],
        insertMissing: true
      })
    })

    it('leaves options untouched without `processOverrides`', () => {
      const processor = new DitoGraphProcessor(
        Book,
        { title: 'Dune', chapters: [{ title: 'One' }] },
        upsertOptions
      )
      expect(processor.getOptions()).toEqual(upsertOptions)
    })

    it('leaves options untouched when no relation overrides them', () => {
      const processor = new DitoGraphProcessor(
        Book,
        { title: 'Dune' },
        { insertMissing: true },
        { processOverrides: true }
      )
      expect(processor.getOptions()).toEqual({ insertMissing: true })
    })

    it('stops scanning once every option has an override', () => {
      const processor = new DitoGraphProcessor(
        Book,
        { title: 'Dune', chapters: [{ title: 'One' }] },
        { relate: true },
        { processOverrides: true }
      )
      expect(processor.numOverrides).toBe(1)
      expect(processor.getOptions()).toEqual({ relate: [] })
    })

    it('reduces related models to references, keeping owned data', () => {
      const processor = new DitoGraphProcessor(
        Book,
        {
          title: 'Dune',
          author: { id: 1, name: 'Renamed' },
          shelf: { id: 3, name: 'Fiction' },
          chapters: [{ id: 4, title: 'One' }],
          genres: [{ id: 2, name: 'Renamed', rank: 1 }]
        },
        upsertOptions,
        { processOverrides: true, processRelates: true }
      )
      const data = processor.getData()
      expect(data).toBeInstanceOf(Book)
      expect(data.author).toBeInstanceOf(Author)
      expect({ ...data.author }).toEqual({ id: 1 })
      expect({ ...data.shelf }).toEqual({ id: 3, name: 'Fiction' })
      expect(data.chapters.map((chapter: Chapter) => ({ ...chapter })))
        .toEqual([{ id: 4, title: 'One' }])
      // The pivot table's extra properties survive the reduction:
      expect(data.genres.map((genre: Genre) => ({ ...genre })))
        .toEqual([{ id: 2, rank: 1 }])
    })

    it('relates according to the global option without overrides', () => {
      const processor = new DitoGraphProcessor(
        Book,
        [{ title: 'Dune', author: { id: 1, name: 'Renamed' } }],
        { relate: true },
        { processRelates: true }
      )
      const data = processor.getData()
      expect(data).toHaveLength(1)
      expect({ ...data[0].author }).toEqual({ id: 1 })
      expect(processor.shouldRelate('')).toBeUndefined()
    })

    it('keeps nested data when relating is disabled', () => {
      const processor = new DitoGraphProcessor(
        Book,
        { title: 'Dune', author: { id: 1, name: 'Renamed' }, shelf: null },
        { relate: false },
        { processRelates: true }
      )
      const data = processor.getData()
      expect({ ...data.author }).toEqual({ id: 1, name: 'Renamed' })
      expect(data.shelf).toBeNull()
    })

    it('converts plain relation data of model instances once', () => {
      const book = createBookGraph({ title: 'Dune' })
      const chapter = { title: 'One' }
      const graph = Object.assign(book, { chapters: [chapter, chapter] })
      const data = new DitoGraphProcessor(Book, graph, {}).getData()
      expect(data).toBe(book)
      expect(data.chapters[0]).toBeInstanceOf(Chapter)
      expect(data.chapters[1]).toBe(data.chapters[0])
    })

    it('keeps relation data that already consists of model instances', () => {
      const book = createBookGraph({
        title: 'Dune',
        chapters: [{ title: 'A' }]
      })
      const { chapters } = book
      const data = new DitoGraphProcessor(Book, book, {}).getData()
      expect(data.chapters).toBe(chapters)
    })

    it('keeps empty entries in arrays', () => {
      const processor = new DitoGraphProcessor(
        Book,
        [null, { title: 'Dune', author: { id: 1, name: 'Renamed' } }],
        { relate: true },
        { processOverrides: true, processRelates: true }
      )
      const [empty, book] = processor.getData()
      expect(empty).toBeNull()
      expect({ ...book.author }).toEqual({ id: 1 })
    })

    it('handles empty data', () => {
      const processor = new DitoGraphProcessor(Book, null, {})
      expect(processor.getData()).toBeUndefined()
    })
  })

  describe('insertDitoGraph()', () => {
    it('relates referenced models without modifying them', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        author: { id: author.id, name: 'Changed' },
        genres: [{ id: fantasy.id, name: 'Changed', rank: 2 }]
      })
      expect(book.authorId).toBe(author.id)
      expect((await Author.query().findById(author.id))!.name).toBe('Ursula')
      expect((await Genre.query().findById(fantasy.id))!.name).toBe('Fantasy')
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 2 }
      ])
    })

    it('inserts the data of owned and non-relating relations', async () => {
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        shelf: { name: 'Fantasy shelf' },
        chapters: [
          { title: 'Warriors in the Mist', position: 1 },
          { title: 'The Shadow', position: 2 }
        ]
      })
      const shelves = await Shelf.query()
      expect(shelves.map(shelf => shelf.name)).toEqual(['Fantasy shelf'])
      expect(book.shelfId).toBe(shelves[0].id)
      const chapters = await Chapter.query().where('bookId', book.id)
      expect(chapters.map(chapter => chapter.title).sort()).toEqual([
        'The Shadow',
        'Warriors in the Mist'
      ])
    })

    it('inserts new models in relating relations', async () => {
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        genres: [{ name: 'Fantasy' }]
      })
      expect(book.genres.map(genre => genre.name)).toEqual(['Fantasy'])
    })

    it('inserts multiple root models', async () => {
      await Book.query().insertDitoGraph([
        { title: 'First' },
        { title: 'Second' }
      ])
      const books = await Book.query().orderBy('title')
      expect(books.map(book => book.title)).toEqual(['First', 'Second'])
    })
  })

  describe('upsertDitoGraph()', () => {
    async function insertBook() {
      const [fantasy, drama] = await Genre.query().insert([
        { name: 'Fantasy' },
        { name: 'Drama' }
      ])
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        chapters: [
          { title: 'One', position: 1 },
          { title: 'Two', position: 2 }
        ],
        genres: [
          { id: fantasy.id, rank: 1 },
          { id: drama.id, rank: 2 }
        ]
      })
      return { book, fantasy, drama }
    }

    it('deletes removed owned models but only unrelates others', async () => {
      const { book, fantasy, drama } = await insertBook()
      const [one, two] = book.chapters
      await Book.query().upsertDitoGraph({
        id: book.id,
        title: 'Earthsea',
        chapters: [{ id: two.id, title: 'Two (revised)' }],
        genres: [{ id: drama.id, rank: 2 }]
      })
      expect(await Chapter.query().findById(one.id)).toBeUndefined()
      expect((await Chapter.query().findById(two.id))!.title).toBe(
        'Two (revised)'
      )
      expect(await Genre.query().findById(fantasy.id)).toBeDefined()
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('inserts missing root models', async () => {
      await Book.query().upsertDitoGraph({ title: 'New' })
      expect((await Book.query()).map(book => book.title)).toEqual(['New'])
    })

    it('upserts by id with upsertDitoGraphAndFetchById()', async () => {
      const { book } = await insertBook()
      const result = await Book.query().upsertDitoGraphAndFetchById(book.id, {
        title: 'Renamed',
        chapters: [{ title: 'Only' }]
      })
      expect(result.id).toBe(book.id)
      expect(result.title).toBe('Renamed')
      expect(result.chapters.map(chapter => chapter.title)).toEqual(['Only'])
      expect(await Chapter.query().where('bookId', book.id)).toHaveLength(1)
    })

    it('resolves cyclic references within the graph', async () => {
      const result = await Book.query().upsertDitoGraphAndFetch(
        {
          title: 'Earthsea',
          chapters: [
            { '#id': 'first', 'title': 'One', 'position': 1 },
            { title: 'Two', position: 2 }
          ],
          featuredChapter: { '#ref': 'first' }
        },
        { cyclic: true }
      )
      const book = await Book.query().findById(result.id)
      const chapter = await Chapter.query()
        .where({ bookId: book!.id, title: 'One' })
        .first()
      expect(book!.featuredChapterId).toBe(chapter!.id)
      expect(await Chapter.query()).toHaveLength(2)
    })

    it('resolves cyclic references inside arrays', async () => {
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      const result = await Book.query().upsertDitoGraphAndFetch(
        [
          {
            title: 'Earthsea',
            chapters: [{ '#id': 'shared', 'title': 'One' }],
            genres: [{ id: fantasy.id, rank: 1 }]
          },
          {
            title: 'Tehanu',
            featuredChapter: { '#ref': 'shared' }
          }
        ],
        { cyclic: true }
      )
      const books = await Book.query().findByIds(
        result.map((book: Book) => book.id)
      )
      const [chapter] = await Chapter.query()
      const tehanu = books.find(book => book.title === 'Tehanu')
      expect(tehanu!.featuredChapterId).toBe(chapter.id)
    })
  })

  describe('patchDitoGraph() and updateDitoGraph()', () => {
    it('patches only the given properties', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        author: { id: author.id }
      })
      await Book.query().patchDitoGraph({
        id: book.id,
        chapters: [{ title: 'One' }]
      })
      const patched = await Book.query().findById(book.id)
      expect(patched!.title).toBe('Earthsea')
      expect(patched!.authorId).toBe(author.id)
      expect(await Chapter.query().where('bookId', book.id)).toHaveLength(1)
    })

    it('patches by id with patchDitoGraphAndFetchById()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().patchDitoGraphAndFetchById(book.id, {
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })

    it('rejects patches of missing models instead of inserting', async () => {
      await expect(
        Book.query().patchDitoGraph({ id: 1234, title: 'Missing' })
      ).rejects.toThrow()
      expect(await Book.query()).toHaveLength(0)
    })

    it('validates changed models on updates', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      await expect(
        // @ts-expect-error -- Invalid data is the point of this test.
        Book.query().updateDitoGraph({ id: book.id, title: 5 })
      ).rejects.toThrow(/not valid/)
      const result = await Book.query().updateDitoGraphAndFetchById(book.id, {
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })

    it('fetches the patched graph with patchDitoGraphAndFetch()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().patchDitoGraphAndFetch({
        id: book.id,
        chapters: [{ title: 'One' }]
      })
      expect(result.chapters.map(chapter => chapter.title)).toEqual(['One'])
    })

    it('fetches the updated graph with updateDitoGraphAndFetch()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().updateDitoGraphAndFetch({
        id: book.id,
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })
  })

  describe('filterGraph()', () => {
    it('removes relations not contained in the expression', () => {
      const book = createBookGraph({
        title: 'Earthsea',
        author: { name: 'Ursula' },
        shelf: { name: 'Fantasy' },
        chapters: [{ title: 'One' }]
      })
      const result = Book.filterGraph(book, '[author, chapters]')
      expect(result).toBe(book)
      expect(book.author).toBeInstanceOf(Author)
      expect(book.chapters).toHaveLength(1)
      expect(book).not.toHaveProperty('shelf')
    })

    it('filters nested relations recursively', () => {
      const books = [
        createBookGraph({
          title: 'Earthsea',
          featuredChapter: { title: 'One' },
          chapters: [{ title: 'One' }]
        })
      ]
      Book.filterGraph(books, 'chapters')
      expect(books[0]).not.toHaveProperty('featuredChapter')
      expect(books[0].chapters).toHaveLength(1)
    })

    it('filters plain graph data', () => {
      const result = Book.filterGraph(
        { title: 'Earthsea', shelf: { name: 'Fantasy' } },
        'author'
      )
      expect(result).toBeInstanceOf(Book)
      expect(result).toMatchObject({ title: 'Earthsea' })
      expect(result).not.toHaveProperty('shelf')
    })
  })

  describe('populateGraph()', () => {
    it('loads the full data of leaf references', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const book = createBookGraph({
        title: 'Earthsea',
        author: { id: author.id }
      })
      const result = await Book.populateGraph(book, 'author')
      expect(result).toBe(book)
      expect(book.author!.name).toBe('Ursula')
    })

    it('eager-loads relations that are missing in the graph', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const stored = await Book.query().insert({
        title: 'Earthsea',
        authorId: author.id
      })
      const book = createBookGraph({ id: stored.id, title: 'Earthsea' })
      await Book.populateGraph([book], 'author')
      expect(book.author!.name).toBe('Ursula')
    })

    it('respects relations that are explicitly null', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const stored = await Book.query().insert({
        title: 'Earthsea',
        authorId: author.id
      })
      const book = createBookGraph({ id: stored.id, title: 'x', author: null })
      await Book.populateGraph(book, 'author')
      expect(book.author).toBeNull()
    })

    it('loads the rest of the path for non-leaf references', async () => {
      const stored = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        chapters: [
          { title: 'Two', position: 2 },
          { title: 'One', position: 1 }
        ]
      })
      const book = createBookGraph({ id: stored.id })
      await Book.populateGraph(book, 'chapters')
      expect(book.title).toBe('Earthsea')
      expect(book.chapters.map(chapter => chapter.title)).toEqual([
        'One',
        'Two'
      ])
    })

    it('loads nested references through populated relations', async () => {
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        chapters: [{ title: 'One' }]
      })
      const graph = createBookGraph({
        title: 'Copy',
        featuredChapter: { id: book.chapters[0].id }
      })
      await Book.populateGraph(graph, 'featuredChapter')
      expect(graph.featuredChapter!.title).toBe('One')
    })

    it('populates plain graph data', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const result = await Book.populateGraph(
        { title: 'Earthsea', author: { id: author.id } },
        'author'
      )
      expect(result.author!.name).toBe('Ursula')
    })

    it('loads the rest of the path for nested references', async () => {
      const book = await Book.query().insertDitoGraphAndFetch({
        title: 'Earthsea',
        chapters: [{ title: 'One' }]
      })
      const graph = createBookGraph({
        title: 'Copy',
        chapters: [{ id: book.chapters[0].id }]
      })
      await Book.populateGraph(graph, 'chapters(ordered).book')
      const [chapter] = graph.chapters
      expect(chapter.title).toBe('One')
      expect(chapter.book!.title).toBe('Earthsea')
    })

    it('stops following paths through empty relations', async () => {
      const graph = createBookGraph({ title: 'Earthsea', chapters: [] })
      await Book.populateGraph(graph, 'chapters.book')
      expect(graph.chapters).toEqual([])
    })

    it('ignores references to models that do not exist', async () => {
      const book = createBookGraph({ title: 'Earthsea', author: { id: 1234 } })
      await Book.populateGraph(book, 'author')
      expect({ ...book.author }).toEqual({ id: 1234 })
    })

    it('ignores items without ids and empty graphs', async () => {
      const book = createBookGraph({ title: 'Earthsea' })
      await Book.populateGraph([book, null], 'author.[]')
      expect(book).not.toHaveProperty('author')
      expect(await Book.populateGraph(null, 'author')).toBeNull()
    })
  })
})
