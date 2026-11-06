import { Hono, type Context } from 'hono'
import { contextStorage } from 'hono/context-storage'
import type { z } from 'zod'
import { asArray, isArray, isFunction, isString } from '@ditojs/utils'
import { resolveController, type ResolvedAction } from './compose.ts'
import { isController } from './define.ts'
import { convertQuery } from './query.ts'
import {
  HttpError,
  bodyValidation,
  createValidationError,
  createErrorHandler,
  queryValidation
} from './errors.ts'
import type {
  CreateApiOptions,
  Authorize,
  DitoContext,
  DitoEnv,
  HandlerContext,
  Middleware,
  Transact
} from './types.ts'

// A request runs the middleware of `users`, sets `c.var.em` and `c.var.user`,
// then runs the middleware of its action, and last the handler. Paths that no
// action matches go on to the app.
export function createApi({
  controllers,
  users,
  adapter = {},
  onError
}: CreateApiOptions) {
  const app = new Hono<DitoEnv>()
  // Runs on the actions only, so that APIs routed at `/api` and `/api/admin`
  // don't run each other's middleware, in any order.
  const setup: Middleware[] = [
    contextStorage(),
    ...asArray(users?.middleware),
    async (c, next) => {
      if (adapter.connect) c.set('em', await adapter.connect(c))
      c.set('user', (await users?.getUser({ c })) ?? null)
      await next()
    }
  ]
  const routeShapes = new Set<string>()
  const definitions = isArray(controllers)
    ? controllers
    : Object.values(controllers).filter(isController)
  const routes = definitions.flatMap(definition =>
    resolveController(definition).map(action => {
      const { key, authorize, transacted } = action
      const where = `'${key}' in '${definition.path}'`
      // Without `users`, there is no user whose roles could match.
      if (!users && (isString(authorize) || isArray(authorize))) {
        throw new Error(
          `Unable to check the roles of ${where} without \`users\`.`
        )
      }
      if (transacted && !adapter.transact) {
        throw new Error(
          `Unable to run ${where} in a transaction: the adapter has no ` +
          '`transact`.'
        )
      }
      return {
        action,
        path: `/${[definition.path, action.path].filter(Boolean).join('/')}`
      }
    })
  )
  // Hono runs the first route that matches, so static segments go before
  // parameters, also across controllers: `get subscribe` before `get :id`.
  routes.sort((a, b) => compareRanks(rank(a.path), rank(b.path)))
  for (const { action, path } of routes) {
    const method = action.verb.toUpperCase()
    const shape = `${method} ${getRouteShape(path)}`
    if (routeShapes.has(shape)) {
      throw new Error(`Unable to route '${method} ${path}' twice.`)
    }
    routeShapes.add(shape)
    const handlers: Middleware[] = [
      ...setup,
      ...getMiddleware(action, adapter.transact),
      async c => respond(c, action)
    ]
    app.on(method, path, ...(handlers as [Middleware]))
  }
  app.onError(createErrorHandler({ onError, toHttpError: adapter.toHttpError }))
  return app
}

// Set `c.var.action`, authorize, validate the query and the body, open the
// transaction, and run the action's `middleware`, in this order.
function getMiddleware(
  action: ResolvedAction,
  transact: Transact | undefined
): Middleware[] {
  const { authorize, query, body, key, verb } = action
  const middleware: Middleware[] = [
    async (c, next) => {
      c.set('action', key)
      await next()
    }
  ]
  // Reads without `authorize` let anyone in.
  if (authorize !== undefined && authorize !== true) {
    middleware.push(async (c, next) => {
      if (!(await isAuthorized(c, authorize))) {
        throw new HttpError(c.var.user ? 403 : 401)
      }
      await next()
    })
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
  if (transact && (action.transacted ?? verb !== 'get')) {
    // Hono handles errors where they are thrown, and `next()` resolves with
    // `c.error` set. Throwing it again rolls the transaction back.
    middleware.push(async (c, next) => {
      try {
        await transact(c, async () => {
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

// Shared with `createAdmin()`. A function lets the user in only by returning
// `true`.
export async function isAuthorized(c: DitoContext, authorize: Authorize) {
  const { user } = c.var
  return isFunction(authorize)
    ? (await authorize({ ...c.var, c })) === true
    : authorize === true ||
      (!!user && asArray(authorize).some(role => user.roles.includes(role)))
}

function validate(target: 'query' | 'json', schema: z.ZodType): Middleware {
  return async (c, next) => {
    const { data, error } = await schema.safeParseAsync(
      target === 'query'
        ? convertQuery(schema, c.req.queries())
        : await readBody(c)
    )
    if (error) {
      throw createValidationError(
        error.issues,
        target === 'query' ? queryValidation : bodyValidation
      )
    }
    c.req.addValidatedData(target, data as object)
    await next()
  }
}

async function respond(c: DitoContext, action: ResolvedAction) {
  const context: Omit<HandlerContext, 'next'> = {
    // The variables of Dito and of the app, such as a session's.
    ...c.var,
    query: action.query ? c.req.valid('query') : c.req.query(),
    params: c.req.param(),
    c
  }
  const result = await action.run(context)
  if (result instanceof Response) {
    return addHeaders(c, result)
  } else if (result === undefined) {
    // Hono keeps the status of `c.status()` private, and it is 200 without one:
    const { status } = c.newResponse(null)
    return c.body(null, (status === 200 ? 204 : status) as never)
  }
  return c.json(result as never)
}

// Hono drops the headers of `c.header()` when it runs before `c.res` exists.
// Responses of `c.redirect()` hold them already, and a response's own win.
function addHeaders(c: DitoContext, response: Response) {
  const cookies = response.headers.getSetCookie()
  const added = [...c.newResponse(null).headers].filter(([name, value]) =>
    name === 'set-cookie'
      ? !cookies.includes(value)
      : !response.headers.has(name)
  )
  if (added.length) {
    // The headers of some responses, such as `Response.redirect()`, are
    // immutable.
    const copy = new Response(response.body, response)
    for (const [name, value] of added) copy.headers.append(name, value)
    return copy
  } else {
    return response
  }
}

async function readBody(c: Context) {
  const type = c.req.header('Content-Type')
  // As Hono's validator does, which reads no JSON without a type.
  if (!type) return {}
  // Bodies of other types stay unread, for the handler.
  if (!/^application\/([\w.-]+\+)?json\b/i.test(type)) return undefined
  const text = await c.req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, { message: 'The body is invalid JSON.' })
  }
}

function getRouteShape(path: string) {
  // Leave out the names of parameters, so that routes that match the same
  // requests have the same shape:
  return path
    .split('/')
    .map(segment => segment.replace(/^:[^{]*/, ':'))
    .join('/')
}

// Rank segments by how much they match: 0 for static ones, 1 for parameters
// with a pattern, 2 for plain parameters, and 3 for wildcards and patterns
// that match any text, such as `:path{.+}`.
function rank(path: string) {
  return path.split('/').map(segment =>
    segment === '*' || /^:.*\{\.[+*]\}$/.test(segment)
      ? 3
      : segment[0] === ':'
        ? segment.includes('{')
          ? 1
          : 2
        : 0
  )
}

function compareRanks(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return 0
}
