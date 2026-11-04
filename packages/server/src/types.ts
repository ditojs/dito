import type { z } from 'zod'
import type { Context, MiddlewareHandler } from 'hono'
import type { HttpError } from './errors.ts'

// A controller is a plain object with one map of `actions`, keyed
// `'verb path'`, such as `get`, `get :id` or `post :id/publish`. A path that
// starts with `:id` is a member action. Paths use Hono's syntax. A handler gets
// one object, the input of the request, with Hono's context as `c` and the
// handler beneath as `next`. Middleware reads Dito's variables from `c.var`.

export type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'

type ActionKey = Verb | `${Verb} ${string}`

export interface User {
  id: number | string
  roles: string[]
}

// The variables that Dito sets on Hono's context of each request.
export interface DitoVariables {
  // The signed-in user, or null.
  user: User | null
  // The database handle of the request, from `connect()` of the API's `db`,
  // such as a fork of the entity manager. During a transaction, the
  // transaction's handle.
  db: any
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

// The input of a handler, built for each request and each layer. It also holds
// the app's own variables, such as a session.
export interface DitoInput<Query = Record<string, any>, Body = any>
  extends DitoVariables {
  // The result of the `query` schema, else the first value of each
  // parameter.
  query: Query
  body: Body
  params: Record<string, string>
  // Hono's context.
  c: DitoContext<Query, Body>
  // Runs the handler of the same key in the layer beneath, and returns its
  // result. That handler sees the changes that this one makes to its input.
  next: () => Promise<unknown>
}

// Hono middleware, which reads Dito's variables from `c.var`.
export type Middleware = MiddlewareHandler<DitoEnv>

// `true` lets anyone in. Roles grant access if the user has any of them. A
// function gets the context, and reads the id of a member action with
// `c.req.param('id')`.
export type Authorize =
  | true
  | string
  | string[]
  | ((c: DitoContext) => boolean | Promise<boolean>)

// A handler returns data, which Dito sends as JSON, or a `Response`.
export type Handler<Query = Record<string, any>, Body = any> = (
  input: DitoInput<Query, Body>
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
  transaction?: boolean
}

// An action with schemas, from `action()`, which types `query` and `body` of
// the input from them.
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

// Runs `fn` in a transaction, with the transaction's handle as `c.var.db`,
// and rolls back when `fn` throws.
export type Transaction = <T>(
  c: DitoContext,
  fn: () => Promise<T>
) => Promise<T>

// The JSON of an error. `errors` holds validation errors by the path of the
// invalid value, such as `chapters/8/title`. Other keys are the error's data.
export interface HttpErrorBody {
  [key: string]: unknown
  type?: string
  message: string
  status: number
  code?: string
  errors?: Record<string, { message: string; keyword?: string }[]>
}

// The database of an API, such as `mikroDb(orm)`.
export interface DbAdapter {
  // The database handle of a request, as `c.var.db`.
  connect?: (c: DitoContext) => unknown
  // Runs the actions that need a transaction. Without it, none runs in one.
  transaction?: Transaction
  // The `HttpError` of a database error, or undefined for other errors.
  toHttpError?: (error: unknown, c: DitoContext) => HttpError | undefined
}

// Called with each error with a status of 500 or above, for the app's logs.
export type ErrorLogger = (error: unknown, c: Context) => void | Promise<void>

export interface ApiConfig {
  // A list, or an object such as a module namespace, of which only the
  // results of `defineController()` count.
  controllers: ControllerDefinition[] | Record<string, unknown>
  // Middleware of every action, before the user is read, such as sessions.
  middleware?: Middleware | Middleware[]
  db?: DbAdapter
  // The signed-in user of the request, or null.
  getUser?: (c: DitoContext) => User | null | Promise<User | null>
  // By default, logs through `c.var.logger`, else `console`.
  onError?: ErrorLogger
}
