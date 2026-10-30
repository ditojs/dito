import { Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
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
import {
  ProblemError,
  createValidationError,
  getStatusTitle,
  respondProblem,
  toProblem
} from './errors.ts'
import type {
  AppConfig,
  Authorize,
  DitoContext,
  DitoEnv,
  Slots
} from './types.ts'

// Builds the Hono app of the controllers. Each action runs plugin middleware,
// sets the request's variables, authorizes, validates, and then runs the
// `around` middleware and the handler inside the transaction. Hono's chain
// turns an error into a response at the step that throws it, so the `around`
// middleware run in a chain of their own, which passes errors on to the
// transaction.

export function createApp(config: AppConfig) {
  const { base = '', controllers, plugins = [], getUser } = config
  const transaction = plugins.find(plugin => plugin.transaction)?.transaction
  const app = new Hono<DitoEnv>()

  app.onError((error, c) =>
    error instanceof HTTPException && error.res
      ? error.res
      : respondProblem(c, toProblem(error, plugins))
  )
  app.notFound(c =>
    respondProblem(c, { title: getStatusTitle(404), status: 404 })
  )

  for (const plugin of plugins) {
    if (plugin.middleware) app.use(plugin.middleware)
  }

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
      const transacted = (
        transaction && (
          action.info.verb === 'get'
            ? action.transacted === true
            : action.transacted !== false
        )
      )
      app.on(
        action.info.verb.toUpperCase(),
        [path || '/'],
        ...handlers,
        async c => {
          const execute = async () => {
            await runAround(c, action.around, async () => {
              c.res = await respond(c, controller, action)
            })
            return c.res
          }
          return transacted ? transaction(c, execute) : execute()
        }
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

async function runAround(
  c: DitoContext,
  around: MiddlewareHandler<DitoEnv>[],
  handler: () => Promise<void>
) {
  const dispatch = async (index: number): Promise<void> => {
    const middleware = around[index]
    if (!middleware) return handler()
    const response = await middleware(c, () => dispatch(index + 1))
    if (response instanceof Response) c.res = response
  }
  await dispatch(0)
}

async function respond(
  c: DitoContext,
  controller: ResolvedController,
  action: ResolvedAction
) {
  const result = await action.run(c)
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
