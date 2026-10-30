import { Hono, type MiddlewareHandler } from 'hono'
import { sValidator } from '@hono/standard-validator'
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
import { ProblemError, createValidationError } from './errors.ts'
import type {
  AppConfig,
  Authorize,
  DitoContext,
  DitoEnv,
  Slots,
  Transaction
} from './types.ts'

// Builds the Hono app of the controllers. Each action sets the request's
// variables, authorizes, validates, and then runs the `around` middleware and
// the handler inside the transaction. All of these are Hono middleware in one
// chain. The `finish` slot and `toJSON` run after the handler and inside the
// `around` middleware, which sees the response that they make. The app sets
// the `onError()` and `notFound()` handlers itself, and adds its middleware to
// a parent app that mounts this one, so that it runs before the actions.

export function createApp(config: AppConfig) {
  const { base = '', controllers, transaction, connect, getUser } = config
  const app = new Hono<DitoEnv>()

  for (const definition of controllers) {
    const controller = resolveController(definition)
    for (const action of controller.actions) {
      const path = `${base}/${controller.path}${action.route}`.replace(
        /\/+$/,
        ''
      )
      const handlers: MiddlewareHandler<DitoEnv>[] = [
        setup(controller, action),
        authorize(action.authorize, controller.slots)
      ]
      if (action.query) {
        handlers.push(validate('query', action.query))
      }
      if (action.body) {
        handlers.push(validate('json', action.body))
      }
      const transacted =
        action.info.verb === 'get'
          ? action.transacted === true
          : action.transacted !== false
      if (transaction && transacted) {
        handlers.push(transact(transaction))
      }
      app.on(
        action.info.verb.toUpperCase(),
        [path || '/'],
        ...handlers,
        ...action.around,
        c => respond(c, controller, action)
      )
    }
  }

  return app

  function setup(
    controller: ResolvedController,
    action: ResolvedAction
  ): MiddlewareHandler<DitoEnv> {
    const isMember = action.info.on === 'member'
    return async (c, next) => {
      const memberId = isMember ? Number(c.req.param('id')) : undefined
      let member: Promise<unknown> | undefined
      c.set('action', action.info)
      c.set('memberId', memberId)
      c.set('load', () => (member ??= load(c, controller, memberId)) as never)
      if (connect) c.set('db', await connect(c))
      c.set('user', await getUser(c))
      await next()
    }
  }
}

async function load(
  c: DitoContext,
  controller: ResolvedController,
  id: number | undefined
) {
  if (id === undefined) {
    throw new Error(`load() needs a member route in '${controller.path}'`)
  }
  if (!controller.slots.load) {
    throw new Error(`'${controller.path}' has no \`load\` slot`)
  }
  const member = await controller.slots.load(c, id)
  if (member == null) throw new ProblemError({ status: 404 })
  return member
}

function authorize(
  value: Authorize | undefined,
  slots: Slots
): MiddlewareHandler<DitoEnv> {
  return async (c, next) => {
    if (!(await isAuthorized(c, value, slots))) {
      throw new ProblemError({ status: c.var.user ? 403 : 401 })
    }
    await next()
  }
}

async function isAuthorized(
  c: DitoContext,
  value: Authorize | undefined,
  slots: Slots
) {
  if (value === undefined || value === true) return true
  if (value === false) return false
  if (isFunction(value)) return !!(await value(c))
  const { user } = c.var
  if (!user) return false
  const roles = asArray(value)
  if (roles.some(role => user.roles.includes(role))) return true
  if (!roles.includes('$owner')) return false
  if (!slots.owner) {
    throw new Error(`'${c.var.action.controller}' has no \`owner\` slot`)
  }
  const owner = await slots.owner(c)
  // Ids from the database may be strings, such as Postgres' bigints.
  return owner != null && String(owner) === String(user.id)
}

function validate(target: 'query' | 'json', schema: ResolvedAction['query']) {
  return sValidator(target, schema!, result => {
    if (!result.success) throw createValidationError(target, result.error)
  }) as MiddlewareHandler<DitoEnv>
}

// Hono turns an error into a response where it's thrown and stores it in
// `c.error`, so `next()` returns normally. Throwing `c.error` again rolls back.
// The error response is already set, so the error stops here. During the
// transaction, `c.var.db` is its handle, and the request's handle after it.
function transact(transaction: Transaction): MiddlewareHandler<DitoEnv> {
  return async (c, next) => {
    try {
      await transaction(c, async () => {
        const { db } = c.var
        c.set('db', c.var.trx ?? db)
        try {
          await next()
        } finally {
          c.set('db', db)
        }
        if (c.error) throw c.error
      })
    } catch (error) {
      if (error !== c.error) throw error
    }
  }
}

async function respond(
  c: DitoContext,
  controller: ResolvedController,
  action: ResolvedAction
) {
  let result = await action.run(c)
  const { finish } = controller.slots
  if (finish) {
    const replacement = await finish(c, result)
    if (replacement !== undefined) result = replacement
  }
  if (result instanceof Response) return result
  if (result === undefined) return c.body(null, 204)
  const json = await toJson(c, controller, result)
  return c.json(json as never, action.isCreate ? 201 : 200)
}

async function toJson(
  c: DitoContext,
  controller: ResolvedController,
  value: unknown
) {
  const { isRow, toJSON } = controller.slots
  if (!isRow) return value
  const convert = async (item: unknown) => {
    if (!isRow(item)) return item
    let json = toJSON ? await toJSON(c, item) : item
    for (const serialize of controller.serialize) {
      json = await serialize(c, item, json)
    }
    return json
  }
  if (isArray(value)) return mapConcurrently(value, convert)
  if (isPlainObject(value) && isArray(value.results) && 'total' in value) {
    return { ...value, results: await mapConcurrently(value.results, convert) }
  }
  return convert(value)
}
