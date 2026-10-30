import { Application, Model, type ModelProperties } from '@ditojs/server'
import { createApp, type ControllerDefinition } from '@ditojs/server-next'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { defineController, objectionPlugin } from '../src/index.ts'

class Author extends Model {
  declare id: number
  declare name: string
  declare active: boolean
  declare books?: Book[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    active: { type: 'boolean', default: true }
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
    active: (query: any) => query.where('active', true),
    books: (query: any) => query.withGraph('books').orderBy('id')
  }

  static override filters: any = {
    name: { filter: 'text' }
  }
}

class Book extends Model {
  declare id: number
  declare title: string
  declare pages: number
  declare authorId: number

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    pages: { type: 'integer' },
    authorId: { type: 'integer', nullable: true }
  }

  static override scopes: any = {
    long: (query: any) => query.where('pages', '>', 300)
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
  models: { Author, Book }
})

function setup(...controllers: ControllerDefinition[]) {
  return createApp({
    base: '/api',
    controllers,
    plugins: [objectionPlugin({ app: dito })],
    getUser: async () => null
  })
}

const request = async (
  app: ReturnType<typeof setup>,
  method: string,
  path: string,
  body?: unknown
) => {
  const response = await app.request(path, {
    method,
    ...(body !== undefined && {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    json: text ? JSON.parse(text) : undefined
  }
}

const authors = defineController({
  path: 'authors',
  model: Author,
  collection: { allow: ['get', 'post', 'put', 'patch', 'delete'] },
  member: { allow: ['get', 'put', 'patch', 'delete'] }
})

beforeAll(async () => {
  await dito.setup()
  await createTestDatabase(dito as any, Author, Book)
})

afterAll(async () => {
  await dito.knex.destroy()
})

beforeEach(async () => {
  await dito.knex('Book').del()
  await dito.knex('Author').del()
  await Author.query().insertGraph([
    {
      id: 1,
      name: 'Ada',
      books: [
        { title: 'Notes', pages: 100 },
        { title: 'Engines', pages: 400 }
      ]
    },
    { id: 2, name: 'Bea', active: false },
    { id: 3, name: 'Cleo', books: [{ title: 'Tides', pages: 500 }] }
  ] as any)
})

describe('collection get', () => {
  const app = setup(authors)
  const names = (json: { name: string }[]) => json.map(author => author.name)

  it('lists the rows', async () => {
    const { status, json } = await request(app, 'GET', '/api/authors')
    expect(status).toBe(200)
    expect(names(json)).toEqual(['Ada', 'Bea', 'Cleo'])
  })

  it('applies `scope`', async () => {
    const { json } = await request(app, 'GET', '/api/authors?scope=active')
    expect(names(json)).toEqual(['Ada', 'Cleo'])
  })

  it('applies `filter=name:args` and `filter[name]=value` alike', async () => {
    const dito6 = await request(
      app,
      'GET',
      `/api/authors?filter=${encodeURIComponent('name:"contains","le"')}`
    )
    const next = await request(app, 'GET', '/api/authors?filter[name]=le')
    expect(names(dito6.json)).toEqual(['Cleo'])
    expect(names(next.json)).toEqual(['Cleo'])
  })

  it('applies `order`', async () => {
    const { json } = await request(app, 'GET', '/api/authors?order=name+desc')
    expect(names(json)).toEqual(['Cleo', 'Bea', 'Ada'])
  })

  it('answers `range` with the results and the total', async () => {
    const { json } = await request(app, 'GET', '/api/authors?range=1,2')
    expect(json.total).toBe(3)
    expect(names(json.results)).toEqual(['Bea', 'Cleo'])
  })

  it('applies the controller scopes, also `^` graph scopes', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        scope: ['books', '^long'],
        collection: { allow: ['get'] }
      })
    )
    const { json } = await request(app, 'GET', '/api/authors?scope=active')
    expect(
      json.map((author: Author) => [
        author.name,
        author.books!.map(book => book.title)
      ])
    ).toEqual([
      ['Ada', ['Engines']],
      ['Cleo', ['Tides']]
    ])
  })

  it('rejects scopes and filters outside `allowScope` and `allowFilter`', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        allowScope: false,
        allowFilter: [],
        collection: { allow: ['get'] }
      })
    )
    const scope = await request(app, 'GET', '/api/authors?scope=active')
    const filter = await request(app, 'GET', '/api/authors?filter[name]=a')
    expect(scope.status).toBe(400)
    expect(scope.json.detail).toBe(`Query scope 'active' is not allowed.`)
    expect(filter.status).toBe(400)
    expect(filter.json.detail).toBe(`Query filter 'name' is not allowed.`)
  })

  it('runs the `query` callback on its queries', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        query: (query, c) => {
          query.where('name', c.req.header('x-name')!)
        },
        collection: { allow: ['get'] }
      })
    )
    const response = await app.request('/api/authors', {
      headers: { 'x-name': 'Bea' }
    })
    expect(await response.json()).toMatchObject([{ id: 2, name: 'Bea' }])
  })
})

describe('allow', () => {
  it('routes only the verbs in `allow` or the ones the controller defines', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        member: { get: (c, next) => next() }
      })
    )
    expect((await request(app, 'GET', '/api/authors')).status).toBe(404)
    expect((await request(app, 'GET', '/api/authors/1')).status).toBe(200)
    expect((await request(app, 'DELETE', '/api/authors/1')).status).toBe(404)
  })
})

describe('member get', () => {
  const app = setup(authors)

  it('answers the row', async () => {
    const { status, json } = await request(app, 'GET', '/api/authors/1')
    expect(status).toBe(200)
    expect(json).toEqual({ id: 1, name: 'Ada', active: true })
  })

  it('answers 404 for missing rows', async () => {
    const { status, json } = await request(app, 'GET', '/api/authors/9')
    expect(status).toBe(404)
    expect(json).toMatchObject({
      status: 404,
      title: 'Not Found',
      detail: `'Author' model with id 9 not found`
    })
  })
})

describe('writes', () => {
  const app = setup(authors)

  it('inserts with post and answers 201', async () => {
    const { status, headers, json } = await request(
      app,
      'POST',
      '/api/authors',
      {
        name: 'Dora'
      }
    )
    expect(status).toBe(201)
    expect(json).toMatchObject({ name: 'Dora', active: true })
    expect(headers.get('Location')).toBe(`/api/authors/${json.id}`)
  })

  it('patches without graph', async () => {
    const { status, json } = await request(app, 'PATCH', '/api/authors/2', {
      name: 'Beatrice'
    })
    expect(status).toBe(200)
    expect(json).toEqual({ id: 2, name: 'Beatrice', active: false })
  })

  it('patches with graph', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        graph: true,
        member: { allow: ['patch'] }
      })
    )
    const { status, json } = await request(app, 'PATCH', '/api/authors/2', {
      name: 'Beatrice',
      books: [{ title: 'Waves', pages: 320 }]
    })
    expect(status).toBe(200)
    expect(json).toMatchObject({
      id: 2,
      name: 'Beatrice',
      books: [{ title: 'Waves', pages: 320, authorId: 2 }]
    })
    expect(await Book.query().where('authorId', 2)).toHaveLength(1)
  })

  it('replaces with put', async () => {
    const { json } = await request(app, 'PUT', '/api/authors/2', {
      name: 'Bo'
    })
    expect(json).toEqual({ id: 2, name: 'Bo', active: true })
  })

  it('deletes and answers the count', async () => {
    const { status, json } = await request(app, 'DELETE', '/api/authors/2')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await Author.query().findById(2)).toBeUndefined()
  })

  it('patches collections by the ids of their models', async () => {
    const { json } = await request(app, 'PATCH', '/api/authors', [
      { id: 1, name: 'Ava' },
      { id: 2, name: 'Bo' }
    ])
    expect(json).toMatchObject([
      { id: 1, name: 'Ava' },
      { id: 2, name: 'Bo' }
    ])
    const missing = await request(app, 'PATCH', '/api/authors', [{ name: 'X' }])
    expect(missing.status).toBe(400)
    expect(missing.json.type).toBe('BodyValidation')
  })

  it('answers validation errors as Problem Details with Dito 6 errors', async () => {
    const { status, headers, json } = await request(
      app,
      'POST',
      '/api/authors',
      { name: 7 }
    )
    expect(status).toBe(400)
    expect(headers.get('Content-Type')).toBe('application/problem+json')
    expect(json).toMatchObject({
      status: 400,
      title: 'Bad Request',
      type: 'ModelValidation',
      message: 'The provided data for the Author model is not valid',
      errors: { name: [{ keyword: 'type', message: expect.any(String) }] }
    })
  })

  it('treats an empty body as an empty object', async () => {
    const response = await app.request('/api/authors', { method: 'POST' })
    expect(response.status).toBe(400)
    // Dito 6 reports missing properties on their parent, here the root.
    expect((await response.json()).errors).toMatchObject({
      '': [{ keyword: 'required', params: { missingProperty: 'name' } }]
    })
  })
})

describe('wrapping the default verbs', () => {
  it('gives the model instance to the wrapping handler', async () => {
    const rows: unknown[] = []
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        member: {
          async patch(c, next) {
            const author = (await next()) as Author
            rows.push(author)
            return author
          }
        }
      })
    )
    const { json } = await request(app, 'PATCH', '/api/authors/1', {
      name: 'Ava'
    })
    expect(rows[0]).toBeInstanceOf(Author)
    expect(json).toEqual({ id: 1, name: 'Ava', active: true })
  })

  it('loads the member through `c.var.load()`', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        scope: 'active',
        member: {
          'get title': async c => {
            const author = await c.var.load<Author>()
            return { title: `${author.name} (${author.constructor.name})` }
          }
        }
      })
    )
    const found = await request(app, 'GET', '/api/authors/1/title')
    const inactive = await request(app, 'GET', '/api/authors/2/title')
    expect(found.json).toEqual({ title: 'Ada (Author)' })
    expect(inactive.status).toBe(404)
  })
})

describe('transactions', () => {
  it('rolls back the writes of a failed action', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        collection: {
          'post fail': async (c, next) => {
            await Author.query(c.var.trx as never).insert({ name: 'Eve' })
            throw new Error('Failed')
          }
        }
      })
    )
    const { status } = await request(app, 'POST', '/api/authors/fail')
    expect(status).toBe(500)
    expect(await Author.query().where('name', 'Eve')).toEqual([])
  })

  it('keeps the transaction in the request storage', async () => {
    const app = setup(
      defineController({
        path: 'authors',
        model: Author,
        collection: {
          'post check': async c => ({
            transaction: dito.requestLocals.transaction === c.var.trx,
            logger: !!dito.requestLocals.logger
          }),
          'get check': async c => ({
            transaction: dito.requestLocals.transaction ?? null,
            trx: c.var.trx ?? null,
            logger: !!dito.requestLocals.logger
          })
        }
      })
    )
    expect((await request(app, 'POST', '/api/authors/check')).json).toEqual({
      transaction: true,
      logger: true
    })
    expect((await request(app, 'GET', '/api/authors/check')).json).toEqual({
      transaction: null,
      trx: null,
      logger: true
    })
  })
})
