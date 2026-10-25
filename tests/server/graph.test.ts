import type { ModelProperties } from '@ditojs/server'
import {
  Model,
  DatabaseError,
  GraphError,
  NotFoundError,
  ValidationError
} from '@ditojs/server'
import {
  GraphProcessor,
  ensureModelArray,
  rejectGraphControlProps
  // @ts-expect-error -- The graph module is internal and not exported by the
  // package, so it comes without type declarations.
} from '../../packages/server/src/graph/index.js'
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
      graphOptions: { added: 'insert' }
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

// A library holds bookcases, which hold volumes, where volumes can continue
// other volumes of the same or of other bookcases through `sequelOf`:

class Library extends Model {
  declare id: number
  declare name: string
  declare bookcases: Bookcase[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations = {
    bookcases: {
      relation: 'hasMany',
      from: 'Library.id',
      to: 'Bookcase.libraryId',
      scope: 'ordered',
      owner: true
    }
  } as any
}

class Bookcase extends Model {
  declare id: number
  declare name: string
  declare position: number
  declare libraryId: number | null
  declare volumes: Volume[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    position: { type: 'integer' },
    libraryId: { type: 'integer', foreign: true, nullable: true }
  }

  static override relations = {
    volumes: {
      relation: 'hasMany',
      from: 'Bookcase.id',
      to: 'Volume.bookcaseId',
      scope: 'ordered',
      owner: true
    }
  } as any

  static override scopes = {
    ordered: (query: any) => query.orderBy('position')
  }
}

class Volume extends Model {
  declare id: number
  declare title: string
  declare position: number
  declare bookcaseId: number | null
  declare sequelOfId: number | null
  declare sequelOf: Volume | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    position: { type: 'integer' },
    bookcaseId: { type: 'integer', foreign: true, nullable: true }
  }

  static override relations = {
    sequelOf: {
      relation: 'belongsTo',
      from: 'Volume.sequelOfId',
      to: 'Volume.id',
      nullable: true
    }
  } as any

  static override scopes = {
    ordered: (query: any) => query.orderBy('position')
  }
}

// Graphs of references are partial data, so skip their validation:
function createBookGraph(json: object): Book {
  return Book.fromJson(json, { skipValidation: true })
}

describe('Dito.js graph handling', () => {
  const app = createTestApp({
    models: {
      Author,
      Shelf,
      Genre,
      Chapter,
      Book,
      Library,
      Bookcase,
      Volume
    }
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
      'Volume',
      'Bookcase',
      'Library',
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

  async function insertBook() {
    const [fantasy, drama] = await Genre.query().insert([
      { name: 'Fantasy' },
      { name: 'Drama' }
    ])
    const book = await Book.query().insertGraphAndFetch({
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

  async function getChapterTitles(bookId: number) {
    const chapters = await Chapter.query().where({ bookId }).orderBy('id')
    return chapters.map(chapter => chapter.title)
  }

  describe('GraphProcessor', () => {
    const upsertDefaults = {
      options: { allowRefs: true, root: { added: 'insert' } },
      owner: { removed: 'delete', added: 'insert' },
      related: { removed: 'unrelate', added: 'relate' }
    }

    it('resolves the settings of each relation path in the graph', () => {
      const processor = new GraphProcessor(
        Book,
        {
          title: 'Dune',
          author: { id: 1 },
          shelf: { name: 'Fiction' },
          chapters: [{ title: 'One', book: { id: 2 } }],
          genres: [{ id: 2 }]
        },
        {},
        upsertDefaults
      )
      expect(processor.getOptions()).toEqual({
        allowRefs: true,
        strict: true,
        root: { added: 'insert' },
        relations: {
          'author': { removed: 'unrelate', added: 'relate' },
          // `shelf` overrides `added` through its `graphOptions`:
          'shelf': { removed: 'unrelate', added: 'insert' },
          'chapters': { removed: 'delete', added: 'insert' },
          'chapters.book': { removed: 'unrelate', added: 'relate' },
          'genres': { removed: 'unrelate', added: 'relate' }
        }
      })
    })

    it('resolves settings for relations set to null or empty', () => {
      // Strict upserts need `removed` for these too:
      const processor = new GraphProcessor(
        Book,
        { title: 'Dune', author: null, chapters: [] },
        {},
        upsertDefaults
      )
      expect(processor.getOptions().relations).toEqual({
        author: { removed: 'unrelate', added: 'relate' },
        chapters: { removed: 'delete', added: 'insert' }
      })
    })

    it('applies the root and relation settings of the call', () => {
      const relations = {
        '*': { removed: 'preserve' },
        'genres': { added: 'insert' }
      }
      const processor = new GraphProcessor(
        Book,
        {
          title: 'Dune',
          chapters: [{ title: 'One', book: { id: 2 } }],
          genres: [{ id: 2, name: 'Myth' }]
        },
        { root: { kept: 'update' }, relations, fetchStrategy: 'Everything' },
        upsertDefaults
      )
      expect(processor.getOptions()).toEqual({
        allowRefs: true,
        fetchStrategy: 'Everything',
        strict: true,
        root: { added: 'insert', kept: 'update' },
        relations: {
          ...relations,
          'chapters': { removed: 'preserve', added: 'insert' },
          'chapters.book': { removed: 'preserve', added: 'relate' },
          'genres': { removed: 'preserve', added: 'insert' }
        }
      })
      // Genres aren't related anymore, so they keep their data:
      expect({ ...processor.getData().genres[0] }).toEqual({
        id: 2,
        name: 'Myth'
      })
    })

    it('leaves out the settings that insertGraph() does not take', () => {
      const processor = new GraphProcessor(
        Book,
        { title: 'Dune', chapters: [{ title: 'One' }] },
        { relations: { chapters: { removed: 'preserve', kept: 'patch' } } },
        {
          options: {},
          owner: { added: 'insert' },
          related: { added: 'relate' }
        }
      )
      // Objection.js still rejects them in the entry of the call:
      expect(processor.getOptions().relations).toEqual({
        chapters: { added: 'insert' }
      })
    })

    it('reduces related models to references, keeping owned data', () => {
      const processor = new GraphProcessor(
        Book,
        {
          title: 'Dune',
          author: { id: 1, name: 'Renamed' },
          shelf: { id: 3, name: 'Fiction' },
          chapters: [{ id: 4, title: 'One' }],
          genres: [{ id: 2, name: 'Renamed', rank: 1 }]
        },
        {},
        upsertDefaults
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

    it('keeps the data of new models in relating relations', () => {
      const processor = new GraphProcessor(
        Book,
        [{ title: 'Dune', author: { name: 'Frank' } }],
        {},
        upsertDefaults
      )
      const data = processor.getData()
      expect(data).toHaveLength(1)
      expect({ ...data[0].author }).toEqual({ name: 'Frank' })
    })

    it('converts plain relation data of model instances once', () => {
      const book = createBookGraph({ title: 'Dune' })
      const chapter = { title: 'One' }
      const graph = Object.assign(book, { chapters: [chapter, chapter] })
      const [data] = ensureModelArray(Book, graph, { skipValidation: true })
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
      const [data] = ensureModelArray(Book, book, { skipValidation: true })
      expect(data.chapters).toBe(chapters)
    })

    it('keeps empty entries in arrays', () => {
      const processor = new GraphProcessor(
        Book,
        [null, { title: 'Dune', author: { id: 1, name: 'Renamed' } }],
        {},
        upsertDefaults
      )
      const [empty, book] = processor.getData()
      expect(empty).toBeNull()
      expect({ ...book.author }).toEqual({ id: 1 })
    })

    it('handles empty data', () => {
      const processor = new GraphProcessor(Book, null, {}, upsertDefaults)
      expect(processor.getData()).toBeUndefined()
    })

    it('passes on relation values that are neither models nor arrays', () => {
      // Invalid relation values are left for validation to report:
      const book = createBookGraph({ title: 'Dune' })
      Object.assign(book, { author: 'Frank' })
      const processor = new GraphProcessor(Book, book, {}, upsertDefaults)
      expect(processor.getData().author).toBe('Frank')
    })
  })

  describe('insertGraph()', () => {
    it('relates referenced models without modifying them', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      const book = await Book.query().insertGraphAndFetch({
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
      const book = await Book.query().insertGraphAndFetch({
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
      const book = await Book.query().insertGraphAndFetch({
        title: 'Earthsea',
        genres: [{ name: 'Fantasy' }]
      })
      expect(book.genres.map(genre => genre.name)).toEqual(['Fantasy'])
    })

    it("inserts related models with ids with `added: 'insert'`", async () => {
      // Seeds insert their full graphs this way:
      const book = await Book.query().insertGraphAndFetch(
        {
          title: 'Earthsea',
          author: { id: 1001, name: 'Ursula' },
          genres: [{ id: 1002, name: 'Fantasy', rank: 1 }]
        },
        { relations: { '*': { added: 'insert' } } }
      )
      expect(book.authorId).toBe(1001)
      expect(await Author.query()).toEqual([{ id: 1001, name: 'Ursula' }])
      expect(await Genre.query()).toEqual([
        { id: 1002, name: 'Fantasy', rank: null }
      ])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: 1002, rank: 1 }
      ])
    })

    it('inserts multiple root models', async () => {
      await Book.query().insertGraph([
        { title: 'First' },
        { title: 'Second' }
      ])
      const books = await Book.query().orderBy('title')
      expect(books.map(book => book.title)).toEqual(['First', 'Second'])
    })

    it('rolls back all models of the graph in transactions', async () => {
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      await expect(
        Book.transaction(async trx =>
          // Without relating, the existing genre is inserted again and fails
          // after the book and its chapter:
          Book.query(trx).insertGraph(
            {
              title: 'Earthsea',
              chapters: [{ title: 'One' }],
              genres: [{ id: fantasy.id, name: 'Fantasy' }]
            },
            { relations: { genres: { added: 'insert' } } }
          )
        )
      ).rejects.toThrow(DatabaseError)
      expect(await Book.query()).toEqual([])
      expect(await Chapter.query()).toEqual([])
      expect(await Genre.query()).toEqual([
        { id: fantasy.id, name: 'Fantasy', rank: null }
      ])
    })

    it('rolls back all models of the graph outside transactions', async () => {
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      await expect(
        Book.query().insertGraph(
          {
            title: 'Earthsea',
            chapters: [{ title: 'One' }],
            genres: [{ id: fantasy.id, name: 'Fantasy' }]
          },
          { relations: { genres: { added: 'insert' } } }
        )
      ).rejects.toThrow(DatabaseError)
      expect(await Book.query()).toEqual([])
      expect(await Chapter.query()).toEqual([])
      expect(await Genre.query()).toEqual([
        { id: fantasy.id, name: 'Fantasy', rank: null }
      ])
    })

    it('reports the data paths of invalid nested models', async () => {
      const getErrorPaths = async (data: any) => {
        const error = await Book.query()
          .insertGraph(data)
          .catch(error => error)
        expect(error).toBeInstanceOf(ValidationError)
        return Object.keys(error.data.errors)
      }
      const chapters = [{ title: 'Prologue' }, { title: 42 }]
      expect(await getErrorPaths({ title: 'Earthsea', chapters })).toEqual([
        'chapters/1/title'
      ])
      // Array input starts with the index of the invalid root model:
      expect(
        await getErrorPaths([
          { title: 'First' },
          { title: 'Earthsea', chapters }
        ])
      ).toEqual(['1/chapters/1/title'])
    })
  })

  describe('upsertGraph()', () => {
    it('deletes removed owned models but only unrelates others', async () => {
      const { book, fantasy, drama } = await insertBook()
      const [one, two] = book.chapters
      await Book.query().upsertGraph({
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

    it('leaves relations alone that are missing in the graph', async () => {
      const { book, fantasy, drama } = await insertBook()
      await Book.query().upsertGraph({ id: book.id, title: 'Tehanu' })
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('unrelates to-one relations that are set to null', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const book = await Book.query().insertGraphAndFetch({
        title: 'Earthsea',
        author: { id: author.id }
      })
      await Book.query().upsertGraph({
        id: book.id,
        title: 'Earthsea',
        author: null
      })
      expect((await Book.query().findById(book.id))!.authorId).toBeNull()
      expect(await Author.query().findById(author.id)).toEqual({
        id: author.id,
        name: 'Ursula'
      })
    })

    it('inserts replaced models of non-relating relations', async () => {
      const book = await Book.query().insertGraphAndFetch({
        title: 'Earthsea',
        shelf: { name: 'Top' }
      })
      await Book.query().upsertGraph({
        id: book.id,
        title: 'Earthsea',
        shelf: { name: 'Bottom' }
      })
      const shelves = await Shelf.query().orderBy('id')
      expect(shelves.map(shelf => shelf.name)).toEqual(['Top', 'Bottom'])
      expect((await Book.query().findById(book.id))!.shelfId).toBe(
        shelves[1].id
      )
    })

    it("keeps removed owned models with `removed: 'preserve'`", async () => {
      const { book } = await insertBook()
      const [, two] = book.chapters
      await Book.query().upsertGraph(
        {
          id: book.id,
          title: 'Earthsea',
          chapters: [{ id: two.id, title: 'Two (revised)' }, { title: 'Three' }]
        },
        { relations: { chapters: { removed: 'preserve' } } }
      )
      expect(await getChapterTitles(book.id)).toEqual([
        'One',
        'Two (revised)',
        'Three'
      ])
    })

    it("keeps removed related models with `removed: 'preserve'`", async () => {
      const { book, fantasy, drama } = await insertBook()
      await Book.query().upsertGraph(
        { id: book.id, title: 'Earthsea', genres: [{ id: drama.id, rank: 3 }] },
        { relations: { genres: { removed: 'preserve' } } }
      )
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: drama.id, rank: 3 }
      ])
    })

    it("deletes removed related models with `removed: 'delete'`", async () => {
      const { book, drama } = await insertBook()
      await Book.query().upsertGraph(
        { id: book.id, title: 'Earthsea', genres: [{ id: drama.id, rank: 2 }] },
        { relations: { genres: { removed: 'delete' } } }
      )
      expect(await Genre.query()).toEqual([
        { id: drama.id, name: 'Drama', rank: null }
      ])
    })

    it("inserts related models with unknown ids with `added: 'insert'`", async () => {
      const { book, fantasy, drama } = await insertBook()
      await Book.query().upsertGraph(
        {
          id: book.id,
          title: 'Earthsea',
          genres: [
            { id: fantasy.id, rank: 1 },
            { id: 1234, name: 'Myth', rank: 2 }
          ]
        },
        { relations: { genres: { added: 'insert' } } }
      )
      expect(await Genre.query().orderBy('id')).toEqual([
        { id: fantasy.id, name: 'Fantasy', rank: null },
        { id: drama.id, name: 'Drama', rank: null },
        { id: 1234, name: 'Myth', rank: null }
      ])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: 1234, rank: 2 }
      ])
    })

    it("rejects owned models with unknown ids with `added: 'throw'`", async () => {
      const { book } = await insertBook()
      await expect(
        Book.query().upsertGraph(
          {
            id: book.id,
            title: 'Earthsea',
            chapters: [{ id: 1234, title: 'X' }]
          },
          { relations: { chapters: { added: 'throw' } } }
        )
      ).rejects.toThrow(NotFoundError)
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
    })

    it('rolls back all changes of the graph outside transactions', async () => {
      const { book, fantasy, drama } = await insertBook()
      const myth = await Genre.query().insert({ name: 'Myth' })
      await expect(
        Book.query().upsertGraph(
          {
            id: book.id,
            title: 'Earthsea',
            chapters: [{ id: book.chapters[1].id, title: 'Two (revised)' }],
            // Without relating, the existing genre is inserted again and fails
            // after the chapters are deleted and updated:
            genres: [{ id: myth.id, name: 'Myth' }]
          },
          { relations: { genres: { added: 'insert' } } }
        )
      ).rejects.toThrow(DatabaseError)
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
      expect(await Genre.query().orderBy('id')).toEqual([
        { id: fantasy.id, name: 'Fantasy', rank: null },
        { id: drama.id, name: 'Drama', rank: null },
        { id: myth.id, name: 'Myth', rank: null }
      ])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('inserts missing root models with their ids', async () => {
      await Book.query().upsertGraph({ id: 1234, title: 'New' })
      expect(await Book.query()).toEqual([
        {
          id: 1234,
          title: 'New',
          authorId: null,
          shelfId: null,
          featuredChapterId: null
        }
      ])
    })

    describe('graph control properties of clients', () => {
      // The data of the tests is client data, which the model types don't
      // describe. `GraphError` responds with 400.
      const expectToReject = (callback: () => unknown, message: string) => {
        expect(callback).toThrow(GraphError)
        expect(callback).toThrow(message)
      }

      it('rejects #unrelate on related references', async () => {
        const { book, fantasy, drama } = await insertBook()
        const data: any = {
          id: book.id,
          genres: [{ 'id': fantasy.id, '#unrelate': true }, { id: drama.id }]
        }
        expectToReject(
          () =>
            Book.query().patchGraph(data, {
              relations: { genres: { removed: 'preserve' } }
            }),
          `Unsupported graph control property '#unrelate' at 'genres/0'.`
        )
        expect(await getBookGenreRows(book.id)).toEqual([
          { genreId: fantasy.id, rank: 1 },
          { genreId: drama.id, rank: 2 }
        ])
      })

      it('rejects #delete on owned models', async () => {
        const { book } = await insertBook()
        const [one, two] = book.chapters
        const data: any = {
          id: book.id,
          chapters: [{ 'id': one.id, '#delete': true }, { id: two.id }]
        }
        expectToReject(
          () =>
            Book.query().patchGraph(data, {
              relations: { chapters: { removed: 'preserve' } }
            }),
          `Unsupported graph control property '#delete' at 'chapters/0'.`
        )
        expect(await Chapter.query().findById(one.id)).toBeDefined()
      })

      it('rejects #dbRef in relations', async () => {
        const other = await Book.query().insertGraphAndFetch({
          title: 'Dune',
          chapters: [{ title: 'Prologue', position: 1 }]
        })
        const [foreign] = other.chapters
        const data: any = {
          title: 'Earthsea',
          chapters: [{ '#dbRef': foreign.id }]
        }
        expectToReject(
          () => Book.query().insertGraph(data),
          `Unsupported graph control property '#dbRef' at 'chapters/0'.`
        )
        expect((await Chapter.query().findById(foreign.id))!.bookId).toBe(
          other.id
        )
      })

      it('rejects them in arrays passed to patchAndFetch() & co.', async () => {
        const { book } = await insertBook()
        const [one] = book.chapters
        const data: any = [
          { id: book.id, chapters: [{ 'id': one.id, '#delete': true }] }
        ]
        const message = `Unsupported graph control property '#delete' at '0/chapters/0'.`
        expectToReject(() => Book.query().patchAndFetch(data), message)
        expectToReject(() => Book.query().updateAndFetch(data), message)
        expectToReject(() => Book.query().upsertAndFetch(data), message)
        expect(await Chapter.query().findById(one.id)).toBeDefined()
      })

      it('keeps #id and #ref references within the graph', async () => {
        const [first, second] = await Book.query().insertGraphAndFetch([
          {
            title: 'Tehanu',
            genres: [{ '#id': 'fantasy', 'name': 'Fantasy' }]
          },
          { title: 'Tales from Earthsea', genres: [{ '#ref': 'fantasy' }] }
        ])
        expect(second.genres).toHaveLength(1)
        expect(second.genres[0].id).toBe(first.genres[0].id)
      })
    })

    it('inserts missing root models', async () => {
      await Book.query().upsertGraph({ title: 'New' })
      expect((await Book.query()).map(book => book.title)).toEqual(['New'])
    })

    it('upserts by id with upsertGraphAndFetchById()', async () => {
      const { book } = await insertBook()
      const result = await Book.query().upsertGraphAndFetchById(book.id, {
        title: 'Renamed',
        chapters: [{ title: 'Only' }]
      })
      expect(result.id).toBe(book.id)
      expect(result.title).toBe('Renamed')
      expect(result.chapters.map(chapter => chapter.title)).toEqual(['Only'])
      expect(await Chapter.query().where('bookId', book.id)).toHaveLength(1)
    })

    it('resolves cyclic references within the graph', async () => {
      const result = await Book.query().upsertGraphAndFetch({
        title: 'Earthsea',
        chapters: [
          { '#id': 'first', 'title': 'One', 'position': 1 },
          { title: 'Two', position: 2 }
        ],
        featuredChapter: { '#ref': 'first' }
      })
      const book = await Book.query().findById(result.id)
      const chapter = await Chapter.query()
        .where({ bookId: book!.id, title: 'One' })
        .first()
      expect(book!.featuredChapterId).toBe(chapter!.id)
      expect(await Chapter.query()).toHaveLength(2)
    })

    it('resolves cyclic references with insertGraph()', async () => {
      const result = await Book.query().insertGraphAndFetch({
        title: 'Earthsea',
        chapters: [{ '#id': 'first', 'title': 'One' }],
        featuredChapter: { '#ref': 'first' }
      })
      const book = await Book.query().findById(result.id)
      const [chapter] = await Chapter.query()
      expect(chapter.bookId).toBe(book!.id)
      expect(book!.featuredChapterId).toBe(chapter.id)
    })

    it('resolves cyclic references when upserting an existing root', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      await Book.query().upsertGraph({
        id: book.id,
        title: 'Earthsea',
        chapters: [{ '#id': 'first', 'title': 'One' }],
        featuredChapter: { '#ref': 'first' }
      })
      const [chapter] = await Chapter.query()
      expect(chapter.bookId).toBe(book.id)
      expect((await Book.query().findById(book.id))!.featuredChapterId).toBe(
        chapter.id
      )
    })

    it('resolves references into other roots inside arrays', async () => {
      const fantasy = await Genre.query().insert({ name: 'Fantasy' })
      const result = await Book.query().upsertGraphAndFetch([
        {
          title: 'Earthsea',
          chapters: [{ '#id': 'shared', 'title': 'One' }],
          genres: [{ id: fantasy.id, rank: 1 }]
        },
        {
          title: 'Tehanu',
          featuredChapter: { '#ref': 'shared' }
        }
      ])
      const books = await Book.query().findByIds(
        result.map((book: Book) => book.id)
      )
      const [chapter] = await Chapter.query()
      const tehanu = books.find(book => book.title === 'Tehanu')
      expect(tehanu!.featuredChapterId).toBe(chapter.id)
    })

    it('rejects cycles that only go through property references', async () => {
      await expect(
        Book.query().upsertGraph({
          // The book's title depends on the chapter, which depends on the book
          // through the `chapters` relation:
          title: '#ref{first.title}',
          chapters: [{ '#id': 'first', 'title': 'One' }]
        })
      ).rejects.toThrow('the object graph contains cyclic references')
      expect(await Book.query()).toHaveLength(0)
      expect(await Chapter.query()).toHaveLength(0)
    })

    it('rejects cycles whose foreign key is not nullable', async () => {
      const alterFeaturedChapterId = (nullable: boolean) =>
        app.knex.schema.alterTable('Book', table => {
          const column = table.integer('featuredChapterId')
          ;(nullable ? column.nullable() : column.notNullable()).alter()
        })
      await alterFeaturedChapterId(false)
      try {
        await expect(
          Book.transaction(async trx =>
            Book.query(trx).upsertGraph({
              title: 'Earthsea',
              chapters: [{ '#id': 'first', 'title': 'One' }],
              featuredChapter: { '#ref': 'first' }
            })
          )
        ).rejects.toThrow(/featuredChapterId/)
        expect(await Book.query()).toHaveLength(0)
        expect(await Chapter.query()).toHaveLength(0)
      } finally {
        await alterFeaturedChapterId(true)
      }
    })
  })

  describe('nested cyclic references across lists', () => {
    // Returns the stored volumes as `[bookcase, title, sequel title]` rows,
    // sorted by bookcase and position, to compare the stored graph as a whole:
    async function getStoredVolumes(libraryId: number) {
      const library = await Library.query()
        .findById(libraryId)
        .withGraph('bookcases.volumes.sequelOf')
      return library!.bookcases.flatMap(bookcase =>
        bookcase.volumes.map(volume => [
          bookcase.name,
          volume.title,
          volume.sequelOf?.title ?? null
        ])
      )
    }

    function getTitles(library: Library) {
      return library.bookcases.map(bookcase => [
        bookcase.name,
        bookcase.volumes.map(volume => volume.title)
      ])
    }

    function findVolume(library: Library, title: string) {
      return library.bookcases
        .flatMap(bookcase => bookcase.volumes)
        .find(volume => volume.title === title)!
    }

    it('resolves references within and across lists on insert', async () => {
      const library = await Library.query().insertGraphAndFetch({
        name: 'City',
        bookcases: [
          {
            name: 'Fiction',
            position: 1,
            volumes: [
              // Forward reference into another bookcase:
              {
                title: 'Heretics',
                position: 4,
                sequelOf: { '#ref': 'emperor' }
              },
              { '#id': 'dune', 'title': 'Dune', 'position': 1 },
              // Forward reference within the same bookcase:
              {
                '#id': 'children',
                'title': 'Children',
                'position': 3,
                'sequelOf': { '#ref': 'messiah' }
              },
              {
                '#id': 'messiah',
                'title': 'Messiah',
                'position': 2,
                'sequelOf': { '#ref': 'dune' }
              }
            ]
          },
          {
            name: 'Classics',
            position: 2,
            volumes: [
              // Backward reference into another bookcase:
              {
                '#id': 'emperor',
                'title': 'Emperor',
                'position': 1,
                'sequelOf': { '#ref': 'children' }
              }
            ]
          }
        ]
      })
      // The returned lists follow the order scope of the relations, not the
      // order of the input:
      expect(getTitles(library)).toEqual([
        ['Fiction', ['Dune', 'Messiah', 'Children', 'Heretics']],
        ['Classics', ['Emperor']]
      ])
      expect(findVolume(library, 'Heretics').sequelOfId).toBe(
        findVolume(library, 'Emperor').id
      )
      expect(await getStoredVolumes(library.id)).toEqual([
        ['Fiction', 'Dune', null],
        ['Fiction', 'Messiah', 'Dune'],
        ['Fiction', 'Children', 'Messiah'],
        ['Fiction', 'Heretics', 'Emperor'],
        ['Classics', 'Emperor', 'Children']
      ])
      // References don't create additional rows:
      expect(await Library.query()).toHaveLength(1)
      expect(await Bookcase.query()).toHaveLength(2)
      expect(await Volume.query()).toHaveLength(5)
    })

    it('upserts an existing graph with references across lists', async () => {
      const existing = await Library.query().insertGraphAndFetch({
        name: 'City',
        bookcases: [
          {
            name: 'Fiction',
            position: 1,
            volumes: [
              { '#id': 'dune', 'title': 'Dune', 'position': 1 },
              {
                title: 'Messiah',
                position: 2,
                sequelOf: { '#ref': 'dune' }
              },
              { title: 'Obsolete', position: 3 }
            ]
          },
          {
            name: 'Classics',
            position: 2,
            volumes: [{ title: 'Odyssey', position: 1 }]
          }
        ]
      })
      const [fiction, classics] = existing.bookcases
      const dune = findVolume(existing, 'Dune')
      const messiah = findVolume(existing, 'Messiah')
      const obsolete = findVolume(existing, 'Obsolete')
      const odyssey = findVolume(existing, 'Odyssey')

      // Both the bookcases and the volumes are deliberately not sorted by
      // their position, to show that the input doesn't need pre-sorting:
      const library = await Library.query().upsertGraphAndFetch({
        id: existing.id,
        name: 'City',
        bookcases: [
          {
            id: classics.id,
            name: 'Classics',
            position: 2,
            volumes: [
              // New volume referencing a new volume in the same bookcase:
              {
                '#id': 'return',
                'title': 'Return',
                'position': 3,
                'sequelOf': { '#ref': 'nostos' }
              },
              // New volume referencing an existing one by id:
              {
                '#id': 'nostos',
                'title': 'Nostos',
                'position': 2,
                'sequelOf': { id: odyssey.id }
              },
              { id: odyssey.id, title: 'Odyssey (revised)', position: 1 }
            ]
          },
          // New bookcase referencing an existing volume in another one:
          {
            name: 'Annex',
            position: 3,
            volumes: [
              {
                title: 'Encyclopedia',
                position: 1,
                sequelOf: { '#ref': 'dune' }
              }
            ]
          },
          {
            id: fiction.id,
            name: 'Fiction',
            position: 1,
            volumes: [
              // New volume referencing an existing one through `#ref`:
              {
                title: 'Children',
                position: 3,
                sequelOf: { '#ref': 'messiah' }
              },
              {
                '#id': 'messiah',
                'id': messiah.id,
                'title': 'Messiah',
                'position': 2,
                'sequelOf': { id: dune.id }
              },
              // Existing volume referencing a new one in another bookcase:
              {
                '#id': 'dune',
                'id': dune.id,
                'title': 'Dune',
                'position': 1,
                'sequelOf': { '#ref': 'return' }
              }
              // `Obsolete` is left out, and owned, so it gets deleted.
            ]
          }
        ]
      })

      expect(library.id).toBe(existing.id)
      // The returned lists follow the order scope of the relations:
      expect(getTitles(library)).toEqual([
        ['Fiction', ['Dune', 'Messiah', 'Children']],
        ['Classics', ['Odyssey (revised)', 'Nostos', 'Return']],
        ['Annex', ['Encyclopedia']]
      ])
      expect(
        library.bookcases.map(bookcase =>
          bookcase.volumes.map(volume => volume.position)
        )
      ).toEqual([[1, 2, 3], [1, 2, 3], [1]])
      // Existing models keep their ids:
      expect(library.bookcases[0].id).toBe(fiction.id)
      expect(library.bookcases[1].id).toBe(classics.id)
      expect(findVolume(library, 'Dune').id).toBe(dune.id)
      expect(findVolume(library, 'Messiah').id).toBe(messiah.id)
      expect(findVolume(library, 'Odyssey (revised)').id).toBe(odyssey.id)
      expect(findVolume(library, 'Dune').sequelOfId).toBe(
        findVolume(library, 'Return').id
      )

      expect(await getStoredVolumes(library.id)).toEqual([
        ['Fiction', 'Dune', 'Return'],
        ['Fiction', 'Messiah', 'Dune'],
        ['Fiction', 'Children', 'Messiah'],
        ['Classics', 'Odyssey (revised)', null],
        ['Classics', 'Nostos', 'Odyssey (revised)'],
        ['Classics', 'Return', 'Nostos'],
        ['Annex', 'Encyclopedia', 'Dune']
      ])
      expect(await Volume.query().findById(obsolete.id)).toBeUndefined()
      expect(await Library.query()).toHaveLength(1)
      expect(await Bookcase.query()).toHaveLength(3)
      expect(await Volume.query()).toHaveLength(7)
    })

    it('returns upserted lists in order of their scope', async () => {
      const existing = await Library.query().insertGraphAndFetch({
        name: 'City',
        bookcases: [
          {
            name: 'Fiction',
            position: 1,
            volumes: [
              { title: 'A', position: 1 },
              { title: 'B', position: 2 }
            ]
          }
        ]
      })
      const [fiction] = existing.bookcases
      const [a, b] = fiction.volumes
      // Move the existing volumes to the end and insert new ones in between,
      // with the input in reverse order of the new positions:
      const library = await Library.query().upsertGraphAndFetch({
        id: existing.id,
        name: 'City',
        bookcases: [
          {
            id: fiction.id,
            name: 'Fiction',
            position: 1,
            volumes: [
              { id: b.id, title: 'B', position: 4, sequelOf: { '#ref': 'c' } },
              { title: 'D', position: 3, sequelOf: { id: a.id } },
              { id: a.id, title: 'A', position: 2 },
              { '#id': 'c', 'title': 'C', 'position': 1 }
            ]
          }
        ]
      })
      expect(getTitles(library)).toEqual([['Fiction', ['C', 'A', 'D', 'B']]])
      expect(await getStoredVolumes(library.id)).toEqual([
        ['Fiction', 'C', null],
        ['Fiction', 'A', null],
        ['Fiction', 'D', 'A'],
        ['Fiction', 'B', 'C']
      ])
    })
  })

  describe('patchGraph() and updateGraph()', () => {
    it('patches only the given properties', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const book = await Book.query().insertGraphAndFetch({
        title: 'Earthsea',
        author: { id: author.id }
      })
      await Book.query().patchGraph({
        id: book.id,
        chapters: [{ title: 'One' }]
      })
      const patched = await Book.query().findById(book.id)
      expect(patched!.title).toBe('Earthsea')
      expect(patched!.authorId).toBe(author.id)
      expect(await Chapter.query().where('bookId', book.id)).toHaveLength(1)
    })

    it('patches by id with patchGraphAndFetchById()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().patchGraphAndFetchById(book.id, {
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })

    it('deletes and unrelates removed models like upserts', async () => {
      const { book, drama } = await insertBook()
      const [, two] = book.chapters
      await Book.query().patchGraph({
        id: book.id,
        chapters: [{ id: two.id }],
        genres: [{ id: drama.id, rank: 2 }]
      })
      expect(await getChapterTitles(book.id)).toEqual(['Two'])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('rejects owned models with unknown ids instead of inserting', async () => {
      const { book } = await insertBook()
      await expect(
        Book.query().patchGraph({
          id: book.id,
          chapters: [{ id: 1234, title: 'X' }]
        })
      ).rejects.toThrow(NotFoundError)
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
    })

    it('rejects patches of missing models instead of inserting', async () => {
      await expect(
        Book.query().patchGraph({ id: 1234, title: 'Missing' })
      ).rejects.toThrow()
      expect(await Book.query()).toHaveLength(0)
    })

    it('validates changed models on updates', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      await expect(
        // @ts-expect-error -- Invalid data is the point of this test.
        Book.query().updateGraph({ id: book.id, title: 5 })
      ).rejects.toThrow(/not valid/)
      const result = await Book.query().updateGraphAndFetchById(book.id, {
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })

    it('patches the extra properties of references on updates', async () => {
      const { book, fantasy, drama } = await insertBook()
      await Book.query().updateGraph({
        id: book.id,
        title: 'Earthsea',
        genres: [
          { id: fantasy.id, rank: 7 },
          { id: drama.id, rank: 2 }
        ]
      })
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 7 },
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('fetches the patched graph with patchGraphAndFetch()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().patchGraphAndFetch({
        id: book.id,
        chapters: [{ title: 'One' }]
      })
      expect(result.chapters.map(chapter => chapter.title)).toEqual(['One'])
    })

    it('fetches the updated graph with updateGraphAndFetch()', async () => {
      const book = await Book.query().insert({ title: 'Earthsea' })
      const result = await Book.query().updateGraphAndFetch({
        id: book.id,
        title: 'Tehanu'
      })
      expect(result.title).toBe('Tehanu')
    })
  })

  describe('strict graphs', () => {
    it('rejects related models with unknown ids', async () => {
      const { book, fantasy, drama } = await insertBook()
      await expect(
        Book.query().patchGraph({
          id: book.id,
          genres: [{ id: fantasy.id }, { id: 1234 }]
        })
      ).rejects.toThrow(NotFoundError)
      await expect(
        Book.query().upsertGraph({ id: book.id, author: { id: 1234 } })
      ).rejects.toThrow(NotFoundError)
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: drama.id, rank: 2 }
      ])
      expect((await Book.query().findById(book.id))!.authorId).toBeNull()
    })

    it('rejects keys that contradict their relation', async () => {
      const { book } = await insertBook()
      const other = await Book.query().insert({ title: 'Dune' })
      // `GraphError` responds with 400:
      await expect(
        Book.query().patchGraph({
          id: book.id,
          chapters: [{ title: 'Three', bookId: other.id }]
        })
      ).rejects.toThrow(GraphError)
      expect(await Chapter.query().where('bookId', other.id)).toEqual([])
    })

    it('writes fetched graphs back unchanged', async () => {
      const { book } = await insertBook()
      const author = await Author.query().insert({ name: 'Ursula' })
      await Book.query().patchGraph({ id: book.id, author })
      const fetch = () =>
        Book.query()
          .findById(book.id)
          .withGraphFetched('[author, chapters, featuredChapter, genres]')
      const fetched = await fetch()
      await Book.query().upsertGraph(fetched!)
      await Book.query().patchGraph(fetched!)
      await Book.query().updateGraph(fetched!)
      expect(await fetch()).toEqual(fetched)
    })

    it('takes the settings of relations from the call', async () => {
      const { book, fantasy, drama } = await insertBook()
      await Book.query().patchGraph(
        { id: book.id, chapters: [], genres: [] },
        { relations: { '*': { removed: 'preserve' } } }
      )
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
      expect(await getBookGenreRows(book.id)).toEqual([
        { genreId: fantasy.id, rank: 1 },
        { genreId: drama.id, rank: 2 }
      ])
    })

    it('takes the settings of relations from their `graphOptions`', async () => {
      // `shelf` inserts models with unknown ids, with their data:
      const book = await Book.query().upsertGraphAndFetch({
        title: 'Earthsea',
        shelf: { id: 1234, name: 'Top' }
      })
      expect(book.shelfId).toBe(1234)
      expect(await Shelf.query()).toEqual([{ id: 1234, name: 'Top' }])
    })

    it('rejects the options of non-strict graphs', async () => {
      const { book } = await insertBook()
      await expect(
        Book.query().upsertGraph({ id: book.id }, { noDelete: true })
      ).rejects.toThrow(
        '"noDelete" is not an option of upsertGraph() in strict mode.'
      )
      await expect(
        Book.query().insertGraph({ title: 'Dune' }, { relate: true })
      ).rejects.toThrow(
        '"relate" is not an option of insertGraph() in strict mode.'
      )
      expect(await getChapterTitles(book.id)).toEqual(['One', 'Two'])
    })
  })

  describe('rejectGraphControlProps()', () => {
    it('rejects control properties with their data path', () => {
      for (const prop of ['#dbRef', '#unrelate', '#delete']) {
        expect(() =>
          rejectGraphControlProps(Book, {
            title: 'Earthsea',
            chapters: [{ title: 'One' }, { title: 'Two', [prop]: null }]
          })
        ).toThrow(
          `Unsupported graph control property '${prop}' at 'chapters/1'.`
        )
      }
      expect(() =>
        rejectGraphControlProps(Book, [{ 'title': 'Earthsea', '#dbRef': 1 }])
      ).toThrow(`Unsupported graph control property '#dbRef' at '0'.`)
    })

    it('rejects them in model instances', () => {
      const book = createBookGraph({
        title: 'Earthsea',
        featuredChapter: { title: 'One' }
      })
      Object.assign(book.featuredChapter!, { '#delete': true })
      expect(() => rejectGraphControlProps(Book, book)).toThrow(GraphError)
    })

    it('accepts #id and #ref references', () => {
      expect(() =>
        rejectGraphControlProps(Book, {
          title: 'Earthsea',
          chapters: [{ '#id': 'one', 'title': 'One' }],
          featuredChapter: { '#ref': 'one' }
        })
      ).not.toThrow()
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

    it('filters arrays of plain graph data, keeping empty entries', () => {
      const result: any = Book.filterGraph(
        [{ title: 'Earthsea', shelf: { name: 'Fantasy' } }, null] as any,
        'author'
      )
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(Book)
      expect(result[0]).not.toHaveProperty('shelf')
      expect(result[1]).toBeNull()
    })

    it('returns empty graphs unchanged', () => {
      expect(Book.filterGraph(null as any, 'author')).toBeNull()
      expect(Book.filterGraph(undefined as any, 'author')).toBeUndefined()
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
      const stored = await Book.query().insertGraphAndFetch({
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
      const book = await Book.query().insertGraphAndFetch({
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
      const book = await Book.query().insertGraphAndFetch({
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

    it('keeps leaves that already hold more than a reference', async () => {
      const author = await Author.query().insert({ name: 'Ursula' })
      const book = createBookGraph({
        title: 'Earthsea',
        author: { id: author.id, name: 'Ursula K. Le Guin' }
      })
      await Book.populateGraph(book, 'author')
      expect(book.author!.name).toBe('Ursula K. Le Guin')
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
