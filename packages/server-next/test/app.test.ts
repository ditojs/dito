import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import {
  action,
  createApp,
  createValidationError,
  defineController,
  defineFeature,
  ProblemError,
  problemResponse,
  toDitoErrors,
  withBase,
  type AppConfig,
  type ControllerDefinition,
  type DitoEnv,
  type Transaction,
  type User
} from '../src/index.ts'

const admin: User = { id: 1, roles: ['admin'] }
const editor: User = { id: 2, roles: ['editor'] }

function setup(
  controllers: ControllerDefinition[],
  { user = admin, ...config }: Partial<AppConfig> & { user?: User | null } = {}
) {
  const app = createApp({
    base: '/api',
    controllers,
    getUser: async () => user,
    ...config
  })
  // The handlers an app sets. `RangeError` stands for an error of the app.
  app.onError((error, c) =>
    problemResponse(
      error instanceof RangeError
        ? new ProblemError({
            status: 422,
            title: 'Out of Range',
            detail: error.message
          })
        : error,
      c
    )
  )
  app.notFound(c => problemResponse(new ProblemError({ status: 404 }), c))
  return app
}

// A transaction that records its steps instead of opening one.
function createTransaction() {
  const log: string[] = []
  const transaction: Transaction = async (c, fn) => {
    log.push('begin')
    c.set('trx', 'trx')
    try {
      const result = await fn()
      log.push('commit')
      return result
    } catch (error) {
      log.push('rollback')
      throw error
    }
  }
  return { transaction, log }
}

const request = (
  app: ReturnType<typeof setup>,
  method: string,
  path: string,
  body?: unknown
) =>
  app.request(path, {
    method,
    ...(body !== undefined && {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
  })

describe('routing', () => {
  it('routes default verbs and actions with paths', async () => {
    const app = setup([
      defineController({
        path: 'fonts',
        collection: {
          'get': () => ['list'],
          'post': () => ({ id: 1 }),
          'get count': () => ({ count: 2 })
        },
        member: {
          'get': c => ({ id: c.var.memberId }),
          'post publish': c => ({ published: c.var.memberId })
        }
      })
    ])
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toEqual([
      'list'
    ])
    const created = await request(app, 'POST', '/api/fonts')
    expect(created.status).toBe(201)
    expect(
      await (await request(app, 'GET', '/api/fonts/count')).json()
    ).toEqual({ count: 2 })
    expect(await (await request(app, 'GET', '/api/fonts/7')).json()).toEqual({
      id: 7
    })
    expect(
      await (await request(app, 'POST', '/api/fonts/7/publish')).json()
    ).toEqual({ published: 7 })
    const missing = await request(app, 'GET', '/api/fonts/abc')
    expect(missing.status).toBe(404)
    expect(missing.headers.get('Content-Type')).toBe('application/problem+json')
  })

  it('sets the action on the context', async () => {
    const app = setup([
      { path: 'fonts', member: { 'post publish': c => c.var.action } }
    ])
    expect(
      await (await request(app, 'POST', '/api/fonts/1/publish')).json()
    ).toEqual({
      controller: 'fonts',
      on: 'member',
      name: 'post publish',
      verb: 'post'
    })
  })

  it('routes only the default verbs in `allow`', async () => {
    const base = defineFeature({
      collection: { get: () => 'list', post: () => 'created' },
      member: { get: () => 'row', patch: () => 'patched', delete: () => 'gone' }
    })
    const app = setup([
      withBase(base, {
        path: 'fonts',
        collection: { allow: ['get'] },
        member: { allow: ['get', 'patch'] }
      })
    ])
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(200)
    expect((await request(app, 'POST', '/api/fonts')).status).toBe(404)
    expect((await request(app, 'PATCH', '/api/fonts/1')).status).toBe(200)
    expect((await request(app, 'DELETE', '/api/fonts/1')).status).toBe(404)
  })

  it('routes every default verb without `allow`', async () => {
    const base = defineFeature({ member: { delete: () => 'gone' } })
    const app = setup([withBase(base, { path: 'fonts' })])
    expect((await request(app, 'DELETE', '/api/fonts/1')).status).toBe(200)
  })

  it('lets the last layer set `allow`', async () => {
    const base = defineFeature({
      collection: { allow: ['get'], get: () => 'list', post: () => 'new' }
    })
    const app = setup([
      withBase(base, { path: 'fonts', collection: { allow: ['get', 'post'] } })
    ])
    expect((await request(app, 'POST', '/api/fonts')).status).toBe(201)
  })

  it(`routes only the defined verbs with \`allow: 'defined'\``, async () => {
    const base = defineFeature({
      collection: { get: () => 'list', post: () => 'created' },
      member: { get: () => 'row', patch: () => 'patched', delete: () => 'gone' }
    })
    const feature = defineFeature({ member: { patch: (c, next) => next() } })
    const app = setup([
      withBase(
        base,
        {
          path: 'fonts',
          use: [feature],
          collection: { get: (c, next) => next() }
        },
        { allow: 'defined' }
      ),
      withBase(
        base,
        { path: 'all', collection: { allow: ['*'] }, member: { allow: ['*'] } },
        { allow: 'defined' }
      )
    ])
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(200)
    expect((await request(app, 'POST', '/api/fonts')).status).toBe(404)
    expect((await request(app, 'GET', '/api/fonts/1')).status).toBe(404)
    expect((await request(app, 'PATCH', '/api/fonts/1')).status).toBe(200)
    expect((await request(app, 'DELETE', '/api/fonts/1')).status).toBe(404)
    expect((await request(app, 'POST', '/api/all')).status).toBe(201)
    expect((await request(app, 'DELETE', '/api/all/1')).status).toBe(200)
  })

  it('routes a default verb the controller defines outside `allow`', async () => {
    const base = defineFeature({
      collection: { get: () => 'list', post: () => 'created' },
      member: { get: () => 'row', delete: () => 'gone' }
    })
    const app = setup([
      withBase(base, {
        path: 'fonts',
        collection: { allow: ['get'], post: (c, next) => next() },
        member: { allow: ['get'] }
      })
    ])
    expect((await request(app, 'POST', '/api/fonts')).status).toBe(201)
    expect((await request(app, 'DELETE', '/api/fonts/1')).status).toBe(404)
  })
})

describe('composition', () => {
  it('wraps base, feature and controller through `next`', async () => {
    const base = defineFeature({
      member: { get: c => ({ id: c.var.memberId, from: ['base'] }) }
    })
    const feature = defineFeature({
      member: {
        get: async (c, next) => {
          const row = (await next()) as { from: string[] }
          return { ...row, from: [...row.from, 'feature'] }
        }
      }
    })
    const app = setup([
      withBase(base, {
        path: 'fonts',
        use: [feature],
        member: {
          get: async (c, next) => {
            const row = (await next()) as { from: string[] }
            return { ...row, from: [...row.from, 'controller'] }
          }
        }
      })
    ])
    expect(await (await request(app, 'GET', '/api/fonts/3')).json()).toEqual({
      id: 3,
      from: ['base', 'feature', 'controller']
    })
  })

  it('throws when two features define the same action', () => {
    const one = defineFeature({ member: { 'post publish': () => 1 } })
    const two = defineFeature({ member: { 'post publish': () => 2 } })
    expect(() => setup([{ path: 'fonts', use: [one, two] }])).toThrow(
      `'post publish' is defined by two features in the member of 'fonts'`
    )
  })

  it('takes slots from the last layer', async () => {
    const base = defineFeature({
      load: async () => 'base',
      member: { get: c => c.var.load() }
    })
    const feature = defineFeature({ load: async () => 'feature' })
    const app = setup([withBase(base, { path: 'fonts', use: [feature] })])
    expect(await (await request(app, 'GET', '/api/fonts/1')).json()).toBe(
      'feature'
    )
  })

  it('runs `around` in layer order, then the action', async () => {
    const order: string[] = []
    const around = (name: string) => async (_c: unknown, next: () => any) => {
      order.push(`${name} in`)
      await next()
      order.push(`${name} out`)
    }
    const base = defineFeature({ around: around('base') })
    const feature = defineFeature({ around: around('feature') })
    const app = setup([
      withBase(base, {
        path: 'fonts',
        use: [feature],
        around: around('controller'),
        collection: {
          get: {
            around: [around('action')],
            handler: () => {
              order.push('handler')
              return []
            }
          }
        }
      })
    ])
    await request(app, 'GET', '/api/fonts')
    expect(order).toEqual([
      'base in',
      'feature in',
      'controller in',
      'action in',
      'handler',
      'action out',
      'controller out',
      'feature out',
      'base out'
    ])
  })

  it('lets `around` replace the response', async () => {
    const app = setup([
      {
        path: 'fonts',
        around: async c => c.json('cached'),
        collection: { get: () => 'fresh' }
      }
    ])
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toBe(
      'cached'
    )
  })
})

describe('authorize', () => {
  const controller = (def: Partial<ControllerDefinition> = {}) =>
    defineController({
      path: 'fonts',
      authorize: ['admin'],
      collection: { get: () => [] },
      ...def
    })

  it('answers 401 without a user and 403 without a role', async () => {
    const anonymous = setup([controller()], { user: null })
    const response = await request(anonymous, 'GET', '/api/fonts')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      title: 'Unauthorized',
      status: 401
    })
    const app = setup([controller()], { user: editor })
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(403)
  })

  it('grants access with any of the roles', async () => {
    const app = setup([controller({ authorize: ['admin', 'editor'] })], {
      user: editor
    })
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(200)
  })

  it('denies access with `false`', async () => {
    const app = setup([controller({ authorize: false })])
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(403)
  })

  it('calls a function with the context', async () => {
    const app = setup(
      [controller({ authorize: c => c.req.header('X-Key') === 'yes' })],
      { user: null }
    )
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(401)
    const response = await app.request('/api/fonts', {
      headers: { 'X-Key': 'yes' }
    })
    expect(response.status).toBe(200)
  })

  it('grants `$owner` access to the owner of the member', async () => {
    const app = setup(
      [
        controller({
          authorize: ['admin', '$owner'],
          owner: async c => String(c.var.memberId),
          member: { get: () => 'row' }
        })
      ],
      { user: editor }
    )
    expect((await request(app, 'GET', '/api/fonts/2')).status).toBe(200)
    expect((await request(app, 'GET', '/api/fonts/3')).status).toBe(403)
  })

  it('lets an action override the controller', async () => {
    const base = defineFeature({ authorize: true })
    const app = setup(
      [
        withBase(base, {
          path: 'fonts',
          authorize: ['admin'],
          collection: {
            'get': () => [],
            'get public': { authorize: true, handler: () => [] }
          }
        })
      ],
      { user: null }
    )
    expect((await request(app, 'GET', '/api/fonts')).status).toBe(401)
    expect((await request(app, 'GET', '/api/fonts/public')).status).toBe(200)
  })
})

describe('validation', () => {
  it('validates the query and the body', async () => {
    const app = setup([
      {
        path: 'fonts',
        member: {
          patch: action({
            query: z.object({ draft: z.enum(['yes', 'no']) }),
            body: z.object({
              sets: z.array(z.object({ name: z.string() }))
            }),
            handler: c => {
              expectTypeOf(c.req.valid('query')).toEqualTypeOf<{
                draft: 'yes' | 'no'
              }>()
              expectTypeOf(c.req.valid('json').sets).toEqualTypeOf<
                { name: string }[]
              >()
              return {
                draft: c.req.valid('query').draft,
                names: c.req.valid('json').sets.map(set => set.name)
              }
            }
          })
        }
      }
    ])
    const valid = await request(app, 'PATCH', '/api/fonts/1?draft=yes', {
      sets: [{ name: 'Regular' }]
    })
    expect(await valid.json()).toEqual({ draft: 'yes', names: ['Regular'] })

    const query = await request(app, 'PATCH', '/api/fonts/1?draft=maybe', {
      sets: []
    })
    expect(query.status).toBe(400)
    expect((await query.json()).errors).toEqual({
      '/draft': [{ message: expect.any(String), keyword: 'invalid_value' }]
    })

    const body = await request(app, 'PATCH', '/api/fonts/1?draft=no', {
      sets: [{ name: 'Regular' }, { name: 8 }]
    })
    expect(body.status).toBe(400)
    expect(body.headers.get('Content-Type')).toBe('application/problem+json')
    expect(await body.json()).toEqual({
      title: 'Validation Failed',
      status: 400,
      detail: 'The body is not valid.',
      errors: {
        '/sets/1/name': [
          { message: expect.any(String), keyword: 'invalid_type' }
        ]
      }
    })
  })

  it(`answers in Dito 6's shape with \`errors: 'dito'\``, async () => {
    const app = setup(
      [
        {
          path: 'fonts',
          member: {
            patch: action({
              query: z.object({ draft: z.enum(['yes', 'no']).optional() }),
              body: z.object({
                sets: z.array(z.object({ name: z.string() }))
              }),
              handler: () => 'ok'
            })
          }
        }
      ],
      { errors: 'dito' }
    )
    const body = await request(app, 'PATCH', '/api/fonts/1', {
      sets: [{ name: 'Regular' }, { name: 8 }]
    })
    expect(body.status).toBe(400)
    expect(await body.json()).toEqual({
      title: 'Bad Request',
      status: 400,
      type: 'ParameterValidation',
      message: 'The provided action parameters are not valid',
      detail: 'The provided action parameters are not valid',
      errors: {
        'sets/1/name': [
          { message: expect.any(String), keyword: 'invalid_type' }
        ]
      }
    })
    const query = await request(app, 'PATCH', '/api/fonts/1?draft=maybe', {
      sets: []
    })
    expect((await query.json()).errors).toEqual({
      draft: [{ message: expect.any(String), keyword: 'invalid_value' }]
    })
  })

  it('creates validation errors in both formats', () => {
    const issues = [
      { message: 'is taken', path: ['sets', { key: 8 }, 'name'] },
      { message: 'is empty', path: [], code: 'too_small' }
    ]
    expect(toDitoErrors(issues)).toEqual({
      'sets/8/name': [{ message: 'is taken' }],
      '': [{ message: 'is empty', keyword: 'too_small' }]
    })
    expect(
      createValidationError('model', issues, { format: 'dito' }).toProblem()
    ).toMatchObject({
      status: 400,
      type: 'ModelValidation',
      message: 'The provided data is not valid'
    })
    expect(createValidationError('model', issues).toProblem()).toEqual({
      title: 'Validation Failed',
      status: 400,
      detail: 'The data is not valid.',
      errors: {
        '/sets/8/name': [{ message: 'is taken' }],
        '': [{ message: 'is empty', keyword: 'too_small' }]
      }
    })
  })

  it('parses the body once, as the same value each time', async () => {
    const app = setup([
      {
        path: 'fonts',
        collection: {
          post: async c => {
            const body = await c.var.body()
            body.changed = true
            return { same: body === (await c.var.body()), body }
          },
          get: async c => ({ body: (await c.var.body()) ?? null })
        }
      }
    ])
    expect(
      await (await request(app, 'POST', '/api/fonts', { name: 'A' })).json()
    ).toEqual({ same: true, body: { name: 'A', changed: true } })
    expect(await (await request(app, 'POST', '/api/fonts')).json()).toEqual({
      same: true,
      body: { changed: true }
    })
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toEqual({
      body: null
    })
    const invalid = await app.request('/api/fonts', {
      method: 'POST',
      body: '{"name":',
      headers: { 'Content-Type': 'application/json' }
    })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({
      title: 'Bad Request',
      status: 400,
      detail: 'The body is invalid JSON.'
    })
  })

  it('returns the validated body with a schema', async () => {
    const app = setup([
      {
        path: 'fonts',
        collection: {
          post: action({
            body: z.object({ name: z.string().trim() }),
            handler: async c => {
              const body = await c.var.body()
              return { same: body === c.req.valid('json'), body }
            }
          })
        }
      }
    ])
    expect(
      await (
        await request(app, 'POST', '/api/fonts', { name: ' A ', other: 1 })
      ).json()
    ).toEqual({ same: true, body: { name: 'A' } })
  })

  it('validates no body without a schema', async () => {
    const app = setup([{ path: 'fonts', member: { patch: () => 'ok' } }])
    expect((await request(app, 'PATCH', '/api/fonts/1', [1])).status).toBe(200)
  })
})

describe('transactions', () => {
  it('runs writes in a transaction, but not reads', async () => {
    const { transaction, log } = createTransaction()
    const app = setup(
      [
        {
          path: 'fonts',
          around: async (c, next) => {
            log.push(`around ${c.var.trx ?? 'none'}`)
            await next()
          },
          collection: {
            'get': c => c.var.trx ?? null,
            'post': c => c.var.trx,
            'get fresh': { transacted: true, handler: c => c.var.trx },
            'post log': { transacted: false, handler: () => null }
          }
        }
      ],
      { transaction }
    )
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toBe(null)
    expect(log).toEqual(['around none'])
    log.length = 0
    expect(await (await request(app, 'POST', '/api/fonts')).json()).toBe('trx')
    expect(log).toEqual(['begin', 'around trx', 'commit'])
    log.length = 0
    expect(await (await request(app, 'GET', '/api/fonts/fresh')).json()).toBe(
      'trx'
    )
    expect(log).toEqual(['begin', 'around trx', 'commit'])
    log.length = 0
    await request(app, 'POST', '/api/fonts/log')
    expect(log).toEqual(['around none'])
  })

  it('rolls back when the handler throws', async () => {
    const { transaction, log } = createTransaction()
    const app = setup(
      [
        {
          path: 'fonts',
          // Plain Hono middleware sees the error in `c.error` after `next()`.
          around: async (c, next) => {
            await next()
            log.push(`around ${c.error?.message}`)
          },
          collection: {
            post: () => {
              throw new RangeError('Too wide')
            }
          }
        }
      ],
      { transaction }
    )
    const response = await request(app, 'POST', '/api/fonts')
    expect(log).toEqual(['begin', 'around Too wide', 'rollback'])
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      title: 'Out of Range',
      status: 422,
      detail: 'Too wide'
    })
  })

  it('sets `c.var.db` from `connect`, and to the transaction in one', async () => {
    const log: string[] = []
    const transaction: Transaction = async (c, fn) => {
      c.set('trx', 'trx')
      const result = await fn()
      log.push(`after ${c.var.db}`)
      return result
    }
    const connect = vi.fn(c => `db ${c.req.method}`)
    const app = setup(
      [
        {
          path: 'fonts',
          collection: { get: c => c.var.db, post: c => c.var.db }
        }
      ],
      { transaction, connect }
    )
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toBe(
      'db GET'
    )
    expect(await (await request(app, 'POST', '/api/fonts')).json()).toBe('trx')
    expect(log).toEqual(['after db POST'])
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('runs the middleware of a parent app first', async () => {
    const parent = new Hono<DitoEnv>()
    parent.use(async (c, next) => {
      c.set('trx', 'em')
      await next()
    })
    parent.route(
      '/',
      setup([{ path: 'fonts', collection: { get: c => c.var.trx } }], {
        getUser: async c => ({ id: String(c.var.trx), roles: [] })
      })
    )
    const response = await parent.request('/api/fonts')
    expect(await response.json()).toBe('em')
  })
})

describe('load', () => {
  it('calls the `load` slot once per request', async () => {
    const load = vi.fn(async (_c, id: number) => ({ id }))
    const app = setup([
      {
        path: 'fonts',
        load,
        member: {
          get: async c => {
            const [one, two] = await Promise.all([c.var.load(), c.var.load()])
            return { same: one === two, row: await c.var.load() }
          }
        }
      }
    ])
    expect(await (await request(app, 'GET', '/api/fonts/5')).json()).toEqual({
      same: true,
      row: { id: 5 }
    })
    expect(load).toHaveBeenCalledTimes(1)
    await request(app, 'GET', '/api/fonts/6')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('answers 404 when nothing loads', async () => {
    const app = setup([
      {
        path: 'fonts',
        load: async () => null,
        member: { get: c => c.var.load() }
      }
    ])
    const response = await request(app, 'GET', '/api/fonts/5')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ title: 'Not Found', status: 404 })
  })
})

describe('results', () => {
  class Row {
    id: number
    constructor(id: number) {
      this.id = id
    }
  }

  const rows = defineFeature({
    isRow: value => value instanceof Row,
    toJSON: (_c, row) => ({ id: (row as Row).id, json: true })
  })

  it('sends a Response unchanged and undefined as 204', async () => {
    const app = setup([
      {
        path: 'fonts',
        collection: {
          'get text': c => c.text('plain'),
          'post': () => undefined
        }
      }
    ])
    expect(await (await request(app, 'GET', '/api/fonts/text')).text()).toBe(
      'plain'
    )
    const empty = await request(app, 'POST', '/api/fonts')
    expect(empty.status).toBe(204)
    expect(await empty.text()).toBe('')
  })

  it('runs `finish` once on every result, before `toJSON`', async () => {
    const order: string[] = []
    const finish = vi.fn((c, result: unknown) => {
      order.push('finish')
      if (result === 'replace') return new Row(9)
    })
    const app = setup([
      withBase(
        { ...rows, finish },
        {
          path: 'fonts',
          serialize: (_c, _row, json) => {
            order.push('serialize')
            return json
          },
          collection: {
            'get': () => [new Row(1)],
            'get replace': () => 'replace',
            'post': () => undefined
          }
        }
      )
    ])
    await request(app, 'GET', '/api/fonts')
    expect(order).toEqual(['finish', 'serialize'])
    expect(finish).toHaveBeenLastCalledWith(expect.anything(), [new Row(1)])
    expect(
      await (await request(app, 'GET', '/api/fonts/replace')).json()
    ).toEqual({ id: 9, json: true })
    expect((await request(app, 'POST', '/api/fonts')).status).toBe(204)
    expect(finish).toHaveBeenLastCalledWith(expect.anything(), undefined)
    expect(finish).toHaveBeenCalledTimes(3)
  })

  it('runs `finish` inside the transaction and `around`', async () => {
    const { transaction, log } = createTransaction()
    const app = setup(
      [
        {
          path: 'fonts',
          around: async (_c, next) => {
            log.push('around in')
            await next()
            log.push('around out')
          },
          finish: c => {
            log.push(`finish ${c.var.trx}`)
          },
          collection: { post: () => ({}) }
        }
      ],
      { transaction }
    )
    await request(app, 'POST', '/api/fonts')
    expect(log).toEqual([
      'begin',
      'around in',
      'finish trx',
      'around out',
      'commit'
    ])
  })

  it('serializes rows through `toJSON` and the `serialize` chain', async () => {
    const feature = defineFeature({
      serialize: (_c, row, json) => ({ ...json, feature: row.id })
    })
    const app = setup([
      withBase(rows, {
        path: 'fonts',
        use: [feature],
        serialize: async (_c, _row, json) => ({ ...json, controller: true }),
        collection: {
          'get': () => [new Row(1), 'other'],
          'get page': () => ({ results: [new Row(2)], total: 9 }),
          'get plain': () => ({ id: 3 }),
          'post': () => new Row(4)
        }
      })
    ])
    const json = (id: number) => ({
      id,
      json: true,
      feature: id,
      controller: true
    })
    expect(await (await request(app, 'GET', '/api/fonts')).json()).toEqual([
      json(1),
      'other'
    ])
    expect(
      await (await request(app, 'GET', '/api/fonts/page')).json()
    ).toEqual({ results: [json(2)], total: 9 })
    expect(
      await (await request(app, 'GET', '/api/fonts/plain')).json()
    ).toEqual({ id: 3 })
    const created = await request(app, 'POST', '/api/fonts')
    expect(created.status).toBe(201)
    expect(await created.json()).toEqual(json(4))
  })
})

describe('errors', () => {
  const app = setup([
    {
      path: 'fonts',
      collection: {
        'get problem': () => {
          throw new ProblemError({
            status: 409,
            detail: 'The name is taken.',
            errors: { '/name': [{ message: 'Taken' }] }
          })
        },
        'get http': () => {
          throw new HTTPException(418, { message: 'Teapot' })
        },
        'get crash': () => {
          throw new Error('Secret internals')
        }
      }
    }
  ])

  it('answers ProblemError and HTTPException as Problem Details', async () => {
    expect(
      await (await request(app, 'GET', '/api/fonts/problem')).json()
    ).toEqual({
      title: 'Conflict',
      status: 409,
      detail: 'The name is taken.',
      errors: { '/name': [{ message: 'Taken' }] }
    })
    const http = await request(app, 'GET', '/api/fonts/http')
    expect(http.status).toBe(418)
    expect(await http.json()).toEqual({
      title: 'Client Error',
      status: 418,
      detail: 'Teapot'
    })
  })

  it('answers other errors as 500 without internals', async () => {
    const response = await request(app, 'GET', '/api/fonts/crash')
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).not.toContain('Secret')
    expect(JSON.parse(text)).toEqual({
      title: 'Internal Server Error',
      status: 500
    })
  })

  it('logs nothing on a 500', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await request(app, 'GET', '/api/fonts/crash')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('sends the response of an HTTPException unchanged', async () => {
    const app = setup([
      {
        path: 'fonts',
        collection: {
          get: () => {
            throw new HTTPException(401, {
              res: new Response('Sign in', { status: 401 })
            })
          }
        }
      }
    ])
    const response = await request(app, 'GET', '/api/fonts')
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Sign in')
  })
})
