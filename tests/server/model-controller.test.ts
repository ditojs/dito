import type { ModelProperties } from '@ditojs/server'
import {
  Model,
  ModelController,
  RelationController,
  ResponseError
} from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Author extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    }
  }

  static override relations: any = {
    books: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Book.authorId',
      owner: true
    },
    notes: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Note.authorId'
    },
    tags: {
      relation: 'manyToMany',
      from: 'Author.id',
      to: 'Tag.id',
      through: {
        from: 'AuthorTag.authorId',
        to: 'AuthorTag.tagId',
        extra: ['sortOrder']
      }
    }
  }

  static override scopes: any = {
    // Only authors with published books, also applied to the books relation.
    published: (query: any) =>
      query.whereExists(
        Author.relatedQuery('books').where('published', true)
      ),
    named: (query: any) => query.whereNotNull('name')
  }
}

class Book extends Model {
  declare id: number
  declare title: string
  declare published: boolean
  declare pages: number
  declare authorId: number

  static override properties: ModelProperties = {
    title: {
      type: 'string',
      required: true
    },
    published: {
      type: 'boolean'
    },
    pages: {
      type: 'integer'
    },
    authorId: {
      type: 'integer',
      nullable: true
    }
  }

  static override scopes: any = {
    published: (query: any) => query.where('published', true),
    long: (query: any) => query.where('pages', '>', 300),
    named: (query: any) => query.whereNotNull('title')
  }

  static override filters: any = {
    minPages: {
      parameters: {
        pages: { type: 'integer' }
      },
      handler(query: any, { pages }: { pages: number }) {
        query.where('pages', '>=', pages)
      }
    }
  }
}

class Note extends Model {
  declare id: number
  declare text: string
  declare authorId: number | null

  static override properties: ModelProperties = {
    text: {
      type: 'string'
    },
    authorId: {
      type: 'integer',
      nullable: true
    }
  }

  static override relations: any = {
    author: {
      relation: 'belongsTo',
      from: 'Note.authorId',
      to: 'Author.id'
    }
  }
}

class Tag extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: {
      type: 'string'
    }
  }
}

// Collects the events of the hooks, so tests can assert their order.
const hookEvents: string[] = []

class LibraryController extends ModelController<any> {
  // A shared base controller that only exposes read access by default, like
  // public API controllers that are extended per model.
  override collection: any = {
    allow: ['get']
  }

  override member: any = {
    allow: ['get']
  }
}

class Books extends ModelController<any> {
  override modelClass = Book

  override hooks: any = {
    'before:collection:post'(ctx: any) {
      hookEvents.push(`before post ${ctx.request.body.title}`)
    },
    'after:collection:post'(ctx: any, book: any) {
      hookEvents.push(`after post ${book.title}`)
    },
    'after:*:get'(ctx: any, result: any) {
      hookEvents.push(`after ${ctx.action.type} get`)
    },
    'after:collection:get'(ctx: any, result: any) {
      // Replace the result with a wrapping object, when requested.
      if (ctx.get('x-wrap')) {
        return { books: result, count: result.length }
      }
    }
  }

  override collection: any = {
    'allow': ['get', 'post', 'put', 'patch', 'delete'],

    'get titles': {
      parameters: {
        published: {
          type: 'boolean'
        }
      },
      async handler(ctx: any, { published }: { published?: boolean }) {
        const books = await Book.query()
          .modify((query: any) => {
            if (published !== undefined) query.where({ published })
          })
          .orderBy('title')
        return books.map(book => book.title)
      }
    },

    // Lists of parameters are passed as separate arguments. In the object
    // form, arrays are read as `[schema, options]`, so use the function form.
    'get page-sum': Object.assign(
      async function (ctx: any, min: number, max?: number) {
        const books = await Book.query()
        return books
          .filter(
            book => book.pages >= min && (max == null || book.pages <= max)
          )
          .reduce((sum, book) => sum + book.pages, 0)
      },
      {
        parameters: [
          { name: 'min', type: 'integer', default: 0 },
          { name: 'max', type: 'integer' }
        ]
      }
    ),

    'post draft': {
      // Validation options are passed as the second entry of an array.
      parameters: [
        {
          title: {
            type: 'string',
            required: true
          },
          pages: {
            type: 'integer'
          }
        },
        { patch: true }
      ],
      handler(ctx: any, { title, pages }: any) {
        return { title: title ?? null, pages: pages ?? null }
      }
    },

    'get echo-query': {
      parameters: {
        consumed: {
          type: 'string'
        }
      },
      handler(ctx: any) {
        return ctx.filteredQuery
      }
    },

    'post import': Object.assign(
      async function (ctx: any, books: any[]) {
        const inserted = await Book.query().insert(books)
        return inserted.length
      },
      {
        parameters: [
          {
            // Without a name, the whole body is validated and passed on.
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' }
              },
              required: ['title']
            }
          }
        ]
      }
    ),

    'post search': {
      parameters: {
        term: {
          type: 'string',
          from: 'query',
          required: true
        },
        options: {
          from: 'root',
          type: 'object'
        }
      },
      handler(ctx: any, { term, options }: any) {
        return { term, options }
      }
    },

    'post ids'(this: any, ctx: any) {
      return this.getIds(ctx)
    },

    'get sorted'(this: any) {
      // The controller's `query()` applies its scope settings.
      return this.query().orderBy('title', 'desc')
    },

    'get count': {
      response: {
        type: 'integer'
      },
      async handler() {
        const { count } = (await Book.query().count().first()) as any
        return +count
      }
    },

    'get broken-count': {
      response: {
        type: 'integer'
      },
      handler() {
        return 'many'
      }
    },

    'get stats': {
      response: {
        name: 'stats',
        type: 'object',
        properties: {
          total: { type: 'integer' }
        }
      },
      async handler() {
        return { total: (await Book.query()).length }
      }
    },

    'get broken-stats': {
      response: {
        name: 'stats',
        type: 'object',
        properties: {
          total: { type: 'integer' }
        }
      },
      handler() {
        return { total: 'none' }
      }
    },

    'get fail': {
      handler() {
        throw new ResponseError('Not today', { status: 418 })
      }
    },

    'get crash': {
      handler() {
        throw new Error('Something broke')
      }
    }
  }

  override member: any = {
    'allow': ['get', 'put', 'patch', 'delete'],

    'delete': {
      async handler(ctx: any) {
        const book = await Book.query().findById(ctx.memberId)
        if (book?.published) {
          throw new ResponseError('Published books cannot be deleted', {
            status: 405
          })
        }
        return super.delete(ctx)
      }
    },

    'post publish': {
      transacted: true,
      async handler(this: any, ctx: any) {
        await Book.query(ctx.transaction)
          .patch({ published: true })
          .findById(ctx.memberId)
        // Call the inherited member `get` action through the actions object.
        return this.get(ctx)
      }
    },

    'post publish-and-fail': {
      transacted: true,
      async handler(ctx: any) {
        await Book.query(ctx.transaction)
          .patch({ published: true })
          .findById(ctx.memberId)
        throw new ResponseError('Rolled back', { status: 409 })
      }
    },

    'post lock': {
      parameters: {
        book: {
          from: 'member',
          forUpdate: true
        }
      },
      handler(ctx: any, { book }: any) {
        return book.title
      }
    },

    'post locked': {
      transacted: true,
      parameters: {
        book: {
          from: 'member',
          forUpdate: true
        }
      },
      handler(ctx: any, { book }: any) {
        return book.title
      }
    },

    'get ids'(this: any, ctx: any) {
      return this.getIds(ctx)
    },

    'get summary-:format': {
      parameters: {
        format: {
          type: 'string',
          from: 'path',
          enum: ['short', 'long']
        },
        book: {
          from: 'member'
        }
      },
      handler(ctx: any, { format, book }: any) {
        return format === 'short'
          ? book.title
          : `${book.title} (${book.pages} pages)`
      }
    }
  }
}

class PublishedBooks extends LibraryController {
  override modelClass = Book
  override scope: any = 'published'
}

class LongBooks extends LibraryController {
  override modelClass = Book
  override allowScope: any = ['long']
  override allowFilter: any = false
}

class PublishedAuthors extends ModelController<any> {
  override modelClass = Author
  // Only graph scopes are passed on to the relations.
  override scope: any = ['^published', 'named']

  override collection: any = {
    allow: ['get']
  }

  override relations: any = {
    books: {
      relation: {
        allow: ['get']
      }
    }
  }
}

class Authors extends ModelController<any> {
  override modelClass = Author

  override collection: any = {
    allow: ['get', 'post']
  }

  override member: any = {
    allow: ['get']
  }

  override relations: any = {
    books: {
      relation: {
        allow: ['get', 'post', 'delete']
      },
      member: {
        allow: ['get', 'patch', 'delete']
      }
    },
    notes: {
      relation: {
        allow: ['get', 'post', 'delete']
      },
      member: {
        allow: ['delete']
      }
    },
    tags: {
      relation: {
        allow: ['get', 'post']
      }
    }
  }
}

// Relates notes to existing authors through their `belongsTo` relation.
class Notes extends ModelController<any> {
  override modelClass = Note

  override relations: any = {
    author: {
      relation: {
        allow: ['get', 'post', 'delete']
      }
    }
  }
}

// Creates and patches authors together with the books in their graphs.
class GraphAuthors extends ModelController<any> {
  override modelClass = Author
  override graph = true

  override collection: any = {
    allow: ['post']
  }

  override member: any = {
    allow: ['patch']
  }

  override relations: any = {
    books: {
      relation: {
        allow: ['get']
      }
    }
  }
}

// Creates authors and relates the existing notes found in their graphs.
class RelatingAuthors extends ModelController<any> {
  override modelClass = Author
  override graph = true
  override relate = true

  override collection: any = {
    allow: ['post']
  }
}

describe('ModelController', () => {
  const app = createTestApp({
    models: { Author, Book, Note, Tag },
    controllers: {
      Books,
      PublishedBooks,
      LongBooks,
      Authors,
      PublishedAuthors,
      RelatingAuthors,
      GraphAuthors,
      Notes
    }
  })

  let url: string

  const request = async (
    path: string,
    { method = 'GET', body }: { method?: string; body?: any } = {}
  ) => {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined && { 'content-type': 'application/json' })
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    const isJson = response.headers
      .get('content-type')
      ?.startsWith('application/json')
    return {
      status: response.status,
      headers: response.headers,
      data: isJson ? await response.json() : await response.text()
    }
  }

  const insertBooks = () =>
    Book.query().insert([
      { title: 'Atlas', published: true, pages: 120 },
      { title: 'Bestiary', published: false, pages: 480 },
      { title: 'Chronicle', published: true, pages: 640 }
    ])

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.knex.schema.createTable('AuthorTag', table => {
      table.increments('id').primary()
      table.integer('authorId')
      table.integer('tagId')
      table.integer('sortOrder')
    })
    await app.start()
    url = getAppUrl(app)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  afterEach(async () => {
    hookEvents.length = 0
    await app.knex('Book').del()
    await app.knex('Note').del()
    await app.knex('AuthorTag').del()
    await app.knex('Tag').del()
    await app.knex('Author').del()
  })

  describe('default collection actions', () => {
    it('lists all models and applies query parameters', async () => {
      await insertBooks()
      const all = await request('/books?order=title')
      expect(all.status).toBe(200)
      expect(all.data.map((book: any) => book.title)).toEqual([
        'Atlas',
        'Bestiary',
        'Chronicle'
      ])
      const page = await request('/books?order=pages%20desc&range=0,1')
      expect(page.data).toMatchObject({
        total: 3,
        results: [{ title: 'Chronicle' }, { title: 'Bestiary' }]
      })
    })

    it('applies model filters from the query', async () => {
      await insertBooks()
      const response = await request('/books?filter=minPages:400&order=title')
      expect(response.data.map((book: any) => book.title)).toEqual([
        'Bestiary',
        'Chronicle'
      ])
    })

    it('rejects invalid query parameters with a 400 error', async () => {
      const response = await request('/books?range=5,1')
      expect(response.status).toBe(400)
      expect(response.data.message).toMatch(/Invalid range/)
    })

    it('creates a model with 201 and a `Location` header', async () => {
      const response = await request('/books', {
        method: 'POST',
        body: { title: 'Atlas', pages: 120 }
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ title: 'Atlas', pages: 120 })
      expect(response.headers.get('location')).toBe(
        `/books/${response.data.id}`
      )
      expect(await Book.query().resultSize()).toBe(1)
    })

    it('creates multiple models from an array body', async () => {
      const response = await request('/books', {
        method: 'POST',
        body: [{ title: 'Atlas' }, { title: 'Bestiary' }]
      })
      expect(response.status).toBe(201)
      expect(response.headers.get('location')).toBeNull()
      expect(response.data.map((book: any) => book.title)).toEqual([
        'Atlas',
        'Bestiary'
      ])
    })

    it('rejects models that fail validation', async () => {
      const response = await request('/books', {
        method: 'POST',
        body: { pages: 10 }
      })
      expect(response.status).toBe(400)
      expect(response.data.type).toBe('ModelValidation')
      // Missing required properties are reported on the parent object.
      expect(response.data.errors['']).toMatchObject([
        { keyword: 'required', params: { missingProperty: 'title' } }
      ])
      expect(await Book.query().resultSize()).toBe(0)
    })

    it('patches and updates multiple models by their ids', async () => {
      const [atlas, bestiary] = await insertBooks()
      const patched = await request('/books', {
        method: 'PATCH',
        body: [
          { id: atlas.id, pages: 121 },
          { id: bestiary.id, published: true }
        ]
      })
      expect(patched.status).toBe(200)
      expect(patched.data).toMatchObject([
        { id: atlas.id, pages: 121 },
        { id: bestiary.id, published: true }
      ])
      const updated = await request('/books', {
        method: 'PUT',
        body: [{ id: atlas.id, title: 'Almanac' }]
      })
      expect(updated.status).toBe(200)
      expect(await Book.query().findById(atlas.id)).toMatchObject({
        title: 'Almanac'
      })
      expect(await Book.query().findById(bestiary.id)).toMatchObject({
        title: 'Bestiary',
        published: true
      })
    })

    it('inserts models without ids in collection patches', async () => {
      const [atlas] = await insertBooks()
      const response = await request('/books', {
        method: 'PATCH',
        body: [{ id: atlas.id, pages: 121 }, { title: 'Codex' }]
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject([
        { id: atlas.id, pages: 121 },
        { id: expect.any(Number), title: 'Codex' }
      ])
      expect(await Book.query().resultSize()).toBe(4)
    })

    // Single objects would otherwise reach Objection's instance-only
    // `patchAndFetch()` and fail with a 500 server error.
    test('rejects single objects for collection patches', async () => {
      const [atlas] = await insertBooks()
      const response = await request('/books', {
        method: 'PATCH',
        body: { id: atlas.id, pages: 121 }
      })
      expect(response.status).toBe(400)
      expect((await Book.query().findById(atlas.id))?.pages).toBe(120)
    })

    it('deletes all models and returns the count', async () => {
      await insertBooks()
      const response = await request('/books', { method: 'DELETE' })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ count: 3 })
      expect(await Book.query().resultSize()).toBe(0)
    })

    // The scope requested in the query has to survive the clearing of the
    // controller's scopes, or all models get deleted instead.
    test('only deletes the models of the requested scope', async () => {
      await insertBooks()
      const response = await request('/books?scope=published', {
        method: 'DELETE'
      })
      expect(response.data).toEqual({ count: 2 })
      expect(await Book.query().resultSize()).toBe(1)
    })
  })

  describe('default member actions', () => {
    it('fetches a single model by its id', async () => {
      const [atlas] = await insertBooks()
      const response = await request(`/books/${atlas.id}`)
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ id: atlas.id, title: 'Atlas' })
    })

    it('responds with 404 for models that do not exist', async () => {
      const response = await request('/books/999999')
      expect(response.status).toBe(404)
      expect(response.data.message).toBe(
        `'Book' model with id 999999 not found`
      )
    })

    it('responds with 400 for ids that fail validation', async () => {
      const response = await request('/books/not-a-number')
      expect(response.status).toBe(400)
      expect(response.data.type).toBe('ModelValidation')
    })

    it('patches a model and returns the full model', async () => {
      const [atlas] = await insertBooks()
      const response = await request(`/books/${atlas.id}`, {
        method: 'PATCH',
        body: { pages: 99 }
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({
        id: atlas.id,
        title: 'Atlas',
        published: true,
        pages: 99
      })
    })

    it('validates the full model on update, but not on patch', async () => {
      const [atlas] = await insertBooks()
      const updated = await request(`/books/${atlas.id}`, {
        method: 'PUT',
        body: { title: 'Almanac' }
      })
      expect(updated.status).toBe(200)
      expect(updated.data).toMatchObject({ id: atlas.id, title: 'Almanac' })
      const incomplete = await request(`/books/${atlas.id}`, {
        method: 'PUT',
        body: { pages: 10 }
      })
      expect(incomplete.status).toBe(400)
      const patched = await request(`/books/${atlas.id}`, {
        method: 'PATCH',
        body: { pages: 10 }
      })
      expect(patched.status).toBe(200)
      expect(patched.data).toMatchObject({ title: 'Almanac', pages: 10 })
    })

    it('responds with 404 when patching a model that does not exist', async () => {
      const response = await request('/books/999999', {
        method: 'PATCH',
        body: { pages: 1 }
      })
      expect(response.status).toBe(404)
    })

    it('calls the inherited `delete` action through `super`', async () => {
      const [, bestiary] = await insertBooks()
      const response = await request(`/books/${bestiary.id}`, {
        method: 'DELETE'
      })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ count: 1 })
      expect(await Book.query().findById(bestiary.id)).toBeUndefined()
    })

    it('passes on the status of thrown response errors', async () => {
      const [atlas] = await insertBooks()
      const response = await request(`/books/${atlas.id}`, {
        method: 'DELETE'
      })
      expect(response.status).toBe(405)
      expect(response.data.message).toBe('Published books cannot be deleted')
      expect(await Book.query().findById(atlas.id)).toBeDefined()
    })
  })

  describe('custom actions', () => {
    it('validates and coerces query parameters into an object', async () => {
      await insertBooks()
      const all = await request('/books/titles')
      expect(all.data).toEqual(['Atlas', 'Bestiary', 'Chronicle'])
      const drafts = await request('/books/titles?published=false')
      expect(drafts.data).toEqual(['Bestiary'])
    })

    it('rejects query parameters that cannot be coerced', async () => {
      const response = await request('/books/titles?published=maybe')
      expect(response.status).toBe(400)
      expect(response.data).toMatchObject({
        type: 'ParameterValidation',
        message: 'The provided action parameters are not valid'
      })
      expect(response.data.errors).toHaveProperty('published')
    })

    it('passes array parameters as separate arguments with defaults', async () => {
      await insertBooks()
      expect((await request('/books/page-sum')).data).toBe(1240)
      expect((await request('/books/page-sum?min=200')).data).toBe(1120)
      expect((await request('/books/page-sum?min=200&max=500')).data).toBe(
        480
      )
    })

    it('applies validation options from `[schema, options]`', async () => {
      const response = await request('/books/draft', {
        method: 'POST',
        body: { pages: 12 }
      })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ title: null, pages: 12 })
      const invalid = await request('/books/draft', {
        method: 'POST',
        body: { pages: 'twelve' }
      })
      expect(invalid.status).toBe(400)
    })

    it('only exposes the query parameters not consumed by the action', async () => {
      const response = await request(
        '/books/echo-query?consumed=yes&order=title'
      )
      expect(response.data).toEqual({ order: 'title' })
    })

    it('validates the whole body for parameters without a name', async () => {
      const imported = await request('/books/import', {
        method: 'POST',
        body: [{ title: 'Atlas' }, { title: 'Bestiary' }]
      })
      expect(imported.status).toBe(200)
      expect(imported.data).toBe(2)
      const invalid = await request('/books/import', {
        method: 'POST',
        body: [{ pages: 1 }]
      })
      expect(invalid.status).toBe(400)
      expect(invalid.data.type).toBe('ParameterValidation')
    })

    it('borrows parameters from the query and the whole body', async () => {
      const response = await request('/books/search?term=atlas', {
        method: 'POST',
        body: { exact: true }
      })
      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        term: 'atlas',
        options: { exact: true }
      })
      const missing = await request('/books/search', {
        method: 'POST',
        body: {}
      })
      expect(missing.status).toBe(400)
      expect(missing.data.errors['']).toMatchObject([
        { params: { missingProperty: 'term' } }
      ])
    })

    it('reads parameters from the path and resolves member parameters', async () => {
      const [atlas] = await insertBooks()
      const short = await request(`/books/${atlas.id}/summary-short`)
      expect(short.data).toBe('Atlas')
      const long = await request(`/books/${atlas.id}/summary-long`)
      expect(long.data).toBe('Atlas (120 pages)')
      const invalid = await request(`/books/${atlas.id}/summary-medium`)
      expect(invalid.status).toBe(400)
      const missing = await request('/books/999999/summary-short')
      expect(missing.status).toBe(404)
    })

    it('validates unnamed responses and returns them unwrapped', async () => {
      await insertBooks()
      const response = await request('/books/count')
      expect(response.status).toBe(200)
      expect(response.data).toBe(3)
    })

    it('rejects unnamed responses that fail validation', async () => {
      const response = await request('/books/broken-count')
      expect(response.status).toBe(400)
      expect(response.data).toMatchObject({
        type: 'ResultValidation',
        message: 'The returned action result is not valid'
      })
    })

    it('wraps named responses under their name', async () => {
      await insertBooks()
      const response = await request('/books/stats')
      expect(response.data).toEqual({ stats: { total: 3 } })
    })

    it('rejects named responses that fail validation', async () => {
      const response = await request('/books/broken-stats')
      expect(response.status).toBe(400)
      expect(response.data.type).toBe('ResultValidation')
      expect(response.data.errors).toHaveProperty(['stats/total'])
    })

    it('responds with the status of response errors', async () => {
      const response = await request('/books/fail')
      expect(response.status).toBe(418)
      expect(response.data).toEqual({ message: 'Not today' })
    })

    it('responds with 500 for other errors', async () => {
      const response = await request('/books/crash')
      expect(response.status).toBe(500)
      expect(response.data.message).toBe('Something broke')
    })

    it('runs the controller query through `this.query()`', async () => {
      await insertBooks()
      const response = await request('/books/sorted')
      expect(response.data.map((book: any) => book.title)).toEqual([
        'Chronicle',
        'Bestiary',
        'Atlas'
      ])
    })

    it('returns the ids that collection and member requests concern', async () => {
      const [atlas] = await insertBooks()
      const collection = await request('/books/ids', {
        method: 'POST',
        body: [{ id: '3' }, { id: 4 }]
      })
      expect(collection.data).toEqual([3, 4])
      const member = await request(`/books/${atlas.id}/ids`)
      expect(member.data).toEqual([atlas.id])
    })

    it('locks members for update only within transactions', async () => {
      const [atlas] = await insertBooks()
      const unlocked = await request(`/books/${atlas.id}/lock`, {
        method: 'POST'
      })
      expect(unlocked.status).toBe(400)
      expect(unlocked.data.message).toBe(
        'Controller Books: Using `forUpdate()` without a transaction is invalid'
      )
      const locked = await request(`/books/${atlas.id}/locked`, {
        method: 'POST'
      })
      expect(locked.status).toBe(200)
      expect(locked.data).toBe('Atlas')
    })

    it('can call other actions through `this`', async () => {
      const [, bestiary] = await insertBooks()
      const response = await request(`/books/${bestiary.id}/publish`, {
        method: 'POST'
      })
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({
        id: bestiary.id,
        published: true
      })
    })

    it('rolls back transacted actions that throw', async () => {
      const [, bestiary] = await insertBooks()
      const response = await request(`/books/${bestiary.id}/publish-and-fail`, {
        method: 'POST'
      })
      expect(response.status).toBe(409)
      const book = await Book.query().findById(bestiary.id)
      expect(book?.published).toBe(false)
    })
  })

  describe('hooks', () => {
    it('runs `before:` and `after:` hooks around the action', async () => {
      await request('/books', { method: 'POST', body: { title: 'Atlas' } })
      expect(hookEvents).toEqual(['before post Atlas', 'after post Atlas'])
    })

    it('runs wildcard hooks for both collection and member actions', async () => {
      const [atlas] = await insertBooks()
      await request('/books')
      await request(`/books/${atlas.id}`)
      expect(hookEvents).toEqual(['after collection get', 'after member get'])
    })

    it('replaces the result with values returned by `after:` hooks', async () => {
      await insertBooks()
      const plain = await request('/books')
      expect(plain.data).toHaveLength(3)
      const response = await fetch(`${url}/books`, {
        headers: { 'x-wrap': 'yes' }
      })
      const wrapped = await response.json()
      expect(wrapped.count).toBe(3)
      expect(wrapped.books).toHaveLength(3)
    })
  })

  describe('scopes', () => {
    it('applies the controller `scope` to all queries', async () => {
      const [atlas, bestiary] = await insertBooks()
      const list = await request('/published-books?order=title')
      expect(list.data.map((book: any) => book.title)).toEqual([
        'Atlas',
        'Chronicle'
      ])
      expect((await request(`/published-books/${atlas.id}`)).status).toBe(200)
      expect((await request(`/published-books/${bestiary.id}`)).status).toBe(
        404
      )
    })

    it('only lets allowed scopes pass through `allowScope`', async () => {
      await insertBooks()
      const long = await request('/long-books?scope=long&order=title')
      expect(long.status).toBe(200)
      expect(long.data.map((book: any) => book.title)).toEqual([
        'Bestiary',
        'Chronicle'
      ])
      const published = await request('/long-books?scope=published')
      expect(published.status).toBe(400)
    })

    it('only lets allowed filters pass through `allowFilter`', async () => {
      const response = await request('/long-books?filter=minPages:400')
      expect(response.status).toBe(400)
      expect(response.data.message).toMatch(/minPages/)
    })

    it('passes graph scopes on to relation controllers', async () => {
      const [ada, bo] = await Author.query().insert([
        { name: 'Ada' },
        { name: 'Bo' }
      ])
      await Book.query().insert([
        { title: 'Atlas', published: true, authorId: ada.id },
        { title: 'Bestiary', published: false, authorId: ada.id },
        { title: 'Chronicle', published: false, authorId: bo.id }
      ])
      const authors = await request('/published-authors')
      expect(authors.data.map((author: any) => author.name)).toEqual(['Ada'])
      const books = await request(`/published-authors/${ada.id}/books`)
      expect(books.data.map((book: any) => book.title)).toEqual(['Atlas'])
      const controller: any = app.getController('/published-authors')
      expect(controller.relations.books.scope).toEqual(['^published'])
    })

    it('inherits `allow` settings from a shared base controller', async () => {
      const [atlas] = await insertBooks()
      const created = await request('/published-books', {
        method: 'POST',
        body: { title: 'Dictionary' }
      })
      expect(created.status).toBe(405)
      expect(created.headers.get('allow')).toBe('GET')
      const deleted = await request(`/published-books/${atlas.id}`, {
        method: 'DELETE'
      })
      expect(deleted.status).toBe(405)
    })
  })

  describe('relations', () => {
    it('lists the related models of a member', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const other = await Author.query().insert({ name: 'Bo' })
      await Book.query().insert([
        { title: 'Atlas', authorId: author.id },
        { title: 'Bestiary', authorId: other.id }
      ])
      const response = await request(`/authors/${author.id}/books`)
      expect(response.status).toBe(200)
      expect(response.data.map((book: any) => book.title)).toEqual(['Atlas'])
    })

    it('responds with 404 for relations of missing members', async () => {
      const response = await request('/authors/999999/books')
      expect(response.status).toBe(404)
    })

    it('creates related models through owned relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const response = await request(`/authors/${author.id}/books`, {
        method: 'POST',
        body: { title: 'Atlas' }
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({
        title: 'Atlas',
        authorId: author.id
      })
    })

    // The relation controller's url contains the parent's `:id` route
    // parameter, which needs to be filled in for the `Location` header.
    test('sets the `Location` header of related models', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const response = await request(`/authors/${author.id}/books`, {
        method: 'POST',
        body: { title: 'Atlas' }
      })
      expect(response.headers.get('location')).toBe(
        `/authors/${author.id}/books/${response.data.id}`
      )
    })

    it('fetches and patches single related models', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const book = await Book.query().insert({
        title: 'Atlas',
        authorId: author.id
      })
      const fetched = await request(`/authors/${author.id}/books/${book.id}`)
      expect(fetched.data).toMatchObject({ id: book.id, title: 'Atlas' })
      const patched = await request(`/authors/${author.id}/books/${book.id}`, {
        method: 'PATCH',
        body: { pages: 10 }
      })
      expect(patched.data).toMatchObject({ id: book.id, pages: 10 })
    })

    it('deletes models of owned relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const book = await Book.query().insert({
        title: 'Atlas',
        authorId: author.id
      })
      const response = await request(
        `/authors/${author.id}/books/${book.id}`,
        { method: 'DELETE' }
      )
      expect(response.data).toEqual({ count: 1 })
      expect(await Book.query().findById(book.id)).toBeUndefined()
    })

    // Relating can't go through `upsertGraph()`, which Objection rejects on
    // `$relatedQuery()`.
    test('relates models through non-owned relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const note = await Note.query().insert({ text: 'Draft' })
      const response = await request(`/authors/${author.id}/notes`, {
        method: 'POST',
        body: { id: note.id }
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({
        id: note.id,
        text: 'Draft',
        authorId: author.id
      })
      expect(response.headers.get('location')).toBe(
        `/authors/${author.id}/notes/${note.id}`
      )
      expect((await Note.query().findById(note.id))?.authorId).toBe(author.id)
    })

    test('relates models through belongsTo relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const note = await Note.query().insert({ text: 'Draft' })
      const response = await request(`/notes/${note.id}/author`, {
        method: 'POST',
        body: { id: author.id }
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({ id: author.id, name: 'Ada' })
      expect((await Note.query().findById(note.id))?.authorId).toBe(author.id)
    })

    test('relates models with the extra columns of join tables', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const [poetry, prose] = await Tag.query().insert([
        { name: 'Poetry' },
        { name: 'Prose' }
      ])
      const response = await request(`/authors/${author.id}/tags`, {
        method: 'POST',
        body: [
          { id: poetry.id, sortOrder: 2 },
          { id: prose.id, sortOrder: 1 }
        ]
      })
      expect(response.status).toBe(201)
      expect(
        response.data.map((tag: any) => tag.name).sort()
      ).toEqual(['Poetry', 'Prose'])
      expect(
        await app
          .knex('AuthorTag')
          .select('tagId', 'sortOrder')
          .orderBy('sortOrder')
      ).toEqual([
        { tagId: prose.id, sortOrder: 1 },
        { tagId: poetry.id, sortOrder: 2 }
      ])
    })

    test('relates models without the extra columns of join tables', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const tag = await Tag.query().insert({ name: 'Poetry' })
      const response = await request(`/authors/${author.id}/tags`, {
        method: 'POST',
        body: [{ id: tag.id }]
      })
      expect(response.status).toBe(201)
      expect(
        await app.knex('AuthorTag').select('tagId', 'sortOrder')
      ).toEqual([{ tagId: tag.id, sortOrder: null }])
    })

    it('rejects relation controllers with foreign parent controllers', async () => {
      const books = app.getController('/books') as any
      const authors = app.getController('/authors') as any
      const { relationInstance, relationDefinition } = authors.relations.books
      expect(
        () =>
          new (RelationController as any)(
            books,
            {},
            relationInstance,
            relationDefinition
          )
      ).toThrow(
        `Controller Books: Invalid parent controller for relation 'books'.`
      )
    })

    it('creates models that relate existing models in their graph', async () => {
      const note = await Note.query().insert({ text: 'Draft' })
      const response = await request('/relating-authors', {
        method: 'POST',
        body: { name: 'Ada', notes: [{ id: note.id }] }
      })
      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({
        name: 'Ada',
        notes: [{ id: note.id }]
      })
      expect((await Note.query().findById(note.id))?.authorId).toBe(
        response.data.id
      )
    })

    it('unrelates instead of deleting models of non-owned relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const [draft, final] = await Note.query().insert([
        { text: 'Draft', authorId: author.id },
        { text: 'Final', authorId: author.id }
      ])
      const unrelated = await request(
        `/authors/${author.id}/notes/${draft.id}`,
        { method: 'DELETE' }
      )
      expect(unrelated.status).toBe(200)
      // Unrelating keeps the related model, but clears its foreign key.
      expect(await Note.query().findById(draft.id)).toMatchObject({
        text: 'Draft',
        authorId: null
      })
      const remaining = await request(`/authors/${author.id}/notes`)
      expect(remaining.data.map((note: any) => note.id)).toEqual([final.id])
    })

    it('unrelates all models of non-owned relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      await Note.query().insert([
        { text: 'Draft', authorId: author.id },
        { text: 'Final', authorId: author.id }
      ])
      const response = await request(`/authors/${author.id}/notes`, {
        method: 'DELETE'
      })
      expect(response.data).toEqual({ count: 2 })
      const notes = await Note.query().orderBy('text')
      expect(notes).toMatchObject([
        { text: 'Draft', authorId: null },
        { text: 'Final', authorId: null }
      ])
    })

    it('fetches single models of one-to-one relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const note = await Note.query().insert({
        text: 'Draft',
        authorId: author.id
      })
      const response = await request(`/notes/${note.id}/author`)
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ id: author.id, name: 'Ada' })
    })

    it('responds with null for empty one-to-one relations', async () => {
      const note = await Note.query().insert({ text: 'Draft' })
      const response = await request(`/notes/${note.id}/author`)
      expect(response.status).toBe(204)
      expect(response.data).toBe('')
    })

    it('unrelates the model of one-to-one relations', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const note = await Note.query().insert({
        text: 'Draft',
        authorId: author.id
      })
      const response = await request(`/notes/${note.id}/author`, {
        method: 'DELETE'
      })
      expect(response.data).toEqual({ count: 1 })
      expect((await Note.query().findById(note.id))?.authorId).toBeNull()
      expect(await Author.query().findById(author.id)).toBeDefined()
    })

    it('responds with 404 when unrelating empty one-to-one relations', async () => {
      const note = await Note.query().insert({ text: 'Draft' })
      const response = await request(`/notes/${note.id}/author`, {
        method: 'DELETE'
      })
      expect(response.status).toBe(404)
    })

    it('inserts and patches graphs with graph controllers', async () => {
      const created = await request('/graph-authors', {
        method: 'POST',
        body: { name: 'Ada', books: [{ title: 'Atlas' }] }
      })
      expect(created.status).toBe(201)
      expect(created.data).toMatchObject({
        name: 'Ada',
        books: [{ title: 'Atlas' }]
      })
      const {
        id,
        books: [atlas]
      } = created.data
      const patched = await request(`/graph-authors/${id}`, {
        method: 'PATCH',
        body: {
          name: 'Ada L.',
          books: [{ id: atlas.id, title: 'Atlas' }, { title: 'Bestiary' }]
        }
      })
      expect(patched.status).toBe(200)
      expect(patched.data.name).toBe('Ada L.')
      const books = await Book.query().where('authorId', id).orderBy('title')
      expect(books.map(book => book.title)).toEqual(['Atlas', 'Bestiary'])
      // Relation controllers inherit the graph setting of their parent.
      const controller: any = app.getController('/graph-authors')
      expect(controller.relations.books.graph).toBe(true)
    })

    it('does not route relation actions that are not allowed', async () => {
      const author = await Author.query().insert({ name: 'Ada' })
      const response = await request(`/authors/${author.id}/notes`, {
        method: 'PATCH',
        body: []
      })
      expect(response.status).toBe(405)
    })
  })
})
