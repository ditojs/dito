import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Author extends Model {
  declare id: number
  declare name: string
  declare books: Book[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations = {
    books: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Book.authorId'
    }
  } as any

  static override filters = {
    bookTitle: { filter: 'text', properties: ['books.title'] }
  } as any
}

class Genre extends Model {
  declare id: number
  declare name: string
  declare rank: number | null

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    // The extra property of the `BookGenre` pivot table:
    rank: { type: 'integer', computed: true, nullable: true }
  }
}

class Book extends Model {
  declare id: number
  declare title: string
  declare authorId: number | null
  declare author: Author | null
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

describe('Related queries', () => {
  const app = createTestApp({ models: { Author, Genre, Book } })

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
    for (const table of ['BookGenre', 'Book', 'Genre', 'Author']) {
      await app.knex(table).del()
    }
  })

  // Ada wrote Atlas and Bestiary, Grace wrote Codex. Atlas is fantasy and
  // drama, Codex is drama:
  async function insertLibrary() {
    const [ada, grace] = await Author.query().insert([
      { name: 'Ada' },
      { name: 'Grace' }
    ])
    const [atlas, bestiary, codex] = await Book.query().insert([
      { title: 'Atlas', authorId: ada.id },
      { title: 'Bestiary', authorId: ada.id },
      { title: 'Codex', authorId: grace.id }
    ])
    const [fantasy, drama] = await Genre.query().insert([
      { name: 'Fantasy' },
      { name: 'Drama' }
    ])
    await app.knex('BookGenre').insert([
      { bookId: atlas.id, genreId: fantasy.id, rank: 1 },
      { bookId: atlas.id, genreId: drama.id, rank: 2 },
      { bookId: codex.id, genreId: drama.id, rank: 1 }
    ])
    return { ada, grace, atlas, bestiary, codex, fantasy, drama }
  }

  function getBooks() {
    return app.knex('Book').select('title', 'authorId').orderBy('id')
  }

  function getBookGenres() {
    return app
      .knex('BookGenre')
      .select('bookId', 'genreId', 'rank')
      .orderBy('id')
  }

  function getTitles(books: Book[]) {
    return books.map(book => book.title)
  }

  function getNames(models: { name: string }[]) {
    return models.map(model => model.name)
  }

  describe('$relatedQuery()', () => {
    it('finds the model of to-one relations', async () => {
      const { ada, atlas } = await insertLibrary()
      const author = await atlas.$relatedQuery('author')
      expect(author).toBeInstanceOf(Author)
      expect(author).toEqual({ id: ada.id, name: 'Ada' })
    })

    it('finds the models of to-many relations', async () => {
      const { ada } = await insertLibrary()
      const books = await ada.$relatedQuery('books').orderBy('title')
      expect(getTitles(books)).toEqual(['Atlas', 'Bestiary'])
    })

    it('finds many-to-many models with their extra properties', async () => {
      const { atlas, fantasy, drama } = await insertLibrary()
      const genres = await atlas.$relatedQuery('genres').orderBy('rank')
      expect(genres).toEqual([
        { id: fantasy.id, name: 'Fantasy', rank: 1 },
        { id: drama.id, name: 'Drama', rank: 2 }
      ])
    })

    it('inserts models of to-many relations with the foreign key', async () => {
      const { ada, grace } = await insertLibrary()
      const book = await ada.$relatedQuery('books').insert({ title: 'Diary' })
      expect(book.authorId).toBe(ada.id)
      expect(await getBooks()).toEqual([
        { title: 'Atlas', authorId: ada.id },
        { title: 'Bestiary', authorId: ada.id },
        { title: 'Codex', authorId: grace.id },
        { title: 'Diary', authorId: ada.id }
      ])
    })

    it('inserts the model of to-one relations and relates it', async () => {
      const { atlas } = await insertLibrary()
      const author = await atlas.$relatedQuery('author').insert({
        name: 'Linus'
      })
      expect((await Book.query().findById(atlas.id))!.authorId).toBe(
        author.id
      )
    })

    it('inserts many-to-many models with their extra properties', async () => {
      const { atlas, bestiary, codex, fantasy, drama } = await insertLibrary()
      const genre = await bestiary.$relatedQuery('genres').insert({
        name: 'Horror',
        rank: 3
      })
      expect(await getBookGenres()).toEqual([
        { bookId: atlas.id, genreId: fantasy.id, rank: 1 },
        { bookId: atlas.id, genreId: drama.id, rank: 2 },
        { bookId: codex.id, genreId: drama.id, rank: 1 },
        { bookId: bestiary.id, genreId: genre.id, rank: 3 }
      ])
    })

    it('patches only the related models', async () => {
      const { ada, grace } = await insertLibrary()
      expect(
        await ada.$relatedQuery('books').patch({ title: 'Untitled' })
      ).toBe(2)
      expect(await getBooks()).toEqual([
        { title: 'Untitled', authorId: ada.id },
        { title: 'Untitled', authorId: ada.id },
        { title: 'Codex', authorId: grace.id }
      ])
    })

    it('patches the extra properties of many-to-many models', async () => {
      const { atlas, codex, fantasy, drama } = await insertLibrary()
      await atlas
        .$relatedQuery('genres')
        .patch({ rank: 5 })
        .where('name', 'Drama')
      expect(await getBookGenres()).toEqual([
        { bookId: atlas.id, genreId: fantasy.id, rank: 1 },
        { bookId: atlas.id, genreId: drama.id, rank: 5 },
        { bookId: codex.id, genreId: drama.id, rank: 1 }
      ])
    })

    it('deletes only the related models', async () => {
      const { ada, grace } = await insertLibrary()
      expect(await ada.$relatedQuery('books').delete()).toBe(2)
      expect(await getBooks()).toEqual([
        { title: 'Codex', authorId: grace.id }
      ])
    })

    it('deletes the models of many-to-many relations', async () => {
      const { atlas } = await insertLibrary()
      await atlas.$relatedQuery('genres').delete().where('name', 'Fantasy')
      expect(getNames(await Genre.query())).toEqual(['Drama'])
      expect(await atlas.$relatedQuery('genres').pluck('name')).toEqual([
        'Drama'
      ])
    })

    it('relates and unrelates models of to-many relations', async () => {
      const { ada, grace, codex } = await insertLibrary()
      await ada.$relatedQuery('books').relate(codex.id)
      expect(await getBooks()).toEqual([
        { title: 'Atlas', authorId: ada.id },
        { title: 'Bestiary', authorId: ada.id },
        { title: 'Codex', authorId: ada.id }
      ])
      await grace.$relatedQuery('books').relate(codex.id)
      await ada.$relatedQuery('books').unrelate().where('title', 'Atlas')
      expect(await getBooks()).toEqual([
        { title: 'Atlas', authorId: null },
        { title: 'Bestiary', authorId: ada.id },
        { title: 'Codex', authorId: grace.id }
      ])
    })

    it('relates and unrelates the model of to-one relations', async () => {
      const { ada, grace, atlas } = await insertLibrary()
      await atlas.$relatedQuery('author').unrelate()
      expect((await Book.query().findById(atlas.id))!.authorId).toBeNull()
      await atlas.$relatedQuery('author').relate(grace.id)
      expect((await Book.query().findById(atlas.id))!.authorId).toBe(grace.id)
      expect(await Author.query().findById(ada.id)).toEqual({
        id: ada.id,
        name: 'Ada'
      })
    })

    it('relates many-to-many models with extra properties', async () => {
      const { atlas, bestiary, codex, fantasy, drama } = await insertLibrary()
      await bestiary.$relatedQuery('genres').relate({ id: fantasy.id, rank: 4 })
      await bestiary.$relatedQuery('genres').relate(drama.id)
      expect(await getBookGenres()).toEqual([
        { bookId: atlas.id, genreId: fantasy.id, rank: 1 },
        { bookId: atlas.id, genreId: drama.id, rank: 2 },
        { bookId: codex.id, genreId: drama.id, rank: 1 },
        { bookId: bestiary.id, genreId: fantasy.id, rank: 4 },
        { bookId: bestiary.id, genreId: drama.id, rank: null }
      ])
    })

    it('unrelates many-to-many models but keeps them', async () => {
      const { atlas, codex, drama } = await insertLibrary()
      expect(
        await atlas.$relatedQuery('genres').unrelate().where('name', 'Fantasy')
      ).toBe(1)
      expect(await getBookGenres()).toEqual([
        { bookId: atlas.id, genreId: drama.id, rank: 2 },
        { bookId: codex.id, genreId: drama.id, rank: 1 }
      ])
      expect(getNames(await Genre.query().orderBy('id'))).toEqual([
        'Fantasy',
        'Drama'
      ])
    })
  })

  describe('relatedQuery()', () => {
    it('finds the related models of several owners', async () => {
      const { ada, grace } = await insertLibrary()
      const titles = await Author.relatedQuery('books')
        .for([ada.id, grace.id])
        .orderBy('title')
        .pluck('title')
      expect(titles).toEqual(['Atlas', 'Bestiary', 'Codex'])
    })

    it('aliases the related table with the relation name', async () => {
      await insertLibrary()
      const authors = await Author.query().whereExists(
        Author.relatedQuery('books').where('books.title', 'Codex')
      )
      expect(getNames(authors)).toEqual(['Grace'])
    })
  })

  describe('joinRelated()', () => {
    it('filters by the columns of joined relations', async () => {
      const { atlas, bestiary } = await insertLibrary()
      const books = await Book.query()
        .joinRelated('author')
        .where('author.name', 'Ada')
        .orderBy('title')
      expect(books).toEqual([
        { id: atlas.id, title: 'Atlas', authorId: atlas.authorId },
        { id: bestiary.id, title: 'Bestiary', authorId: bestiary.authorId }
      ])
    })

    it('refers model properties to the root table', async () => {
      const { atlas } = await insertLibrary()
      // Both tables have an `id` column:
      const books = await Book.query()
        .joinRelated('author')
        .where('id', atlas.id)
      expect(getTitles(books)).toEqual(['Atlas'])
    })

    it('returns a row for each joined model', async () => {
      await insertLibrary()
      const authors = await Author.query().joinRelated('books').orderBy('name')
      expect(getNames(authors)).toEqual(['Ada', 'Ada', 'Grace'])
    })

    it('joins relations under aliases', async () => {
      await insertLibrary()
      const books = await Book.query()
        .joinRelated('author as writer')
        .where('writer.name', 'Grace')
      expect(getTitles(books)).toEqual(['Codex'])
    })

    it('joins nested relation expressions', async () => {
      await insertLibrary()
      const authors = await Author.query()
        .joinRelated('books.genres')
        .where('books:genres.name', 'Fantasy')
      expect(getNames(authors)).toEqual(['Ada'])
    })

    it('left joins relations with leftJoinRelated()', async () => {
      await insertLibrary()
      await Author.query().insert({ name: 'Linus' })
      const authors = await Author.query()
        .leftJoinRelated('books')
        .whereNull('books.id')
      expect(getNames(authors)).toEqual(['Linus'])
    })

    it('applies find() parameters to joined relations', async () => {
      await insertLibrary()
      const authors = await Author.query()
        .joinRelated('books')
        .find({ filter: 'bookTitle:"e"', order: 'name desc' })
      expect(getNames(authors)).toEqual(['Grace', 'Ada'])
    })
  })
})
