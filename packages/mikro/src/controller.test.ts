import { UniqueConstraintViolationException } from '@mikro-orm/core'
import { Hono } from 'hono'
import { z } from 'zod'
import { asArray } from '@ditojs/utils'
import {
  HttpError,
  createApi,
  createErrorHandler,
  createValidationError,
  defineMixin,
  notFound,
  type ControllerDefinition
} from '@ditojs/server'
import { OptimisticLockError, type FilterOptions } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import {
  assignRecord,
  createMikroAdapter,
  crud,
  defineChoices,
  defineDateRangeFilter,
  defineFilter,
  defineListHandler,
  defineModelController,
  defineTextFilter,
  guardEntity,
  type FindShape,
  type ModelControllerDefinition
} from './index.ts'
import { mergeFind } from './find.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { createClient } from '../../../tests/utils/client.ts'
import {
  Award,
  Author,
  Book,
  Chapter,
  Part,
  Info,
  Pair,
  entities
} from './test/entities.ts'

const { orm, sql, drop } = await createTestDatabase(entities)

afterAll(drop)

// Sets up an API with the parts that an app wires in, below `/api`.
function setup(...controllers: ControllerDefinition[]) {
  return new Hono()
    .route(
      '/api',
      createApi({
        controllers,
        adapter: createMikroAdapter(orm),
        // The user of the `X-User` header, with that name as its role.
        getUser: async ({ c }) => {
          const name = c.req.header('X-User')
          return name ? { id: name, roles: [name] } : null
        },
        onError: () => {}
      })
    )
    .onError(createErrorHandler())
    .notFound(notFound)
}

const request = async (
  api: Hono<any, any, any>,
  method: string,
  path: string,
  body?: unknown,
  user?: string
) => {
  const headers = user ? { 'X-User': user } : undefined
  const response = await createClient(api.fetch).request(method, path, body, {
    headers
  })
  return { ...response, json: response.data }
}

// The book controller of the tests, with `overrides` for its definition.
function books({
  actions,
  ...overrides
}: Partial<ModelControllerDefinition<Book>> = {}) {
  return defineModelController({
    path: 'books',
    authorize: true,
    entity: Book,
    find: {
      populate: ['parts.chapters', 'authors'],
      orderBy: { name: 'asc' }
    },
    // Clients can't publish through a write.
    deserialize: ({ json }) => {
      const { published, ...rest } = json as Record<string, unknown>
      return rest
    },
    filters: {
      name: {
        schema: z.string(),
        where: ({ value }) => ({ name: { $ilike: `%${value}%` } })
      },
      published: z.boolean(),
      // Books by the names of their authors, repeated for several.
      author: {
        schema: z.union([z.string(), z.array(z.string())]),
        where: ({ value }) => ({ authors: { name: { $in: asArray(value) } } })
      },
      // `all` skips the filter.
      status: {
        schema: z.enum(['draft', 'published', 'all']),
        where: ({ value }) =>
          value === 'all' ? undefined : { published: value === 'published' }
      }
    },
    actions: {
      'get': true,
      'post': true,
      'get :id': true,
      'delete :id': true,
      'get names': async ({ c }) => {
        const rows = await c.var.em.find(
          Book,
          {},
          {
            orderBy: { name: 'asc' }
          }
        )
        return rows.map(row => row.name)
      },

      // The `updatedAt` the client loaded. A newer one in the database
      // responds with 409.
      async 'patch :id'({ getRecord, body, next }) {
        const book = await getRecord<Book>()
        const { updatedAt } = body
        if (updatedAt && +new Date(updatedAt) !== +book.updatedAt) {
          throw new HttpError(409, {
            message: 'A more recent version exists in the database.'
          })
        }
        return next()
      },

      async 'post :id/publish'({ getRecord }) {
        const book = await getRecord<Book>()
        if (book.parts.length === 0) {
          throw createValidationError([
            { path: ['parts'], message: 'has no parts' }
          ])
        }
        book.published = true
        return book
      },
      // The overrides replace the actions above. The cast keeps their types
      // out of the inferred action keys.
      ...(actions as object)
    },
    ...overrides
  })
}

beforeEach(async () => {
  await orm.schema.clear()
  const em = orm.em.fork()
  const [ada, bea] = [
    em.create(Author, { name: 'Ada' }),
    em.create(Author, { name: 'Bea' })
  ]
  em.create(Book, {
    id: 1,
    name: 'Arcadia',
    published: true,
    specs: { pages: 400, tags: ['fable'] },
    secret: 'hidden',
    authors: [ada],
    parts: [
      {
        name: 'Preface',
        order: 0,
        chapters: [
          { name: 'Lesson', order: 0 },
          { name: 'Bark', order: 1 }
        ]
      },
      { name: 'Drama', order: 1, chapters: [{ name: 'Drama', order: 0 }] }
    ],
    awards: [{ name: 'PEN' }]
  })
  em.create(Book, { id: 2, name: 'Burns', authors: [ada, bea] })
  em.create(Book, {
    id: 3,
    name: 'Circuits',
    published: true,
    parts: [{ name: 'Std', chapters: [{ name: 'Std' }] }]
  })
  await em.flush()
  // The seeded rows have fixed ids, so the sequence starts after them.
  await sql(`select setval('book_id_seq', 3)`)
})

describe('get', () => {
  const api = setup(books())
  const names = (rows: Book[]) => rows.map(row => row.name)

  it('lists the rows in the order of `find`', async () => {
    const { status, json } = await request(api, 'GET', '/api/books')
    expect(status).toBe(200)
    expect(names(json)).toEqual(['Arcadia', 'Burns', 'Circuits'])
  })

  it('loads each row in the shape of `find`', async () => {
    const { json } = await request(api, 'GET', '/api/books')
    expect(json[0].parts.map((part: any) => part.chapters.length)).toEqual([
      2, 1
    ])
    expect(json[1].authors.map((it: any) => it.name)).toEqual(['Ada', 'Bea'])
  })

  it('applies `filter=name:args`', async () => {
    const get = async (query: string) =>
      names((await request(api, 'GET', `/api/books?${query}`)).json)
    expect(await get('filter=name:"ir"')).toEqual(['Circuits'])
    expect(await get('filter=published:false')).toEqual(['Burns'])
    expect(await get('filter=name:"r"&filter=published:true')).toEqual([
      'Arcadia',
      'Circuits'
    ])
    expect(await get('filter=status:"draft"')).toEqual(['Burns'])
    // A repeated filter narrows the list, such as a scope's and the panel's:
    expect(await get('filter=name:"ir"&filter=name:"u"')).toEqual(['Circuits'])
    expect(await get('filter=status:"all"')).toEqual([
      'Arcadia',
      'Burns',
      'Circuits'
    ])
  })

  it('gives a filter with several arguments an array', async () => {
    const both = await request(
      api,
      'GET',
      '/api/books?filter=author:"Ada","Bea"'
    )
    const one = await request(api, 'GET', '/api/books?filter=author:"Bea"')
    const twice = await request(
      api,
      'GET',
      '/api/books?filter=name:"A","B"'
    )
    expect(names(both.json)).toEqual(['Arcadia', 'Burns'])
    expect(names(one.json)).toEqual(['Burns'])
    expect(twice.status).toBe(400)
    expect(Object.keys(twice.json.errors)).toEqual(['name'])
  })

  it('validates each filter, and answers all errors at once', async () => {
    const { status, json } = await request(
      api,
      'GET',
      '/api/books?filter=published:"maybe"&filter=status:"x"&filter=name:"A"'
    )
    expect(status).toBe(400)
    expect(json).toMatchObject({
      type: 'FilterValidation',
      message: 'The query is not valid.'
    })
    expect(Object.keys(json.errors)).toEqual([
      'published',
      'status'
    ])
    expect(json.errors.status[0].keyword).toBe('invalid_value')
  })

  it('answers 400 for a filter whose schema throws or rejects', async () => {
    const failing = (check: () => never | Promise<never>) =>
      z.unknown().refine(check)
    const api = setup(
      books({
        filters: {
          throws: failing(() => {
            throw new Error('internal')
          }),
          rejects: failing(() => Promise.reject(new Error('internal')))
        }
      })
    )
    const { status, json } = await request(
      api,
      'GET',
      '/api/books?filter=throws:1&filter=rejects:1'
    )
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      throws: [{ message: 'Invalid input', keyword: 'custom' }],
      rejects: [{ message: 'Invalid input', keyword: 'custom' }]
    })
  })

  it('runs async `where`s with the context', async () => {
    const api = setup(
      books({
        filters: {
          mine: {
            schema: z.boolean(),
            async where({ value: mine, c, em }) {
              if (!mine) return undefined
              const author = await em.findOneOrFail(
                Author,
                { name: c.var.user!.id as string }
              )
              return { authors: author }
            }
          }
        }
      })
    )
    const { json } = await request(
      api,
      'GET',
      '/api/books?filter=mine:true',
      undefined,
      'Bea'
    )
    expect(names(json)).toEqual(['Burns'])
  })

  it('converts the arguments of filters by their schemas', async () => {
    const api = setup(
      books({
        filters: {
          ids: defineFilter({
            schema: z.array(z.number().int()),
            where: ({ value }) => ({ id: { $in: value } })
          }),
          below: defineFilter({
            schema: z.number().int(),
            where: ({ value }) => ({ id: { $lt: value } })
          })
        }
      })
    )
    const ids = async (search: string) =>
      (await request(api, 'GET', `/api/books?${search}`)).json.map(
        (book: Book) => book.id
      )
    expect(await ids('filter=ids:1,3')).toEqual([1, 3])
    expect(await ids('filter=ids:2')).toEqual([2])
    expect(await ids('filter=below:2')).toEqual([1])
    const { status } = await request(api, 'GET', '/api/books?filter=below:1,2')
    expect(status).toBe(400)
  })

  it('types `where` by the schema of `defineFilter()`', async () => {
    const api = setup(
      books({
        filters: {
          below: defineFilter({
            schema: z.number().int(),
            where: ({ value }) => {
              expectTypeOf(value).toEqualTypeOf<number>()
              return { id: { $lt: value } }
            }
          })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books?filter=below:2')
    expect(json.map((book: Book) => book.id)).toEqual([1])
  })

  it('combines the filters with `find.where`, also on the same key', async () => {
    const api = setup(books({ find: { where: { published: true } } }))
    const none = await request(
      api,
      'GET',
      '/api/books?filter=published:false'
    )
    const some = await request(
      api,
      'GET',
      '/api/books?filter=published:true&filter=name:"ir"'
    )
    expect(none.json).toEqual([])
    expect(names(some.json)).toEqual(['Circuits'])
  })

  it('applies `order`', async () => {
    const { json } = await request(api, 'GET', '/api/books?order=name+desc')
    expect(names(json)).toEqual(['Circuits', 'Burns', 'Arcadia'])
  })

  it('answers `range` with the results and the total', async () => {
    const { json } = await request(
      api,
      'GET',
      '/api/books?range=1,2&order=name+desc'
    )
    expect(json.total).toBe(3)
    expect(names(json.results)).toEqual(['Burns', 'Arcadia'])
    expect(json.results[1].parts).toHaveLength(2)
  })

  it('refuses unknown filters and orders', async () => {
    const unknown = await request(api, 'GET', '/api/books?filter=none:1')
    const proto = await request(
      api,
      'GET',
      '/api/books?filter=constructor:1'
    )
    const order = await request(api, 'GET', '/api/books?order=secret')
    const relation = await request(api, 'GET', '/api/books?order=parts')
    expect(unknown).toMatchObject({
      status: 400,
      json: { message: `Unknown filter 'none'` }
    })
    expect(proto.status).toBe(400)
    expect(order.status).toBe(400)
    expect(relation.status).toBe(400)
  })

  it('pages a filter on a relation to many rows by distinct rows', async () => {
    const page = (range: string) =>
      request(
        api,
        'GET',
        `/api/books?filter=author:"Ada","Bea"&range=${range}`
      )
    const first = await page('0,0')
    const second = await page('1,1')
    const all = await page('0,9')
    expect(first.json.total).toBe(2)
    expect(names(first.json.results)).toEqual(['Arcadia'])
    expect(names(second.json.results)).toEqual(['Burns'])
    expect(all.json.total).toBe(2)
    expect(names(all.json.results)).toEqual(['Arcadia', 'Burns'])
    // The page holds all the authors, not only the filtered ones.
    expect(all.json.results[1].authors).toHaveLength(2)
  })

  it('applies entity filters to the page and the total', async () => {
    await sql(`insert into author (name, deleted) values ('Cy', true)`)
    const api = setup(
      defineModelController({
        path: 'authors',
        authorize: true,
        entity: Author,
        find: { orderBy: { name: 'desc' } },
        actions: { get: true }
      })
    )
    const list = await request(api, 'GET', '/api/authors')
    const page = await request(api, 'GET', '/api/authors?range=0,0')
    expect(names(list.json)).toEqual(['Bea', 'Ada'])
    expect(page.json).toMatchObject({ total: 2, results: [{ name: 'Bea' }] })
  })

  it('refuses to order by lazy properties', async () => {
    const api = setup(
      defineModelController({
        path: 'authors',
        authorize: true,
        entity: Author,
        actions: { get: true }
      })
    )
    const lazy = await request(api, 'GET', '/api/authors?order=bio')
    const plain = await request(api, 'GET', '/api/authors?order=name')
    expect(lazy.status).toBe(400)
    expect(plain.status).toBe(200)
  })

  it('orders only by columns that `find` returns', async () => {
    const status = async (api: Hono<any, any, any>, order: string) =>
      (await request(api, 'GET', `/api/books?order=${order}`)).status
    const excluded = setup(books({ find: { exclude: ['notes'] } }))
    const narrowed = setup(books({ find: { fields: ['name', 'notes'] } }))
    for (const order of ['name', 'id+desc', 'nameLength', 'rating']) {
      expect(await status(excluded, order)).toBe(200)
    }
    for (const order of ['notes', 'secret', 'parts', 'parts.name']) {
      expect(await status(excluded, order)).toBe(400)
    }
    expect(await status(narrowed, 'notes')).toBe(200)
    expect(await status(narrowed, 'id')).toBe(200)
    expect(await status(narrowed, 'published')).toBe(400)
  })

  it('answers at most 1000 rows', async () => {
    await sql(
      `insert into book (name, created_at, updated_at)
      select 'Book ' || n, now(), now() from generate_series(1, 997) n`
    )
    const api = setup(books({ find: {} }))
    const all = await request(api, 'GET', '/api/books')
    expect(all.json).toHaveLength(1000)
    await sql(
      `insert into book (name, created_at, updated_at)
      values ('One more', now(), now())`
    )
    const more = await request(api, 'GET', '/api/books')
    const page = await request(api, 'GET', '/api/books?range=1,1000')
    const large = await request(api, 'GET', '/api/books?range=0,1000')
    expect(more).toMatchObject({
      status: 400,
      json: {
        message: 'Unable to list more than 1000 rows without a `range`'
      }
    })
    expect(page.json.total).toBe(1001)
    expect(page.json.results).toHaveLength(1000)
    expect(large).toMatchObject({
      status: 400,
      json: {
        message: `Invalid range '0,1000': a list answers at most 1000 rows`
      }
    })
  })

  it('lists through `c.var.list()` with a find', async () => {
    const api = setup(
      books({
        find: {},
        actions: {
          'get published': ({ list }) => list({ where: { published: true } })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books/published')
    expect(names(json)).toEqual(['Arcadia', 'Circuits'])
  })

  it('lists all rows in `defineChoices()`, past the limit of lists', async () => {
    await sql(
      `insert into book (name, created_at, updated_at)
       select 'Many ' || n, now(), now() from generate_series(1, 1000) n`
    )
    const api = setup(books({ mixins: [defineChoices({ fields: ['name'] })] }))
    const { json } = await request(api, 'GET', '/api/books/choices')
    await sql(`delete from book where name like 'Many %'`)
    expect(json.length).toBeGreaterThan(1000)
  })

  it('answers as many rows as `maxRows` lets it', async () => {
    const [{ count }] = await sql('select count(*)::int as count from book')
    const api = setup(
      books({
        find: {},
        actions: {
          'get all': defineListHandler({ fields: ['name'], maxRows: Infinity }),
          'get few': defineListHandler({ maxRows: count - 1 }),
          'get ids': async ({ list }) => {
            const rows = await list({
              where: { published: true },
              fields: ['id'],
              maxRows: Infinity
            })
            return (rows as Book[]).map(({ id }) => id)
          }
        },
        mixins: [defineChoices({ fields: ['name'] })]
      })
    )
    for (const path of ['all', 'choices']) {
      const { status, json } = await request(
        api,
        'GET',
        `/api/books/${path}`
      )
      expect(status).toBe(200)
      expect(json).toHaveLength(count)
    }
    // Filters still apply.
    const unknown = await request(api, 'GET', '/api/books/all?filter=x:1')
    expect(unknown.status).toBe(400)
    const ids = await request(api, 'GET', '/api/books/ids?order=name+desc')
    expect(ids.json).toEqual([3, 1])
    const few = await request(api, 'GET', '/api/books/few')
    expect(few).toMatchObject({
      status: 400,
      json: {
        message: `Unable to list more than ${
          count - 1
        } rows without a \`range\``
      }
    })
  })

  it('applies `find.where` to every query', async () => {
    const api = setup(books({ find: { where: { published: true } } }))
    const list = await request(api, 'GET', '/api/books')
    const member = await request(api, 'GET', '/api/books/2')
    expect(names(list.json)).toEqual(['Arcadia', 'Circuits'])
    expect(member.status).toBe(404)
  })
})

describe('get :id', () => {
  const api = setup(books())

  it('answers the row as Dito does', async () => {
    const { status, json } = await request(api, 'GET', '/api/books/1')
    expect(status).toBe(200)
    expect(json).toMatchObject({
      id: 1,
      name: 'Arcadia',
      published: true,
      specs: { pages: 400, tags: ['fable'] },
      nameLength: 7,
      authors: [{ id: expect.any(Number), name: 'Ada' }]
    })
    // Relations to many rows that `find` leaves out aren't sent. Relations to
    // one row that hold the foreign key go out as `{ id }`, or `null`, also
    // the parent of a nested row.
    const [part] = json.parts
    expect(part).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      order: 0,
      book: { id: 1 },
      defaultChapter: null,
      chapters: [
        {
          id: expect.any(Number),
          name: 'Lesson',
          order: 0,
          code: null,
          keywords: null,
          part: { id: part.id }
        },
        {
          id: expect.any(Number),
          name: 'Bark',
          order: 1,
          code: null,
          keywords: null,
          part: { id: part.id }
        }
      ]
    })
    expect(json).not.toHaveProperty('awards')
    expect(json).not.toHaveProperty('info')
  })

  it('leaves out hidden properties', async () => {
    const { json } = await request(api, 'GET', '/api/books/1')
    expect(json).not.toHaveProperty('secret')
  })

  it('answers 404 for missing rows', async () => {
    const { status, json } = await request(api, 'GET', '/api/books/9')
    expect(status).toBe(404)
    expect(json).toMatchObject({ status: 404, message: 'Not Found' })
  })

  it('answers 404 for ids that are no valid primary key', async () => {
    for (const id of ['abc', '1.5', '1e3', '99999999999999999999']) {
      const { status } = await request(api, 'GET', `/api/books/${id}`)
      expect(status).toBe(404)
    }
  })

  it('gives record actions the id of the primary key', async () => {
    const api = setup(
      books({
        actions: {
          'get :id/id': ({ id, params }) => ({ id, param: params.id })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books/1/id')
    expect(json).toEqual({ id: 1, param: '1' })
    const { status } = await request(api, 'GET', '/api/books/abc/id')
    expect(status).toBe(404)
  })

  it('gives handlers the entity of the controller', async () => {
    const api = setup(
      books({
        actions: {
          'get table': ({ entity, em }) => ({
            isBook: entity === Book,
            table: em.getMetadata(entity).tableName
          })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books/table')
    expect(json).toEqual({ isBook: true, table: 'book' })
  })

  it('leaves ids that are no primary key to `load`', async () => {
    const api = setup(
      books({
        load: ({ c, id }) => c.var.em.findOne(Book, id === 'self' ? 1 : +id),
        actions: {
          'get :id': true,
          'get :id/id': async ({ id, getRecord }) => ({
            id,
            name: (await getRecord()).name
          })
        }
      })
    )
    const get = (path: string) => request(api, 'GET', `/api/books/${path}`)
    expect((await get('self')).json.name).toBe('Arcadia')
    expect((await get('self/id')).json).toEqual({ id: 'self', name: 'Arcadia' })
    expect((await get('1/id')).json).toEqual({ id: 1, name: 'Arcadia' })
    expect((await get('9')).status).toBe(404)
  })
})

describe('find', () => {
  it('narrows the properties with `fields`, with the ids', async () => {
    const api = setup(books({ find: { fields: ['name', 'notes'] } }))
    const { json } = await request(api, 'GET', '/api/books/1')
    expect(json).toEqual({ id: 1, name: 'Arcadia', notes: null })
  })

  it('can be a function of the context, run once per request', async () => {
    let calls = 0
    const api = setup(
      books({
        find: ({ user }) => {
          calls++
          return {
            where: user ? {} : { published: true },
            exclude: user ? [] : ['notes'],
            orderBy: { name: 'asc' }
          }
        }
      })
    )
    const names = (rows: Book[]) => rows.map(row => row.name)
    const guest = await request(api, 'GET', '/api/books')
    const editor = await request(api, 'GET', '/api/books', undefined, 'ed')
    expect(names(guest.json)).toEqual(['Arcadia', 'Circuits'])
    expect(guest.json[0]).not.toHaveProperty('notes')
    expect(names(editor.json)).toEqual(['Arcadia', 'Burns', 'Circuits'])
    expect(editor.json[0]).toHaveProperty('notes')
    expect(calls).toBe(2)
    calls = 0
    const hidden = await request(api, 'GET', '/api/books/2')
    const patched = await request(
      api,
      'PATCH',
      '/api/books/2',
      { notes: 'New' },
      'ed'
    )
    expect(hidden.status).toBe(404)
    expect(patched.json.notes).toBe('New')
    expect(calls).toBe(2)
  })

  it('refuses the options that the base controls', async () => {
    for (const key of ['limit', 'offset', 'ctx', 'lockMode']) {
      expect(() => books({ find: { [key]: 1 } })).toThrow(
        `Unable to set \`${key}\` in \`find\`, which the base controls`
      )
    }
    const errors: unknown[] = []
    const api = createApi({
      controllers: [
        books({ find: () => ({ disableIdentityMap: true }) })
      ],
      adapter: createMikroAdapter(orm),
      onError: ({ error }) => {
        errors.push(error)
      }
    })
    const { status } = await request(api, 'GET', '/books/1')
    expect(status).toBe(500)
    expect(errors[0]).toMatchObject({
      message:
        'Unable to set `disableIdentityMap` in `find`, which the base controls'
    })
  })
})

describe('defineListHandler', () => {
  it('lists the choices of a select, with the filters of the list', async () => {
    const api = setup(
      books({
        find: {
          where: { published: true },
          populate: ['parts.chapters', 'authors'],
          exclude: ['notes']
        },
        mixins: [
          defineChoices({
            fields: ['id', 'name', 'notes', 'authors.name'],
            populate: ['authors'],
            orderBy: { name: 'desc' }
          })
        ]
      })
    )
    const all = await request(api, 'GET', '/api/books/choices')
    const filtered = await request(
      api,
      'GET',
      '/api/books/choices?filter=name:"ad"&range=0,9'
    )
    // `find.where` applies, `notes` stays excluded and only the relations of
    // `fields` go out.
    expect(all.json).toEqual([
      { id: 3, name: 'Circuits', authors: [] },
      { id: 1, name: 'Arcadia', authors: [{ id: 1, name: 'Ada' }] }
    ])
    expect(filtered.json).toEqual({
      results: [
        { id: 1, name: 'Arcadia', authors: [{ id: 1, name: 'Ada' }] }
      ],
      total: 1
    })
  })

  it("merges its `find` into the controller's", async () => {
    const api = setup(
      books({
        find: ({ user }) => ({
          where: user ? {} : { name: { $ne: 'Arcadia' } },
          orderBy: { name: 'asc' }
        }),
        actions: {
          'get published': defineListHandler({ where: { published: true } })
        }
      })
    )
    const guest = await request(api, 'GET', '/api/books/published')
    const editor = await request(
      api,
      'GET',
      '/api/books/published',
      undefined,
      'ed'
    )
    expect(guest.json.map((row: Book) => row.name)).toEqual(['Circuits'])
    expect(editor.json.map((row: Book) => row.name)).toEqual([
      'Arcadia',
      'Circuits'
    ])
  })

  it("keeps what the controller's `exclude` hides, also from `*`", async () => {
    await sql(`update book set notes = 'Private'`)
    const api = setup(
      books({
        find: { populate: ['parts'], exclude: ['notes', 'parts.order'] },
        actions: {
          'get all': defineListHandler({ fields: ['*'], populate: ['parts'] })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books/all?order=id')
    const ordered = await request(api, 'GET', '/api/books/all?order=notes')
    expect(json[0]).toMatchObject({ id: 1, name: 'Arcadia' })
    expect(json[0]).not.toHaveProperty('notes')
    expect(json[0].parts[0]).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      book: { id: 1 },
      defaultChapter: null
    })
    expect(ordered.status).toBe(400)
  })

  it("replaces the controller's `fields`", async () => {
    const api = setup(
      books({
        find: { fields: ['name'] },
        mixins: [defineChoices({ fields: ['id', 'name', 'notes'] })]
      })
    )
    const { json } = await request(api, 'GET', '/api/books/choices?order=id')
    const ordered = await request(
      api,
      'GET',
      '/api/books/choices?order=notes'
    )
    expect(json[0]).toEqual({ id: 1, name: 'Arcadia', notes: null })
    expect(ordered.status).toBe(200)
  })

  it('keeps nested excludes when `fields` names the relation', async () => {
    const api = setup(
      books({
        find: {
          populate: ['parts.chapters'],
          exclude: ['parts.name', 'notes']
        },
        mixins: [
          defineChoices({
            fields: ['name', 'notes', 'parts'],
            populate: ['parts.chapters']
          })
        ]
      })
    )
    const { json } = await request(api, 'GET', '/api/books/choices?order=id')
    expect(json[0]).toEqual({
      id: 1,
      name: 'Arcadia',
      parts: [
        expect.objectContaining({ order: 0, chapters: expect.any(Array) }),
        expect.objectContaining({ order: 1 })
      ]
    })
    expect(json[0].parts[0]).not.toHaveProperty('name')
    expect(json[0].parts[0].chapters[0].name).toBe('Lesson')
  })

  it('refuses the options that the base controls', () => {
    expect(() => defineListHandler({ limit: 1 })).toThrow(
      'Unable to set `limit` in `find`, which the base controls'
    )
  })
})

describe('list filters', () => {
  const api = setup(
    books({
      find: { orderBy: { id: 'asc' } },
      filters: {
        name: defineTextFilter(),
        text: defineTextFilter(['name', 'notes']),
        createdAt: defineDateRangeFilter(),
        since: defineDateRangeFilter('releasedAt')
      }
    })
  )
  const names = async (query: string) => {
    const { status, json } = await request(api, 'GET', `/api/books?${query}`)
    return status === 200 ? json.map((row: Book) => row.name) : status
  }

  it('matches text as the admin sends it', async () => {
    await sql(`update book set notes = '100% burns' where id = 3`)
    expect(await names('filter=name:"ADI"')).toEqual(['Arcadia'])
    expect(await names('filter=name:"","urn"')).toEqual(['Burns'])
    const operator = (name: string, text: string) =>
      `filter=name:"${name}","${text}"`
    expect(await names(operator('starts-with', 'b'))).toEqual(['Burns'])
    expect(await names(operator('ends-with', 'TS'))).toEqual(['Circuits'])
    expect(await names(operator('equals', 'burn'))).toEqual([])
    expect(await names(operator('equals', 'burns'))).toEqual(['Burns'])
    expect(await names(operator('contains', 'r'))).toHaveLength(3)
    expect(await names(operator('like', 'r'))).toBe(400)
    // Several properties, and no wildcards in the text.
    expect(await names('filter=text:"burns"')).toEqual(['Burns', 'Circuits'])
    expect(await names('filter=text:"100%25"')).toEqual(['Circuits'])
    expect(await names('filter=text:"_"')).toEqual([])
    // An empty text skips the filter.
    expect(await names('filter=name:""')).toHaveLength(3)
  })

  it('matches date ranges as the admin sends them', async () => {
    await sql(`update book set released_at = '2020-01-01' where id = 1`)
    await sql(`update book set released_at = '2022-01-01' where id = 2`)
    const date = (year: number) => `${year}-06-01T00:00:00.000Z`
    const since = (...values: string[]) =>
      names(`filter=since:${values.map(value => `"${value}"`).join(',')}`)
    expect(await since(date(2020))).toEqual(['Burns'])
    expect(await since('', date(2020))).toEqual(['Arcadia'])
    expect(await since(date(2019), date(2021))).toEqual(['Arcadia'])
    expect(await since('')).toHaveLength(3)
    expect(await since('tomorrow')).toBe(400)
    expect(await names(`filter=createdAt:"${date(2000)}"`)).toHaveLength(3)
  })
})

describe('c.var.getListQuery()', () => {
  it('returns the `where` and `orderBy` of the list', async () => {
    const api = setup(
      books({
        find: { where: { published: true }, orderBy: { name: 'desc' } },
        filters: { name: defineTextFilter() },
        actions: {
          async 'get summary'({ em, getListQuery }) {
            const { where, orderBy, range } = await getListQuery()
            const rows = await em.find(Book, where, {
              fields: ['id'],
              orderBy
            })
            return {
              ids: rows.map(row => row.id),
              count: rows.length,
              range
            }
          }
        }
      })
    )
    const summary = (query = '') =>
      request(api, 'GET', `/api/books/summary${query}`)
    expect((await summary()).json).toEqual({
      ids: [3, 1],
      count: 2,
      range: null
    })
    expect((await summary('?range=0,9')).json.range).toEqual([0, 9])
    expect((await summary('?order=name')).json.ids).toEqual([1, 3])
    expect((await summary('?filter=name:"circ"')).json.ids).toEqual([3])
    expect((await summary('?filter=other:1')).status).toBe(400)
    expect((await summary('?order=secret')).status).toBe(400)
  })
})

describe('mergeFind()', () => {
  it('joins `where`s and replaces the other options', () => {
    expect(
      mergeFind<Book>(
        {
          where: { a: 1 },
          populate: ['parts'],
          exclude: ['notes'],
          orderBy: { name: 'asc' },
          maxRows: 10
        },
        {
          where: { b: 2 },
          populate: ['authors'] as never[],
          orderBy: { id: 'desc' },
          maxRows: undefined
        }
      )
    ).toEqual({
      where: { $and: [{ a: 1 }, { b: 2 }] },
      populate: ['authors'],
      exclude: ['notes'],
      orderBy: { id: 'desc' },
      maxRows: 10
    })
  })

  it('leaves out `populate` for `fields` without one', () => {
    expect(
      mergeFind<Book>(
        { populate: ['parts.chapters', 'authors'] as never[] },
        { fields: ['name', 'parts.name'] as never[] }
      )
    ).toEqual({ fields: ['name', 'parts.name'] })
  })

  it('merges `filters` by name, and replaces other values of them', () => {
    const merge = (base: FilterOptions, extra: FilterOptions) =>
      mergeFind<Book>({ filters: base }, { filters: extra }).filters
    expect(
      merge({ active: true, tenant: { id: 1 } }, { active: false, other: true })
    ).toEqual({ active: false, tenant: { id: 1 }, other: true })
    expect(merge({ tenant: { id: 1 } }, ['active'])).toEqual(['active'])
    expect(merge({ tenant: { id: 1 } }, false)).toBe(false)
  })
})

describe('output', () => {
  const parts = (find: ModelControllerDefinition<Part>['find']) =>
    defineModelController({
      path: 'parts',
      authorize: true,
      entity: Part,
      find,
      actions: { 'get': true, 'get :id': true }
    })

  it('sends relations to one row as `{ id }` unless populated', async () => {
    const plain = setup(parts({ orderBy: { id: 'asc' } }))
    const loaded = setup(parts({ populate: ['book', 'defaultChapter'] }))
    const [part] = (await request(plain, 'GET', '/api/parts')).json
    const { json } = await request(loaded, 'GET', `/api/parts/${part.id}`)
    expect(part).toEqual({
      id: part.id,
      name: 'Preface',
      order: 0,
      book: { id: 1 },
      defaultChapter: null
    })
    expect(json).toMatchObject({
      book: { id: 1, name: 'Arcadia' },
      defaultChapter: null
    })
    // The nested book leaves out its relations and hidden properties.
    expect(json.book).not.toHaveProperty('parts')
    expect(json.book).not.toHaveProperty('secret')
  })

  it('sends rows that share relations like single rows', async () => {
    const api = setup(
      parts({ populate: ['book.parts.book'], orderBy: { id: 'asc' } })
    )
    const { json: rows } = await request(api, 'GET', '/api/parts')
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      const { json } = await request(api, 'GET', `/api/parts/${row.id}`)
      expect(row).toEqual(json)
    }
  })

  it('sends a relation as `{ id }` where a handler loaded it', async () => {
    const api = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        actions: {
          'get :id': async ({ getRecord, em }) => {
            const part = await getRecord<Part>()
            await em.populate(part, ['book', 'chapters'] as never[])
            return part
          }
        }
      })
    )
    const [{ id }] = await sql(`select id from part where name = 'Drama'`)
    const { json } = await request(api, 'GET', `/api/parts/${id}`)
    expect(json.book).toEqual({ id: 1 })
    expect(json).not.toHaveProperty('chapters')
  })

  it('keeps inverse one-to-one relations out unless populated', async () => {
    await sql(`insert into info (id, text, book_id) values (7, 'Note', 1)`)
    const get = async (find?: FindShape) =>
      (await request(setup(books({ find })), 'GET', '/api/books/1')).json
    const api = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        actions: {
          // Only the id of `info` is known, as a reference.
          'get book': ({ em }) =>
            em.findOneOrFail(Book, 1, { populate: ['info:ref'] as never[] })
        }
      })
    )
    // A book that isn't a record of the controller has no `find`.
    const { json } = await request(api, 'GET', '/api/parts/book')
    expect(json).toMatchObject({ id: 1, name: 'Arcadia' })
    expect(json).not.toHaveProperty('info')
    // A record leaves the relation out, also when a handler loaded it.
    const records = setup(
      books({
        actions: {
          'get :id': async ({ getRecord, em }) => {
            const book = await getRecord<Book>()
            await em.find(Info, {})
            expect(book.info).toBeDefined()
            return book
          }
        }
      })
    )
    const loaded = await request(records, 'GET', '/api/books/1')
    expect(loaded.status).toBe(200)
    expect(loaded.json).not.toHaveProperty('info')
    expect(await get({})).not.toHaveProperty('info')
    expect(await get({ fields: ['name'] })).not.toHaveProperty('info')
    expect((await get({ populate: ['info'] })).info).toMatchObject({
      id: 7,
      text: 'Note'
    })
    expect(await get({ fields: ['name', 'info.text'] })).toEqual({
      id: 1,
      name: 'Arcadia',
      info: { id: 7, text: 'Note' }
    })
    await sql('delete from info where id = 7')
  })

  it('sends a relation where `fields` selects it', async () => {
    const get = async (find: FindShape) =>
      (await request(setup(parts(find)), 'GET', '/api/parts?order=id')).json[0]
    expect(await get({ fields: ['name'] })).toEqual({
      id: expect.any(Number),
      name: 'Preface'
    })
    for (const name of ['book', 'book.id']) {
      expect(await get({ fields: ['name', name] })).toEqual({
        id: expect.any(Number),
        name: 'Preface',
        book: { id: 1 }
      })
    }
    expect(await get({ fields: ['name', 'defaultChapter'] })).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      defaultChapter: null
    })
    expect(await get({ fields: ['name', 'defaultChapter.id'] })).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      defaultChapter: null
    })
    expect(await get({ fields: ['*'] })).toMatchObject({
      book: { id: 1 },
      defaultChapter: null
    })
    expect(await get({ exclude: ['book'] })).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      order: 0,
      defaultChapter: null
    })
    expect(
      await get({ fields: ['name', 'book'], exclude: ['book'] })
    ).toEqual({ id: expect.any(Number), name: 'Preface' })
  })

  it('sends a populated relation as a nested row', async () => {
    const get = async (find: FindShape) =>
      (await request(setup(parts(find)), 'GET', '/api/parts?order=id')).json[0]
    for (const populate of [undefined, ['book']]) {
      expect(await get({ fields: ['name', 'book.name'], populate })).toEqual(
        {
          id: expect.any(Number),
          name: 'Preface',
          book: { id: 1, name: 'Arcadia' }
        }
      )
    }
    // Nested rows take their relations in `fields` and `exclude` by paths.
    const { json } = await request(
      setup(
        books({
          find: {
            fields: [
              'name', 'parts.name', 'parts.defaultChapter', 'parts.chapters'
            ],
            populate: ['parts', 'parts.chapters'],
            exclude: ['parts.chapters.part']
          }
        })
      ),
      'GET',
      '/api/books/1'
    )
    expect(json.parts[0]).toEqual({
      id: expect.any(Number),
      name: 'Preface',
      defaultChapter: null,
      chapters: [
        expect.not.objectContaining({ part: expect.anything() }),
        expect.not.objectContaining({ part: expect.anything() })
      ]
    })
    // The bare name of a populated relation sends the row.
    for (const exclude of [[], ['order']]) {
      expect(
        await get({
          fields: ['name', 'book', 'order'],
          exclude,
          populate: ['book']
        })
      ).toMatchObject({ book: { id: 1, name: 'Arcadia' } })
    }
  })

  it('keeps hidden relations out', async () => {
    await sql('update award set judge_id = 1, jury_id = 1')
    const awards = (find: FindShape) =>
      setup(
        defineModelController({
          path: 'awards',
          authorize: true,
          entity: Award,
          find,
          actions: { get: true }
        })
      )
    const get = async (find: FindShape, query = '') =>
      request(awards(find), 'GET', `/api/awards${query}`)
    for (const find of [
      {},
      { fields: ['name', 'judge', 'jury'] },
      { fields: ['*'], exclude: ['author'] }
    ]) {
      const [award] = (await get(find)).json
      expect(award).not.toHaveProperty('judge')
      expect(award.jury).toEqual({ id: 1 })
    }
    expect((await get({}, '?order=judge.id')).status).toBe(400)
    expect((await get({}, '?order=jury.id')).status).toBe(200)
    await sql('update award set judge_id = null, jury_id = null')
  })

  it('loads no lazy properties through `relation.*` unless named', async () => {
    await sql('update award set author_id = (select min(id) from author)')
    const awards = (fields: string[]) =>
      setup(
        defineModelController({
          path: 'awards',
          authorize: true,
          entity: Award,
          find: { fields },
          actions: { get: true }
        })
      )
    const get = async (fields: string[]) => {
      const queries: string[] = []
      const logger = orm.config.getLogger()
      const spy = vi
        .spyOn(logger, 'logQuery')
        .mockImplementation(({ query }) => void queries.push(query ?? ''))
      const debug = orm.config.get('debug')
      orm.config.set('debug', ['query'])
      try {
        const { json } = await request(awards(fields), 'GET', '/api/awards')
        return { author: json[0].author, queries: queries.join('\n') }
      } finally {
        orm.config.set('debug', debug)
        spy.mockRestore()
      }
    }
    const plain = await get(['name', 'author.*'])
    expect(plain.author).toEqual({
      id: expect.any(Number),
      name: 'Ada',
      deleted: false,
      email: null
    })
    expect(plain.queries).not.toMatch(/count/)
    const named = await get(['name', 'author.*', 'author.awardCount'])
    expect(named.author).toMatchObject({ name: 'Ada', awardCount: 1 })
  })

  it('orders by `relation.id` where the rows return it', async () => {
    const list = async (find: FindShape, order: string) =>
      request(setup(parts(find)), 'GET', `/api/parts?order=${order}`)
    const expected = (
      await sql('select id from part order by book_id desc, id')
    ).map((row: Record<string, unknown>) => row.id as number)
    // The order differs from the order of the ids.
    expect(expected).not.toEqual([...expected].sort((a, b) => a - b))
    for (const find of [
      {},
      { fields: ['name', 'book'] },
      { fields: ['name', 'book.id'] },
      { fields: ['name', 'book.name'] }
    ]) {
      const { status, json } = await list(find, 'book.id+desc')
      expect(status).toBe(200)
      expect(json.map((part: { id: number }) => part.id)).toEqual(expected)
    }
    for (const [find, order] of [
      [{ fields: ['name'] }, 'book.id'],
      [{ exclude: ['book'] }, 'book.id'],
      [{ exclude: ['book.id'] }, 'book.id'],
      [{}, 'book'],
      [{}, 'bookId'],
      [{}, 'book.name'],
      [{}, 'book.id.id'],
      [{}, 'name.id'],
      [{}, 'chapters.id']
    ] as const) {
      expect((await list(find, order)).status).toBe(400)
    }
  })

  it('filters by `relation.id`', async () => {
    const api = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        filters: { 'book.id': z.coerce.number() },
        actions: { get: true }
      })
    )
    const { json } = await request(api, 'GET', '/api/parts?filter=book.id:1')
    expect(json.length).toBeGreaterThan(0)
    for (const part of json) expect(part.book).toEqual({ id: 1 })
  })

  it(`serializes the entities of a result that aren't records`, async () => {
    await sql(`update author set email = 'ada@example.com'`)
    const api = setup(
      books({
        actions: {
          'get graph': async ({ em }) => {
            const award = await em.findOneOrFail(
              Award,
              { name: 'PEN' },
              { populate: ['book'] }
            )
            const author = await em.findOneOrFail(
              Author,
              { name: 'Ada' },
              { populate: ['books'] }
            )
            const part = await em.findOneOrFail(
              Part,
              { name: 'Preface' },
              { populate: ['chapters', 'book'] }
            )
            return { award, authors: [author], part, count: 1 }
          }
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books/graph')
    // Records of the controller go out in its shape, other entities with
    // their loaded relations and without hidden properties.
    expect(json.award).toEqual({
      id: expect.any(Number),
      name: 'PEN',
      author: null,
      jury: null,
      book: expect.objectContaining({ id: 1, name: 'Arcadia' })
    })
    expect(json.award.book).not.toHaveProperty('secret')
    expect(json.authors).toEqual([
      {
        id: 1,
        name: 'Ada',
        deleted: false,
        email: 'ada@example.com',
        books: expect.any(Array)
      }
    ])
    expect(json.authors[0].books[0].name).toBe('Arcadia')
    expect(json.authors[0].books[0]).not.toHaveProperty('secret')
    // A relation back to an entity above it stays `{ id }`.
    expect(json.part.chapters[0]).toEqual({
      id: expect.any(Number),
      name: 'Lesson',
      order: 0,
      code: null,
      keywords: null,
      part: { id: json.part.id }
    })
    expect(json.count).toBe(1)
  })
})

describe('default handlers', () => {
  it('refuses entities with a composite primary key', async () => {
    const errors: unknown[] = []
    const api = createApi({
      controllers: [
        defineModelController({
          path: 'pairs',
          entity: Pair,
          actions: { get: true }
        })
      ],
      adapter: createMikroAdapter(orm),
      onError: ({ error }) => {
        errors.push(error)
      }
    })
    const { status } = await request(api, 'GET', '/pairs')
    expect(status).toBe(500)
    expect(errors[0]).toMatchObject({
      message: expect.stringContaining(`composite primary key of 'Pair'`)
    })
  })

  it('applies the settings of the controller to the actions of mixins', async () => {
    const api = setup(
      defineModelController({
        path: 'books',
        entity: Book,
        authorize: true,
        mixins: [crud],
        actions: { 'get count': () => 1 }
      })
    )
    const { status } = await request(api, 'POST', '/api/books', {
      name: 'New'
    })
    expect(status).toBe(201)
  })

  it('routes all five with `crud`', async () => {
    const api = setup(
      defineModelController({
        path: 'books',
        entity: Book,
        authorize: true,
        mixins: [crud]
      })
    )
    const created = await request(api, 'POST', '/api/books', { name: 'New' })
    const path = `/api/books/${created.json.id}`
    expect(created.status).toBe(201)
    expect((await request(api, 'GET', '/api/books')).json).toHaveLength(4)
    expect((await request(api, 'GET', path)).json.name).toBe('New')
    const patched = await request(api, 'PATCH', path, { name: 'Newer' })
    expect(patched.json.name).toBe('Newer')
    expect((await request(api, 'DELETE', path)).json).toEqual({ count: 1 })
  })

  it('routes only the ones that the controller sets', async () => {
    const api = setup(
      defineModelController({
        path: 'books',
        entity: Book,
        actions: { 'get :id': ({ next }) => next() }
      })
    )
    expect((await request(api, 'GET', '/api/books')).status).toBe(404)
    expect((await request(api, 'GET', '/api/books/1')).status).toBe(200)
    expect((await request(api, 'DELETE', '/api/books/1')).status).toBe(404)
  })
})

describe('writes', () => {
  const api = setup(books())

  it('creates with post, answers 201 and loads the shape', async () => {
    const { status, headers, json } = await request(
      api,
      'POST',
      '/api/books',
      {
        name: 'Dia',
        authors: [{ id: 2 }],
        parts: [{ name: 'Preface', chapters: [{ name: 'Body' }] }]
      }
    )
    expect(status).toBe(201)
    expect(headers.get('Location')).toBe(`/api/books/${json.id}`)
    expect(json).toMatchObject({
      name: 'Dia',
      published: false,
      authors: [{ id: 2, name: 'Bea' }],
      parts: [{ name: 'Preface', chapters: [{ name: 'Body' }] }],
      // The database computes formulas, which the reload after the flush
      // loads.
      nameLength: 3
    })
    const saved = await request(api, 'GET', `/api/books/${json.id}`)
    expect(saved.json).toEqual(json)
  })

  it('writes nothing for a patch of the loaded graph', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const { status, json } = await request(
      api,
      'PATCH',
      '/api/books/1',
      book
    )
    expect(status).toBe(200)
    expect(json).toEqual(book)
  })

  it('leaves columns outside of the shape to the database', async () => {
    const api = setup(
      books({
        find: { fields: ['name'] },
        actions: {
          // The record holds `notes`, which the shape leaves out, and which
          // the database changes after the record loaded.
          async 'patch :id'({ id, em }) {
            const book = await em.findOneOrFail(Book, id)
            await em.execute(`update book set notes = 'New' where id = ${id}`)
            return book
          }
        }
      })
    )
    const { status } = await request(api, 'PATCH', '/api/books/1', {})
    expect(status).toBe(200)
    expect((await sql(`select notes from book where id = 1`))[0].notes).toBe(
      'New'
    )
  })

  it('only takes the id of relations that the record does not own', async () => {
    const { status } = await request(api, 'PATCH', '/api/books/1', {
      authors: [{ id: 2, name: 'Changed' }]
    })
    expect(status).toBe(200)
    const [{ name }] = await sql(`select name from author where id = 2`)
    expect(name).toBe('Bea')
  })

  it('saves nested changes in one patch', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [preface, drama] = book.parts
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      authors: [1, 2],
      parts: [
        {
          ...preface,
          chapters: [{ ...preface.chapters[0], name: 'Tail' }, { name: 'Back' }]
        },
        { name: 'Interlude', chapters: [{ name: 'Interlude' }] }
      ]
    })
    expect(status).toBe(200)
    expect(json.authors.map((it: any) => it.name)).toEqual(['Ada', 'Bea'])
    expect(
      json.parts.map((part: any) => [
        part.name,
        part.chapters.map((chapter: any) => chapter.name)
      ])
    ).toEqual([
      ['Preface', ['Tail', 'Back']],
      ['Interlude', ['Interlude']]
    ])
    // The removed rows are deleted, as the relations own them.
    const [chapters] = await sql(
      'select count(*)::int as count from chapter where part_id = ?',
      [drama.id]
    )
    expect(chapters.count).toBe(0)
    const saved = await request(api, 'GET', '/api/books/1')
    expect(saved.json).toEqual(json)
  })

  it('links relations to new rows with `#id` and `#ref`', async () => {
    const { json } = await request(api, 'PATCH', '/api/books/2', {
      parts: [
        {
          name: 'Preface',
          defaultChapter: { '#ref': 'book' },
          chapters: [
            { name: 'Lesson' },
            { '#id': 'book', 'name': 'Bark' }
          ]
        }
      ]
    })
    const [part] = json.parts
    const book = part.chapters.find((chapter: any) => chapter.name === 'Bark')
    expect(part.defaultChapter).toEqual({ id: book.id })
  })

  it('refuses a reference to no new row', async () => {
    const { status, json } = await request(api, 'PATCH', '/api/books/2', {
      parts: [{ name: 'Preface', defaultChapter: { '#ref': 'none' } }]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'parts/0/defaultChapter': [
        {
          message: `references the unknown new row 'none'`,
          keyword: 'invalid_value'
        }
      ]
    })
  })

  it('takes `{ id }` for a relation to one row, as the output sends it', async () => {
    const parts = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        actions: { 'get :id': true, 'patch :id': true }
      })
    )
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [preface, drama] = book.parts
    const moved = await request(parts, 'PATCH', `/api/parts/${drama.id}`, {
      book: { id: 2 }
    })
    const missing = await request(parts, 'PATCH', `/api/parts/${drama.id}`, {
      book: { id: 99 }
    })
    const nested = await request(api, 'PATCH', '/api/books/1', {
      parts: [{ ...preface, defaultChapter: { id: preface.chapters[1].id } }]
    })
    expect(moved.json.book).toEqual({ id: 2 })
    expect(missing.json.errors).toEqual({
      book: [{ keyword: 'invalid_value', message: 'names no Book' }]
    })
    expect(nested.json.parts[0].defaultChapter).toEqual({
      id: preface.chapters[1].id
    })
  })

  it('ignores `<name>Id` in a body, as any unknown key', async () => {
    const parts = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        actions: { 'post': true, 'patch :id': true }
      })
    )
    const [{ id }] = await sql(`select id from part where name = 'Drama'`)
    const patched = await request(parts, 'PATCH', `/api/parts/${id}`, {
      bookId: 2
    })
    const posted = await request(parts, 'POST', '/api/parts', {
      name: 'New',
      bookId: 2
    })
    expect(patched.status).toBe(200)
    expect(patched.json.book).toEqual({ id: 1 })
    expect(patched.json).not.toHaveProperty('bookId')
    expect(posted.status).toBe(400)
    expect(Object.keys(posted.json.errors)).toEqual(['book'])
  })

  it('takes back a loaded row', async () => {
    const parts = setup(
      defineModelController({
        path: 'parts',
        authorize: true,
        entity: Part,
        find: { populate: ['book', 'defaultChapter'] },
        actions: { 'get :id': true, 'patch :id': true }
      })
    )
    const [{ id }] = await sql(`select id from part where name = 'Drama'`)
    const { json: part } = await request(parts, 'GET', `/api/parts/${id}`)
    expect(part.book).toMatchObject({ id: 1, name: 'Arcadia' })
    const { status, json } = await request(
      parts,
      'PATCH',
      `/api/parts/${id}`,
      part
    )
    expect(status).toBe(200)
    expect(json).toEqual(part)
  })

  it('refuses ids of relations that name no row, or a filtered one', async () => {
    await sql(`insert into author (id, name, deleted) values (9, 'Cy', true)`)
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [preface] = book.parts
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      authors: [1, 77, { id: 9 }, 77],
      parts: [
        { ...preface, defaultChapter: 99 },
        {
          name: 'New',
          defaultChapter: { '#ref': 'chapter' },
          chapters: [{ '#id': 'chapter', 'name': 'C' }]
        }
      ]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'authors/1': [
        { keyword: 'invalid_value', message: 'names no Author' }
      ],
      'authors/2': [
        { keyword: 'invalid_value', message: 'names no Author' }
      ],
      'authors/3': [
        { keyword: 'invalid_value', message: 'names no Author' }
      ],
      'parts/0/defaultChapter': [
        { keyword: 'invalid_value', message: 'names no Chapter' }
      ]
    })
    const posted = await request(api, 'POST', '/api/books', {
      name: 'Dia',
      authors: [2],
      parts: [{ name: 'Preface', defaultChapter: preface.chapters[0].id }]
    })
    expect(posted.status).toBe(201)
    expect(posted.json.parts[0].defaultChapter).toEqual({
      id: preface.chapters[0].id
    })
    const refused = await request(api, 'POST', '/api/books', {
      name: 'Eve',
      authors: [9]
    })
    expect(Object.keys(refused.json.errors)).toEqual(['authors/0'])
  })

  it('keeps relations to rows that filters hide', async () => {
    await sql(`update award set author_id = 1`)
    await sql(`update author set deleted = true where id = 1`)
    const awards = setup(
      defineModelController({
        path: 'awards',
        authorize: true,
        entity: Award,
        actions: { 'post': true, 'patch :id': true }
      })
    )
    const [award] = await sql(`select id from award`)
    // The client never sees the hidden row, and the collection that the
    // write loads leaves it out too.
    const kept = await request(api, 'PATCH', '/api/books/1', {
      authors: [2]
    })
    const added = await request(api, 'PATCH', '/api/books/3', {
      authors: [1]
    })
    const same = await request(awards, 'PATCH', `/api/awards/${award.id}`, {
      name: 'PEN 2'
    })
    const posted = await request(awards, 'POST', '/api/awards', {
      name: 'ADC',
      book: 1,
      author: 1
    })
    expect(kept.json.authors.map((it: Author) => it.id)).toEqual([2])
    // The link to the hidden row stays.
    const links = await sql(
      'select author_id as id from book_authors where book_id = 1'
    )
    expect(links.map(link => link.id).sort()).toEqual([1, 2])
    expect(added.json.errors).toEqual({
      'authors/0': [
        { keyword: 'invalid_value', message: 'names no Author' }
      ]
    })
    expect(same.status).toBe(200)
    expect(await sql('select author_id as id from award')).toEqual([
      { id: 1 }
    ])
    expect(posted.json.errors).toEqual({
      author: [{ keyword: 'invalid_value', message: 'names no Author' }]
    })
  })

  it('refuses ids of nested rows in a post, at any depth', async () => {
    const { status, json } = await request(api, 'POST', '/api/books', {
      name: 'Dia',
      parts: [{ id: 1 }, { name: 'B', chapters: [{ id: 1, name: 'C' }] }]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'parts/0/id': [
        { keyword: 'invalid_value', message: 'is not allowed in a new row' }
      ],
      'parts/0/name': [expect.objectContaining({ keyword: 'invalid_type' })],
      'parts/1/chapters/0/id': [
        { keyword: 'invalid_value', message: 'is not allowed in a new row' }
      ]
    })
    expect(await sql(`select id from book where name = 'Dia'`)).toEqual([])
  })

  it('refuses rows of another book, at the path of their id', async () => {
    const { json: other } = await request(api, 'GET', '/api/books/3')
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      parts: [...book.parts, { id: other.parts[0].id, name: 'Moved' }]
    })
    expect(status).toBe(400)
    expect(Object.keys(json.errors)).toEqual(['parts/2/id'])
    const [part] = await sql('select book_id from part where id = ?', [
      other.parts[0].id
    ])
    expect(part.book_id).toBe(3)
  })

  it('answers validation errors by path', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const { status, headers, json } = await request(
      api,
      'PATCH',
      '/api/books/1',
      {
        name: 42,
        specs: { pages: 'many' },
        parts: [book.parts[0], { name: 7 }, { order: 2 }]
      }
    )
    expect(status).toBe(400)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(json).toMatchObject({
      status: 400,
      type: 'ModelValidation',
      message: 'The data is not valid.'
    })
    expect(Object.keys(json.errors).sort()).toEqual([
      'name',
      'parts/1/name',
      'parts/2/name',
      'specs/pages'
    ])
    expect(json.errors.name).toEqual([
      { message: expect.any(String), keyword: 'invalid_type' }
    ])
  })

  it('runs the schemas of custom types, also in nested rows', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [preface] = book.parts
    const invalid = await request(api, 'PATCH', '/api/books/1', {
      specs: { pages: 'many', extra: 1 },
      parts: [
        {
          ...preface,
          chapters: [
            {
              ...preface.chapters[0],
              code: 'abc',
              keywords: [{ tag: 'epub' }]
            },
            { name: 'New', code: 'NEW', keywords: [{ tag: 'mobi' }, {}] }
          ]
        }
      ]
    })
    expect(invalid.status).toBe(400)
    expect(invalid.json.errors).toEqual({
      'specs/pages': [
        { keyword: 'invalid_type', message: expect.any(String) }
      ],
      'specs': [{ keyword: 'unrecognized_keys', message: expect.any(String) }],
      'parts/0/chapters/0/code': [
        { keyword: 'custom', message: 'Invalid code' }
      ],
      'parts/0/chapters/1/keywords/1/tag': [
        { keyword: 'invalid_type', message: expect.any(String) }
      ]
    })
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      specs: { pages: 700 },
      parts: [
        {
          ...preface,
          chapters: [
            { ...preface.chapters[0], code: 'LT', keywords: [{ tag: 'epub' }] }
          ]
        }
      ]
    })
    expect(status).toBe(200)
    expect(json.specs).toEqual({ pages: 700 })
    // The value type of the column follows the schema.
    expectTypeOf<Book['specs']>().toEqualTypeOf<
      { pages?: number; tags?: string[] } | null | undefined
    >()
    expect(json.parts[0].chapters[0]).toMatchObject({
      code: 'LT',
      keywords: [{ tag: 'epub' }]
    })
  })

  it('ignores read-only columns and unknown properties', async () => {
    const [before] = await sql('select created_at from book where id = 2')
    const { status, json } = await request(api, 'PATCH', '/api/books/2', {
      published: true,
      nameLength: 1,
      id: 7,
      unknown: true,
      secret: 'x',
      createdAt: '2000-01-01T00:00:00Z'
    })
    expect(status).toBe(200)
    expect(json).toMatchObject({ id: 2, published: false, nameLength: 5 })
    const [row] = await sql(
      'select secret, created_at from book where id = 2'
    )
    expect(row).toEqual({ secret: null, created_at: before.created_at })
  })

  it('replaces an owned row with a new row of the same unique value', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [part] = book.parts
    const [chapter] = part.chapters
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      parts: [
        {
          ...part,
          chapters: [...part.chapters.slice(1), { name: chapter.name }]
        }
      ]
    })
    expect(status).toBe(200)
    const names = json.parts[0].chapters.map((it: any) => it.name)
    expect(names).toContain(chapter.name)
    expect(json.parts[0].chapters.map((it: any) => it.id)).not.toContain(
      chapter.id
    )
  })

  // MikroORM inserts first, as it can't see the unique value of the row that
  // leaves, so the write fails instead of replacing it.
  it('refuses a new row with the unique value of a partly loaded row', async () => {
    const em = orm.em.fork()
    const part = await em.findOneOrFail(Part, 1, {
      populate: ['chapters'],
      fields: ['chapters.id']
    })
    const [chapter, ...chapters] = part.chapters.getItems()
    const { name } = await orm.em.fork().findOneOrFail(Chapter, chapter.id)
    await assignRecord(em, part, {
      chapters: [...chapters.map(({ id }) => ({ id })), { name }]
    })
    await expect(em.flush()).rejects.toThrow(UniqueConstraintViolationException)
  })

  it('writes the owned row of a one-to-one relation', async () => {
    const api = setup(books({ find: { populate: ['info'] } }))
    const created = await request(api, 'PATCH', '/api/books/2', {
      info: { text: 'New' }
    })
    // `bookCode` is a formula of the entity, which the reload after the
    // flush computes.
    expect(created.json.info).toEqual({
      id: expect.any(Number),
      text: 'New',
      book: { id: 2 },
      bookCode: 20
    })
    const { id } = created.json.info
    const loaded = await request(api, 'GET', '/api/books/2')
    expect(loaded.json.info).toEqual({
      id,
      text: 'New',
      book: { id: 2 },
      bookCode: 20
    })
    const updated = await request(api, 'PATCH', '/api/books/2', {
      info: { id, text: 'Changed' }
    })
    expect(updated.json.info).toEqual({
      id,
      text: 'Changed',
      book: { id: 2 },
      bookCode: 20
    })
    const other = await request(api, 'PATCH', '/api/books/3', {
      info: { id, text: 'Moved' }
    })
    expect(other.status).toBe(400)
    expect(Object.keys(other.json.errors)).toEqual(['info/id'])
    const removed = await request(api, 'PATCH', '/api/books/2', {
      info: null
    })
    expect(removed.json.info).toBe(null)
    expect(await sql('select id from info')).toEqual([])
  })

  it('stores dates that it takes as ISO strings', async () => {
    const releasedAt = '2020-01-01T00:00:00.000Z'
    const { json } = await request(api, 'PATCH', '/api/books/2', {
      releasedAt: '2020-01-01T01:00:00+01:00'
    })
    expect(json.releasedAt).toBe(releasedAt)
    const [row] = await sql('select released_at from book where id = 2')
    expect(new Date(row.released_at)).toEqual(new Date(releasedAt))
  })

  it('runs `deserialize` with the record before the check', async () => {
    const records: unknown[] = []
    const mixin = defineMixin({
      deserialize: ({ json }) => ({
        ...(json as object),
        notes: `by mixin`
      })
    })
    const api = setup(
      books({
        mixins: [mixin],
        deserialize: ({ json, record }) => {
          records.push(record)
          const { createdAt, ...rest } = json as Record<string, unknown>
          return { ...rest, name: (rest.name as string).toUpperCase() }
        }
      })
    )
    const patched = await request(api, 'PATCH', '/api/books/2', {
      name: 'Burnsish',
      published: true,
      createdAt: '2000-01-01T00:00:00Z'
    })
    expect(patched.json).toMatchObject({
      name: 'BURNSISH',
      notes: 'by mixin',
      published: true
    })
    expect(patched.json.createdAt).not.toBe('2000-01-01T00:00:00.000Z')
    expect(records[0]).toBeInstanceOf(Book)
    const posted = await request(api, 'POST', '/api/books', { name: 'Eve' })
    expect(posted.json).toMatchObject({ name: 'EVE', notes: 'by mixin' })
    expect(records[1]).toBeUndefined()
  })

  it('checks what `deserialize` returns', async () => {
    const api = setup(
      books({
        deserialize: ({ json }) => ({ ...(json as object), notes: 5 })
      })
    )
    const { status, json } = await request(api, 'POST', '/api/books', {
      name: 'Eve'
    })
    expect(status).toBe(400)
    expect(Object.keys(json.errors)).toEqual(['notes'])
  })

  it('answers 409 for a stale save', async () => {
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      notes: 'Stale',
      updatedAt: '2000-01-01T00:00:00.000Z'
    })
    expect(status).toBe(409)
    expect(json.message).toBe('A more recent version exists in the database.')
  })

  it('answers a unique violation with 409, and writes nothing', async () => {
    const { json: book } = await request(api, 'GET', '/api/books/1')
    const [preface] = book.parts
    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      notes: 'Changed',
      parts: [
        { ...preface, chapters: [...preface.chapters, { name: 'Lesson' }] }
      ]
    })
    expect(status).toBe(409)
    expect(json).toEqual({
      status: 409,
      message: 'The data conflicts with rows in the database.'
    })
    const saved = await request(api, 'GET', '/api/books/1')
    expect(saved.json.notes).toBe(null)
  })

  it('answers a composite unique key of the root table at both columns', async () => {
    await request(api, 'PATCH', '/api/books/2', { notes: 'A' })
    const { status, json } = await request(api, 'PATCH', '/api/books/3', {
      name: 'Burns',
      notes: 'A'
    })
    expect(status).toBe(409)
    expect(json.errors).toEqual({
      name: [{ message: 'already exists', keyword: 'not_unique' }],
      notes: [{ message: 'already exists', keyword: 'not_unique' }]
    })
  })

  it('answers 409 for a delete of a row that others reference', async () => {
    const { status } = await request(api, 'DELETE', '/api/books/1')
    expect(status).toBe(409)
    expect(await sql('select id from book where id = 1')).toHaveLength(1)
  })

  it('answers a violation on the root table at the property', async () => {
    await sql(
      `alter table book add constraint book_notes_check check (notes <> 'x')`
    )
    try {
      const { status, json } = await request(api, 'PATCH', '/api/books/1', {
        notes: 'x'
      })
      expect(status).toBe(400)
      expect(json.errors).toEqual({
        notes: [{ message: 'fails a check', keyword: 'invalid_value' }]
      })
    } finally {
      await sql('alter table book drop constraint book_notes_check')
    }
  })

  it('flushes and serializes the rows of lists and pages', async () => {
    const api = setup(
      books({
        actions: {
          'post batch': ({ em }) => {
            return [em.create(Book, { name: 'Gil' } as never)]
          },
          'post page': ({ em }) => {
            return {
              results: [em.create(Book, { name: 'Hal' } as never)],
              total: 1
            }
          }
        }
      })
    )
    const batch = await request(api, 'POST', '/api/books/batch')
    const page = await request(api, 'POST', '/api/books/page')
    expect(batch.json).toMatchObject([{ id: expect.any(Number), name: 'Gil' }])
    expect(page.json).toMatchObject({
      results: [{ id: expect.any(Number), name: 'Hal', notes: null }],
      total: 1
    })
  })

  it('deletes and answers the count', async () => {
    const { status, json } = await request(api, 'DELETE', '/api/books/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from book where id = 3')).toEqual([])
    expect(await sql('select id from part where book_id = 3')).toEqual(
      []
    )
  })

  it('flushes writes without a transaction, also for results that are no rows', async () => {
    const api = setup(books({ transacted: false }))
    const { status, json } = await request(api, 'DELETE', '/api/books/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from book where id = 3')).toEqual([])
  })
})

describe('actions', () => {
  const api = setup(books())

  it('runs a record action on the loaded row, and flushes it', async () => {
    const { status, json } = await request(
      api,
      'POST',
      '/api/books/2/publish'
    )
    expect(status).toBe(400)
    expect(json.errors).toEqual({ parts: [{ message: 'has no parts' }] })
    const published = await request(api, 'POST', '/api/books/3/publish')
    expect(published.json).toMatchObject({ id: 3, published: true })
    const [row] = await sql('select published from book where id = 3')
    expect(row.published).toBe(true)
  })

  it('runs an action without `:id` on the request entity manager', async () => {
    const { json } = await request(api, 'GET', '/api/books/names')
    expect(json).toEqual(['Arcadia', 'Burns', 'Circuits'])
  })
})

describe('find()', () => {
  it('queries the rows that `find` lets the user see, in its shape', async () => {
    const api = setup(
      books({
        find: ({ user }) => ({
          where: user ? {} : { published: true },
          populate: ['parts'],
          orderBy: { name: 'asc' }
        }),
        actions: {
          'get with-r': ({ find }) =>
            find<Book>({
              where: { name: { $ilike: '%r%' } },
              populate: ['parts', 'authors'],
              orderBy: { name: 'desc' }
            })
        }
      })
    )
    const guest = await request(api, 'GET', '/api/books/with-r')
    const editor = await request(
      api,
      'GET',
      '/api/books/with-r',
      undefined,
      'ed'
    )
    expect(guest.json.map((row: Book) => row.name)).toEqual([
      'Circuits',
      'Arcadia'
    ])
    expect(editor.json.map((row: Book) => row.name)).toEqual([
      'Circuits',
      'Burns',
      'Arcadia'
    ])
    // The rows go out in the controller's shape.
    expect(guest.json[1].parts).toHaveLength(2)
    expect(guest.json[1]).not.toHaveProperty('authors')
  })
})

describe('wrapping the default handlers', () => {
  it('reads the new row with `getRecord()` after `next()` on `post`', async () => {
    const api = setup(
      books({
        actions: {
          async post({ getRecord, next }) {
            await next()
            const book = await getRecord<Book>()
            book.notes = `Created ${book.name}`
            return book
          }
        }
      })
    )
    const created = await request(api, 'POST', '/api/books', { name: 'New' })
    expect(created.status).toBe(201)
    expect(created.json.notes).toBe('Created New')
  })

  it('checks the graph with relations the shape leaves out', async () => {
    const api = setup(
      books({
        actions: {
          async 'patch :id'({ getRecord, em, next }) {
            const book = (await next()) as Book
            await em.populate(book, ['awards'])
            if (book.name.length < 3 && book.awards.length > 0) {
              throw createValidationError([
                { path: ['name'], message: 'is too short for an award' }
              ])
            }
            return book
          }
        }
      })
    )
    const short = await request(api, 'PATCH', '/api/books/1', {
      name: 'Ak'
    })
    expect(short.status).toBe(400)
    expect(short.json.errors).toEqual({
      name: [{ message: 'is too short for an award' }]
    })
    const [row] = await sql('select name from book where id = 1')
    expect(row.name).toBe('Arcadia')

    const { status, json } = await request(api, 'PATCH', '/api/books/1', {
      name: 'Arcadia Pro'
    })
    expect(status).toBe(200)
    expect(json.name).toBe('Arcadia Pro')
    expect(json).not.toHaveProperty('awards')
  })

  it('loads the record once through `getRecord()`', async () => {
    const loaded: unknown[] = []
    const api = setup(
      books({
        actions: {
          async 'patch :id'({ getRecord, next }) {
            loaded.push(await getRecord())
            const book = await next()
            loaded.push(book)
            return book
          }
        }
      })
    )
    await request(api, 'PATCH', '/api/books/1', { notes: 'Once' })
    expect(loaded[0]).toBeInstanceOf(Book)
    expect(loaded[1]).toBe(loaded[0])
  })

  it('returns the row that `post` creates from `getRecord()`', async () => {
    const records: unknown[] = []
    const api = setup(
      books({
        middleware: async (c, next) => {
          const response = await next()
          if (c.req.method === 'POST') records.push(await c.var.getRecord())
          return response
        }
      })
    )
    const { json } = await request(api, 'POST', '/api/books', {
      name: 'Eve'
    })
    expect(records[0]).toBeInstanceOf(Book)
    expect(records[0]).toMatchObject({ id: json.id, name: 'Eve' })
  })

  it('sets `Location` for an entity of a replaced `post`', async () => {
    // Only the default handler responds with 201.
    const api = setup(
      books({
        actions: {
          post: ({ em }) => em.create(Book, { name: 'Fay' } as never)
        }
      })
    )
    const { status, headers, json } = await request(
      api,
      'POST',
      '/api/books'
    )
    expect(status).toBe(201)
    expect(json).toMatchObject({ name: 'Fay' })
    expect(headers.get('Location')).toBe(`/api/books/${json.id}`)
  })
})

describe('layers', () => {
  it('runs the `deserialize` chain of the layers in reverse order', async () => {
    const order: string[] = []
    const records: unknown[] = []
    const layer = (name: string) =>
      defineMixin({
        deserialize: ({ json, record }) => {
          order.push(name)
          records.push(record)
          return { ...(json as object), notes: name }
        }
      })
    const api = setup(
      books({
        mixins: [layer('one'), layer('two')],
        deserialize: ({ json }) => {
          order.push('controller')
          return json
        },
        actions: { 'patch :id': true }
      })
    )
    const { json } = await request(api, 'PATCH', '/api/books/1', {})
    expect(order).toEqual(['controller', 'two', 'one'])
    expect(records[0]).toBeInstanceOf(Book)
    expect(json.notes).toBe('one')
  })

  it('flushes and serializes the result of a mixin that replaces a default', async () => {
    const mixin = defineMixin({
      actions: {
        'patch :id': {
          authorize: 'admin',
          async handler({ getRecord, em }) {
            const row = await getRecord<Book>()
            row.notes = `by ${em.isInTransaction() ? 'transaction' : 'none'}`
            return row
          }
        }
      }
    })
    const api = setup(
      books({
        mixins: [mixin],
        find: { fields: ['name', 'notes', 'nameLength'] },
        actions: { 'patch :id': true }
      })
    )
    const denied = await request(api, 'PATCH', '/api/books/2', {})
    expect(denied.status).toBe(401)
    const { json } = await request(
      api,
      'PATCH',
      '/api/books/2',
      {},
      'admin'
    )
    expect(json).toEqual({
      id: 2,
      name: 'Burns',
      notes: 'by transaction',
      nameLength: 5
    })
    const [row] = await sql('select notes from book where id = 2')
    expect(row.notes).toBe('by transaction')
  })

  it('throws for a key without a handler', () => {
    expect(() => setup(books({ actions: { 'get other': true } }))).toThrow(
      `Invalid action without a handler: 'get other' in 'books'.`
    )
  })

  it('runs the `beforeSerialize` chain once per response', async () => {
    const calls: [string, number[]][] = []
    const record =
      (name: string) =>
      ({ records }: { records: Book[] }) => {
        calls.push([name, records.map(row => row.id)])
      }
    const lengths = new Map<number, number>()
    const mixin = defineMixin({
      beforeSerialize: ({ records }: { records: Book[] }) => {
        record('mixin')({ records })
        for (const row of records) lengths.set(row.id, row.name.length)
      },
      serialize: ({ record, json }) => ({
        ...(json as object),
        length: lengths.get(record.id)
      })
    })
    const api = setup(
      books({
        find: { fields: ['name'], orderBy: { id: 'asc' } },
        mixins: [mixin],
        beforeSerialize: record('controller'),
        actions: {
          'get page': ({ list }) => list({ query: { range: '0,1' } }),
          'get none': () => [],
          'get count': () => ({ count: 1 })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/books')
    expect(json[0]).toEqual({ id: 1, name: 'Arcadia', length: 7 })
    expect(calls).toEqual([
      ['mixin', [1, 2, 3]],
      ['controller', [1, 2, 3]]
    ])

    calls.length = 0
    await request(api, 'GET', '/api/books/2')
    expect(calls).toEqual([
      ['mixin', [2]],
      ['controller', [2]]
    ])

    calls.length = 0
    const page = await request(api, 'GET', '/api/books/page')
    expect(page.json.results).toHaveLength(2)
    expect(calls[0]).toEqual(['mixin', [1, 2]])

    calls.length = 0
    await request(api, 'GET', '/api/books/none')
    await request(api, 'GET', '/api/books/count')
    expect(calls).toEqual([])
  })

  it('serializes records through the `serialize` chain of the layers', async () => {
    const mixin = defineMixin({
      serialize: ({ record, json }) => ({ ...json, mixin: record.id })
    })
    const api = setup(
      books({
        find: { fields: ['name'] },
        mixins: [mixin],
        serialize: async ({ json }) => ({ ...json, controller: true }),
        actions: {
          'get nested': async ({ find }) => {
            const [row] = await find<Book>({ where: { id: 1 } })
            return { order: { row, rows: [row] }, other: 'other' }
          }
        }
      })
    )
    const row = { id: 1, name: 'Arcadia', mixin: 1, controller: true }
    const page = await request(api, 'GET', '/api/books?range=0,0')
    expect(page.json).toEqual({ results: [row], total: 3 })
    const nested = await request(api, 'GET', '/api/books/nested')
    expect(nested.json).toEqual({
      order: { row, rows: [row] },
      other: 'other'
    })
  })

  it('loads the record through `load`', async () => {
    const api = setup(
      books({
        load: async ({ c, id }) =>
          id === 'first'
            ? c.var.em.findOne(Book, { name: 'Arcadia' })
            : null,
        find: { fields: ['name'] }
      })
    )
    const first = await request(api, 'GET', '/api/books/first')
    expect(first.json).toEqual({ id: 1, name: 'Arcadia' })
    expect((await request(api, 'GET', '/api/books/1')).status).toBe(404)
  })

  it('throws for `getRecord()` outside record actions', async () => {
    const errors: unknown[] = []
    const api = new Hono().route(
      '/api',
      createApi({
        controllers: [
          books({ actions: { 'get one': ({ getRecord }) => getRecord() } })
        ],
        adapter: createMikroAdapter(orm),
        onError: ({ error }) => {
          errors.push(error)
        }
      })
    )
    expect((await request(api, 'GET', '/api/books/one')).status).toBe(500)
    expect(errors[0]).toMatchObject({
      message: (
        'Unable to get the record: only record actions load one, and other ' +
        'actions need a handler that calls `setRecord()`'
      )
    })
  })

  it('replaces the list parameters with the `query` of `list()`', async () => {
    const api = setup(
      books({
        actions: {
          'get first': ({ list }) =>
            list({ query: { range: '0,0', order: 'name desc' } })
        }
      })
    )
    const { json } = await request(
      api,
      'GET',
      '/api/books/first?range=0,9&filter=name:"x"'
    )
    expect(json.total).toBe(3)
    expect(json.results.map((row: Book) => row.name)).toEqual(['Circuits'])
  })
})

describe('errors', () => {
  it('maps the errors of queries as those of a flush', async () => {
    const api = setup(
      books({
        actions: {
          'post own': ({ em }) => em.insert(Book, { name: null } as never),
          'post other': ({ em }) => em.insert(Part, { name: 'Body', book: 0 })
        }
      })
    )
    const own = await request(api, 'POST', '/api/books/own')
    expect(own.status).toBe(400)
    expect(own.json.errors).toEqual({
      name: [{ message: 'is required', keyword: 'invalid_type' }]
    })
    // The rows of other tables can't be told apart.
    const other = await request(api, 'POST', '/api/books/other')
    expect(other.status).toBe(409)
    expect(other.json.errors).toBeUndefined()
  })
})

describe('transactions', () => {
  it('rolls back the writes of a failed action', async () => {
    const api = setup(
      books({
        actions: {
          'post fail': async ({ em }) => {
            em.create(Award, { name: 'Lost', book: 1 })
            await em.flush()
            throw new Error('Failed')
          }
        }
      })
    )
    const { status } = await request(api, 'POST', '/api/books/fail')
    expect(status).toBe(500)
    expect(await sql(`select id from award where name = 'Lost'`)).toEqual([])
  })

  it('gives reads the request fork and writes the transaction', async () => {
    const managers: Record<string, EntityManager> = {}
    const api = setup(
      books({
        actions: {
          'get check': ({ em }) => {
            managers.get = em
            return {}
          },
          'post check': ({ em }) => {
            managers.post = em
            return { transaction: !!managers.post.isInTransaction() }
          }
        }
      })
    )
    expect((await request(api, 'POST', '/api/books/check')).json).toEqual({
      transaction: true
    })
    await request(api, 'GET', '/api/books/check')
    expect(managers.get!.isInTransaction()).toBe(false)
    expect(managers.get).not.toBe(orm.em)
  })
  it('writes the row that `authorize` loads before the transaction', async () => {
    let checked: Book | undefined
    let written: Book | undefined
    const api = setup(
      books({
        actions: {
          'patch :id': {
            authorize: async ({ c }) => {
              const em = c.var.em
              checked = await em.findOneOrFail(
                Book,
                Number(c.req.param('id'))
              )
              return !em.isInTransaction()
            },
            async handler({ em, next }) {
              written = (await next()) as Book
              // The transaction's fork keeps the loaded entities.
              expect(em.isInTransaction()).toBe(true)
              expect(em.getReference(Book, 1)).toBe(checked)
              return written
            }
          }
        }
      })
    )
    const { status } = await request(api, 'PATCH', '/api/books/1', {
      name: 'Arcadia Pro'
    })
    expect(status).toBe(200)
    expect(written).toBe(checked)
    expect(await sql('select name from book where id = 1')).toEqual([
      { name: 'Arcadia Pro' }
    ])
  })
})

describe('createMikroAdapter()', () => {
  it('maps the errors of MikroORM before `onError`', async () => {
    const onError = vi.fn()
    const error = new Error('Failed')
    const api = createApi({
      controllers: [
        {
          path: 'items',
          actions: {
            'get locked': () => {
              throw OptimisticLockError.lockFailed('Book')
            },
            'get failed': () => {
              throw error
            }
          }
        }
      ],
      adapter: createMikroAdapter(orm),
      onError
    })
    const locked = await request(api, 'GET', '/items/locked')
    expect(locked.status).toBe(409)
    expect(locked.json.message).toBe(
      'A more recent version exists in the database.'
    )
    expect(onError).not.toHaveBeenCalled()
    expect((await request(api, 'GET', '/items/failed')).status).toBe(500)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]![0].error).toBe(error)
  })

  it('runs the guards of an entity, without adding routes', async () => {
    const calls: string[] = []
    const addGuard = (name: string, call: string) =>
      guardEntity(Info, name, {
        middleware: async (_c, next) => {
          calls.push(`${call} middleware`)
          await next()
        },
        actions: {
          get: ({ next }) => {
            calls.push(`${call} action`)
            return next()
          },
          post: () => {
            throw new Error('Unused guard')
          }
        }
      })
    // Controllers read the guards per request:
    const api = setup(
      defineModelController({
        path: 'infos',
        entity: Info,
        actions: { 'get': true, 'get count': ({ em }) => em.count(Info) }
      })
    )
    addGuard('first', 'replaced')
    addGuard('first', 'first')
    addGuard('second', 'second')
    expect((await request(api, 'GET', '/api/infos')).status).toBe(200)
    expect(calls).toEqual([
      'first middleware',
      'second middleware',
      'first action',
      'second action'
    ])
    calls.length = 0
    await request(api, 'GET', '/api/infos/count')
    expect(calls).toEqual(['first middleware', 'second middleware'])
    expect((await request(api, 'POST', '/api/infos', {})).status).toBe(404)
  })

  it('gives each request a fork of the entity manager', async () => {
    const api = createApi({
      controllers: [
        { path: 'items', actions: { get: ({ em }) => em !== orm.em } }
      ],
      adapter: createMikroAdapter(orm)
    })
    expect((await request(api, 'GET', '/items')).json).toBe(true)
  })
})
