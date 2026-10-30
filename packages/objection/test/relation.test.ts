import { Hono } from 'hono'
import { Application, Model, type ModelProperties } from '@ditojs/server'
import {
  createApp,
  ProblemError,
  problemResponse,
  type ControllerDefinition
} from '@ditojs/server-next'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import {
  defineController,
  objectionTransaction,
  requestStorage,
  toProblem,
  withRelations
} from '../src/index.ts'

class Author extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations: any = {
    books: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Book.authorId',
      owner: true
    }
  }

  static override scopes: any = {
    books: (query: any) => query.withGraph('books')
  }
}

class Book extends Model {
  declare id: number
  declare title: string
  declare pages: number
  declare authorId: number | null
  declare shelfId: number | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    pages: { type: 'integer' },
    authorId: { type: 'integer', nullable: true },
    shelfId: { type: 'integer', nullable: true }
  }

  static override relations: any = {
    shelf: {
      relation: 'belongsTo',
      from: 'Book.shelfId',
      to: 'Shelf.id'
    }
  }

  static override scopes: any = {
    long: (query: any) => query.where('pages', '>', 300)
  }
}

class Shelf extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations: any = {
    books: {
      relation: 'hasMany',
      from: 'Shelf.id',
      to: 'Book.shelfId'
    }
  }
}

const dito = new Application({
  config: {
    log: { silent: true },
    logger: { level: 'silent' },
    knex: {
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    }
  },
  models: { Author, Book, Shelf }
})

// The user has the roles of the `x-roles` header, and is signed out without.
function setup(...controllers: ControllerDefinition[]) {
  const app = new Hono()
  const api = createApp({
    base: '/api',
    controllers: withRelations(controllers),
    transaction: objectionTransaction(dito),
    getUser: async c => {
      const roles = c.req.header('x-roles')
      return roles === undefined ? null : { id: 1, roles: roles.split(',') }
    }
  })
  app.use(requestStorage(dito))
  app.onError((error, c) => problemResponse(toProblem(error) ?? error, c))
  app.notFound(c => problemResponse(new ProblemError({ status: 404 }), c))
  app.route('/', api)
  return app
}

const request = async (
  app: ReturnType<typeof setup>,
  method: string,
  path: string,
  { body, roles }: { body?: unknown; roles?: string } = {}
) => {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (roles !== undefined) headers['x-roles'] = roles
  const response = await app.request(path, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) })
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    json: text ? JSON.parse(text) : undefined
  }
}

const titles = (json: { title: string }[]) => json.map(book => book.title)

beforeAll(async () => {
  await dito.setup()
  await createTestDatabase(dito as any, Author, Book, Shelf)
})

afterAll(async () => {
  await dito.knex.destroy()
})

beforeEach(async () => {
  await dito.knex('Book').del()
  await dito.knex('Author').del()
  await dito.knex('Shelf').del()
  await Shelf.query().insert([
    { id: 1, name: 'Front' },
    { id: 2, name: 'Back' }
  ] as any)
  await Author.query().insertGraph([
    {
      id: 1,
      name: 'Ada',
      books: [
        { id: 1, title: 'Notes', pages: 100, shelfId: 1 },
        { id: 2, title: 'Engines', pages: 400, shelfId: 1 }
      ]
    },
    { id: 2, name: 'Bea', books: [{ id: 3, title: 'Tides', pages: 500 }] }
  ] as any)
})

describe('owner relations', () => {
  const app = setup(
    defineController({
      path: 'authors',
      model: Author,
      graph: true,
      relations: {
        books: {
          collection: { allow: ['get', 'post'] },
          member: {
            'allow': ['get', 'patch', 'delete'],
            'get activity': async c => {
              const book = await c.var.load<Book>()
              return { activity: `${book.title} (${book.constructor.name})` }
            }
          }
        }
      }
    })
  )

  it('lists the rows of the parent', async () => {
    const { status, json } = await request(app, 'GET', '/api/authors/1/books')
    expect(status).toBe(200)
    expect(titles(json)).toEqual(['Notes', 'Engines'])
  })

  it('inserts with post, answers 201 and the `Location`', async () => {
    const { status, headers, json } = await request(
      app,
      'POST',
      '/api/authors/2/books',
      { body: { title: 'Waves', pages: 320 } }
    )
    expect(status).toBe(201)
    expect(json).toMatchObject({ title: 'Waves', authorId: 2 })
    expect(headers.get('Location')).toBe(`/api/authors/2/books/${json.id}`)
  })

  it('answers a member of the parent and 404 for others', async () => {
    const own = await request(app, 'GET', '/api/authors/1/books/2')
    const other = await request(app, 'GET', '/api/authors/1/books/3')
    expect(own.json).toMatchObject({ id: 2, title: 'Engines' })
    expect(other.status).toBe(404)
  })

  it('patches a member', async () => {
    const { status, json } = await request(
      app,
      'PATCH',
      '/api/authors/1/books/1',
      { body: { title: 'Letters' } }
    )
    expect(status).toBe(200)
    expect(json).toMatchObject({ id: 1, title: 'Letters', authorId: 1 })
  })

  it('patches only related rows with graph', async () => {
    const { status } = await request(app, 'PATCH', '/api/authors/1/books/3', {
      body: { title: 'Letters' }
    })
    expect(status).toBe(404)
    expect((await Book.query().findById(3))!.title).toBe('Tides')
  })

  it('deletes a member', async () => {
    const { json } = await request(app, 'DELETE', '/api/authors/1/books/1')
    expect(json).toEqual({ count: 1 })
    expect(await Book.query().findById(1)).toBeUndefined()
    const other = await request(app, 'DELETE', '/api/authors/1/books/3')
    expect(other.status).toBe(404)
    expect(await Book.query().findById(3)).toBeDefined()
  })

  it('answers 404 for a missing parent', async () => {
    const get = await request(app, 'GET', '/api/authors/9/books')
    const post = await request(app, 'POST', '/api/authors/9/books', {
      body: { title: 'Waves' }
    })
    expect(get.status).toBe(404)
    expect(post.status).toBe(404)
    expect(await Book.query().where('title', 'Waves')).toEqual([])
  })

  it('runs member actions on the related row', async () => {
    const own = await request(app, 'GET', '/api/authors/1/books/1/activity')
    const other = await request(app, 'GET', '/api/authors/1/books/3/activity')
    expect(own.json).toEqual({ activity: 'Notes (Book)' })
    expect(other.status).toBe(404)
  })
})

describe('inherited settings', () => {
  it('applies only the graph scopes of the parent', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        scope: ['books', '^long'],
        relations: { books: { collection: { allow: ['get'] } } }
      })
    )
    const { json } = await request(app, 'GET', '/api/authors/1/books')
    expect(json).toEqual([
      { id: 2, title: 'Engines', pages: 400, authorId: 1, shelfId: 1 }
    ])
  })

  it('inherits `transacted` and `graph`', async () => {
    const check = async (c: any) => ({ trx: !!c.var.trx })
    const definition = (transacted?: boolean) =>
      defineController({
        path: 'authors',
        model: Author,
        transacted,
        relations: { books: { collection: { 'post check': check } } }
      })
    const off = await request(
      setup(definition(false)),
      'POST',
      '/api/authors/1/books/check'
    )
    const on = await request(
      setup(definition()),
      'POST',
      '/api/authors/1/books/check'
    )
    expect(off.json).toEqual({ trx: false })
    expect(on.json).toEqual({ trx: true })
  })
})

describe('relations that are not owners', () => {
  const app = setup(
    defineController({
      path: 'shelves',
      model: Shelf,
      relations: {
        books: {
          collection: { allow: ['get', 'post', 'delete'] },
          member: { allow: ['delete'] }
        }
      }
    }),
    defineController({
      path: 'books',
      model: Book,
      relations: { shelf: { collection: { allow: ['get', 'post', 'delete'] } } }
    })
  )
  const shelfIds = async () =>
    (await Book.query().orderBy('id')).map(book => book.shelfId)

  it('relates a row with post', async () => {
    const { status, headers, json } = await request(
      app,
      'POST',
      '/api/shelves/2/books',
      { body: { id: '3' } }
    )
    expect(status).toBe(201)
    expect(json).toMatchObject({ id: 3, title: 'Tides', shelfId: 2 })
    expect(headers.get('Location')).toBe('/api/shelves/2/books/3')
    expect(await Book.query().count('* as count').first()).toEqual({
      count: 3
    })
  })

  it('relates several rows with post', async () => {
    const { json } = await request(app, 'POST', '/api/shelves/2/books', {
      body: [{ id: 1 }, { id: 3 }]
    })
    expect(titles(json)).toEqual(['Notes', 'Tides'])
    expect(await shelfIds()).toEqual([2, 1, 2])
  })

  it('rejects rows without ids', async () => {
    const { status, json } = await request(
      app,
      'POST',
      '/api/shelves/2/books',
      {
        body: { title: 'Waves' }
      }
    )
    expect(status).toBe(400)
    expect(json.type).toBe('BodyValidation')
  })

  it('unrelates with delete', async () => {
    const member = await request(app, 'DELETE', '/api/shelves/1/books/1')
    expect(member.json).toEqual({ count: 1 })
    expect(await shelfIds()).toEqual([null, 1, null])
    const collection = await request(app, 'DELETE', '/api/shelves/1/books')
    expect(collection.json).toEqual({ count: 1 })
    expect(await shelfIds()).toEqual([null, null, null])
  })

  it('answers the row of a one-to-one relation, or null', async () => {
    const { json } = await request(app, 'GET', '/api/books/1/shelf')
    const empty = await request(app, 'GET', '/api/books/3/shelf')
    expect(json).toEqual({ id: 1, name: 'Front' })
    expect(empty.status).toBe(200)
    expect(empty.json).toBeNull()
  })

  it('relates and unrelates a one-to-one relation', async () => {
    const post = await request(app, 'POST', '/api/books/3/shelf', {
      body: { id: 2 }
    })
    expect(post.json).toEqual({ id: 2, name: 'Back' })
    expect(await shelfIds()).toEqual([1, 1, 2])
    const remove = await request(app, 'DELETE', '/api/books/3/shelf')
    expect(remove.json).toEqual({ count: 1 })
    expect(await shelfIds()).toEqual([1, 1, null])
    const empty = await request(app, 'DELETE', '/api/books/3/shelf')
    expect(empty.status).toBe(404)
  })
})

describe('authorization', () => {
  const app = setup(
    defineController({
      path: 'authors',
      model: Author,
      member: {
        get: { authorize: 'reader', handler: (c, next) => next() },
        patch: { authorize: 'editor', handler: (c, next) => next() }
      },
      relations: {
        books: {
          collection: {
            'allow': ['get', 'post'],
            'post flag': {
              authorize: 'flagger',
              handler: () => ({ flagged: true })
            }
          }
        }
      }
    })
  )
  const post = (roles?: string) =>
    request(app, 'POST', '/api/authors/1/books', {
      body: { title: 'Waves' },
      roles
    })

  it('needs the `get` authorization of the parent for reads', async () => {
    const out = await request(app, 'GET', '/api/authors/1/books')
    const other = await request(app, 'GET', '/api/authors/1/books', {
      roles: 'editor'
    })
    const reader = await request(app, 'GET', '/api/authors/1/books', {
      roles: 'reader'
    })
    expect(out.status).toBe(401)
    expect(other.status).toBe(403)
    expect(reader.status).toBe(200)
  })

  it('needs the `patch` authorization of the parent for writes', async () => {
    expect((await post('reader')).status).toBe(403)
    expect((await post('editor')).status).toBe(403)
    expect((await post('reader,editor')).status).toBe(201)
  })

  it("needs no `patch` authorization where the relation's write has one", async () => {
    const flag = (roles: string) =>
      request(app, 'POST', '/api/authors/1/books/flag', { roles })
    expect((await flag('reader')).status).toBe(403)
    expect((await flag('reader,flagger')).json).toEqual({ flagged: true })
  })

  it("checks `$owner` against the parent's owner", async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        owner: async c => (await c.var.load<Author>()).id,
        member: { get: { authorize: '$owner', handler: (c, next) => next() } },
        relations: { books: { collection: { allow: ['get'] } } }
      })
    )
    const own = await request(app, 'GET', '/api/authors/1/books', {
      roles: ''
    })
    const other = await request(app, 'GET', '/api/authors/2/books', {
      roles: ''
    })
    expect(own.status).toBe(200)
    expect(other.status).toBe(403)
  })

  it('answers 404 for a missing parent', async () => {
    const { status } = await request(app, 'GET', '/api/authors/9/books', {
      roles: 'reader'
    })
    expect(status).toBe(404)
  })
})
