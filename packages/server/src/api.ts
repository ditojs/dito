import { Hono, type Context } from 'hono'
import { getMimeType } from 'hono/utils/mime'
import { sValidator } from '@hono/standard-validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { asArray, isArray, isFunction } from '@ditojs/utils'
import { resolveController, type ResolvedAction } from './compose.ts'
import { isController } from './define.ts'
import {
  HttpError,
  bodyValidation,
  createValidationError,
  errorHandler,
  queryValidation
} from './errors.ts'
import type {
  ApiConfig,
  Authorize,
  DitoContext,
  DitoEnv,
  DitoInput,
  Middleware,
  Transaction
} from './types.ts'

// Builds a Hono app of the controllers, which the app routes with
// `app.route('/api', api)`. A request runs the API's `middleware`, sets
// `c.var.db` and `c.var.user`, then runs the middleware of its action, see
// `getMiddleware()`. The handler runs last, inside the transaction and the
// middleware. Paths that no action matches go on to the app's `notFound()`.

export function createApi({
  controllers,
  middleware,
  db = {},
  getUser,
  onError
}: ApiConfig) {
  const app = new Hono<DitoEnv>()
  app.use(...asArray(middleware), async (c, next) => {
    if (db.connect) c.set('db', await db.connect(c))
    c.set('user', (await getUser?.(c)) ?? null)
    await next()
  })
  // The routes by method and path, with the names of parameters left out.
  const routes = new Set<string>()
  const definitions = isArray(controllers)
    ? controllers
    : Object.values(controllers).filter(isController)
  for (const definition of definitions) {
    const controller = resolveController(definition)
    const sub = new Hono<DitoEnv>()
    // Hono runs the first route that matches, so static segments go before
    // parameters: `get subscribe` before `get :id`.
    const actions = controller.actions.toSorted((a, b) =>
      compareRanks(rank(a.path), rank(b.path))
    )
    for (const action of actions) {
      const { verb, path } = action
      const method = verb.toUpperCase()
      const fullPath = `/${[controller.path, path].filter(Boolean).join('/')}`
      const route = `${method} ${getRouteShape(fullPath)}`
      if (routes.has(route)) {
        throw new Error(`Two actions route ${method} ${fullPath}`)
      }
      routes.add(route)
      const handlers: Middleware[] = [
        ...getMiddleware(action, db.transaction),
        async c => respond(c, action)
      ]
      sub.on(method, `/${path}`, ...(handlers as [Middleware]))
    }
    app.route(`/${controller.path}`, sub)
  }
  app.onError(errorHandler(onError, db.toHttpError))
  return app
}

// Sets `c.var.action`, authorizes, validates the query and the body, sets
// `c.var.body`, opens the transaction, and runs the action's `middleware`.
function getMiddleware(
  action: ResolvedAction,
  transaction: Transaction | undefined
): Middleware[] {
  const { authorize: value, query, body, key, verb } = action
  const middleware: Middleware[] = [
    async (c, next) => {
      c.set('action', key)
      await next()
    }
  ]
  // Reads without `authorize` let anyone in.
  if (value !== undefined && value !== true) {
    middleware.push(authorize(value))
  }
  if (query) middleware.push(validate('query', query))
  if (body) middleware.push(validate('json', body))
  // A write reads its body here, so invalid JSON fails before the transaction
  // starts.
  if (verb !== 'get') {
    middleware.push(async (c: DitoContext, next) => {
      c.set('body', body ? c.req.valid('json') : await readBody(c))
      await next()
    })
  }
  if (transaction && (action.transaction ?? verb !== 'get')) {
    // Hono handles errors where they are thrown, and `next()` resolves with
    // `c.error` set. Throwing it again rolls the transaction back.
    middleware.push(async (c, next) => {
      try {
        await transaction(c, async () => {
          await next()
          if (c.error) throw c.error
        })
      } catch (error) {
        if (error !== c.error) throw error
      }
    })
  }
  return [...middleware, ...action.middleware]
}

function authorize(value: Exclude<Authorize, true>): Middleware {
  return async (c, next) => {
    const { user } = c.var
    const isAuthorized = isFunction(value)
      ? await value(c)
      : !!user && asArray(value).some(role => user.roles.includes(role))
    if (!isAuthorized) throw new HttpError(user ? 403 : 401)
    await next()
  }
}

function validate(target: 'query' | 'json', schema: StandardSchemaV1) {
  return sValidator(target, schema, result => {
    if (!result.success) {
      throw createValidationError(
        result.error,
        target === 'query' ? queryValidation : bodyValidation
      )
    }
  }) as Middleware
}

async function respond(c: DitoContext, action: ResolvedAction) {
  const input: Omit<DitoInput, 'next'> = {
    query: action.query ? c.req.valid('query') : c.req.query(),
    params: c.req.param(),
    // The variables of Dito and of the app, such as a session's.
    ...c.var,
    c
  }
  const result = await action.run(input)
  if (result instanceof Response) return withHeaders(c, result)
  if (result === undefined) {
    // Reads the status of `c.status()`, which Hono keeps private. It is 200
    // without one.
    const { status } = c.newResponse(null)
    return c.body(null, (status === 200 ? 204 : status) as never)
  }
  return c.json(result as never)
}

// Adds the headers of `c.header()` to a Response that a handler returns,
// unless the Response sets them itself. Hono drops them when `c.header()`
// runs before `c.res` exists. Responses of `c.redirect()` already hold them.
function withHeaders(c: DitoContext, response: Response) {
  const cookies = response.headers.getSetCookie()
  const added = [...c.newResponse(null).headers].filter(([name, value]) =>
    name === 'set-cookie'
      ? !cookies.includes(value)
      : !response.headers.has(name)
  )
  if (!added.length) return response
  // The headers of some responses, such as `Response.redirect()`, are
  // immutable.
  const copy = new Response(response.body, response)
  for (const [name, value] of added) copy.headers.append(name, value)
  return copy
}

// The JSON body of a request. An empty body is `{}`, and invalid JSON responds
// with 400. Bodies of other types stay unread for the handler, and are
// undefined.
async function readBody(c: Context) {
  const type = c.req.header('Content-Type')
  if (type && !/^application\/([\w.-]+\+)?json\b/.test(type)) return undefined
  const text = await c.req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, { message: 'The body is invalid JSON.' })
  }
}

export interface SendFileOptions {
  filename?: string
  // Default: the type of the file's extension.
  type?: string
  // Shows the file in the browser, instead of downloading it.
  inline?: boolean
}

// Returns a response with a file, also from a stream such as a Node `Readable`.
export function sendFile(
  c: Context,
  body: BodyInit | AsyncIterable<Uint8Array>,
  { filename, type, inline = false }: SendFileOptions
) {
  return c.body(body as never, 200, {
    'Content-Type': (
      type ??
      (filename && getMimeType(filename)) ??
      'application/octet-stream'
    ),
    'Content-Disposition': getDisposition(inline, filename)
  })
}

function getDisposition(inline: boolean, filename?: string) {
  const type = inline ? 'inline' : 'attachment'
  if (!filename) return type
  // The plain name is for clients that don't read `filename*`.
  const plainName = filename.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const encodedName = encodeURIComponent(filename)
  return `${type}; filename="${plainName}"; filename*=UTF-8''${encodedName}`
}

// The rank of each segment: 0 for static ones, 1 for parameters, and 2 for
// parameters with a pattern and wildcards, which can match more.
function rank(path: string) {
  return path
    .split('/')
    .map(segment =>
      segment === '*' || /^:.*\{/.test(segment) ? 2 : segment[0] === ':' ? 1 : 0
    )
}

function compareRanks(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return 0
}

// The path of a route with the names of parameters left out, so that two
// routes that match the same requests are equal.
function getRouteShape(path: string) {
  return path
    .split('/')
    .map(segment => segment.replace(/^:[^{]*/, ':'))
    .join('/')
}
