import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import {
  action,
  createApi,
  createValidationError,
  defineController,
  defineMixin,
  errorHandler,
  hostMiddleware,
  HttpError,
  notFound,
  sendFile,
  type ActionSettings,
  type ApiConfig,
  type ControllerDefinition,
  type DbAdapter,
  type DitoContext,
  type DitoInput,
  type Middleware,
  type MixinDefinition,
  type Transaction,
  type User
} from '../src/index.ts'
import * as zodModule from '../src/zod.ts'
import { createClient } from '../../../tests/utils/client.ts'

declare module '../src/index.ts' {
  interface DitoVariables {
    session?: string
  }
}

const admin: User = { id: 1, roles: ['admin'] }
const editor: User = { id: 2, roles: ['editor'] }

interface SetupOptions extends Partial<ApiConfig>, DbAdapter {
  user?: User | null
}

// The host app, which routes the API below `/api`. `connect` and
// `transaction` go to the `db` adapter, whose `toHttpError()` maps
// `RangeError`, which stands for an error of the ORM.
function setup(
  controllers: ControllerDefinition[],
  { user = admin, connect, transaction, ...config }: SetupOptions = {}
) {
  const app = new Hono()
  app.route(
    '/api',
    createApi({
      controllers,
      getUser: async () => user,
      db: {
        connect,
        transaction,
        toHttpError: error =>
          error instanceof RangeError
            ? new HttpError(422, { type: 'OutOfRange', message: error.message })
            : undefined
      },
      onError: () => {},
      ...config
    })
  )
  app.onError(errorHandler())
  app.notFound(notFound)
  return app
}

// A transaction that records its steps instead of opening one. It sets
// `c.var.db` to 'trx' during `fn`.
function createTransaction() {
  const log: string[] = []
  const transaction: Transaction = async (c, fn) => {
    log.push('begin')
    const { db } = c.var
    c.set('db', 'trx')
    try {
      const result = await fn()
      log.push('commit')
      return result
    } catch (error) {
      log.push('rollback')
      throw error
    } finally {
      c.set('db', db)
    }
  }
  return { transaction, log }
}

const request = (
  app: Hono,
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit
) => createClient(app.fetch).request(method, path, body, init)

const json = async (
  app: Hono,
  method: string,
  path: string,
  body?: unknown
) => (await request(app, method, path, body)).data

describe('routing', () => {
  it('matches static segments first, also across controllers', async () => {
    const api = setup([
      { path: 'fonts', actions: { 'get :id': () => 'font' } },
      { path: 'fonts/popular', actions: { get: () => 'popular' } }
    ])
    expect(await json(api, 'GET', '/api/fonts/popular')).toBe('popular')
    expect(await json(api, 'GET', '/api/fonts/1')).toBe('font')
  })

  it('sets the action in `c.var` before its middleware', async () => {
    const seen: unknown[] = []
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        middleware: async (c, next) => {
          seen.push(c.var.action)
          await next()
        },
        actions: {
          'post :id/publish': ({ action }) => action
        }
      }
    ])
    const key = 'post :id/publish'
    expect(await json(api, 'POST', '/api/fonts/1/publish')).toBe(key)
    expect(seen).toEqual([key])
  })

  it('routes default verbs and actions with paths', async () => {
    const api = setup([
      defineController({
        path: 'fonts',
        authorize: true,
        actions: {
          'get': () => ['list'],
          'post': () => ({ id: 1 }),
          'get count': () => ({ count: 2 }),
          'get :id': ({ params: { id } }) => ({ id }),
          'post :id/publish': ({ params }) => ({ published: params.id })
        }
      })
    ])
    expect(await json(api, 'GET', '/api/fonts')).toEqual(['list'])
    expect((await request(api, 'POST', '/api/fonts')).status).toBe(200)
    expect(await json(api, 'GET', '/api/fonts/count')).toEqual({ count: 2 })
    expect(await json(api, 'GET', '/api/fonts/7')).toEqual({ id: '7' })
    expect(await json(api, 'POST', '/api/fonts/7/publish')).toEqual({
      published: '7'
    })
  })

  it('passes any id to the member actions as a string', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'get :id': ({ params: { id } }) => ({ id }),
          'post :id/publish': ({ params: { id } }) => ({ id })
        }
      }
    ])
    for (const id of ['abc', '1.5', 'x']) {
      expect(await json(api, 'GET', `/api/fonts/${id}`)).toEqual({ id })
    }
    expect(await json(api, 'POST', '/api/fonts/a/publish')).toEqual({
      id: 'a'
    })
  })

  it('leaves unknown paths to the app', async () => {
    const app = new Hono()
    app.route(
      '/',
      createApi({
        controllers: [{ path: 'reset', actions: { get: () => 'reset' } }]
      })
    )
    app.get('/page', c => c.text('page'))
    // Hono sends the errors of `notFound()` to `onError()`.
    app.onError(errorHandler())
    app.notFound(notFound)
    expect(await (await app.request('/reset')).json()).toBe('reset')
    expect(await (await app.request('/page')).text()).toBe('page')
    const response = await app.request('/reset/1')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ message: 'Not Found', status: 404 })
  })

  it('answers the routes of deeper APIs first', async () => {
    const app = new Hono()
    const api = (name: string) =>
      createApi({
        controllers: [{ path: 'items', actions: { get: () => name } }]
      })
    app.route('/api/admin', api('admin'))
    app.route('/api', api('main'))
    expect(await (await app.request('/api/admin/items')).json()).toBe('admin')
    expect(await (await app.request('/api/items')).json()).toBe('main')
    expect((await app.request('/api/admin/other')).status).toBe(404)
  })

  it('answers HEAD as GET without a body', async () => {
    const handler = vi.fn(({ c }: DitoInput) => {
      c.header('X-Total', '2')
      return ['a', 'b']
    })
    const api = setup([{ path: 'fonts', actions: { get: handler } }])
    const response = await request(api, 'HEAD', '/api/fonts')
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Total')).toBe('2')
    expect(response.data).toBeUndefined()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('matches parameters with a pattern before plain parameters', async () => {
    const api = setup([
      {
        path: 'books',
        authorize: true,
        actions: {
          'get :slug': ({ params: { slug } }) => ({ slug }),
          'get :id{[0-9]+}': ({ params: { id } }) => ({ id })
        }
      }
    ])
    expect(await json(api, 'GET', '/api/books/12')).toEqual({ id: '12' })
    expect(await json(api, 'GET', '/api/books/emma')).toEqual({ slug: 'emma' })
  })

  it('matches static segments before parameters', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'get :id': ({ params: { id } }) => ({ id }),
          'get :id/:file': ({ params }) => params,
          'get subscribe': ({ params: { id } }) => ({
            subscribe: true,
            id: id ?? null
          }),
          'get :id/files': () => 'files',
          'get :id/:path{.+}': ({ params }) => params,
          'post :id': () => 'post',
          'post subscribe': () => 'subscribe'
        }
      }
    ])
    expect(await json(api, 'GET', '/api/fonts/subscribe')).toEqual({
      subscribe: true,
      id: null
    })
    expect(await json(api, 'GET', '/api/fonts/3')).toEqual({ id: '3' })
    expect(await json(api, 'GET', '/api/fonts/3/files')).toBe('files')
    expect(await json(api, 'GET', '/api/fonts/3/a')).toEqual({
      id: '3',
      file: 'a'
    })
    expect(await json(api, 'GET', '/api/fonts/3/a/b.otf')).toEqual({
      id: '3',
      path: 'a/b.otf'
    })
    expect(await json(api, 'POST', '/api/fonts/subscribe')).toBe('subscribe')
  })

  it('routes the parameters of the controller path', async () => {
    const api = setup([
      defineController({
        path: 'pages/:pageId/child-pages',
        actions: {
          'get': ({ params }) => params,
          'get :id': ({ params }) => params
        }
      })
    ])
    expect(await json(api, 'GET', '/api/pages/3/child-pages')).toEqual({
      pageId: '3'
    })
    expect(await json(api, 'GET', '/api/pages/3/child-pages/4')).toEqual({
      pageId: '3',
      id: '4'
    })
  })

  it('throws for empty segments in the controller path', () => {
    for (const path of ['', '/fonts', 'fonts/', 'fonts//by-name']) {
      expect(() => setup([{ path, actions: { get: () => 'list' } }])).toThrow(
        `Invalid path '${path}'`
      )
    }
  })

  it('throws for `:id` in the controller path', () => {
    expect(() =>
      setup([{ path: 'pages/:id/children', actions: { get: () => [] } }])
    ).toThrow("The path 'pages/:id/children' holds `:id`")
  })

  it('throws for two actions of the same method and path', () => {
    expect(() =>
      setup([
        { path: 'fonts', actions: { 'get :id': () => 1 } },
        { path: 'fonts', actions: { 'get :id': () => 2 } }
      ])
    ).toThrow('Two actions route GET /fonts/:id')
    expect(() =>
      setup([
        { path: 'fonts', actions: { 'get by/:name': () => 1 } },
        { path: 'fonts/by', actions: { 'get :key': () => 2 } }
      ])
    ).toThrow('Two actions route GET /fonts/by/:key')
    expect(() =>
      setup([
        { path: 'fonts', actions: { 'get files/:path{.+}': () => 1 } },
        { path: 'fonts/files', actions: { 'get :name{.+}': () => 2 } }
      ])
    ).toThrow('Two actions route GET /fonts/files/:name{.+}')
    expect(() =>
      setup([
        { path: 'fonts', actions: { 'get files/:path{.+}': () => 1 } },
        { path: 'fonts/files', actions: { 'get :name': () => 2 } }
      ])
    ).not.toThrow()
  })

  it('throws for invalid keys', () => {
    expect(() =>
      setup([{ path: 'fonts', actions: { fetch: () => 1 } as never }])
    ).toThrow(`Invalid action 'fetch' in 'fonts'`)
    for (const key of ['get /by', 'get by//name', 'get by/', 'get ']) {
      expect(() =>
        setup([{ path: 'fonts', actions: { [key]: () => 1 } }])
      ).toThrow(`Invalid action '${key}' in 'fonts'`)
    }
  })
})

describe('composition', () => {
  it('wraps the first mixin, the next and the controller through `next`', async () => {
    const base = defineMixin({
      actions: {
        'get :id': ({ params: { id } }) => ({ id, from: ['base'] })
      }
    })
    const mixin = defineMixin({
      actions: {
        'get :id': async ({ next }) => {
          const row = (await next()) as { from: string[] }
          return { ...row, from: [...row.from, 'mixin'] }
        }
      }
    })
    const api = setup([
      {
        path: 'fonts',
        mixins: [base, mixin],
        actions: {
          'get :id': async ({ next }) => {
            const row = (await next()) as { from: string[] }
            return { ...row, from: [...row.from, 'controller'] }
          }
        }
      }
    ])
    expect(await json(api, 'GET', '/api/fonts/3')).toEqual({
      id: '3',
      from: ['base', 'mixin', 'controller']
    })
  })

  it('gives each layer its own `next` and input', async () => {
    const base = defineMixin({
      actions: { post: ({ body }) => ({ beneath: body }) }
    })
    const mixin = defineMixin({
      actions: {
        post: async input => {
          input.body = { from: 'mixin' }
          return input.next()
        }
      }
    })
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        mixins: [base, mixin],
        actions: {
          post: async input => ({
            ...((await input.next()) as object),
            own: input.body
          })
        }
      }
    ])
    expect(await json(api, 'POST', '/api/fonts', { from: 'client' })).toEqual({
      beneath: { from: 'mixin' },
      own: { from: 'client' }
    })
  })

  it('wraps the handlers of mixins in the order of the layers', async () => {
    const one = defineMixin({ actions: { 'get :id': () => ['one'] } })
    const two = defineMixin({
      actions: {
        'get :id': async ({ next }) => [
          ...((await next()) as string[]),
          'two'
        ]
      }
    })
    const api = setup([{ path: 'fonts', mixins: [one, two] }])
    expect(await json(api, 'GET', '/api/fonts/1')).toEqual(['one', 'two'])
  })

  it('lets a mixin wrap a mixin that it lists', async () => {
    const inner = defineMixin({ actions: { 'get :id': () => ['inner'] } })
    const wrap = (name: string, mixin: typeof inner) =>
      defineMixin({
        mixins: [mixin],
        actions: {
          'get :id': async ({ next }) => [
            ...((await next()) as string[]),
            name
          ]
        }
      })
    const middle = wrap('middle', inner)
    const outer = wrap('outer', middle)
    const api = setup([{ path: 'fonts', mixins: [outer] }])
    expect(await json(api, 'GET', '/api/fonts/1')).toEqual([
      'inner',
      'middle',
      'outer'
    ])
    // `outer` lists `inner` through `middle`.
    const direct = setup([{ path: 'fonts', mixins: [inner, middle, outer] }])
    expect(await json(direct, 'GET', '/api/fonts/1')).toEqual([
      'inner',
      'middle',
      'outer'
    ])
  })

  it('takes settings from the last action, else the last layer', async () => {
    const { transaction, log } = createTransaction()
    const base = defineMixin({
      authorize: 'editor',
      actions: {
        get: { authorize: 'editor', handler: () => 'list' },
        post: () => 'created'
      }
    })
    const mixin = defineMixin({ authorize: 'editor', transaction: false })
    const define = (def: Partial<ControllerDefinition>) =>
      setup([{ path: 'fonts', mixins: [base, mixin], ...def }], {
        user: editor,
        transaction
      })
    const api = define({
      authorize: 'admin',
      actions: { get: true, post: true }
    })
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(200)
    expect((await request(api, 'POST', '/api/fonts')).status).toBe(403)
    const action = define({
      actions: { get: { authorize: 'admin' }, post: true }
    })
    expect((await request(action, 'GET', '/api/fonts')).status).toBe(403)
    expect((await request(action, 'POST', '/api/fonts')).status).toBe(200)
    expect(log).toEqual([])
  })

  it('runs the middleware of the API, the layers and the action in order', async () => {
    const order: string[] = []
    const middleware =
      (name: string): Middleware =>
      async (_c, next) => {
        order.push(`${name} in`)
        await next()
        order.push(`${name} out`)
      }
    const base = defineMixin({ middleware: middleware('base') })
    const mixin = defineMixin({ middleware: middleware('mixin') })
    const api = setup(
      [
        {
          path: 'fonts',
          mixins: [base, mixin],
          middleware: middleware('controller'),
          actions: {
            get: {
              middleware: [middleware('action')],
              handler: () => {
                order.push('handler')
                return []
              }
            }
          }
        }
      ],
      {
        middleware: [middleware('api')],
        getUser: async () => {
          order.push('user')
          return admin
        }
      }
    )
    await request(api, 'GET', '/api/fonts')
    expect(order).toEqual([
      'api in',
      'user',
      'base in',
      'mixin in',
      'controller in',
      'action in',
      'handler',
      'action out',
      'controller out',
      'mixin out',
      'base out',
      'api out'
    ])
  })

  it('lets middleware replace the response', async () => {
    const api = setup([
      {
        path: 'fonts',
        middleware: async c => c.json('cached'),
        actions: { get: () => 'fresh' }
      }
    ])
    expect(await json(api, 'GET', '/api/fonts')).toBe('cached')
  })

  it('runs the middleware of the API before `connect` and `getUser`', async () => {
    const api = setup(
      [
        {
          path: 'fonts',
          actions: { get: ({ db, user, session }) => [db, user?.id, session] }
        }
      ],
      {
        middleware: async (c, next) => {
          c.set('session', 'em')
          await next()
        },
        connect: c => `db ${c.var.session}`,
        getUser: async c => ({ id: String(c.var.session), roles: [] })
      }
    )
    expect(await json(api, 'GET', '/api/fonts')).toEqual(['db em', 'em', 'em'])
  })

  it('shares `c.var.body` between middleware and the handler', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        middleware: async (c, next) => {
          c.var.body.checked = true
          await next()
        },
        actions: { post: ({ body }) => body }
      }
    ])
    expect(await json(api, 'POST', '/api/fonts', { name: 'A' })).toEqual({
      name: 'A',
      checked: true
    })
  })
})

describe('settings of mixins', () => {
  const open = defineMixin({
    authorize: true,
    transaction: false,
    actions: { 'post shared': () => 'mixin', 'post own': () => 'mixin' }
  })

  it('keeps them off the actions of the host', () => {
    expect(() =>
      setup([
        {
          path: 'fonts',
          mixins: [open],
          actions: { 'post other': () => 'host' }
        }
      ])
    ).toThrow(`'post other' has no \`authorize\` in 'fonts'`)
  })

  it('applies them to an action that the host adds to', async () => {
    const api = setup([
      {
        path: 'fonts',
        mixins: [open],
        actions: { 'post shared': ({ next }) => next() }
      }
    ])
    expect(await json(api, 'POST', '/api/fonts/shared')).toBe('mixin')
  })

  it('lets the controller override them', async () => {
    const api = setup([
      { path: 'fonts', authorize: ['editor'], mixins: [open] }
    ])
    expect((await request(api, 'POST', '/api/fonts/own')).status).toBe(403)
  })

  it('applies a mixin without actions to all actions', async () => {
    const api = setup([
      {
        path: 'fonts',
        mixins: [defineMixin({ authorize: ['editor'] }), open],
        actions: { 'get other': () => 'host' }
      }
    ])
    expect((await request(api, 'GET', '/api/fonts/other')).status).toBe(403)
  })
})

describe('authorize', () => {
  it('grants access only when a function returns `true`', async () => {
    const authorize = (() => 'yes') as never
    const api = setup([
      { path: 'fonts', authorize, actions: { get: () => 'ok' } }
    ])
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(403)
  })

  const controller = (def: Partial<ControllerDefinition> = {}) =>
    defineController({
      path: 'fonts',
      authorize: ['admin'],
      actions: { get: () => [] },
      ...def
    })

  it('answers 401 without a user and 403 without a role', async () => {
    const anonymous = setup([controller()], { user: null })
    const response = await request(anonymous, 'GET', '/api/fonts')
    expect(response.status).toBe(401)
    expect(response.data).toEqual({
      message: 'Unauthorized',
      status: 401
    })
    const api = setup([controller()], { user: editor })
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(403)
  })

  it('grants access with any of the roles', async () => {
    const api = setup([controller({ authorize: ['admin', 'editor'] })], {
      user: editor
    })
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(200)
  })

  it('calls a function with the context', async () => {
    const api = setup(
      [controller({ authorize: c => c.req.header('X-Key') === 'yes' })],
      { user: null }
    )
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(401)
    const response = await request(api, 'GET', '/api/fonts', undefined, {
      headers: { 'X-Key': 'yes' }
    })
    expect(response.status).toBe(200)
  })

  it('checks the owner of the record with a function', async () => {
    const api = setup(
      [
        controller({
          authorize: ({ req, var: { user } }) => (
            !!user?.roles.includes('admin') ||
            req.param('id') === String(user?.id)
          ),
          actions: { 'get :id': () => 'row' }
        })
      ],
      { user: editor }
    )
    expect((await request(api, 'GET', '/api/fonts/2')).status).toBe(200)
    expect((await request(api, 'GET', '/api/fonts/3')).status).toBe(403)
  })

  it('lets an action override the controller', async () => {
    const api = setup(
      [
        controller({
          actions: {
            'get': () => [],
            'get public': { authorize: () => true, handler: () => [] }
          }
        })
      ],
      { user: null }
    )
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(401)
    expect((await request(api, 'GET', '/api/fonts/public')).status).toBe(200)
  })

  it('takes `authorize` from the last layer', async () => {
    const mixin = defineMixin({ authorize: ['admin'] })
    const api = setup(
      [controller({ authorize: ['editor'], mixins: [mixin] })],
      { user: editor }
    )
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(200)
  })

  it('lets anyone in with `true`', async () => {
    const api = setup(
      [controller({ authorize: true, actions: { post: () => 'ok' } })],
      { user: null }
    )
    expect((await request(api, 'POST', '/api/fonts')).status).toBe(200)
  })

  it('throws for a write without `authorize` at any level', () => {
    const base = defineMixin({ actions: { 'delete :id': () => null } })
    expect(() =>
      setup([
        {
          path: 'fonts',
          mixins: [base],
          actions: { 'get': () => [], 'delete :id': true }
        }
      ])
    ).toThrow(`'delete :id' has no \`authorize\` in 'fonts'`)
  })

  it('checks a write that a mixin sets with an object', () => {
    const base = defineMixin({ actions: { post: () => 'ok' } })
    const mixin = defineMixin({ actions: { post: { transaction: false } } })
    expect(() =>
      setup([{ path: 'fonts', mixins: [base, mixin], actions: { post: true } }])
    ).toThrow(`'post' has no \`authorize\` in 'fonts'`)
    const authorized = defineMixin({ ...base, authorize: 'admin' })
    expect(() =>
      setup([
        { path: 'fonts', mixins: [authorized, mixin], actions: { post: true } }
      ])
    ).not.toThrow()
  })
})

describe('validation', () => {
  it('validates the query and the body', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'patch :id': action({
            query: z.object({ draft: z.enum(['yes', 'no']) }),
            body: z.object({
              sets: z.array(z.object({ name: z.string() }))
            }),
            handler: ({ query, body, c }) => {
              expectTypeOf(query).toEqualTypeOf<{ draft: 'yes' | 'no' }>()
              expectTypeOf(body.sets).toEqualTypeOf<{ name: string }[]>()
              expectTypeOf(c.req.valid('query')).toEqualTypeOf<{
                draft: 'yes' | 'no'
              }>()
              expect(c.req.valid('json')).toBe(body)
              return {
                draft: query.draft,
                names: body.sets.map(set => set.name)
              }
            }
          })
        }
      }
    ])
    expect(
      await json(api, 'PATCH', '/api/fonts/1?draft=yes', {
        sets: [{ name: 'Regular' }]
      })
    ).toEqual({ draft: 'yes', names: ['Regular'] })

    const query = await request(api, 'PATCH', '/api/fonts/1?draft=maybe', {
      sets: []
    })
    expect(query.status).toBe(400)
    expect(query.data).toEqual({
      type: 'ParameterValidation',
      message: 'The query is not valid.',
      status: 400,
      errors: {
        draft: [{ message: expect.any(String), keyword: 'invalid_value' }]
      }
    })

    const body = await request(api, 'PATCH', '/api/fonts/1?draft=no', {
      sets: [{ name: 'Regular' }, { name: 8 }]
    })
    expect(body.status).toBe(400)
    expect(body.headers.get('Content-Type')).toBe('application/json')
    expect(body.data).toEqual({
      type: 'BodyValidation',
      message: 'The body is not valid.',
      status: 400,
      errors: {
        'sets/1/name': [
          { message: expect.any(String), keyword: 'invalid_type' }
        ]
      }
    })
  })

  it('handles destructured input', async () => {
    const subscribed: string[] = []
    const api = setup([
      {
        path: 'newsletter',
        actions: {
          'get subscribe': action({
            query: z.object({ emailAddress: z.email() }),
            handler: ({ query: { emailAddress } }) => {
              subscribed.push(emailAddress)
              return { emailAddress }
            }
          })
        }
      }
    ])
    expect(
      await json(api, 'GET', '/api/newsletter/subscribe?emailAddress=a%40b.ch')
    ).toEqual({ emailAddress: 'a@b.ch' })
    expect(subscribed).toEqual(['a@b.ch'])
  })

  it('passes arrays of repeated parameters to the query schema', async () => {
    const api = setup([
      {
        path: 'fonts',
        actions: {
          'get': action({
            query: z.object({
              tag: z.array(z.string()),
              page: z.string().optional()
            }),
            handler: ({ query }) => query
          }),
          'get plain': ({ query }) => query,
          'get ids': action({
            query: z.object({ id: zodModule.q.array(zodModule.q.integer()) }),
            handler: ({ query }) => query
          })
        }
      }
    ])
    expect(await json(api, 'GET', '/api/fonts?tag=a&tag=b&page=2')).toEqual({
      tag: ['a', 'b'],
      page: '2'
    })
    expect(await json(api, 'GET', '/api/fonts/ids?id=1&id=2')).toEqual({
      id: [1, 2]
    })
    expect(await json(api, 'GET', '/api/fonts/ids?id=1')).toEqual({ id: [1] })
    expect(await json(api, 'GET', '/api/fonts/plain?tag=a&tag=b')).toEqual({
      tag: 'a'
    })
  })

  it('creates validation errors keyed by path', () => {
    const issues = [
      { message: 'is taken', path: ['sets', 8, 'name'] },
      { message: 'is empty', path: [], code: 'too_small' }
    ]
    expect(createValidationError(issues).toJSON()).toEqual({
      type: 'ModelValidation',
      message: 'The data is not valid.',
      status: 400,
      errors: {
        'sets/8/name': [{ message: 'is taken' }],
        '': [{ message: 'is empty', keyword: 'too_small' }]
      }
    })
    const cause = new Error('Taken')
    const conflict = createValidationError(issues.slice(0, 1), {
      message: 'The name is taken.',
      type: 'NameValidation',
      status: 409,
      cause
    })
    expect(conflict.cause).toBe(cause)
    expect(conflict.toJSON()).toEqual({
      type: 'NameValidation',
      message: 'The name is taken.',
      status: 409,
      errors: { 'sets/8/name': [{ message: 'is taken' }] }
    })
  })

  it('parses the JSON body of writes', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'post': ({ body }) => ({ body }),
          'get': ({ body }) => ({ body: body ?? null }),
          'patch :id': ({ body }) => ({ body })
        }
      }
    ])
    expect(await json(api, 'POST', '/api/fonts', { name: 'A' })).toEqual({
      body: { name: 'A' }
    })
    const merge = await request(api, 'PATCH', '/api/fonts/1', undefined, {
      body: '{"name":"B"}',
      headers: { 'Content-Type': 'application/merge-patch+json' }
    })
    expect(merge.data).toEqual({ body: { name: 'B' } })
    expect(await json(api, 'POST', '/api/fonts')).toEqual({ body: {} })
    expect(await json(api, 'GET', '/api/fonts')).toEqual({ body: null })
  })

  it('reads no JSON from a body without a type', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: { post: ({ body }) => ({ body }) }
      }
    ])
    const { data } = await request(api, 'POST', '/api/fonts', undefined, {
      body: new Blob(['{"name":"A"}'])
    })
    expect(data).toEqual({ body: {} })
  })

  it('keeps `query` and `params` from the variables of the app', async () => {
    const api = setup([
      {
        path: 'fonts',
        middleware: async (c, next) => {
          c.set('query' as never, 'set' as never)
          c.set('params' as never, 'set' as never)
          await next()
        },
        actions: { 'get :id': ({ query, params }) => ({ query, params }) }
      }
    ])
    expect(await json(api, 'GET', '/api/fonts/1?a=b')).toEqual({
      query: { a: 'b' },
      params: { id: '1' }
    })
  })

  it('answers 400 for invalid JSON, after the authorization', async () => {
    const controller: ControllerDefinition = {
      path: 'fonts',
      authorize: ['admin'],
      actions: { post: () => 'ok' }
    }
    const init = {
      body: '{"name":',
      headers: { 'Content-Type': 'application/json' }
    }
    const api = setup([controller])
    const invalid = await request(api, 'POST', '/api/fonts', undefined, init)
    expect(invalid.status).toBe(400)
    expect(invalid.data).toEqual({
      message: 'The body is invalid JSON.',
      status: 400
    })
    const anonymous = setup([controller], { user: null })
    expect(
      (await request(anonymous, 'POST', '/api/fonts', undefined, init)).status
    ).toBe(401)
  })

  it('leaves other bodies unread for the handler', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'post upload': async ({ body, c }) => {
            const form = await c.req.formData()
            return { body: body ?? null, name: form.get('name') }
          },
          'post raw': async ({ body, c }) => {
            const bytes = new Uint8Array(await c.req.arrayBuffer())
            return { body: body ?? null, bytes: [...bytes] }
          }
        }
      }
    ])
    const form = new FormData()
    form.set('name', 'Regular')
    const upload = await request(api, 'POST', '/api/fonts/upload', undefined, {
      body: form
    })
    expect(upload.data).toEqual({ body: null, name: 'Regular' })
    const raw = await request(api, 'POST', '/api/fonts/raw', undefined, {
      body: new Uint8Array([1, 2, 3]),
      headers: { 'Content-Type': 'application/octet-stream' }
    })
    expect(raw.data).toEqual({ body: null, bytes: [1, 2, 3] })
  })

  it('sets the validated body with a schema', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          post: action({
            body: z.object({ name: z.string().trim() }),
            handler: ({ body }) => ({ body })
          })
        }
      }
    ])
    expect(
      await json(api, 'POST', '/api/fonts', { name: ' A ', other: 1 })
    ).toEqual({ body: { name: 'A' } })
  })

  it('validates no body without a schema', async () => {
    const api = setup([
      { path: 'fonts', authorize: true, actions: { 'patch :id': () => 'ok' } }
    ])
    expect((await request(api, 'PATCH', '/api/fonts/1', [1])).status).toBe(200)
  })
})

describe('transactions', () => {
  it('runs writes in a transaction, but not reads', async () => {
    const { transaction, log } = createTransaction()
    const api = setup(
      [
        {
          path: 'fonts',
          authorize: true,
          middleware: async (c, next) => {
            log.push(`middleware ${c.var.db ?? 'none'}`)
            await next()
          },
          actions: {
            'get': ({ db }) => db ?? null,
            'post': ({ db }) => db,
            'get fresh': { transaction: true, handler: ({ db }) => db },
            'post log': { transaction: false, handler: () => null }
          }
        }
      ],
      { transaction }
    )
    expect(await json(api, 'GET', '/api/fonts')).toBe(null)
    expect(log).toEqual(['middleware none'])
    log.length = 0
    expect(await json(api, 'POST', '/api/fonts')).toBe('trx')
    expect(log).toEqual(['begin', 'middleware trx', 'commit'])
    log.length = 0
    expect(await json(api, 'GET', '/api/fonts/fresh')).toBe('trx')
    expect(log).toEqual(['begin', 'middleware trx', 'commit'])
    log.length = 0
    await request(api, 'POST', '/api/fonts/log')
    expect(log).toEqual(['middleware none'])
  })

  it('takes `transaction` from the action, else the last layer', async () => {
    const { transaction, log } = createTransaction()
    const mixin = defineMixin({ transaction: false })
    const api = setup(
      [
        {
          path: 'fonts',
          transaction: true,
          actions: { get: ({ db }) => db }
        },
        {
          path: 'files',
          authorize: true,
          mixins: [mixin],
          actions: {
            'post': () => null,
            'post import': { transaction: true, handler: ({ db }) => db }
          }
        }
      ],
      { transaction }
    )
    expect(await json(api, 'GET', '/api/fonts')).toBe('trx')
    expect(log).toEqual(['begin', 'commit'])
    log.length = 0
    await request(api, 'POST', '/api/files')
    expect(log).toEqual([])
    expect(await json(api, 'POST', '/api/files/import')).toBe('trx')
    expect(log).toEqual(['begin', 'commit'])
  })

  it('rolls back when the handler throws', async () => {
    const { transaction, log } = createTransaction()
    const api = setup(
      [
        {
          path: 'fonts',
          authorize: true,
          // Middleware sees the error of what it wraps in `c.error`.
          middleware: async (c, next) => {
            await next()
            log.push(`middleware ${c.error?.message}`)
          },
          actions: {
            post: () => {
              throw new RangeError('Too wide')
            }
          }
        }
      ],
      { transaction }
    )
    const response = await request(api, 'POST', '/api/fonts')
    expect(log).toEqual(['begin', 'middleware Too wide', 'rollback'])
    expect(response.status).toBe(422)
    expect(response.data).toEqual({
      type: 'OutOfRange',
      message: 'Too wide',
      status: 422
    })
  })

  it('rolls back when the chain throws after the handler', async () => {
    const { transaction, log } = createTransaction()
    const api = setup(
      [
        {
          path: 'fonts',
          authorize: true,
          middleware: async (_c, next) => {
            await next()
            log.push('middleware throws')
            throw new HttpError(409, { message: 'Stale' })
          },
          actions: {
            post: () => {
              log.push('handler')
              return {}
            }
          }
        }
      ],
      { transaction }
    )
    const response = await request(api, 'POST', '/api/fonts')
    expect(log).toEqual(['begin', 'handler', 'middleware throws', 'rollback'])
    expect(response.status).toBe(409)
  })

  it('answers the errors of the transaction itself', async () => {
    const transaction: Transaction = async (_c, fn) => {
      await fn()
      throw new RangeError('Commit failed')
    }
    const api = setup(
      [{ path: 'fonts', authorize: true, actions: { post: () => ({}) } }],
      { transaction }
    )
    const response = await request(api, 'POST', '/api/fonts')
    expect(response.status).toBe(422)
    expect(response.data.message).toBe('Commit failed')
  })

  it('sets `db` from `connect`, which the transaction swaps', async () => {
    const log: string[] = []
    const transaction: Transaction = async (c, fn) => {
      const { db } = c.var
      c.set('db', `trx of ${db}`)
      try {
        return await fn()
      } finally {
        c.set('db', db)
        log.push(`after ${c.var.db}`)
      }
    }
    const connect = vi.fn((c: DitoContext) => `db ${c.req.method}`)
    const api = setup(
      [
        {
          path: 'fonts',
          authorize: true,
          actions: { get: ({ db }) => db, post: ({ db }) => db }
        }
      ],
      { transaction, connect }
    )
    expect(await json(api, 'GET', '/api/fonts')).toBe('db GET')
    expect(await json(api, 'POST', '/api/fonts')).toBe('trx of db POST')
    expect(log).toEqual(['after db POST'])
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('keeps `db` in a transaction that does not set it', async () => {
    const transaction: Transaction = (_c, fn) => fn()
    const api = setup(
      [{ path: 'fonts', authorize: true, actions: { post: ({ db }) => db } }],
      { transaction, connect: () => 'db' }
    )
    expect(await json(api, 'POST', '/api/fonts')).toBe('db')
  })
})

describe('results', () => {
  it('sends a Response unchanged and undefined as 204', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'get text': ({ c }) => c.text('plain'),
          'post': () => undefined
        }
      }
    ])
    expect((await request(api, 'GET', '/api/fonts/text')).data).toBe('plain')
    const empty = await request(api, 'POST', '/api/fonts')
    expect(empty.status).toBe(204)
    expect(empty.data).toBeUndefined()
  })

  it('adds the headers of `c.header()` to a returned Response', async () => {
    const api = setup(
      [
        {
          path: 'fonts',
          actions: {
            'get file': ({ c }) => {
              c.header('Cache-Control', 'no-store')
              c.header('Content-Type', 'text/csv')
              return new Response('a,b', {
                headers: { 'Content-Type': 'text/plain' }
              })
            },
            'get redirect': ({ c }) => {
              c.header('X-Reason', 'moved')
              return Response.redirect('https://example.com/', 302)
            },
            'get login': ({ c }) => {
              setCookie(c, 'login', 'l')
              return c.redirect('https://example.com/')
            }
          }
        }
      ],
      {
        middleware: async (c, next) => {
          setCookie(c, 'session', 's')
          await next()
        }
      }
    )
    const file = await request(api, 'GET', '/api/fonts/file')
    expect(file.headers.get('Cache-Control')).toBe('no-store')
    expect(file.headers.get('Content-Type')).toBe('text/plain')
    expect(file.headers.getSetCookie()).toEqual(['session=s; Path=/'])
    expect(file.data).toBe('a,b')
    const redirect = await request(api, 'GET', '/api/fonts/redirect')
    expect(redirect.status).toBe(302)
    expect(redirect.headers.get('Location')).toBe('https://example.com/')
    expect(redirect.headers.get('X-Reason')).toBe('moved')
    expect(redirect.headers.getSetCookie()).toEqual(['session=s; Path=/'])
    const login = await request(api, 'GET', '/api/fonts/login')
    expect(login.status).toBe(302)
    expect(login.headers.getSetCookie()).toEqual([
      'session=s; Path=/',
      'login=l; Path=/'
    ])
  })

  it('answers data with 200 also for `post`, and with `c.status()`', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'post': () => ({ id: 1 }),
          'post ok': ({ c }) => {
            c.status(200)
            return { id: 2 }
          }
        }
      }
    ])
    expect((await request(api, 'POST', '/api/fonts')).status).toBe(200)
    expect((await request(api, 'POST', '/api/fonts/ok')).status).toBe(200)
  })

  it('uses the status and headers of `c` for data', async () => {
    const api = setup([
      {
        path: 'fonts',
        authorize: true,
        actions: {
          'post': ({ c }) => {
            c.status(202)
            c.header('Location', '/api/fonts/1')
            return { id: 1 }
          },
          'post empty': ({ c }) => {
            c.status(205)
            c.header('X-Done', 'yes')
          },
          'get': () => ({})
        }
      }
    ])
    const accepted = await request(api, 'POST', '/api/fonts')
    expect(accepted.status).toBe(202)
    expect(accepted.headers.get('Location')).toBe('/api/fonts/1')
    expect(accepted.headers.get('Content-Type')).toBe('application/json')
    expect(accepted.data).toEqual({ id: 1 })
    const empty = await request(api, 'POST', '/api/fonts/empty')
    expect(empty.status).toBe(205)
    expect(empty.headers.get('X-Done')).toBe('yes')
    expect((await request(api, 'GET', '/api/fonts')).status).toBe(200)
  })

  it('keeps the cookies of middleware on data', async () => {
    const api = setup([{ path: 'fonts', actions: { get: () => 'data' } }], {
      middleware: async (c, next) => {
        setCookie(c, 'session', 's')
        await next()
      }
    })
    const response = await request(api, 'GET', '/api/fonts')
    expect(response.headers.getSetCookie()).toEqual(['session=s; Path=/'])
  })
})

describe('errors', () => {
  const api = setup([
    {
      path: 'fonts',
      actions: {
        'get taken': () => {
          throw new HttpError(409, {
            message: 'The name is taken.',
            errors: { name: [{ message: 'Taken' }] },
            name: 'Uni'
          })
        },
        'get teapot': () => {
          throw new HttpError(418, { type: 'Teapot', code: 'tea' })
        },
        'get crash': () => {
          throw new Error('Secret internals')
        },
        'get exception': () => {
          throw new HTTPException(413, {
            res: new Response('Too large', { status: 413 })
          })
        }
      }
    }
  ])

  it('answers an HttpError as JSON', async () => {
    const taken = await request(api, 'GET', '/api/fonts/taken')
    expect(taken.status).toBe(409)
    expect(taken.headers.get('Content-Type')).toBe('application/json')
    expect(taken.data).toEqual({
      message: 'The name is taken.',
      status: 409,
      errors: { name: [{ message: 'Taken' }] },
      name: 'Uni'
    })
    const teapot = await request(api, 'GET', '/api/fonts/teapot')
    expect(teapot.status).toBe(418)
    expect(teapot.data).toEqual({
      type: 'Teapot',
      message: 'Client Error',
      status: 418,
      code: 'tea'
    })
  })

  it('answers other errors as 500 without internals', async () => {
    const response = await request(api, 'GET', '/api/fonts/crash')
    expect(response.status).toBe(500)
    expect(response.data).toEqual({
      message: 'Internal Server Error',
      status: 500
    })
  })

  it(`answers Hono's HTTPException as JSON`, async () => {
    const response = await request(api, 'GET', '/api/fonts/exception')
    expect(response.status).toBe(413)
    expect(response.data).toEqual({
      message: 'Content Too Large',
      status: 413
    })
  })

  it('answers errors with a numeric `status` with that status', async () => {
    const fail = (status: number, message: string, expose?: boolean) => () => {
      throw Object.assign(new Error(message), { status, expose })
    }
    const api = createApi({
      controllers: [
        {
          path: 'fonts',
          actions: {
            'get taken': fail(409, 'Taken'),
            'get hidden': fail(400, 'Secret', false),
            'get busy': fail(503, 'Busy', true),
            'get down': fail(502, 'Secret'),
            'get ok': fail(200, 'Secret')
          }
        }
      ]
    })
    const answer = async (path: string) => {
      const response = await api.request(`/fonts/${path}`)
      return { status: response.status, body: await response.json() }
    }
    expect(await answer('taken')).toEqual({
      status: 409,
      body: { message: 'Taken', status: 409 }
    })
    expect((await answer('hidden')).body.message).toBe('Bad Request')
    expect((await answer('busy')).body.message).toBe('Busy')
    expect(await answer('down')).toEqual({
      status: 502,
      body: { message: 'Server Error', status: 502 }
    })
    expect((await answer('ok')).status).toBe(500)
  })

  it('calls `onError` with the errors that answer 500 or above', async () => {
    const error = new Error('Broken')
    const onError = vi.fn()
    const api = setup(
      [
        {
          path: 'fonts',
          authorize: true,
          actions: {
            'post :id/publish': () => {
              throw error
            },
            'get missing': () => {
              throw new HttpError(404)
            },
            'get wide': () => {
              throw new RangeError('Too wide')
            }
          }
        }
      ],
      { onError }
    )
    const response = await request(api, 'POST', '/api/fonts/4/publish')
    expect(response.status).toBe(500)
    expect(response.data).toEqual({
      message: 'Internal Server Error',
      status: 500
    })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0]).toBe(error)
    const c: DitoContext = onError.mock.calls[0]![1]
    expect(c.req.url).toBe('https://example.com/api/fonts/4/publish')
    expect(c.req.param('id')).toBe('4')
    expect((await request(api, 'GET', '/api/fonts/missing')).status).toBe(404)
    // `toHttpError()` of the `db` adapter maps the error to a 422 first.
    expect((await request(api, 'GET', '/api/fonts/wide')).status).toBe(422)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('passes the context to `toHttpError()` of the `db` adapter', async () => {
    const toHttpError = vi.fn(
      (_error: unknown, c: DitoContext) =>
        new HttpError(503, {
          message: `${c.req.method} of ${c.req.param('id')}`
        })
    )
    const onError = vi.fn()
    const error = new Error('Busy')
    const api = setup(
      [
        {
          path: 'fonts',
          actions: {
            'get :id': () => {
              throw error
            }
          }
        }
      ],
      { db: { toHttpError }, onError }
    )
    const response = await request(api, 'GET', '/api/fonts/4')
    expect(response.status).toBe(503)
    expect(response.data.message).toBe('GET of 4')
    expect(toHttpError.mock.calls[0]![0]).toBe(error)
    expect(onError.mock.calls[0]![0]).toBe(error)
  })

  it('keeps the headers on error responses, but not those of the data', async () => {
    const api = setup(
      [
        {
          path: 'fonts',
          middleware: async (c, next) => {
            c.header('Cache-Control', 'public')
            await next()
          },
          actions: {
            get: ({ c }) => {
              setCookie(c, 'flash', 'f')
              c.header('X-Request', 'r')
              c.header('Content-Security-Policy', 'default-src https:')
              c.header('Content-Disposition', 'attachment')
              c.header('ETag', '"1"')
              c.header('Location', '/api/fonts/1')
              throw new HttpError(409)
            }
          }
        }
      ],
      {
        // Sessions set their cookie before the error.
        middleware: async (c, next) => {
          setCookie(c, 'session', 's')
          await next()
        }
      }
    )
    const response = await request(api, 'GET', '/api/fonts')
    expect(response.status).toBe(409)
    expect(response.headers.getSetCookie()).toEqual([
      'session=s; Path=/',
      'flash=f; Path=/'
    ])
    expect(response.headers.get('X-Request')).toBe('r')
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'default-src https:'
    )
    expect(response.headers.get('Content-Type')).toBe('application/json')
    for (const name of [
      'Cache-Control',
      'Content-Disposition',
      'ETag',
      'Location'
    ]) {
      expect(response.headers.has(name)).toBe(false)
    }
  })

  it('keeps the headers of `cors()` on error responses', async () => {
    const app = new Hono()
    app.use(cors({ origin: 'https://example.com' }))
    app.route(
      '/api',
      createApi({
        controllers: [
          {
            path: 'fonts',
            actions: {
              get: () => {
                throw new HttpError(409)
              }
            }
          }
        ]
      })
    )
    const response = await app.request('/api/fonts', {
      headers: { Origin: 'https://example.com' }
    })
    expect(response.status).toBe(409)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://example.com'
    )
  })

  it('answers the errors of the host with `errorHandler()`', async () => {
    const onError = vi.fn()
    const app = new Hono()
    app.use(async (c, next) => {
      setCookie(c, 'session', 's')
      if (c.req.path === '/fail') throw new Error('Boom')
      if (c.req.path === '/denied') throw new HttpError(403)
      await next()
    })
    app.onError(errorHandler(onError))
    const denied = await app.request('/denied')
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ message: 'Forbidden', status: 403 })
    expect(denied.headers.getSetCookie()).toEqual(['session=s; Path=/'])
    const failed = await app.request('/fail')
    expect(failed.status).toBe(500)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0]).toMatchObject({ message: 'Boom' })
  })

  describe('logging by default', () => {
    const error = new Error('Boom')
    const fail = () => {
      throw error
    }

    it('logs through `c.var.logger`, in the API and the host', async () => {
      const logger = { error: vi.fn() }
      const app = new Hono<{ Variables: { logger: typeof logger } }>()
      app.use(async (c, next) => {
        c.set('logger', logger)
        await next()
      })
      app.onError(errorHandler())
      app.get('/host', fail)
      app.route(
        '/api',
        createApi({
          controllers: [
            {
              path: 'fonts',
              actions: {
                'get': fail,
                'get denied': () => {
                  throw new HttpError(403)
                }
              }
            }
          ]
        })
      )
      await app.request('/host')
      await app.request('/api/fonts')
      await app.request('/api/fonts/denied')
      expect(logger.error.mock.calls).toEqual([[error], [error]])
    })

    it('logs through `console` without a logger', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const app = new Hono()
      app.onError(errorHandler())
      app.get('/', fail)
      await app.request('/')
      expect(spy).toHaveBeenCalledWith(error)
      spy.mockRestore()
    })
  })
})

describe('controllers of a module', () => {
  it('keeps the results of `defineController()`', async () => {
    const fonts = defineController({
      path: 'fonts',
      actions: { get: () => 'fonts' }
    })
    const module = {
      fonts,
      mixin: defineMixin({ actions: { 'get other': () => 'other' } }),
      helper: () => {},
      plain: { path: 'plain', actions: { get: () => 'plain' } },
      nested: { fonts },
      name: 'name',
      nothing: null
    }
    const api = createApi({ controllers: module })
    expect(await (await api.request('/fonts')).json()).toBe('fonts')
    expect((await api.request('/plain')).status).toBe(404)
    // A module namespace is such an object, here without controllers.
    expect(() => createApi({ controllers: zodModule })).not.toThrow()
  })
})

describe('sendFile()', () => {
  const app = setup([
    {
      path: 'files',
      actions: {
        'get csv': ({ c }) => sendFile(c, 'a,b', { filename: 'export.csv' }),
        'get pdf': ({ c }) => {
          c.header('Cache-Control', 'no-store')
          return sendFile(c, new Uint8Array([1, 2]), {
            filename: 'Ünï "1".pdf',
            type: 'application/x-pdf',
            inline: true
          })
        },
        'get unknown': ({ c }) =>
          sendFile(c, 'data', { filename: 'data.unknown' }),
        'get image': ({ c }) =>
          sendFile(c, 'data', { type: 'image/png', inline: true }),
        'get stream': ({ c }) =>
          sendFile(c, Readable.from([Buffer.from('a,'), Buffer.from('b')]), {
            filename: 'export.csv'
          })
      }
    }
  ])

  it('answers as an attachment with the type of the file name', async () => {
    const response = await app.request('/api/files/csv')
    expect(await response.text()).toBe('a,b')
    expect(response.headers.get('Content-Type')).toBe(
      'text/csv; charset=utf-8'
    )
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="export.csv"; filename*=UTF-8''export.csv`
    )
  })

  it('answers inline with a type, and encodes the name', async () => {
    const response = await app.request('/api/files/pdf')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2])
    )
    expect(response.headers.get('Content-Type')).toBe('application/x-pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      `inline; filename="_n_ _1_.pdf"; ` +
      `filename*=UTF-8''%C3%9Cn%C3%AF%20%221%22.pdf`
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('falls back to binary data for unknown types', async () => {
    const response = await app.request('/api/files/unknown')
    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream'
    )
  })

  it('answers without a file name', async () => {
    const response = await app.request('/api/files/image')
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Content-Disposition')).toBe('inline')
  })

  it('answers with a stream of Node', async () => {
    const response = await app.request('/api/files/stream')
    expect(await response.text()).toBe('a,b')
  })
})

describe('hostMiddleware()', () => {
  const host = (...args: Parameters<typeof hostMiddleware>) => {
    const app = new Hono()
    app.onError(errorHandler())
    app.use(...hostMiddleware(...args))
    app.all('/', async c => c.text((await c.req.text()) || 'text'))
    return app
  }

  const post = (app: Hono, headers: Record<string, string>, body = 'body') =>
    app.request('http://localhost/', { method: 'POST', headers, body })

  it('checks `Origin` only where a request sends it', async () => {
    const form = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const app = host()
    expect((await post(app, form)).status).toBe(200)
    const denied = await post(app, { ...form, Origin: 'https://evil.test' })
    expect(denied.status).toBe(403)
    expect((await denied.json()).status).toBe(403)
    expect(denied.headers.has('X-Content-Type-Options')).toBe(true)
    const same = await post(app, { ...form, Origin: 'http://localhost' })
    expect(same.status).toBe(200)
    const allowed = host({ csrf: { origin: 'https://admin.test' } })
    expect(
      (await post(allowed, { ...form, Origin: 'https://admin.test' })).status
    ).toBe(200)
    expect(
      (
        await post(host({ csrf: false }), {
          ...form,
          Origin: 'https://evil.test'
        })
      ).status
    ).toBe(200)
  })

  it('sets the secure headers, unless turned off', async () => {
    const on = await host().request('/')
    const off = await host({ secureHeaders: false }).request('/')
    expect(on.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(off.headers.has('X-Content-Type-Options')).toBe(false)
  })

  it('limits bodies to 1 MB, except multipart bodies', async () => {
    const large = 'x'.repeat(1024 * 1024 + 1)
    const plain = { 'Content-Type': 'text/plain' }
    const multipart = { 'Content-Type': 'multipart/form-data; boundary=x' }
    const app = host()
    const refused = await post(app, plain, large)
    expect(refused.status).toBe(413)
    expect((await refused.json()).status).toBe(413)
    expect((await post(app, multipart, large)).status).toBe(200)
    expect((await post(app, plain, 'x'.repeat(1024))).status).toBe(200)
    const small = host({ bodyLimit: { maxSize: 2 } })
    expect((await post(small, plain, 'abc')).status).toBe(413)
    const open = host({ bodyLimit: false })
    expect((await post(open, plain, large)).status).toBe(200)
  })

  it('adds `cors` and `etag` when asked', async () => {
    const off = await host().request('/')
    expect(off.headers.has('ETag')).toBe(false)
    expect(off.headers.has('Access-Control-Allow-Origin')).toBe(false)
    const on = await host({ cors: true, etag: true }).request('/')
    expect(on.headers.has('ETag')).toBe(true)
    expect(on.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const origin = await host({ cors: { origin: 'https://a.test' } }).request(
      '/',
      { headers: { Origin: 'https://a.test' } }
    )
    expect(origin.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://a.test'
    )
  })
})

describe('types', () => {
  it('passes the input and context of any action to helpers', () => {
    const getName = ({ user, params, c }: DitoInput) => (
      user?.id ?? params.name ?? c.req.path
    )
    defineController({
      path: 'fonts',
      actions: {
        'get by/:name': getName,
        'get page': action({
          query: z.object({ page: z.coerce.number().optional() }),
          body: z.object({ name: z.string() }),
          handler: getName
        }),
        'get :id': getName
      }
    })
  })
})
