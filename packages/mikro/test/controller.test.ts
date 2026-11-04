import { Hono } from 'hono'
import { z } from 'zod'
import { asArray } from '@ditojs/utils'
import {
  HttpError,
  createApi,
  createValidationError,
  defineMixin,
  errorHandler,
  notFound,
  type ControllerDefinition
} from '@ditojs/server'
import { q } from '@ditojs/server/zod'
import { OptimisticLockError, type FilterOptions } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import {
  choices,
  crud,
  dateRangeFilter,
  assignRecord,
  defineController,
  listHandler,
  textFilter,
  getEntityManager,
  mikroDb,
  type FindShape,
  type MikroControllerDefinition
} from '../src/index.ts'
import { mergeFind } from '../src/find.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { createClient } from '../../../tests/utils/client.ts'
import {
  Award,
  Designer,
  Family,
  Cut,
  FontSet,
  Info,
  Pair,
  entities
} from './entities.ts'

const { orm, sql, drop } = await createTestDatabase(entities)

afterAll(drop)

// Sets up an API with the parts that an app wires in, below `/api`.
function setup(...controllers: ControllerDefinition[]) {
  return new Hono()
    .route(
      '/api',
      createApi({
        controllers,
        db: mikroDb(orm),
        // The user of the `X-User` header, with that name as its role.
        getUser: async c => {
          const name = c.req.header('X-User')
          return name ? { id: name, roles: [name] } : null
        },
        onError: () => {}
      })
    )
    .onError(errorHandler())
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

// The family controller of the tests, with `overrides` for its definition.
function families({
  actions,
  ...overrides
}: Partial<MikroControllerDefinition<Family>> = {}) {
  return defineController({
    path: 'families',
    authorize: true,
    entity: Family,
    find: {
      populate: ['sets.cuts', 'designers'],
      orderBy: { name: 'asc' }
    },
    // Clients can't publish through a write.
    deserialize: (_c, json) => {
      const { published, ...rest } = json as Record<string, unknown>
      return rest
    },
    filters: {
      name: {
        schema: z.string(),
        where: text => ({ name: { $ilike: `%${text}%` } })
      },
      published: q.boolean(),
      // Families by the names of their designers, repeated for several.
      designer: {
        schema: z.union([z.string(), z.array(z.string())]),
        where: names => ({ designers: { name: { $in: asArray(names) } } })
      },
      // `all` skips the filter.
      status: {
        schema: z.enum(['draft', 'published', 'all']),
        where: status =>
          status === 'all' ? undefined : { published: status === 'published' }
      }
    },
    actions: {
      'get': true,
      'post': true,
      'get :id': true,
      'delete :id': true,
      'get names': async ({ c }) => {
        const rows = await getEntityManager(c).find(
          Family,
          {},
          {
            orderBy: { name: 'asc' }
          }
        )
        return rows.map(row => row.name)
      },

      // The `updatedAt` the client loaded. A newer one in the database
      // responds with 409.
      async 'patch :id'({ record, body, next }) {
        const family = await record<Family>()
        const { updatedAt } = body
        if (updatedAt && +new Date(updatedAt) !== +family.updatedAt) {
          throw new HttpError(409, {
            message: 'A more recent version exists in the database.'
          })
        }
        return next()
      },

      async 'post :id/publish'({ record }) {
        const family = await record<Family>()
        if (family.sets.length === 0) {
          throw createValidationError([
            { path: ['sets'], message: 'has no sets' }
          ])
        }
        family.published = true
        return family
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
    em.create(Designer, { name: 'Ada' }),
    em.create(Designer, { name: 'Bea' })
  ]
  em.create(Family, {
    id: 1,
    name: 'Akkurat',
    published: true,
    specs: { weight: 400, tags: ['grotesk'] },
    secret: 'hidden',
    designers: [ada],
    sets: [
      {
        name: 'Regular',
        order: 0,
        cuts: [
          { name: 'Light', order: 0 },
          { name: 'Book', order: 1 }
        ]
      },
      { name: 'Mono', order: 1, cuts: [{ name: 'Mono', order: 0 }] }
    ],
    awards: [{ name: 'TDC' }]
  })
  em.create(Family, { id: 2, name: 'Brown', designers: [ada, bea] })
  em.create(Family, {
    id: 3,
    name: 'Circular',
    published: true,
    sets: [{ name: 'Std', cuts: [{ name: 'Std' }] }]
  })
  await em.flush()
  // The seeded rows have fixed ids, so the sequence starts after them.
  await sql(`select setval('family_id_seq', 3)`)
})

describe('get', () => {
  const api = setup(families())
  const names = (rows: Family[]) => rows.map(row => row.name)

  it('lists the rows in the order of `find`', async () => {
    const { status, json } = await request(api, 'GET', '/api/families')
    expect(status).toBe(200)
    expect(names(json)).toEqual(['Akkurat', 'Brown', 'Circular'])
  })

  it('loads each row in the shape of `find`', async () => {
    const { json } = await request(api, 'GET', '/api/families')
    expect(json[0].sets.map((set: any) => set.cuts.length)).toEqual([2, 1])
    expect(json[1].designers.map((it: any) => it.name)).toEqual(['Ada', 'Bea'])
  })

  it('applies `filter[name]=value`', async () => {
    const get = async (query: string) =>
      names((await request(api, 'GET', `/api/families?${query}`)).json)
    expect(await get('filter[name]=ir')).toEqual(['Circular'])
    expect(await get('filter[published]=false')).toEqual(['Brown'])
    expect(await get('filter[name]=r&filter[published]=true')).toEqual([
      'Akkurat',
      'Circular'
    ])
    expect(await get('filter[status]=draft')).toEqual(['Brown'])
    expect(await get('filter[status]=all')).toEqual([
      'Akkurat',
      'Brown',
      'Circular'
    ])
  })

  it('gives a filter the values of a repeated parameter', async () => {
    const both = await request(
      api,
      'GET',
      '/api/families?filter[designer]=Ada&filter[designer]=Bea'
    )
    const one = await request(api, 'GET', '/api/families?filter[designer]=Bea')
    const twice = await request(
      api,
      'GET',
      '/api/families?filter[name]=A&filter[name]=B'
    )
    expect(names(both.json)).toEqual(['Akkurat', 'Brown'])
    expect(names(one.json)).toEqual(['Brown'])
    expect(twice.status).toBe(400)
    expect(Object.keys(twice.json.errors)).toEqual(['name'])
  })

  it('validates each filter, and answers all errors at once', async () => {
    const { status, json } = await request(
      api,
      'GET',
      '/api/families?filter[published]=maybe&filter[status]=x&filter[name]=A'
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
      families({
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
      '/api/families?filter[throws]=1&filter[rejects]=1'
    )
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      throws: [{ message: 'Invalid input', keyword: 'custom' }],
      rejects: [{ message: 'Invalid input', keyword: 'custom' }]
    })
  })

  it('runs async `where`s with the context', async () => {
    const api = setup(
      families({
        filters: {
          mine: {
            schema: q.boolean(),
            async where(mine, c) {
              if (!mine) return undefined
              const designer = await getEntityManager(c).findOneOrFail(
                Designer,
                { name: c.var.user!.id as string }
              )
              return { designers: designer }
            }
          }
        }
      })
    )
    const { json } = await request(
      api,
      'GET',
      '/api/families?filter[mine]=true',
      undefined,
      'Bea'
    )
    expect(names(json)).toEqual(['Brown'])
  })

  it('combines the filters with `find.where`, also on the same key', async () => {
    const api = setup(families({ find: { where: { published: true } } }))
    const none = await request(
      api,
      'GET',
      '/api/families?filter[published]=false'
    )
    const some = await request(
      api,
      'GET',
      '/api/families?filter[published]=true&filter[name]=ir'
    )
    expect(none.json).toEqual([])
    expect(names(some.json)).toEqual(['Circular'])
  })

  it('applies `order`', async () => {
    const { json } = await request(api, 'GET', '/api/families?order=name+desc')
    expect(names(json)).toEqual(['Circular', 'Brown', 'Akkurat'])
  })

  it('answers `range` with the results and the total', async () => {
    const { json } = await request(
      api,
      'GET',
      '/api/families?range=1,2&order=name+desc'
    )
    expect(json.total).toBe(3)
    expect(names(json.results)).toEqual(['Brown', 'Akkurat'])
    expect(json.results[1].sets).toHaveLength(2)
  })

  it('refuses unknown filters and orders', async () => {
    const unknown = await request(api, 'GET', '/api/families?filter[none]=1')
    const proto = await request(
      api,
      'GET',
      '/api/families?filter[constructor]=1'
    )
    const order = await request(api, 'GET', '/api/families?order=secret')
    const relation = await request(api, 'GET', '/api/families?order=sets')
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
        `/api/families?filter[designer]=Ada&filter[designer]=Bea&range=${range}`
      )
    const first = await page('0,0')
    const second = await page('1,1')
    const all = await page('0,9')
    expect(first.json.total).toBe(2)
    expect(names(first.json.results)).toEqual(['Akkurat'])
    expect(names(second.json.results)).toEqual(['Brown'])
    expect(all.json.total).toBe(2)
    expect(names(all.json.results)).toEqual(['Akkurat', 'Brown'])
    // The page holds all the designers, not only the filtered ones.
    expect(all.json.results[1].designers).toHaveLength(2)
  })

  it('applies entity filters to the page and the total', async () => {
    await sql(`insert into designer (name, deleted) values ('Cy', true)`)
    const api = setup(
      defineController({
        path: 'designers',
        authorize: true,
        entity: Designer,
        find: { orderBy: { name: 'desc' } },
        actions: { get: true }
      })
    )
    const list = await request(api, 'GET', '/api/designers')
    const page = await request(api, 'GET', '/api/designers?range=0,0')
    expect(names(list.json)).toEqual(['Bea', 'Ada'])
    expect(page.json).toMatchObject({ total: 2, results: [{ name: 'Bea' }] })
  })

  it('refuses to order by lazy properties', async () => {
    const api = setup(
      defineController({
        path: 'designers',
        authorize: true,
        entity: Designer,
        actions: { get: true }
      })
    )
    const lazy = await request(api, 'GET', '/api/designers?order=bio')
    const plain = await request(api, 'GET', '/api/designers?order=name')
    expect(lazy.status).toBe(400)
    expect(plain.status).toBe(200)
  })

  it('orders only by columns that `find` returns', async () => {
    const status = async (api: Hono<any, any, any>, order: string) =>
      (await request(api, 'GET', `/api/families?order=${order}`)).status
    const excluded = setup(families({ find: { exclude: ['notes'] } }))
    const narrowed = setup(families({ find: { fields: ['name', 'notes'] } }))
    for (const order of ['name', 'id+desc', 'nameLength', 'rating']) {
      expect(await status(excluded, order)).toBe(200)
    }
    for (const order of ['notes', 'secret', 'sets', 'sets.name']) {
      expect(await status(excluded, order)).toBe(400)
    }
    expect(await status(narrowed, 'notes')).toBe(200)
    expect(await status(narrowed, 'id')).toBe(200)
    expect(await status(narrowed, 'published')).toBe(400)
  })

  it('answers at most 1000 rows', async () => {
    await sql(
      `insert into family (name, created_at, updated_at)
      select 'Family ' || n, now(), now() from generate_series(1, 997) n`
    )
    const api = setup(families({ find: {} }))
    const all = await request(api, 'GET', '/api/families')
    expect(all.json).toHaveLength(1000)
    await sql(
      `insert into family (name, created_at, updated_at)
      values ('One more', now(), now())`
    )
    const more = await request(api, 'GET', '/api/families')
    const page = await request(api, 'GET', '/api/families?range=1,1000')
    const large = await request(api, 'GET', '/api/families?range=0,1000')
    expect(more).toMatchObject({
      status: 400,
      json: { message: 'The list has more than 1000 rows: ask for a `range`' }
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
      families({
        find: {},
        actions: {
          'get published': ({ list }) => list({ where: { published: true } })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/families/published')
    expect(names(json)).toEqual(['Akkurat', 'Circular'])
  })

  it('answers as many rows as `maxRows` lets it', async () => {
    const [{ count }] = await sql('select count(*)::int as count from family')
    const api = setup(
      families({
        find: {},
        actions: {
          'get all': listHandler({ fields: ['name'], maxRows: Infinity }),
          'get few': listHandler({ maxRows: count - 1 }),
          'get ids': async ({ list }) => {
            const rows = await list({
              where: { published: true },
              fields: ['id'],
              maxRows: Infinity
            })
            return (rows as Family[]).map(({ id }) => id)
          }
        },
        mixins: [choices({ fields: ['name'], maxRows: Infinity })]
      })
    )
    for (const path of ['all', 'choices']) {
      const { status, json } = await request(
        api,
        'GET',
        `/api/families/${path}`
      )
      expect(status).toBe(200)
      expect(json).toHaveLength(count)
    }
    // Filters still apply.
    const unknown = await request(api, 'GET', '/api/families/all?filter[x]=1')
    expect(unknown.status).toBe(400)
    const ids = await request(api, 'GET', '/api/families/ids?order=name+desc')
    expect(ids.json).toEqual([3, 1])
    const few = await request(api, 'GET', '/api/families/few')
    expect(few).toMatchObject({
      status: 400,
      json: {
        message: `The list has more than ${count - 1} rows: ask for a \`range\``
      }
    })
  })

  it('applies `find.where` to every query', async () => {
    const api = setup(families({ find: { where: { published: true } } }))
    const list = await request(api, 'GET', '/api/families')
    const member = await request(api, 'GET', '/api/families/2')
    expect(names(list.json)).toEqual(['Akkurat', 'Circular'])
    expect(member.status).toBe(404)
  })
})

describe('get :id', () => {
  const api = setup(families())

  it('answers the row as Dito does', async () => {
    const { status, json } = await request(api, 'GET', '/api/families/1')
    expect(status).toBe(200)
    expect(json).toMatchObject({
      id: 1,
      name: 'Akkurat',
      published: true,
      specs: { weight: 400, tags: ['grotesk'] },
      nameLength: 7,
      designers: [{ id: expect.any(Number), name: 'Ada' }]
    })
    // Relations to many rows that `find` leaves out aren't sent. Relations to
    // one row that hold the foreign key go out as `{ id }`, or `null`, also
    // the parent of a nested row.
    const [set] = json.sets
    expect(set).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      order: 0,
      family: { id: 1 },
      defaultCut: null,
      cuts: [
        {
          id: expect.any(Number),
          name: 'Light',
          order: 0,
          code: null,
          features: null,
          set: { id: set.id }
        },
        {
          id: expect.any(Number),
          name: 'Book',
          order: 1,
          code: null,
          features: null,
          set: { id: set.id }
        }
      ]
    })
    expect(json).not.toHaveProperty('awards')
    expect(json).not.toHaveProperty('info')
  })

  it('leaves out hidden properties', async () => {
    const { json } = await request(api, 'GET', '/api/families/1')
    expect(json).not.toHaveProperty('secret')
  })

  it('answers 404 for missing rows', async () => {
    const { status, json } = await request(api, 'GET', '/api/families/9')
    expect(status).toBe(404)
    expect(json).toMatchObject({ status: 404, message: 'Not Found' })
  })

  it('answers 404 for ids that are no valid primary key', async () => {
    for (const id of ['abc', '1.5', '1e3', '99999999999999999999']) {
      const { status } = await request(api, 'GET', `/api/families/${id}`)
      expect(status).toBe(404)
    }
  })

  it('gives member actions the id of the primary key', async () => {
    const api = setup(
      families({
        actions: {
          'get :id/id': ({ id, params }) => ({ id, param: params.id })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/families/1/id')
    expect(json).toEqual({ id: 1, param: '1' })
    const { status } = await request(api, 'GET', '/api/families/abc/id')
    expect(status).toBe(404)
  })

  it('leaves ids that are no primary key to `load`', async () => {
    const api = setup(
      families({
        load: (c, id) =>
          getEntityManager(c).findOne(Family, id === 'self' ? 1 : +id),
        actions: {
          'get :id': true,
          'get :id/id': async ({ id, record }) => ({
            id,
            name: (await record()).name
          })
        }
      })
    )
    const get = (path: string) => request(api, 'GET', `/api/families/${path}`)
    expect((await get('self')).json.name).toBe('Akkurat')
    expect((await get('self/id')).json).toEqual({ id: 'self', name: 'Akkurat' })
    expect((await get('1/id')).json).toEqual({ id: 1, name: 'Akkurat' })
    expect((await get('9')).status).toBe(404)
  })
})

describe('find', () => {
  it('narrows the properties with `fields`, with the ids', async () => {
    const api = setup(families({ find: { fields: ['name', 'notes'] } }))
    const { json } = await request(api, 'GET', '/api/families/1')
    expect(json).toEqual({ id: 1, name: 'Akkurat', notes: null })
  })

  it('can be a function of the context, run once per request', async () => {
    let calls = 0
    const api = setup(
      families({
        find: c => {
          calls++
          return {
            where: c.var.user ? {} : { published: true },
            exclude: c.var.user ? [] : ['notes'],
            orderBy: { name: 'asc' }
          }
        }
      })
    )
    const names = (rows: Family[]) => rows.map(row => row.name)
    const guest = await request(api, 'GET', '/api/families')
    const editor = await request(api, 'GET', '/api/families', undefined, 'ed')
    expect(names(guest.json)).toEqual(['Akkurat', 'Circular'])
    expect(guest.json[0]).not.toHaveProperty('notes')
    expect(names(editor.json)).toEqual(['Akkurat', 'Brown', 'Circular'])
    expect(editor.json[0]).toHaveProperty('notes')
    expect(calls).toBe(2)
    calls = 0
    const hidden = await request(api, 'GET', '/api/families/2')
    const patched = await request(
      api,
      'PATCH',
      '/api/families/2',
      { notes: 'New' },
      'ed'
    )
    expect(hidden.status).toBe(404)
    expect(patched.json.notes).toBe('New')
    expect(calls).toBe(2)
  })

  it('refuses the options that the base controls', async () => {
    for (const key of ['limit', 'offset', 'ctx', 'lockMode']) {
      expect(() => families({ find: { [key]: 1 } })).toThrow(
        `\`find\` can't set \`${key}\`, which the base controls`
      )
    }
    const errors: unknown[] = []
    const api = createApi({
      controllers: [
        families({ find: () => ({ disableIdentityMap: true }) })
      ],
      db: mikroDb(orm),
      onError: error => {
        errors.push(error)
      }
    })
    const { status } = await request(api, 'GET', '/families/1')
    expect(status).toBe(500)
    expect(errors[0]).toMatchObject({
      message: `\`find\` can't set \`disableIdentityMap\`, which the base controls`
    })
  })
})

describe('listHandler', () => {
  it('lists the choices of a select, with the filters of the list', async () => {
    const api = setup(
      families({
        find: {
          where: { published: true },
          populate: ['sets.cuts', 'designers'],
          exclude: ['notes']
        },
        mixins: [
          choices({
            fields: ['id', 'name', 'notes', 'designers.name'],
            populate: ['designers'],
            orderBy: { name: 'desc' }
          })
        ]
      })
    )
    const all = await request(api, 'GET', '/api/families/choices')
    const filtered = await request(
      api,
      'GET',
      '/api/families/choices?filter[name]=kk&range=0,9'
    )
    // `find.where` applies, `notes` stays excluded and only the relations of
    // `fields` go out.
    expect(all.json).toEqual([
      { id: 3, name: 'Circular', designers: [] },
      { id: 1, name: 'Akkurat', designers: [{ id: 1, name: 'Ada' }] }
    ])
    expect(filtered.json).toEqual({
      results: [
        { id: 1, name: 'Akkurat', designers: [{ id: 1, name: 'Ada' }] }
      ],
      total: 1
    })
  })

  it("merges its `find` into the controller's", async () => {
    const api = setup(
      families({
        find: c => ({
          where: c.var.user ? {} : { name: { $ne: 'Akkurat' } },
          orderBy: { name: 'asc' }
        }),
        actions: {
          'get published': listHandler({ where: { published: true } })
        }
      })
    )
    const guest = await request(api, 'GET', '/api/families/published')
    const editor = await request(
      api,
      'GET',
      '/api/families/published',
      undefined,
      'ed'
    )
    expect(guest.json.map((row: Family) => row.name)).toEqual(['Circular'])
    expect(editor.json.map((row: Family) => row.name)).toEqual([
      'Akkurat',
      'Circular'
    ])
  })

  it("keeps what the controller's `exclude` hides, also from `*`", async () => {
    await sql(`update family set notes = 'Private'`)
    const api = setup(
      families({
        find: { populate: ['sets'], exclude: ['notes', 'sets.order'] },
        actions: {
          'get all': listHandler({ fields: ['*'], populate: ['sets'] })
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/families/all?order=id')
    const ordered = await request(api, 'GET', '/api/families/all?order=notes')
    expect(json[0]).toMatchObject({ id: 1, name: 'Akkurat' })
    expect(json[0]).not.toHaveProperty('notes')
    expect(json[0].sets[0]).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      family: { id: 1 },
      defaultCut: null
    })
    expect(ordered.status).toBe(400)
  })

  it("replaces the controller's `fields`", async () => {
    const api = setup(
      families({
        find: { fields: ['name'] },
        mixins: [choices({ fields: ['id', 'name', 'notes'] })]
      })
    )
    const { json } = await request(api, 'GET', '/api/families/choices?order=id')
    const ordered = await request(
      api,
      'GET',
      '/api/families/choices?order=notes'
    )
    expect(json[0]).toEqual({ id: 1, name: 'Akkurat', notes: null })
    expect(ordered.status).toBe(200)
  })

  it('keeps nested excludes when `fields` names the relation', async () => {
    const api = setup(
      families({
        find: { populate: ['sets.cuts'], exclude: ['sets.name', 'notes'] },
        mixins: [
          choices({
            fields: ['name', 'notes', 'sets'],
            populate: ['sets.cuts']
          })
        ]
      })
    )
    const { json } = await request(api, 'GET', '/api/families/choices?order=id')
    expect(json[0]).toEqual({
      id: 1,
      name: 'Akkurat',
      sets: [
        expect.objectContaining({ order: 0, cuts: expect.any(Array) }),
        expect.objectContaining({ order: 1 })
      ]
    })
    expect(json[0].sets[0]).not.toHaveProperty('name')
    expect(json[0].sets[0].cuts[0].name).toBe('Light')
  })

  it('refuses the options that the base controls', () => {
    expect(() => listHandler({ limit: 1 })).toThrow(
      "`find` can't set `limit`, which the base controls"
    )
  })
})

describe('list filters', () => {
  const api = setup(
    families({
      find: { orderBy: { id: 'asc' } },
      filters: {
        name: textFilter(),
        text: textFilter('name', 'notes'),
        createdAt: dateRangeFilter(),
        since: dateRangeFilter('releasedAt')
      }
    })
  )
  const names = async (query: string) => {
    const { status, json } = await request(api, 'GET', `/api/families?${query}`)
    return status === 200 ? json.map((row: Family) => row.name) : status
  }

  it('matches text as the admin sends it', async () => {
    await sql(`update family set notes = '100% brown' where id = 3`)
    expect(await names('filter[name]=KKU')).toEqual(['Akkurat'])
    expect(await names('filter[name]=&filter[name]=row')).toEqual(['Brown'])
    const operator = (name: string, text: string) =>
      `filter[name]=${name}&filter[name]=${text}`
    expect(await names(operator('starts-with', 'b'))).toEqual(['Brown'])
    expect(await names(operator('ends-with', 'AR'))).toEqual(['Circular'])
    expect(await names(operator('equals', 'brow'))).toEqual([])
    expect(await names(operator('equals', 'brown'))).toEqual(['Brown'])
    expect(await names(operator('contains', 'r'))).toHaveLength(3)
    expect(await names(operator('like', 'r'))).toBe(400)
    // Several properties, and no wildcards in the text.
    expect(await names('filter[text]=brown')).toEqual(['Brown', 'Circular'])
    expect(await names('filter[text]=100%25')).toEqual(['Circular'])
    expect(await names('filter[text]=_')).toEqual([])
    // An empty text skips the filter.
    expect(await names('filter[name]=')).toHaveLength(3)
  })

  it('matches date ranges as the admin sends them', async () => {
    await sql(`update family set released_at = '2020-01-01' where id = 1`)
    await sql(`update family set released_at = '2022-01-01' where id = 2`)
    const date = (year: number) => `${year}-06-01T00:00:00.000Z`
    const since = (...values: string[]) =>
      names(values.map(value => `filter[since]=${value}`).join('&'))
    expect(await since(date(2020))).toEqual(['Brown'])
    expect(await since('', date(2020))).toEqual(['Akkurat'])
    expect(await since(date(2019), date(2021))).toEqual(['Akkurat'])
    expect(await since('')).toHaveLength(3)
    expect(await since('tomorrow')).toBe(400)
    expect(await names(`filter[createdAt]=${date(2000)}`)).toHaveLength(3)
  })
})

describe('c.var.listQuery()', () => {
  it('returns the `where` and `orderBy` of the list', async () => {
    const api = setup(
      families({
        find: { where: { published: true }, orderBy: { name: 'desc' } },
        filters: { name: textFilter() },
        actions: {
          async 'get summary'({ db, listQuery }) {
            const { where, orderBy, range } = await listQuery()
            const rows = await db.find(Family, where, {
              fields: ['id'],
              orderBy
            })
            return {
              ids: rows.map((row: Family) => row.id),
              count: rows.length,
              range
            }
          }
        }
      })
    )
    const summary = (query = '') =>
      request(api, 'GET', `/api/families/summary${query}`)
    expect((await summary()).json).toEqual({
      ids: [3, 1],
      count: 2,
      range: null
    })
    expect((await summary('?range=0,9')).json.range).toEqual([0, 9])
    expect((await summary('?order=name')).json.ids).toEqual([1, 3])
    expect((await summary('?filter[name]=circ')).json.ids).toEqual([3])
    expect((await summary('?filter[other]=1')).status).toBe(400)
    expect((await summary('?order=secret')).status).toBe(400)
  })
})

describe('mergeFind()', () => {
  it('joins `where`s and replaces the other options', () => {
    expect(
      mergeFind<Family>(
        {
          where: { a: 1 },
          populate: ['sets'],
          exclude: ['notes'],
          orderBy: { name: 'asc' },
          maxRows: 10
        },
        {
          where: { b: 2 },
          populate: ['designers'] as never[],
          orderBy: { id: 'desc' },
          maxRows: undefined
        }
      )
    ).toEqual({
      where: { $and: [{ a: 1 }, { b: 2 }] },
      populate: ['designers'],
      exclude: ['notes'],
      orderBy: { id: 'desc' },
      maxRows: 10
    })
  })

  it('leaves out `populate` for `fields` without one', () => {
    expect(
      mergeFind<Family>(
        { populate: ['sets.cuts', 'designers'] as never[] },
        { fields: ['name', 'sets.name'] as never[] }
      )
    ).toEqual({ fields: ['name', 'sets.name'] })
  })

  it('merges `filters` by name, and replaces other values of them', () => {
    const merge = (base: FilterOptions, extra: FilterOptions) =>
      mergeFind<Family>({ filters: base }, { filters: extra }).filters
    expect(
      merge({ active: true, tenant: { id: 1 } }, { active: false, other: true })
    ).toEqual({ active: false, tenant: { id: 1 }, other: true })
    expect(merge({ tenant: { id: 1 } }, ['active'])).toEqual(['active'])
    expect(merge({ tenant: { id: 1 } }, false)).toBe(false)
  })
})

describe('output', () => {
  const sets = (find: MikroControllerDefinition<FontSet>['find']) =>
    defineController({
      path: 'sets',
      authorize: true,
      entity: FontSet,
      find,
      actions: { 'get': true, 'get :id': true }
    })

  it('sends relations to one row as `{ id }` unless populated', async () => {
    const plain = setup(sets({ orderBy: { id: 'asc' } }))
    const loaded = setup(sets({ populate: ['family', 'defaultCut'] }))
    const [set] = (await request(plain, 'GET', '/api/sets')).json
    const { json } = await request(loaded, 'GET', `/api/sets/${set.id}`)
    expect(set).toEqual({
      id: set.id,
      name: 'Regular',
      order: 0,
      family: { id: 1 },
      defaultCut: null
    })
    expect(json).toMatchObject({
      family: { id: 1, name: 'Akkurat' },
      defaultCut: null
    })
    // The nested family leaves out its relations and hidden properties.
    expect(json.family).not.toHaveProperty('sets')
    expect(json.family).not.toHaveProperty('secret')
  })

  it('sends a relation as `{ id }` where a handler loaded it', async () => {
    const api = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        actions: {
          'get :id': async ({ record, db: em }) => {
            const set = await record<FontSet>()
            await em.populate(set, ['family', 'cuts'] as never[])
            return set
          }
        }
      })
    )
    const [{ id }] = await sql(`select id from font_set where name = 'Mono'`)
    const { json } = await request(api, 'GET', `/api/sets/${id}`)
    expect(json.family).toEqual({ id: 1 })
    expect(json).not.toHaveProperty('cuts')
  })

  it('keeps inverse one-to-one relations out unless populated', async () => {
    await sql(`insert into info (id, text, family_id) values (7, 'Note', 1)`)
    const get = async (find?: FindShape) =>
      (await request(setup(families({ find })), 'GET', '/api/families/1')).json
    const api = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        actions: {
          // Only the id of `info` is known, as a reference.
          'get family': ({ db: em }) =>
            em.findOneOrFail(Family, 1, { populate: ['info:ref'] as never[] })
        }
      })
    )
    // A family that isn't a record of the controller has no `find`.
    const { json } = await request(api, 'GET', '/api/sets/family')
    expect(json).toMatchObject({ id: 1, name: 'Akkurat' })
    expect(json).not.toHaveProperty('info')
    // A record leaves the relation out, also when a handler loaded it.
    const records = setup(
      families({
        actions: {
          'get :id': async ({ record, db: em }) => {
            const family = await record<Family>()
            await em.find(Info, {})
            expect(family.info).toBeDefined()
            return family
          }
        }
      })
    )
    const loaded = await request(records, 'GET', '/api/families/1')
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
      name: 'Akkurat',
      info: { id: 7, text: 'Note' }
    })
    await sql('delete from info where id = 7')
  })

  it('sends a relation where `fields` selects it', async () => {
    const get = async (find: FindShape) =>
      (await request(setup(sets(find)), 'GET', '/api/sets?order=id')).json[0]
    expect(await get({ fields: ['name'] })).toEqual({
      id: expect.any(Number),
      name: 'Regular'
    })
    for (const name of ['family', 'family.id']) {
      expect(await get({ fields: ['name', name] })).toEqual({
        id: expect.any(Number),
        name: 'Regular',
        family: { id: 1 }
      })
    }
    expect(await get({ fields: ['name', 'defaultCut'] })).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      defaultCut: null
    })
    expect(await get({ fields: ['name', 'defaultCut.id'] })).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      defaultCut: null
    })
    expect(await get({ fields: ['*'] })).toMatchObject({
      family: { id: 1 },
      defaultCut: null
    })
    expect(await get({ exclude: ['family'] })).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      order: 0,
      defaultCut: null
    })
    expect(
      await get({ fields: ['name', 'family'], exclude: ['family'] })
    ).toEqual({ id: expect.any(Number), name: 'Regular' })
  })

  it('sends a populated relation as a nested row', async () => {
    const get = async (find: FindShape) =>
      (await request(setup(sets(find)), 'GET', '/api/sets?order=id')).json[0]
    for (const populate of [undefined, ['family']]) {
      expect(await get({ fields: ['name', 'family.name'], populate })).toEqual(
        {
          id: expect.any(Number),
          name: 'Regular',
          family: { id: 1, name: 'Akkurat' }
        }
      )
    }
    // Nested rows take their relations in `fields` and `exclude` by paths.
    const { json } = await request(
      setup(
        families({
          find: {
            fields: ['name', 'sets.name', 'sets.defaultCut', 'sets.cuts'],
            populate: ['sets', 'sets.cuts'],
            exclude: ['sets.cuts.set']
          }
        })
      ),
      'GET',
      '/api/families/1'
    )
    expect(json.sets[0]).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      defaultCut: null,
      cuts: [
        expect.not.objectContaining({ set: expect.anything() }),
        expect.not.objectContaining({ set: expect.anything() })
      ]
    })
    // The bare name of a populated relation sends the row.
    for (const exclude of [[], ['order']]) {
      expect(
        await get({
          fields: ['name', 'family', 'order'],
          exclude,
          populate: ['family']
        })
      ).toMatchObject({ family: { id: 1, name: 'Akkurat' } })
    }
  })

  it('keeps hidden relations out', async () => {
    await sql('update award set judge_id = 1, jury_id = 1')
    const awards = (find: FindShape) =>
      setup(
        defineController({
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
      { fields: ['*'], exclude: ['designer'] }
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
    await sql('update award set designer_id = (select min(id) from designer)')
    const awards = (fields: string[]) =>
      setup(
        defineController({
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
        return { designer: json[0].designer, queries: queries.join('\n') }
      } finally {
        orm.config.set('debug', debug)
        spy.mockRestore()
      }
    }
    const plain = await get(['name', 'designer.*'])
    expect(plain.designer).toEqual({
      id: expect.any(Number),
      name: 'Ada',
      deleted: false,
      email: null
    })
    expect(plain.queries).not.toMatch(/count/)
    const named = await get(['name', 'designer.*', 'designer.awardCount'])
    expect(named.designer).toMatchObject({ name: 'Ada', awardCount: 1 })
  })

  it('orders by `relation.id` where the rows return it', async () => {
    const list = async (find: FindShape, order: string) =>
      request(setup(sets(find)), 'GET', `/api/sets?order=${order}`)
    const expected = (
      await sql('select id from font_set order by family_id desc, id')
    ).map((row: Record<string, unknown>) => row.id as number)
    // The order differs from the order of the ids.
    expect(expected).not.toEqual([...expected].sort((a, b) => a - b))
    for (const find of [
      {},
      { fields: ['name', 'family'] },
      { fields: ['name', 'family.id'] },
      { fields: ['name', 'family.name'] }
    ]) {
      const { status, json } = await list(find, 'family.id+desc')
      expect(status).toBe(200)
      expect(json.map((set: { id: number }) => set.id)).toEqual(expected)
    }
    for (const [find, order] of [
      [{ fields: ['name'] }, 'family.id'],
      [{ exclude: ['family'] }, 'family.id'],
      [{ exclude: ['family.id'] }, 'family.id'],
      [{}, 'family'],
      [{}, 'familyId'],
      [{}, 'family.name'],
      [{}, 'family.id.id'],
      [{}, 'name.id'],
      [{}, 'cuts.id']
    ] as const) {
      expect((await list(find, order)).status).toBe(400)
    }
  })

  it('filters by `relation.id`', async () => {
    const api = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        filters: { 'family.id': z.coerce.number() },
        actions: { get: true }
      })
    )
    const { json } = await request(api, 'GET', '/api/sets?filter[family.id]=1')
    expect(json.length).toBeGreaterThan(0)
    for (const set of json) expect(set.family).toEqual({ id: 1 })
  })

  it(`serializes the entities of a result that aren't records`, async () => {
    await sql(`update designer set email = 'ada@example.com'`)
    const api = setup(
      families({
        actions: {
          'get graph': async ({ db: em }) => {
            const award = await em.findOneOrFail(
              Award,
              { name: 'TDC' },
              { populate: ['family'] }
            )
            const designer = await em.findOneOrFail(
              Designer,
              { name: 'Ada' },
              { populate: ['families'] }
            )
            const set = await em.findOneOrFail(
              FontSet,
              { name: 'Regular' },
              { populate: ['cuts', 'family'] }
            )
            return { award, designers: [designer], set, count: 1 }
          }
        }
      })
    )
    const { json } = await request(api, 'GET', '/api/families/graph')
    // Records of the controller go out in its shape, other entities with
    // their loaded relations and without hidden properties.
    expect(json.award).toEqual({
      id: expect.any(Number),
      name: 'TDC',
      designer: null,
      jury: null,
      family: expect.objectContaining({ id: 1, name: 'Akkurat' })
    })
    expect(json.award.family).not.toHaveProperty('secret')
    expect(json.designers).toEqual([
      {
        id: 1,
        name: 'Ada',
        deleted: false,
        email: 'ada@example.com',
        families: expect.any(Array)
      }
    ])
    expect(json.designers[0].families[0].name).toBe('Akkurat')
    expect(json.designers[0].families[0]).not.toHaveProperty('secret')
    // A relation back to an entity above it stays `{ id }`.
    expect(json.set.cuts[0]).toEqual({
      id: expect.any(Number),
      name: 'Light',
      order: 0,
      code: null,
      features: null,
      set: { id: json.set.id }
    })
    expect(json.count).toBe(1)
  })
})

describe('default handlers', () => {
  it('refuses entities with a composite primary key', async () => {
    const errors: unknown[] = []
    const api = createApi({
      controllers: [
        defineController({
          path: 'pairs',
          entity: Pair,
          actions: { get: true }
        })
      ],
      db: mikroDb(orm),
      onError: error => {
        errors.push(error)
      }
    })
    const { status } = await request(api, 'GET', '/pairs')
    expect(status).toBe(500)
    expect(errors[0]).toMatchObject({
      message: expect.stringContaining(`'Pair' has a composite primary key`)
    })
  })

  it('applies the settings of the controller to the actions of mixins', async () => {
    const api = setup(
      defineController({
        path: 'families',
        entity: Family,
        authorize: true,
        mixins: [crud],
        actions: { 'get count': () => 1 }
      })
    )
    const { status } = await request(api, 'POST', '/api/families', {
      name: 'New'
    })
    expect(status).toBe(201)
  })

  it('routes all five with `crud`', async () => {
    const api = setup(
      defineController({
        path: 'families',
        entity: Family,
        authorize: true,
        mixins: [crud]
      })
    )
    const created = await request(api, 'POST', '/api/families', { name: 'New' })
    const path = `/api/families/${created.json.id}`
    expect(created.status).toBe(201)
    expect((await request(api, 'GET', '/api/families')).json).toHaveLength(4)
    expect((await request(api, 'GET', path)).json.name).toBe('New')
    const patched = await request(api, 'PATCH', path, { name: 'Newer' })
    expect(patched.json.name).toBe('Newer')
    expect((await request(api, 'DELETE', path)).json).toEqual({ count: 1 })
  })

  it('routes only the ones that the controller sets', async () => {
    const api = setup(
      defineController({
        path: 'families',
        entity: Family,
        actions: { 'get :id': ({ next }) => next() }
      })
    )
    expect((await request(api, 'GET', '/api/families')).status).toBe(404)
    expect((await request(api, 'GET', '/api/families/1')).status).toBe(200)
    expect((await request(api, 'DELETE', '/api/families/1')).status).toBe(404)
  })
})

describe('writes', () => {
  const api = setup(families())

  it('creates with post, answers 201 and loads the shape', async () => {
    const { status, headers, json } = await request(
      api,
      'POST',
      '/api/families',
      {
        name: 'Dia',
        designers: [{ id: 2 }],
        sets: [{ name: 'Regular', cuts: [{ name: 'Bold' }] }]
      }
    )
    expect(status).toBe(201)
    expect(headers.get('Location')).toBe(`/api/families/${json.id}`)
    expect(json).toMatchObject({
      name: 'Dia',
      published: false,
      designers: [{ id: 2, name: 'Bea' }],
      sets: [{ name: 'Regular', cuts: [{ name: 'Bold' }] }],
      // The database computes formulas, which the reload after the flush
      // loads.
      nameLength: 3
    })
    const saved = await request(api, 'GET', `/api/families/${json.id}`)
    expect(saved.json).toEqual(json)
  })

  it('writes nothing for a patch of the loaded graph', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const { status, json } = await request(
      api,
      'PATCH',
      '/api/families/1',
      family
    )
    expect(status).toBe(200)
    expect(json).toEqual(family)
  })

  it('saves nested changes in one patch', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [regular, mono] = family.sets
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      designers: [1, 2],
      sets: [
        {
          ...regular,
          cuts: [{ ...regular.cuts[0], name: 'Thin' }, { name: 'Black' }]
        },
        { name: 'Italic', cuts: [{ name: 'Italic' }] }
      ]
    })
    expect(status).toBe(200)
    expect(json.designers.map((it: any) => it.name)).toEqual(['Ada', 'Bea'])
    expect(
      json.sets.map((set: any) => [
        set.name,
        set.cuts.map((cut: any) => cut.name)
      ])
    ).toEqual([
      ['Regular', ['Thin', 'Black']],
      ['Italic', ['Italic']]
    ])
    // The removed rows are deleted, as the relations own them.
    const [cuts] = await sql(
      'select count(*)::int as count from font_cut where set_id = ?',
      [mono.id]
    )
    expect(cuts.count).toBe(0)
    const saved = await request(api, 'GET', '/api/families/1')
    expect(saved.json).toEqual(json)
  })

  it('links relations to new rows with `#id` and `#ref`', async () => {
    const { json } = await request(api, 'PATCH', '/api/families/2', {
      sets: [
        {
          name: 'Regular',
          defaultCut: { '#ref': 'book' },
          cuts: [
            { name: 'Light' },
            { '#id': 'book', 'name': 'Book' }
          ]
        }
      ]
    })
    const [set] = json.sets
    const book = set.cuts.find((cut: any) => cut.name === 'Book')
    expect(set.defaultCut).toEqual({ id: book.id })
  })

  it('refuses a reference to no new row', async () => {
    const { status, json } = await request(api, 'PATCH', '/api/families/2', {
      sets: [{ name: 'Regular', defaultCut: { '#ref': 'none' } }]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'sets/0/defaultCut': [
        {
          message: `references the unknown new row 'none'`,
          keyword: 'invalid_value'
        }
      ]
    })
  })

  it('takes `{ id }` for a relation to one row, as the output sends it', async () => {
    const sets = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        actions: { 'get :id': true, 'patch :id': true }
      })
    )
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [regular, mono] = family.sets
    const moved = await request(sets, 'PATCH', `/api/sets/${mono.id}`, {
      family: { id: 2 }
    })
    const missing = await request(sets, 'PATCH', `/api/sets/${mono.id}`, {
      family: { id: 99 }
    })
    const nested = await request(api, 'PATCH', '/api/families/1', {
      sets: [{ ...regular, defaultCut: { id: regular.cuts[1].id } }]
    })
    expect(moved.json.family).toEqual({ id: 2 })
    expect(missing.json.errors).toEqual({
      family: [{ keyword: 'invalid_value', message: 'names no Family' }]
    })
    expect(nested.json.sets[0].defaultCut).toEqual({ id: regular.cuts[1].id })
  })

  it('ignores `<name>Id` in a body, as any unknown key', async () => {
    const sets = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        actions: { 'post': true, 'patch :id': true }
      })
    )
    const [{ id }] = await sql(`select id from font_set where name = 'Mono'`)
    const patched = await request(sets, 'PATCH', `/api/sets/${id}`, {
      familyId: 2
    })
    const posted = await request(sets, 'POST', '/api/sets', {
      name: 'New',
      familyId: 2
    })
    expect(patched.status).toBe(200)
    expect(patched.json.family).toEqual({ id: 1 })
    expect(patched.json).not.toHaveProperty('familyId')
    expect(posted.status).toBe(400)
    expect(Object.keys(posted.json.errors)).toEqual(['family'])
  })

  it('takes back a loaded row', async () => {
    const sets = setup(
      defineController({
        path: 'sets',
        authorize: true,
        entity: FontSet,
        find: { populate: ['family', 'defaultCut'] },
        actions: { 'get :id': true, 'patch :id': true }
      })
    )
    const [{ id }] = await sql(`select id from font_set where name = 'Mono'`)
    const { json: set } = await request(sets, 'GET', `/api/sets/${id}`)
    expect(set.family).toMatchObject({ id: 1, name: 'Akkurat' })
    const { status, json } = await request(
      sets,
      'PATCH',
      `/api/sets/${id}`,
      set
    )
    expect(status).toBe(200)
    expect(json).toEqual(set)
  })

  it('refuses ids of relations that name no row, or a filtered one', async () => {
    await sql(`insert into designer (id, name, deleted) values (9, 'Cy', true)`)
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [regular] = family.sets
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      designers: [1, 77, { id: 9 }, 77],
      sets: [
        { ...regular, defaultCut: 99 },
        {
          name: 'New',
          defaultCut: { '#ref': 'cut' },
          cuts: [{ '#id': 'cut', 'name': 'C' }]
        }
      ]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'designers/1': [
        { keyword: 'invalid_value', message: 'names no Designer' }
      ],
      'designers/2': [
        { keyword: 'invalid_value', message: 'names no Designer' }
      ],
      'designers/3': [
        { keyword: 'invalid_value', message: 'names no Designer' }
      ],
      'sets/0/defaultCut': [
        { keyword: 'invalid_value', message: 'names no Cut' }
      ]
    })
    const posted = await request(api, 'POST', '/api/families', {
      name: 'Dia',
      designers: [2],
      sets: [{ name: 'Regular', defaultCut: regular.cuts[0].id }]
    })
    expect(posted.status).toBe(201)
    expect(posted.json.sets[0].defaultCut).toEqual({ id: regular.cuts[0].id })
    const refused = await request(api, 'POST', '/api/families', {
      name: 'Eve',
      designers: [9]
    })
    expect(Object.keys(refused.json.errors)).toEqual(['designers/0'])
  })

  it('keeps relations to rows that filters hide', async () => {
    await sql(`update award set designer_id = 1`)
    await sql(`update designer set deleted = true where id = 1`)
    const awards = setup(
      defineController({
        path: 'awards',
        authorize: true,
        entity: Award,
        actions: { 'post': true, 'patch :id': true }
      })
    )
    const [award] = await sql(`select id from award`)
    // The client never sees the hidden row, and the collection that the
    // write loads leaves it out too.
    const kept = await request(api, 'PATCH', '/api/families/1', {
      designers: [2]
    })
    const added = await request(api, 'PATCH', '/api/families/3', {
      designers: [1]
    })
    const same = await request(awards, 'PATCH', `/api/awards/${award.id}`, {
      name: 'TDC 2'
    })
    const posted = await request(awards, 'POST', '/api/awards', {
      name: 'ADC',
      family: 1,
      designer: 1
    })
    expect(kept.json.designers.map((it: Designer) => it.id)).toEqual([2])
    // The link to the hidden row stays.
    const links = await sql(
      'select designer_id as id from family_designers where family_id = 1'
    )
    expect(links.map(link => link.id).sort()).toEqual([1, 2])
    expect(added.json.errors).toEqual({
      'designers/0': [
        { keyword: 'invalid_value', message: 'names no Designer' }
      ]
    })
    expect(same.status).toBe(200)
    expect(await sql('select designer_id as id from award')).toEqual([
      { id: 1 }
    ])
    expect(posted.json.errors).toEqual({
      designer: [{ keyword: 'invalid_value', message: 'names no Designer' }]
    })
  })

  it('refuses ids of nested rows in a post, at any depth', async () => {
    const { status, json } = await request(api, 'POST', '/api/families', {
      name: 'Dia',
      sets: [{ id: 1 }, { name: 'B', cuts: [{ id: 1, name: 'C' }] }]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      'sets/0/id': [
        { keyword: 'invalid_value', message: 'is not allowed in a new row' }
      ],
      'sets/0/name': [expect.objectContaining({ keyword: 'invalid_type' })],
      'sets/1/cuts/0/id': [
        { keyword: 'invalid_value', message: 'is not allowed in a new row' }
      ]
    })
    expect(await sql(`select id from family where name = 'Dia'`)).toEqual([])
  })

  it('refuses rows of another family, at the path of their id', async () => {
    const { json: other } = await request(api, 'GET', '/api/families/3')
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      sets: [...family.sets, { id: other.sets[0].id, name: 'Moved' }]
    })
    expect(status).toBe(400)
    expect(Object.keys(json.errors)).toEqual(['sets/2/id'])
    const [set] = await sql('select family_id from font_set where id = ?', [
      other.sets[0].id
    ])
    expect(set.family_id).toBe(3)
  })

  it('answers validation errors by path', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const { status, headers, json } = await request(
      api,
      'PATCH',
      '/api/families/1',
      {
        name: 42,
        specs: { weight: 'heavy' },
        sets: [family.sets[0], { name: 7 }, { order: 2 }]
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
      'sets/1/name',
      'sets/2/name',
      'specs/weight'
    ])
    expect(json.errors.name).toEqual([
      { message: expect.any(String), keyword: 'invalid_type' }
    ])
  })

  it('runs the schemas of custom types, also in nested rows', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [regular] = family.sets
    const invalid = await request(api, 'PATCH', '/api/families/1', {
      specs: { weight: 'heavy', extra: 1 },
      sets: [
        {
          ...regular,
          cuts: [
            { ...regular.cuts[0], code: 'abc', features: [{ tag: 'kern' }] },
            { name: 'New', code: 'NEW', features: [{ tag: 'liga' }, {}] }
          ]
        }
      ]
    })
    expect(invalid.status).toBe(400)
    expect(invalid.json.errors).toEqual({
      'specs/weight': [
        { keyword: 'invalid_type', message: expect.any(String) }
      ],
      'specs': [{ keyword: 'unrecognized_keys', message: expect.any(String) }],
      'sets/0/cuts/0/code': [{ keyword: 'custom', message: 'Invalid code' }],
      'sets/0/cuts/1/features/1/tag': [
        { keyword: 'invalid_type', message: expect.any(String) }
      ]
    })
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      specs: { weight: 700 },
      sets: [
        {
          ...regular,
          cuts: [
            { ...regular.cuts[0], code: 'LT', features: [{ tag: 'kern' }] }
          ]
        }
      ]
    })
    expect(status).toBe(200)
    expect(json.specs).toEqual({ weight: 700 })
    // The value type of the column follows the schema.
    expectTypeOf<Family['specs']>().toEqualTypeOf<
      { weight?: number; tags?: string[] } | null | undefined
    >()
    expect(json.sets[0].cuts[0]).toMatchObject({
      code: 'LT',
      features: [{ tag: 'kern' }]
    })
  })

  it('ignores read-only columns and unknown properties', async () => {
    const [before] = await sql('select created_at from family where id = 2')
    const { status, json } = await request(api, 'PATCH', '/api/families/2', {
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
      'select secret, created_at from family where id = 2'
    )
    expect(row).toEqual({ secret: null, created_at: before.created_at })
  })

  it('replaces an owned row with a new row of the same unique value', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [set] = family.sets
    const [cut] = set.cuts
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      sets: [
        { ...set, cuts: [...set.cuts.slice(1), { name: cut.name }] }
      ]
    })
    expect(status).toBe(200)
    const names = json.sets[0].cuts.map(({ name }) => name)
    expect(names).toContain(cut.name)
    expect(json.sets[0].cuts.map(({ id }) => id)).not.toContain(cut.id)
  })

  it('replaces an owned row that is loaded without its unique value', async () => {
    const em = orm.em.fork()
    const set = await em.findOneOrFail(FontSet, 1, {
      populate: ['cuts'],
      fields: ['cuts.id']
    })
    const [cut, ...cuts] = set.cuts.getItems()
    const { name } = await orm.em.fork().findOneOrFail(Cut, cut.id)
    await assignRecord(em, set, {
      cuts: [...cuts.map(({ id }) => ({ id })), { name }]
    })
    await em.flush()
    const rows = await orm.em.fork().find(Cut, { set: 1, name })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(cut.id)
  })

  it('writes the owned row of a one-to-one relation', async () => {
    const api = setup(families({ find: { populate: ['info'] } }))
    const created = await request(api, 'PATCH', '/api/families/2', {
      info: { text: 'New' }
    })
    // `familyCode` is a formula of the entity, which the reload after the
    // flush computes.
    expect(created.json.info).toEqual({
      id: expect.any(Number),
      text: 'New',
      family: { id: 2 },
      familyCode: 20
    })
    const { id } = created.json.info
    const loaded = await request(api, 'GET', '/api/families/2')
    expect(loaded.json.info).toEqual({
      id,
      text: 'New',
      family: { id: 2 },
      familyCode: 20
    })
    const updated = await request(api, 'PATCH', '/api/families/2', {
      info: { id, text: 'Changed' }
    })
    expect(updated.json.info).toEqual({
      id,
      text: 'Changed',
      family: { id: 2 },
      familyCode: 20
    })
    const other = await request(api, 'PATCH', '/api/families/3', {
      info: { id, text: 'Moved' }
    })
    expect(other.status).toBe(400)
    expect(Object.keys(other.json.errors)).toEqual(['info/id'])
    const removed = await request(api, 'PATCH', '/api/families/2', {
      info: null
    })
    expect(removed.json.info).toBe(null)
    expect(await sql('select id from info')).toEqual([])
  })

  it('stores dates that it takes as ISO strings', async () => {
    const releasedAt = '2020-01-01T00:00:00.000Z'
    const { json } = await request(api, 'PATCH', '/api/families/2', {
      releasedAt: '2020-01-01T01:00:00+0100'
    })
    expect(json.releasedAt).toBe(releasedAt)
    const [row] = await sql('select released_at from family where id = 2')
    expect(new Date(row.released_at)).toEqual(new Date(releasedAt))
  })

  it('runs `deserialize` with the record before the check', async () => {
    const records: unknown[] = []
    const mixin = defineMixin({
      deserialize: (_c, json) => ({
        ...(json as object),
        notes: `by mixin`
      })
    })
    const api = setup(
      families({
        mixins: [mixin],
        deserialize: (_c, json, record) => {
          records.push(record)
          const { createdAt, ...rest } = json as Record<string, unknown>
          return { ...rest, name: (rest.name as string).toUpperCase() }
        }
      })
    )
    const patched = await request(api, 'PATCH', '/api/families/2', {
      name: 'Brownish',
      published: true,
      createdAt: '2000-01-01T00:00:00Z'
    })
    expect(patched.json).toMatchObject({
      name: 'BROWNISH',
      notes: 'by mixin',
      published: true
    })
    expect(patched.json.createdAt).not.toBe('2000-01-01T00:00:00.000Z')
    expect(records[0]).toBeInstanceOf(Family)
    const posted = await request(api, 'POST', '/api/families', { name: 'Eve' })
    expect(posted.json).toMatchObject({ name: 'EVE', notes: 'by mixin' })
    expect(records[1]).toBeUndefined()
  })

  it('checks what `deserialize` returns', async () => {
    const api = setup(
      families({
        deserialize: (_c, json) => ({ ...(json as object), notes: 5 })
      })
    )
    const { status, json } = await request(api, 'POST', '/api/families', {
      name: 'Eve'
    })
    expect(status).toBe(400)
    expect(Object.keys(json.errors)).toEqual(['notes'])
  })

  it('answers 409 for a stale save', async () => {
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      notes: 'Stale',
      updatedAt: '2000-01-01T00:00:00.000Z'
    })
    expect(status).toBe(409)
    expect(json.message).toBe('A more recent version exists in the database.')
  })

  it('answers a unique violation with 409, and writes nothing', async () => {
    const { json: family } = await request(api, 'GET', '/api/families/1')
    const [regular] = family.sets
    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      notes: 'Changed',
      sets: [{ ...regular, cuts: [...regular.cuts, { name: 'Light' }] }]
    })
    expect(status).toBe(409)
    expect(json).toEqual({
      status: 409,
      message: 'The data conflicts with rows in the database.'
    })
    const saved = await request(api, 'GET', '/api/families/1')
    expect(saved.json.notes).toBe(null)
  })

  it('answers a composite unique key of the root table at both columns', async () => {
    await request(api, 'PATCH', '/api/families/2', { notes: 'A' })
    const { status, json } = await request(api, 'PATCH', '/api/families/3', {
      name: 'Brown',
      notes: 'A'
    })
    expect(status).toBe(409)
    expect(json.errors).toEqual({
      name: [{ message: 'already exists', keyword: 'not_unique' }],
      notes: [{ message: 'already exists', keyword: 'not_unique' }]
    })
  })

  it('answers 409 for a delete of a row that others reference', async () => {
    const { status } = await request(api, 'DELETE', '/api/families/1')
    expect(status).toBe(409)
    expect(await sql('select id from family where id = 1')).toHaveLength(1)
  })

  it('answers a violation on the root table at the property', async () => {
    await sql(
      `alter table family add constraint family_notes_check check (notes <> 'x')`
    )
    try {
      const { status, json } = await request(api, 'PATCH', '/api/families/1', {
        notes: 'x'
      })
      expect(status).toBe(400)
      expect(json.errors).toEqual({
        notes: [{ message: 'fails a check', keyword: 'invalid_value' }]
      })
    } finally {
      await sql('alter table family drop constraint family_notes_check')
    }
  })

  it('flushes and serializes the rows of lists and pages', async () => {
    const api = setup(
      families({
        actions: {
          'post batch': ({ db: em }) => {
            return [em.create(Family, { name: 'Gil' } as never)]
          },
          'post page': ({ db: em }) => {
            return {
              results: [em.create(Family, { name: 'Hal' } as never)],
              total: 1
            }
          }
        }
      })
    )
    const batch = await request(api, 'POST', '/api/families/batch')
    const page = await request(api, 'POST', '/api/families/page')
    expect(batch.json).toMatchObject([{ id: expect.any(Number), name: 'Gil' }])
    expect(page.json).toMatchObject({
      results: [{ id: expect.any(Number), name: 'Hal', notes: null }],
      total: 1
    })
  })

  it('deletes and answers the count', async () => {
    const { status, json } = await request(api, 'DELETE', '/api/families/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from family where id = 3')).toEqual([])
    expect(await sql('select id from font_set where family_id = 3')).toEqual(
      []
    )
  })

  it('flushes writes without a transaction, also for results that are no rows', async () => {
    const api = setup(families({ transaction: false }))
    const { status, json } = await request(api, 'DELETE', '/api/families/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from family where id = 3')).toEqual([])
  })
})

describe('actions', () => {
  const api = setup(families())

  it('runs a member action on the loaded row, and flushes it', async () => {
    const { status, json } = await request(
      api,
      'POST',
      '/api/families/2/publish'
    )
    expect(status).toBe(400)
    expect(json.errors).toEqual({ sets: [{ message: 'has no sets' }] })
    const published = await request(api, 'POST', '/api/families/3/publish')
    expect(published.json).toMatchObject({ id: 3, published: true })
    const [row] = await sql('select published from family where id = 3')
    expect(row.published).toBe(true)
  })

  it('runs an action without `:id` on the request entity manager', async () => {
    const { json } = await request(api, 'GET', '/api/families/names')
    expect(json).toEqual(['Akkurat', 'Brown', 'Circular'])
  })
})

describe('find()', () => {
  it('queries the rows that `find` lets the user see, in its shape', async () => {
    const api = setup(
      families({
        find: c => ({
          where: c.var.user ? {} : { published: true },
          populate: ['sets'],
          orderBy: { name: 'asc' }
        }),
        actions: {
          'get with-r': ({ find }) =>
            find<Family>({
              where: { name: { $ilike: '%r%' } },
              populate: ['sets', 'designers'],
              orderBy: { name: 'desc' }
            })
        }
      })
    )
    const guest = await request(api, 'GET', '/api/families/with-r')
    const editor = await request(
      api,
      'GET',
      '/api/families/with-r',
      undefined,
      'ed'
    )
    expect(guest.json.map((row: Family) => row.name)).toEqual([
      'Circular',
      'Akkurat'
    ])
    expect(editor.json.map((row: Family) => row.name)).toEqual([
      'Circular',
      'Brown',
      'Akkurat'
    ])
    // The rows go out in the controller's shape.
    expect(guest.json[1].sets).toHaveLength(2)
    expect(guest.json[1]).not.toHaveProperty('designers')
  })
})

describe('wrapping the default handlers', () => {
  it('reads the new row with `record()` after `next()` on `post`', async () => {
    const api = setup(
      families({
        actions: {
          async post({ record, next }) {
            await next()
            const family = await record<Family>()
            family.notes = `Created ${family.name}`
            return family
          }
        }
      })
    )
    const created = await request(api, 'POST', '/api/families', { name: 'New' })
    expect(created.status).toBe(201)
    expect(created.json.notes).toBe('Created New')
  })

  it('checks the graph with relations the shape leaves out', async () => {
    const api = setup(
      families({
        actions: {
          async 'patch :id'({ record, db, next }) {
            const family = (await next()) as Family
            await db.populate(family, ['awards'])
            if (family.name.length < 3 && family.awards.length > 0) {
              throw createValidationError([
                { path: ['name'], message: 'is too short for an award' }
              ])
            }
            return family
          }
        }
      })
    )
    const short = await request(api, 'PATCH', '/api/families/1', {
      name: 'Ak'
    })
    expect(short.status).toBe(400)
    expect(short.json.errors).toEqual({
      name: [{ message: 'is too short for an award' }]
    })
    const [row] = await sql('select name from family where id = 1')
    expect(row.name).toBe('Akkurat')

    const { status, json } = await request(api, 'PATCH', '/api/families/1', {
      name: 'Akkurat Pro'
    })
    expect(status).toBe(200)
    expect(json.name).toBe('Akkurat Pro')
    expect(json).not.toHaveProperty('awards')
  })

  it('loads the record once through `record()`', async () => {
    const loaded: unknown[] = []
    const api = setup(
      families({
        actions: {
          async 'patch :id'({ record, next }) {
            loaded.push(await record())
            const family = await next()
            loaded.push(family)
            return family
          }
        }
      })
    )
    await request(api, 'PATCH', '/api/families/1', { notes: 'Once' })
    expect(loaded[0]).toBeInstanceOf(Family)
    expect(loaded[1]).toBe(loaded[0])
  })

  it('returns the row that `post` creates from `record()`', async () => {
    const records: unknown[] = []
    const api = setup(
      families({
        middleware: async (c, next) => {
          const response = await next()
          if (c.req.method === 'POST') records.push(await c.var.record())
          return response
        }
      })
    )
    const { json } = await request(api, 'POST', '/api/families', {
      name: 'Eve'
    })
    expect(records[0]).toBeInstanceOf(Family)
    expect(records[0]).toMatchObject({ id: json.id, name: 'Eve' })
  })

  it('sets `Location` for an entity of a replaced `post`', async () => {
    // Only the default handler responds with 201.
    const api = setup(
      families({
        actions: {
          post: ({ db }) => db.create(Family, { name: 'Fay' } as never)
        }
      })
    )
    const { status, headers, json } = await request(
      api,
      'POST',
      '/api/families'
    )
    expect(status).toBe(201)
    expect(json).toMatchObject({ name: 'Fay' })
    expect(headers.get('Location')).toBe(`/api/families/${json.id}`)
  })
})

describe('layers', () => {
  it('runs the `deserialize` chain of the layers in reverse order', async () => {
    const order: string[] = []
    const records: unknown[] = []
    const layer = (name: string) =>
      defineMixin({
        deserialize: (_c, json, record) => {
          order.push(name)
          records.push(record)
          return { ...(json as object), notes: name }
        }
      })
    const api = setup(
      families({
        mixins: [layer('one'), layer('two')],
        deserialize: (_c, json) => {
          order.push('controller')
          return json
        },
        actions: { 'patch :id': true }
      })
    )
    const { json } = await request(api, 'PATCH', '/api/families/1', {})
    expect(order).toEqual(['controller', 'two', 'one'])
    expect(records[0]).toBeInstanceOf(Family)
    expect(json.notes).toBe('one')
  })

  it('flushes and serializes the result of a mixin that replaces a default', async () => {
    const mixin = defineMixin({
      actions: {
        'patch :id': {
          authorize: 'admin',
          async handler({ record, db }) {
            const row = await record<Family>()
            row.notes = `by ${db.isInTransaction() ? 'transaction' : 'none'}`
            return row
          }
        }
      }
    })
    const api = setup(
      families({
        mixins: [mixin],
        find: { fields: ['name', 'notes', 'nameLength'] },
        actions: { 'patch :id': true }
      })
    )
    const denied = await request(api, 'PATCH', '/api/families/2', {})
    expect(denied.status).toBe(401)
    const { json } = await request(
      api,
      'PATCH',
      '/api/families/2',
      {},
      'admin'
    )
    expect(json).toEqual({
      id: 2,
      name: 'Brown',
      notes: 'by transaction',
      nameLength: 5
    })
    const [row] = await sql('select notes from family where id = 2')
    expect(row.notes).toBe('by transaction')
  })

  it('throws for a key without a handler', () => {
    expect(() => setup(families({ actions: { 'get other': true } }))).toThrow(
      `'get other' has no handler in 'families'`
    )
  })

  it('runs the `beforeSerialize` chain once per response', async () => {
    const calls: [string, number[]][] = []
    const record = (name: string) => (_c: unknown, rows: Family[]) => {
      calls.push([name, rows.map(row => row.id)])
    }
    const lengths = new Map<number, number>()
    const mixin = defineMixin({
      beforeSerialize: (_c, rows: Family[]) => {
        record('mixin')(_c, rows)
        for (const row of rows) lengths.set(row.id, row.name.length)
      },
      serialize: (_c, row, json) => ({
        ...(json as object),
        length: lengths.get(row.id)
      })
    })
    const api = setup(
      families({
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
    const { json } = await request(api, 'GET', '/api/families')
    expect(json[0]).toEqual({ id: 1, name: 'Akkurat', length: 7 })
    expect(calls).toEqual([
      ['mixin', [1, 2, 3]],
      ['controller', [1, 2, 3]]
    ])

    calls.length = 0
    await request(api, 'GET', '/api/families/2')
    expect(calls).toEqual([
      ['mixin', [2]],
      ['controller', [2]]
    ])

    calls.length = 0
    const page = await request(api, 'GET', '/api/families/page')
    expect(page.json.results).toHaveLength(2)
    expect(calls[0]).toEqual(['mixin', [1, 2]])

    calls.length = 0
    await request(api, 'GET', '/api/families/none')
    await request(api, 'GET', '/api/families/count')
    expect(calls).toEqual([])
  })

  it('serializes records through the `serialize` chain of the layers', async () => {
    const mixin = defineMixin({
      serialize: (_c, row, json) => ({ ...json, mixin: row.id })
    })
    const api = setup(
      families({
        find: { fields: ['name'] },
        mixins: [mixin],
        serialize: async (_c, _row, json) => ({ ...json, controller: true }),
        actions: {
          'get nested': async ({ find }) => {
            const [row] = await find<Family>({ where: { id: 1 } })
            return { order: { row, rows: [row] }, other: 'other' }
          }
        }
      })
    )
    const row = { id: 1, name: 'Akkurat', mixin: 1, controller: true }
    const page = await request(api, 'GET', '/api/families?range=0,0')
    expect(page.json).toEqual({ results: [row], total: 3 })
    const nested = await request(api, 'GET', '/api/families/nested')
    expect(nested.json).toEqual({
      order: { row, rows: [row] },
      other: 'other'
    })
  })

  it('loads the record through `load`', async () => {
    const api = setup(
      families({
        load: async (c, id) =>
          id === 'first'
            ? getEntityManager(c).findOne(Family, { name: 'Akkurat' })
            : null,
        find: { fields: ['name'] }
      })
    )
    const first = await request(api, 'GET', '/api/families/first')
    expect(first.json).toEqual({ id: 1, name: 'Akkurat' })
    expect((await request(api, 'GET', '/api/families/1')).status).toBe(404)
  })

  it('throws for `record()` outside member actions', async () => {
    const errors: unknown[] = []
    const api = new Hono().route(
      '/api',
      createApi({
        controllers: [
          families({ actions: { 'get one': ({ record }) => record() } })
        ],
        db: mikroDb(orm),
        onError: error => {
          errors.push(error)
        }
      })
    )
    expect((await request(api, 'GET', '/api/families/one')).status).toBe(500)
    expect(errors[0]).toMatchObject({
      message: (
        'record() has no record here: only member actions load one, and ' +
        'other actions need a handler that calls `setRecord()`'
      )
    })
  })

  it('replaces the list parameters with the `query` of `list()`', async () => {
    const api = setup(
      families({
        actions: {
          'get first': ({ list }) =>
            list({ query: { range: '0,0', order: 'name desc' } })
        }
      })
    )
    const { json } = await request(
      api,
      'GET',
      '/api/families/first?range=0,9&filter[name]=x'
    )
    expect(json.total).toBe(3)
    expect(json.results.map((row: Family) => row.name)).toEqual(['Circular'])
  })
})

describe('errors', () => {
  it('maps the errors of queries as those of a flush', async () => {
    const api = setup(
      families({
        actions: {
          'post own': ({ db }) => db.insert(Family, { name: null }),
          'post other': ({ db }) =>
            db.insert(FontSet, { name: 'Bold', family: 0 })
        }
      })
    )
    const own = await request(api, 'POST', '/api/families/own')
    expect(own.status).toBe(400)
    expect(own.json.errors).toEqual({
      name: [{ message: 'is required', keyword: 'invalid_type' }]
    })
    // The rows of other tables can't be told apart.
    const other = await request(api, 'POST', '/api/families/other')
    expect(other.status).toBe(409)
    expect(other.json.errors).toBeUndefined()
  })
})

describe('transactions', () => {
  it('rolls back the writes of a failed action', async () => {
    const api = setup(
      families({
        actions: {
          'post fail': async ({ db: em }) => {
            em.create(Award, { name: 'Lost', family: 1 })
            await em.flush()
            throw new Error('Failed')
          }
        }
      })
    )
    const { status } = await request(api, 'POST', '/api/families/fail')
    expect(status).toBe(500)
    expect(await sql(`select id from award where name = 'Lost'`)).toEqual([])
  })

  it('gives reads the request fork and writes the transaction', async () => {
    const managers: Record<string, EntityManager> = {}
    const api = setup(
      families({
        actions: {
          'get check': ({ db }) => {
            managers.get = db as EntityManager
            return {}
          },
          'post check': ({ db }) => {
            managers.post = db as EntityManager
            return { transaction: !!managers.post.isInTransaction() }
          }
        }
      })
    )
    expect((await request(api, 'POST', '/api/families/check')).json).toEqual({
      transaction: true
    })
    await request(api, 'GET', '/api/families/check')
    expect(managers.get!.isInTransaction()).toBe(false)
    expect(managers.get).not.toBe(orm.em)
    expect(getEntityManager({ var: { db: managers.get } } as never)).toBe(
      managers.get
    )
  })
  it('writes the row that `authorize` loads before the transaction', async () => {
    let checked: Family | undefined
    let written: Family | undefined
    const api = setup(
      families({
        actions: {
          'patch :id': {
            authorize: async c => {
              const em = getEntityManager(c)
              checked = await em.findOneOrFail(
                Family,
                Number(c.req.param('id'))
              )
              return !em.isInTransaction()
            },
            async handler({ db: em, next }) {
              written = (await next()) as Family
              // The transaction's fork keeps the loaded entities.
              expect(em.isInTransaction()).toBe(true)
              expect(em.getReference(Family, 1)).toBe(checked)
              return written
            }
          }
        }
      })
    )
    const { status } = await request(api, 'PATCH', '/api/families/1', {
      name: 'Akkurat Pro'
    })
    expect(status).toBe(200)
    expect(written).toBe(checked)
    expect(await sql('select name from family where id = 1')).toEqual([
      { name: 'Akkurat Pro' }
    ])
  })
})

describe('mikroDb()', () => {
  it('maps the errors of MikroORM before `onError`', async () => {
    const onError = vi.fn()
    const error = new Error('Failed')
    const api = createApi({
      controllers: [
        {
          path: 'items',
          actions: {
            'get locked': () => {
              throw OptimisticLockError.lockFailed('Family')
            },
            'get failed': () => {
              throw error
            }
          }
        }
      ],
      db: mikroDb(orm),
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
    expect(onError.mock.calls[0]![0]).toBe(error)
  })

  it('gives each request a fork of the entity manager', async () => {
    const api = createApi({
      controllers: [
        { path: 'items', actions: { get: ({ db }) => db !== orm.em } }
      ],
      db: mikroDb(orm)
    })
    expect((await request(api, 'GET', '/items')).json).toBe(true)
  })
})
