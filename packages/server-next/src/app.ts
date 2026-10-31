import { addRoute, createRouter, findRoute } from 'rou3'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import {
  asArray,
  isArray,
  isFunction,
  isPlainObject,
  mapConcurrently
} from '@ditojs/utils'
import {
  resolveController,
  type ResolvedAction,
  type ResolvedController
} from './compose.ts'
import { HttpError, createValidationError, problemResponse } from './errors.ts'
import type {
  App,
  AppConfig,
  Authorize,
  DitoContext,
  DitoLocals,
  Middleware,
  Slots,
  Transaction
} from './types.ts'

// Builds the `fetch()` of the controllers. A request runs one chain of
// middleware: the app's `around`, then Dito sets the database handle and the
// user, authorizes and validates, opens the transaction for writes, and runs
// the `around` of the controller and the action. The handler runs last. The
// `finish` slot and `toJSON` run after it, inside the transaction and the
// `around` middleware, which see the response that they make. Errors are
// thrown through the chain and become responses in `onError`.

interface Route {
  controller: ResolvedController
  action: ResolvedAction
  chain: Middleware[]
}

export function createApp(config: AppConfig): App {
  const {
    base = '',
    controllers,
    around,
    transaction,
    connect,
    getUser,
    onError = problemResponse
  } = config
  const router = createRouter<Route>()

  for (const definition of controllers) {
    const controller = resolveController(definition)
    for (const action of controller.actions) {
      const path = `${base}/${controller.path}${action.route}`.replace(
        /\/+$/,
        ''
      )
      const chain: Middleware[] = [
        ...asArray(around),
        setup,
        authorize(action.authorize, controller.slots)
      ]
      if (action.query) chain.push(validateQuery(action.query))
      if (action.body) chain.push(validateBody(action.body))
      const transacted =
        action.info.verb === 'get'
          ? action.transacted === true
          : action.transacted !== false
      if (transaction && transacted) chain.push(transact(transaction))
      chain.push(...action.around)
      addRoute(router, action.info.verb.toUpperCase(), path || '/', {
        controller,
        action,
        chain
      })
    }
  }

  async function setup(ctx: DitoContext, next: () => Promise<Response>) {
    if (connect) ctx.db = await connect(ctx)
    ctx.user = (await getUser?.(ctx)) ?? null
    return next()
  }

  return {
    async fetch(req, locals = {}) {
      const response = await handle(req, locals)
      return req.method === 'HEAD'
        ? new Response(null, response)
        : response
    }
  }

  async function handle(req: Request, locals: Partial<DitoLocals>) {
    const url = new URL(req.url)
    const method = req.method === 'HEAD' ? 'GET' : req.method
    const match = findRoute(
      router,
      method,
      url.pathname.replace(/(.)\/+$/, '$1')
    )
    const params = match?.params ?? {}
    if (!match || ('id' in params && !/^\d+$/.test(params.id!))) {
      return problemResponse(new HttpError(404))
    }
    const { controller, action, chain } = match.data
    const ctx = createContext(req, url, params, locals, controller, action)
    try {
      const response = await run(ctx, chain, () =>
        respond(ctx, controller, action)
      )
      return withHeaders(response, ctx.res.headers)
    } catch (error) {
      // Error responses keep the cookies, such as a session's, but not the
      // headers that were meant for the data.
      const cookies = new Headers()
      for (const cookie of ctx.res.headers.getSetCookie()) {
        cookies.append('Set-Cookie', cookie)
      }
      return withHeaders(await onError(error, ctx), cookies)
    }
  }
}

function createContext(
  req: Request,
  url: URL,
  params: Record<string, string>,
  locals: Partial<DitoLocals>,
  controller: ResolvedController,
  action: ResolvedAction
): DitoContext {
  const memberId = action.info.on === 'member' ? Number(params.id) : undefined
  let member: Promise<unknown> | undefined
  let body: Promise<unknown> | undefined
  const ctx: DitoContext = {
    req,
    url,
    params,
    query: getQuery(url, true) as Record<string, string>,
    body: () => (body ??= parseBody(req)) as never,
    res: { status: undefined, headers: new Headers() },
    user: null,
    memberId,
    load: () => (member ??= load(ctx, controller, memberId)) as never,
    db: undefined,
    trx: undefined,
    action: action.info,
    locals: { ...locals } as DitoLocals
  }
  return ctx
}

function run(
  ctx: DitoContext,
  chain: Middleware[],
  last: () => Promise<Response>
) {
  const dispatch = async (index: number): Promise<Response> =>
    index < chain.length
      ? chain[index]!(ctx, () => dispatch(index + 1))
      : last()
  return dispatch(0)
}

// The query as an object: the first value of each parameter, or without
// `first`, an array for repeated parameters, which schemas validate.
function getQuery(url: URL, first: boolean) {
  const query: Record<string, string | string[]> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    query[key] = first || values.length === 1 ? values[0]! : values
  }
  return query
}

async function load(
  ctx: DitoContext,
  controller: ResolvedController,
  id: number | undefined
) {
  if (id === undefined) {
    throw new Error(`load() needs a member route in '${controller.path}'`)
  }
  if (!controller.slots.load) {
    throw new Error(`'${controller.path}' has no \`load\` slot`)
  }
  const member = await controller.slots.load(ctx, id)
  if (member == null) throw new HttpError(404)
  return member
}

async function parseBody(req: Request) {
  const text = await req.text()
  if (!text) return ['GET', 'HEAD'].includes(req.method) ? undefined : {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, { detail: 'The body is invalid JSON.' })
  }
}

function authorize(value: Authorize | undefined, slots: Slots): Middleware {
  return async (ctx, next) => {
    if (!(await isAuthorized(ctx, value, slots))) {
      throw new HttpError(ctx.user ? 403 : 401)
    }
    return next()
  }
}

async function isAuthorized(
  ctx: DitoContext,
  value: Authorize | undefined,
  slots: Slots
) {
  if (value === undefined || value === true) return true
  if (value === false) return false
  if (isFunction(value)) return !!(await value(ctx))
  const { user } = ctx
  if (!user) return false
  const roles = asArray(value)
  if (roles.some(role => user.roles.includes(role))) return true
  if (!roles.includes('$owner')) return false
  if (!slots.owner) {
    throw new Error(`'${ctx.action.controller}' has no \`owner\` slot`)
  }
  const owner = await slots.owner(ctx)
  // Ids from the database may be strings, such as Postgres' bigints.
  return owner != null && String(owner) === String(user.id)
}

async function validate(
  schema: StandardSchemaV1,
  value: unknown,
  detail: string
) {
  const result = await schema['~standard'].validate(value)
  if (result.issues) throw createValidationError(result.issues, detail)
  return result.value
}

function validateQuery(schema: StandardSchemaV1): Middleware {
  return async (ctx, next) => {
    ctx.query = (await validate(
      schema,
      getQuery(ctx.url, false),
      'The query is not valid.'
    )) as Record<string, string>
    return next()
  }
}

function validateBody(schema: StandardSchemaV1): Middleware {
  return async (ctx, next) => {
    const body = await validate(
      schema,
      await ctx.body(),
      'The body is not valid.'
    )
    ctx.body = async () => body as never
    return next()
  }
}

// During the transaction, `ctx.db` is its handle, and the request's handle
// after it. An error that the chain throws rolls it back.
function transact(transaction: Transaction): Middleware {
  return (ctx, next) =>
    transaction(ctx, async () => {
      const { db } = ctx
      ctx.db = ctx.trx ?? db
      try {
        return await next()
      } finally {
        ctx.db = db
      }
    })
}

async function respond(
  ctx: DitoContext,
  controller: ResolvedController,
  action: ResolvedAction
) {
  let result = await action.run(ctx)
  const { finish } = controller.slots
  if (finish) {
    const replacement = await finish(ctx, result)
    if (replacement !== undefined) result = replacement
  }
  if (result instanceof Response) return result
  const { status, headers } = ctx.res
  if (result === undefined) {
    return new Response(null, { status: status ?? 204, headers })
  }
  const json = await toJson(ctx, controller, result)
  return Response.json(json, {
    status: status ?? (action.isCreate ? 201 : 200),
    headers
  })
}

// Adds the headers of `ctx.res` to a response that a handler or middleware
// made. Cookies are added, and other headers only if the response has none.
function withHeaders(response: Response, headers: Headers) {
  const entries = [...headers].filter(([name, value]) =>
    name === 'set-cookie'
      ? !response.headers.getSetCookie().includes(value)
      : !response.headers.has(name)
  )
  if (!entries.length) return response
  // The headers of a fetched response are immutable.
  const copy = new Response(response.body, response)
  for (const [name, value] of entries) copy.headers.append(name, value)
  return copy
}

async function toJson(
  ctx: DitoContext,
  controller: ResolvedController,
  value: unknown
) {
  const { isRow, toJSON } = controller.slots
  if (!isRow) return value
  const convert = async (item: unknown) => {
    if (!isRow(item)) return item
    let json = toJSON ? await toJSON(ctx, item) : item
    for (const serialize of controller.serialize) {
      json = await serialize(ctx, item, json)
    }
    return json
  }
  if (isArray(value)) return mapConcurrently(value, convert)
  if (isPlainObject(value) && isArray(value.results) && 'total' in value) {
    return { ...value, results: await mapConcurrently(value.results, convert) }
  }
  return convert(value)
}
