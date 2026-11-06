import type { z } from 'zod'
import type { Context, ContextVariableMap, MiddlewareHandler } from 'hono'
import type { HttpError } from './errors.ts'

// A controller is a plain object with one map of `actions`, keyed
// `'verb path'`, such as `get`, `get :id` or `post :id/publish`. A path that
// starts with `:id` is a record action. Paths use Hono's syntax. A handler gets
// one object, its context, with Hono's context as `c` and the handler beneath
// as `next`. Middleware reads Dito's variables from `c.var`.

export type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'

type ActionKey = Verb | `${Verb} ${string}`

// The signed-in user of a request, such as the entity of `@ditojs/auth`. A user
// without `roles` has none.
export interface User {
  id: number | string
  roles?: string[] | null
}

// The handle of the database, which adapters type by augmenting
// `DitoVariables`, such as `@ditojs/mikro/types`. A property of
// `DitoVariables` itself couldn't change its type.
interface DatabaseVariables {
  // The database handle of the request, from `connect()` of the API's
  // adapter, such as a fork of MikroORM's entity manager. During a
  // transaction, the transaction's handle.
  em: any
}

// The variables of each request on Hono's context. Dito sets these, and its
// packages add their own by augmenting this interface.
export interface DitoVariables extends DatabaseVariables {
  // The signed-in user, or null.
  user: User | null
  // The `onError` of the API, for errors that no response reports, such as
  // those of work that outlives the request.
  onError: ReportError
  // The key of the action that runs, such as `get` or `post :id/publish`.
  action: string
  // The result of the `body` schema, else the JSON body of a write: `{}` when
  // it is empty, and undefined for other types, such as form data, which
  // handlers read from `c.req`. Invalid JSON responds with 400. Dito sets it
  // after the validation, so the middleware of actions and layers can read and
  // replace it. Reads have no body.
  body: any
}

export interface DitoEnv {
  Variables: DitoVariables
}

// Hono's context of a Dito request. `c.req.valid('query')` and
// `c.req.valid('json')` have the types of the action's schemas.
export type DitoContext<Query = any, Body = any> = Context<
  DitoEnv,
  any,
  { out: { query: Query; json: Body } }
>

// What callbacks get for each request: its variables, also those of the app,
// and Hono's context. Callbacks with more arguments extend it.
export interface RequestContext<Query = any, Body = any>
  extends ContextVariableMap, DitoVariables {
  // Hono's context.
  c: DitoContext<Query, Body>
}

// The context of a handler, built for each request and each layer.
export interface HandlerContext<Query = Record<string, any>, Body = any>
  extends RequestContext<Query, Body> {
  // The result of the `query` schema, else the first value of each
  // parameter.
  query: Query
  body: Body
  params: Record<string, string>
  // Runs the handler of the same key in the layer beneath, and returns its
  // result. That handler sees the changes that this one makes to its context.
  next: () => Promise<unknown>
}

// Hono middleware, the only callback with the arguments `(c, next)`. It reads
// Dito's variables from `c.var`.
export type Middleware = MiddlewareHandler<DitoEnv>

// `true` lets anyone in. Roles grant access if the user has any of them. A
// function reads the id of a record action with `c.req.param('id')`.
export type Authorize =
  | true
  | string
  | string[]
  | ((context: RequestContext) => boolean | Promise<boolean>)

// A handler returns data, which Dito sends as JSON, or a `Response`.
export type Handler<Query = Record<string, any>, Body = any> = (
  context: HandlerContext<Query, Body>
) => unknown

type Output<S, Default> = S extends z.ZodType ? z.output<S> : Default

// The settings of actions, controllers and mixins.
export interface ActionSettings {
  // Every write needs it on the action or a layer.
  authorize?: Authorize
  // Middleware of this action only, such as caching. It runs after the
  // authorization, the validation and the start of the transaction.
  middleware?: Middleware | Middleware[]
  // Writes run in a transaction unless this is false, for actions that run
  // their own. Reads run in one if this is true.
  transacted?: boolean
}

// An action with schemas, from `defineAction()`, which types `query` and `body`
// of the handler's context from them.
export interface ActionDefinition<
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined
> extends ActionSettings {
  query?: Q
  body?: B
  handler: Handler<Output<Q, Record<string, string>>, Output<B, any>>
}

// `true` routes the handler of the same key in the layer beneath. A function
// is the handler. An object without `handler` keeps the handler beneath and
// adds settings.
type ActionValue =
  | true
  | Handler<Record<string, string>>
  | (ActionSettings & {
      query?: z.ZodType
      body?: z.ZodType
      handler?: Handler<any, any>
    })

export type Actions = { [key in ActionKey]?: ActionValue }

// A reusable part of a controller: a controller without `path`.
export interface MixinDefinition extends ActionSettings {
  mixins?: MixinDefinition[]
  actions?: Actions
}

export interface ControllerDefinition extends MixinDefinition {
  // The path below the API, such as `book-categories`. It may hold
  // parameters, such as `pages/:pageId/child-pages`, but not `:id`.
  path: string
}

// Runs `fn` in a transaction, with the transaction's handle as `c.var.em`,
// and rolls back when `fn` throws.
export type Transact = <T>(
  c: DitoContext,
  fn: () => Promise<T>
) => Promise<T>

// The database of an app, such as `createMikroAdapter(orm)`. An API uses the
// parts that it finds.
export interface Adapter {
  // The database handle of a request, as `c.var.em`.
  connect?: (
    c: DitoContext
  ) => DitoVariables['em'] | Promise<DitoVariables['em']>
  // Runs the actions that need a transaction. Without it, none runs in one,
  // and `createApi()` throws for actions with `transacted: true`.
  transact?: Transact
  // The `HttpError` of a database error, or undefined for other errors.
  toHttpError?: (context: {
    error: unknown
    c: DitoContext
  }) => HttpError | undefined
}

// Runs next to the server, such as a mailer or a scheduler. `stop()` ends once
// its work is done, as the database may close right after it.
export interface Service {
  start?: () => void | Promise<void>
  stop?: () => void | Promise<void>
}

// Called with each error with a status of 500 or above, for the app's logs.
export type ReportError = (context: {
  error: unknown
  c: Context
}) => void | Promise<void>

export interface CreateApiOptions {
  // A list, or an object such as a module namespace, of which only the plain
  // objects with a string `path` count.
  controllers: ControllerDefinition[] | Record<string, unknown>
  // The users of the API, such as the result of `createUsers()`.
  users?: {
    // Hono middleware that runs first on every action, to load a session.
    middleware?: Middleware | Middleware[]
    // The signed-in user of the request, or null.
    getUser: (context: { c: DitoContext }) => User | null | Promise<User | null>
  }
  adapter?: Adapter
  // By default, logs with `console.error()`.
  onError?: ReportError
}
