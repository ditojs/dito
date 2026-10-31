import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import {
  HttpError,
  createApp,
  errorResponse,
  type App,
  type ControllerDefinition
} from '@ditojs/server-next'
import { DiskStorage, assets, insertAsset } from '@ditojs/storage'
import type { EntityManager } from '@mikro-orm/sql'
import {
  createValidationError,
  defineController,
  getEntityManager,
  mikroConnect,
  mikroTransaction,
  toHttpError,
  type MikroControllerDefinition
} from '../src/index.ts'
import { createTestDatabase } from './database.ts'
import { Award, Designer, Family, entities } from './entities.ts'

const { orm, drop } = await createTestDatabase(entities)

afterAll(drop)

// Sets up an app with the parts that an app wires in.
function setup(...controllers: ControllerDefinition[]) {
  return createApp({
    prefix: '/api',
    controllers,
    transaction: mikroTransaction(orm),
    connect: mikroConnect(orm),
    getUser: async () => null,
    onError: error => errorResponse(toHttpError(error) ?? error)
  })
}

const request = async (
  app: App,
  method: string,
  path: string,
  body?: unknown
) => {
  const response = await app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      ...(body !== undefined && {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })
    })
  )
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    json: text ? JSON.parse(text) : undefined
  }
}

const sql = (query: string, params: unknown[] = []) =>
  orm.em.getConnection().execute(query, params)

const textArgs = z.union([
  z.tuple([z.string()]),
  z.tuple([z.enum(['contains', 'equals']), z.string()])
])

// The family controller of the tests, with `overrides` for its definition.
function families(overrides: Partial<MikroControllerDefinition<Family>> = {}) {
  return defineController({
    path: 'families',
    entity: Family,
    find: {
      populate: ['sets.cuts', 'designers'],
      orderBy: { name: 'asc' }
    },
    filters: {
      name: {
        args: textArgs,
        apply(qb, ...args: string[]) {
          const [operator, text] =
            args.length === 2 ? args : ['contains', args[0]]
          qb.andWhere({
            name: { $ilike: operator === 'equals' ? text : `%${text}%` }
          })
        }
      },
      published: {
        args: z.tuple([z.stringbool()]).or(z.tuple([])),
        apply: (qb, published = true) => qb.andWhere({ published })
      }
    },
    rules: {
      Family: {
        readOnly: ['published'],
        fields: {
          specs: z
            .strictObject({
              weight: z.number().optional(),
              tags: z.array(z.string()).optional()
            })
            .nullable()
        }
      }
    },
    collection: {
      'allow': ['get', 'post'],
      'get names': async ctx => {
        const rows = await getEntityManager(ctx).find(
          Family,
          {},
          {
            orderBy: { name: 'asc' }
          }
        )
        return rows.map(row => row.name)
      }
    },
    member: {
      'allow': ['get', 'patch', 'delete'],

      // The `updatedAt` the client loaded. A newer one in the database
      // answers 409.
      async 'patch'(ctx, next) {
        const family = await ctx.member<Family>()
        const { updatedAt } = ctx.body
        if (updatedAt && +new Date(updatedAt) !== +family.updatedAt) {
          throw new HttpError(409, {
            detail: 'A more recent version exists in the database.'
          })
        }
        return next()
      },

      async 'post publish'(ctx) {
        const family = await ctx.member<Family>()
        if (family.sets.length === 0) {
          throw createValidationError([
            { path: ['sets'], message: 'has no sets' }
          ])
        }
        family.published = true
        return family
      }
    },
    // The overrides replace the definitions above. The cast keeps their types
    // out of the inferred action keys.
    ...(overrides as object)
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

describe('collection get', () => {
  const app = setup(families())
  const names = (rows: Family[]) => rows.map(row => row.name)

  it('lists the rows in the order of `find`', async () => {
    const { status, json } = await request(app, 'GET', '/api/families')
    expect(status).toBe(200)
    expect(names(json)).toEqual(['Akkurat', 'Brown', 'Circular'])
  })

  it('loads each row in the shape of `find`', async () => {
    const { json } = await request(app, 'GET', '/api/families')
    expect(json[0].sets.map((set: any) => set.cuts.length)).toEqual([2, 1])
    expect(json[1].designers.map((it: any) => it.name)).toEqual(['Ada', 'Bea'])
  })

  it('applies `filter[name]=value`, repeated for several arguments', async () => {
    const one = await request(app, 'GET', '/api/families?filter[name]=ir')
    const two = await request(
      app,
      'GET',
      '/api/families?filter[name]=equals&filter[name]=Akkurat'
    )
    const none = await request(app, 'GET', '/api/families?filter[published]=')
    const unpublished = await request(
      app,
      'GET',
      '/api/families?filter[published]=false'
    )
    expect(names(one.json)).toEqual(['Circular'])
    expect(names(two.json)).toEqual(['Akkurat'])
    expect(names(none.json)).toEqual(['Akkurat', 'Circular'])
    expect(names(unpublished.json)).toEqual(['Brown'])
  })

  it('applies `order`', async () => {
    const { json } = await request(app, 'GET', '/api/families?order=name+desc')
    expect(names(json)).toEqual(['Circular', 'Brown', 'Akkurat'])
  })

  it('answers `range` with the results and the total', async () => {
    const { json } = await request(
      app,
      'GET',
      '/api/families?range=1,2&order=name+desc'
    )
    expect(json.total).toBe(3)
    expect(names(json.results)).toEqual(['Brown', 'Akkurat'])
    expect(json.results[1].sets).toHaveLength(2)
  })

  it('refuses unknown filters, invalid arguments and orders', async () => {
    const unknown = await request(app, 'GET', '/api/families?filter[none]=1')
    const invalid = await request(
      app,
      'GET',
      '/api/families?filter[published]=maybe'
    )
    const order = await request(app, 'GET', '/api/families?order=secret')
    const relation = await request(app, 'GET', '/api/families?order=sets')
    expect(unknown).toMatchObject({
      status: 400,
      json: { detail: `Unknown filter 'none'` }
    })
    expect(invalid).toMatchObject({
      status: 400,
      json: { errors: { '/published': [expect.any(Object)] } }
    })
    expect(order.status).toBe(400)
    expect(relation.status).toBe(400)
  })

  it('applies `find.where` to every query', async () => {
    const app = setup(families({ find: { where: { published: true } } }))
    const list = await request(app, 'GET', '/api/families')
    const member = await request(app, 'GET', '/api/families/2')
    expect(names(list.json)).toEqual(['Akkurat', 'Circular'])
    expect(member.status).toBe(404)
  })
})

describe('member get', () => {
  const app = setup(families())

  it('answers the row as Dito does', async () => {
    const { status, json } = await request(app, 'GET', '/api/families/1')
    expect(status).toBe(200)
    expect(json).toMatchObject({
      id: 1,
      name: 'Akkurat',
      published: true,
      specs: { weight: 400, tags: ['grotesk'] },
      nameLength: 7,
      designers: [{ id: expect.any(Number), name: 'Ada' }]
    })
    // Relations to one row are objects, nested rows leave out their parent,
    // and relations to many rows that `find` leaves out aren't sent.
    const [set] = json.sets
    expect(set).toEqual({
      id: expect.any(Number),
      name: 'Regular',
      order: 0,
      defaultCut: null,
      cuts: [
        { id: expect.any(Number), name: 'Light', order: 0 },
        { id: expect.any(Number), name: 'Book', order: 1 }
      ]
    })
    expect(json).not.toHaveProperty('awards')
  })

  it('leaves out hidden properties', async () => {
    const { json } = await request(app, 'GET', '/api/families/1')
    expect(json).not.toHaveProperty('secret')
  })

  it('answers 404 for missing rows', async () => {
    const { status, json } = await request(app, 'GET', '/api/families/9')
    expect(status).toBe(404)
    expect(json).toMatchObject({ status: 404, title: 'Not Found' })
  })

  it('answers 404 for ids that are no valid primary key', async () => {
    for (const id of ['abc', '1.5', '1e3', '99999999999999999999']) {
      const { status } = await request(app, 'GET', `/api/families/${id}`)
      expect(status).toBe(404)
    }
  })
})

describe('fields', () => {
  it('narrows the properties of reads, with the ids', async () => {
    const app = setup(families())
    const list = await request(
      app,
      'GET',
      '/api/families?fields=name,sets.name'
    )
    const member = await request(app, 'GET', '/api/families/2?fields=name')
    expect(list.json[0]).toEqual({
      id: 1,
      name: 'Akkurat',
      sets: [
        { id: expect.any(Number), name: 'Regular' },
        { id: expect.any(Number), name: 'Mono' }
      ]
    })
    expect(member.json).toEqual({ id: 2, name: 'Brown' })
  })

  it('refuses fields outside the shape of `find`', async () => {
    const app = setup(families())
    const { status, json } = await request(
      app,
      'GET',
      '/api/families?fields=awards.name'
    )
    expect(status).toBe(400)
    expect(json.detail).toBe(`Invalid field 'awards.name'`)
  })

  it('can only narrow `find.fields`', async () => {
    const app = setup(
      families({
        find: { fields: ['name', 'notes'] },
        member: { allow: ['get'] }
      })
    )
    const all = await request(app, 'GET', '/api/families/1')
    const narrow = await request(app, 'GET', '/api/families/1?fields=notes')
    const wide = await request(app, 'GET', '/api/families/1?fields=published')
    expect(all.json).toEqual({ id: 1, name: 'Akkurat', notes: null })
    expect(narrow.json).toEqual({ id: 1, notes: null })
    expect(wide.status).toBe(400)
  })
})

describe('allow', () => {
  it('routes only the verbs in `allow` or the ones the controller defines', async () => {
    const app = setup(
      defineController({
        path: 'families',
        entity: Family,
        member: { get: (ctx, next) => next() }
      })
    )
    expect((await request(app, 'GET', '/api/families')).status).toBe(404)
    expect((await request(app, 'GET', '/api/families/1')).status).toBe(200)
    expect((await request(app, 'DELETE', '/api/families/1')).status).toBe(404)
  })
})

describe('writes', () => {
  const app = setup(families())

  it('creates with post, answers 201 and loads the shape', async () => {
    const { status, headers, json } = await request(
      app,
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
      sets: [{ name: 'Regular', cuts: [{ name: 'Bold' }] }]
    })
    // The database computes formulas, which only `refresh` loads.
    const saved = await request(app, 'GET', `/api/families/${json.id}`)
    expect(saved.json).toEqual({ ...json, nameLength: 3 })
  })

  it('writes nothing for a patch of the loaded graph', async () => {
    const { json: family } = await request(app, 'GET', '/api/families/1')
    const { status, json } = await request(
      app,
      'PATCH',
      '/api/families/1',
      family
    )
    expect(status).toBe(200)
    expect(json).toEqual(family)
  })

  it('saves nested changes in one patch', async () => {
    const { json: family } = await request(app, 'GET', '/api/families/1')
    const [regular, mono] = family.sets
    const { status, json } = await request(app, 'PATCH', '/api/families/1', {
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
    const saved = await request(app, 'GET', '/api/families/1')
    expect(saved.json).toEqual(json)
  })

  it('links relations to new rows with `#id` and `#ref`', async () => {
    const { json } = await request(app, 'PATCH', '/api/families/2', {
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
    expect(set.defaultCut).toEqual({ id: set.cuts[1].id })
  })

  it('refuses a reference to no new row', async () => {
    const { status, json } = await request(app, 'PATCH', '/api/families/2', {
      sets: [{ name: 'Regular', defaultCut: { '#ref': 'none' } }]
    })
    expect(status).toBe(400)
    expect(json.errors).toEqual({
      '/sets/0/defaultCut': [
        { message: `references the unknown new row 'none'` }
      ]
    })
  })

  it('refuses rows of another family, at the path of their id', async () => {
    const { json: other } = await request(app, 'GET', '/api/families/3')
    const { json: family } = await request(app, 'GET', '/api/families/1')
    const { status, json } = await request(app, 'PATCH', '/api/families/1', {
      sets: [...family.sets, { id: other.sets[0].id, name: 'Moved' }]
    })
    expect(status).toBe(400)
    expect(Object.keys(json.errors)).toEqual(['/sets/2/id'])
    const [set] = await sql('select family_id from font_set where id = ?', [
      other.sets[0].id
    ])
    expect(set.family_id).toBe(3)
  })

  it('answers validation errors by JSON Pointer', async () => {
    const { json: family } = await request(app, 'GET', '/api/families/1')
    const { status, headers, json } = await request(
      app,
      'PATCH',
      '/api/families/1',
      {
        name: 42,
        specs: { weight: 'heavy' },
        sets: [family.sets[0], { name: 7 }, { order: 2 }]
      }
    )
    expect(status).toBe(400)
    expect(headers.get('Content-Type')).toBe('application/problem+json')
    expect(json).toMatchObject({
      status: 400,
      title: 'Validation Failed',
      detail: 'The data is not valid.'
    })
    expect(Object.keys(json.errors).sort()).toEqual([
      '/name',
      '/sets/1/name',
      '/sets/2/name',
      '/specs/weight'
    ])
    expect(json.errors['/name']).toEqual([
      { message: expect.any(String), code: 'invalid_type' }
    ])
  })

  it('ignores read-only columns and unknown properties', async () => {
    const { status, json } = await request(app, 'PATCH', '/api/families/2', {
      published: true,
      nameLength: 1,
      id: 7,
      unknown: true
    })
    expect(status).toBe(200)
    expect(json).toMatchObject({ id: 2, published: false, nameLength: 5 })
  })

  it('answers 409 for a stale save', async () => {
    const { status, json } = await request(app, 'PATCH', '/api/families/1', {
      notes: 'Stale',
      updatedAt: '2000-01-01T00:00:00.000Z'
    })
    expect(status).toBe(409)
    expect(json.detail).toBe('A more recent version exists in the database.')
  })

  it('answers a unique violation with 409, and writes nothing', async () => {
    const { json: family } = await request(app, 'GET', '/api/families/1')
    const [regular] = family.sets
    const { status, json } = await request(app, 'PATCH', '/api/families/1', {
      notes: 'Changed',
      sets: [{ ...regular, cuts: [...regular.cuts, { name: 'Light' }] }]
    })
    expect(status).toBe(409)
    expect(json).toEqual({
      title: 'Conflict',
      status: 409,
      detail: 'The data conflicts with rows in the database.'
    })
    const saved = await request(app, 'GET', '/api/families/1')
    expect(saved.json.notes).toBe(null)
  })

  it('deletes and answers the count', async () => {
    const { status, json } = await request(app, 'DELETE', '/api/families/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from family where id = 3')).toEqual([])
    expect(await sql('select id from font_set where family_id = 3')).toEqual(
      []
    )
  })

  it('flushes writes without a transaction, also for results that are no rows', async () => {
    const app = setup(families({ transaction: false }))
    const { status, json } = await request(app, 'DELETE', '/api/families/3')
    expect(status).toBe(200)
    expect(json).toEqual({ count: 1 })
    expect(await sql('select id from family where id = 3')).toEqual([])
  })
})

describe('actions', () => {
  const app = setup(families())

  it('runs a member action on the loaded row, and flushes it', async () => {
    const { status, json } = await request(
      app,
      'POST',
      '/api/families/2/publish'
    )
    expect(status).toBe(400)
    expect(json.errors).toEqual({ '/sets': [{ message: 'has no sets' }] })
    const published = await request(app, 'POST', '/api/families/3/publish')
    expect(published.json).toMatchObject({ id: 3, published: true })
    const [row] = await sql('select published from family where id = 3')
    expect(row.published).toBe(true)
  })

  it('runs a collection action on the request entity manager', async () => {
    const { json } = await request(app, 'GET', '/api/families/names')
    expect(json).toEqual(['Akkurat', 'Brown', 'Circular'])
  })
})

describe('wrapping the default verbs', () => {
  it('checks the graph with relations the shape leaves out', async () => {
    const app = setup(
      families({
        member: {
          allow: ['patch'],
          async patch(ctx, next) {
            const family = (await next()) as Family
            await getEntityManager(ctx).populate(family, ['awards'])
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
    const short = await request(app, 'PATCH', '/api/families/1', {
      name: 'Ak'
    })
    expect(short.status).toBe(400)
    expect(short.json.errors).toEqual({
      '/name': [{ message: 'is too short for an award' }]
    })
    const [row] = await sql('select name from family where id = 1')
    expect(row.name).toBe('Akkurat')

    const { status, json } = await request(app, 'PATCH', '/api/families/1', {
      name: 'Akkurat Pro'
    })
    expect(status).toBe(200)
    expect(json.name).toBe('Akkurat Pro')
    expect(json).not.toHaveProperty('awards')
  })

  it('loads the member once through `ctx.member()`', async () => {
    const loaded: unknown[] = []
    const app = setup(
      families({
        member: {
          allow: ['patch'],
          async patch(ctx, next) {
            loaded.push(await ctx.member())
            const family = await next()
            loaded.push(family)
            return family
          }
        }
      })
    )
    await request(app, 'PATCH', '/api/families/1', { notes: 'Once' })
    expect(loaded[0]).toBeInstanceOf(Family)
    expect(loaded[1]).toBe(loaded[0])
  })
})

describe('refresh', () => {
  it('loads the rows again after the write when `refresh` is on', async () => {
    const stale = setup(families())
    const fresh = setup(families({ refresh: true }))
    const before = await request(stale, 'PATCH', '/api/families/2', {
      name: 'Brownish'
    })
    const after = await request(fresh, 'PATCH', '/api/families/2', {
      name: 'Brown Pro'
    })
    // The database computes the formula, so only a refresh shows it.
    expect(before.json).toMatchObject({ name: 'Brownish', nameLength: 5 })
    expect(after.json).toMatchObject({ name: 'Brown Pro', nameLength: 9 })
  })
})

describe('transactions', () => {
  it('rolls back the writes of a failed action', async () => {
    const app = setup(
      families({
        collection: {
          'post fail': async ctx => {
            const em = getEntityManager(ctx)
            em.create(Award, { name: 'Lost', family: 1 })
            await em.flush()
            throw new Error('Failed')
          }
        }
      })
    )
    const { status } = await request(app, 'POST', '/api/families/fail')
    expect(status).toBe(500)
    expect(await sql(`select id from award where name = 'Lost'`)).toEqual([])
  })

  it('gives reads the request fork and writes the transaction', async () => {
    const managers: Record<string, EntityManager> = {}
    const app = setup(
      families({
        collection: {
          'get check': ctx => {
            managers.get = ctx.db as EntityManager
            return {}
          },
          'post check': ctx => {
            managers.post = ctx.db as EntityManager
            return { transaction: !!managers.post.isInTransaction() }
          }
        }
      })
    )
    expect((await request(app, 'POST', '/api/families/check')).json).toEqual({
      transaction: true
    })
    await request(app, 'GET', '/api/families/check')
    expect(managers.get!.isInTransaction()).toBe(false)
    expect(managers.get).not.toBe(orm.em)
    expect(getEntityManager({ db: managers.get } as never)).toBe(
      managers.get
    )
  })
})

describe('assets', () => {
  let basePath: string
  let files: DiskStorage

  beforeAll(async () => {
    await sql(`create table if not exists asset (
      id serial primary key,
      key text not null unique,
      file text,
      storage text not null,
      count integer not null default 0,
      unreferenced_since timestamptz,
      created_at timestamptz,
      updated_at timestamptz
    )`)
  })

  beforeEach(async () => {
    basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-mikro-'))
    files = new DiskStorage({
      name: 'files',
      path: basePath,
      secret: 'secret',
      url: 'https://example.com/',
      nestedFolders: false
    })
  })

  afterEach(async () => {
    await sql('delete from asset')
    await fs.rm(basePath, { recursive: true, force: true })
  })

  const kysely = (ctx: Parameters<typeof getEntityManager>[0]) =>
    getEntityManager(ctx).getKysely() as unknown as Kysely<any>

  const setupAssets = () =>
    setup(
      families({
        features: [
          assets(
            [
              {
                table: 'family',
                column: 'documents',
                path: '',
                storage: 'files'
              }
            ],
            { storages: { files }, db: kysely }
          )
        ]
      })
    )

  it('takes signed files and signs the files it sends', async () => {
    const added = await files.addFile(
      { key: 'specimen.pdf', name: 'specimen.pdf' },
      Buffer.from('%PDF')
    )
    const signed = { ...added }
    files.signAssetFile(signed)
    await insertAsset(orm.em.fork().getKysely() as never, added, files)
    const { status, json } = await request(
      setupAssets(),
      'PATCH',
      '/api/families/1',
      { documents: [signed] }
    )
    expect(status).toBe(200)
    expect(json.documents).toMatchObject([
      { key: 'specimen.pdf', signature: expect.any(String) }
    ])
    const [row] = await sql('select documents from family where id = 1')
    expect(row.documents).toEqual([
      expect.not.objectContaining({ signature: expect.anything() })
    ])
    const [asset] = await sql('select unreferenced_since from asset')
    expect(asset.unreferenced_since).toBe(null)
  })

  it('refuses forged signatures, and writes nothing', async () => {
    const { status, json } = await request(
      setupAssets(),
      'PATCH',
      '/api/families/1',
      {
        notes: 'Forged',
        documents: [{ key: 'a.pdf', name: 'a.pdf', signature: 'forged' }]
      }
    )
    expect(status).toBe(400)
    expect(json.detail).toBe(`Invalid asset signature for file 'a.pdf'`)
    const [row] = await sql('select notes from family where id = 1')
    expect(row.notes).toBe(null)
  })
})
