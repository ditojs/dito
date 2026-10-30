import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import type { StandardSchemaV1 } from '@standard-schema/spec'

// The controller model of Dito's server on Hono. A controller is a plain
// object: actions on its collection and on each member, keyed `'verb path'`,
// and the verbs `get`, `post`, `patch`, `put` and `delete` without a path.
// The core knows no ORM. An ORM package builds its model controllers as a
// base layer of handlers and slots (`load`, `finish`, `toJSON`) under the
// controller's own definitions, which wrap them through `next`.

export type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface User {
  id: number | string
  roles: string[]
}

// What Dito keeps on `c.var` for each request.
export interface DitoVariables {
  user: User | null
  // The id from the path of a member action, undefined on the collection.
  memberId: number | undefined
  // Loads the member through the controller's `load` slot, once per request.
  load: <T = any>() => Promise<T>
  // The database handle of the request, which handlers query through: the
  // one that the app's `connect()` returns, such as an entity manager fork or
  // a knex instance, and the transaction's handle during a transaction.
  db: unknown
  // The transaction's handle during a transaction, else undefined.
  trx: unknown
  // The action that runs, for middleware that reads its settings.
  action: ActionInfo
}

export interface DitoEnv extends Env {
  Variables: DitoVariables
}

export type DitoContext = Context<DitoEnv>

export interface ActionInfo {
  controller: string
  on: 'collection' | 'member'
  // The definition key, such as `get` or `post publish`.
  name: string
  verb: Verb
}

// Roles, any of which grant access, or a function of the context. `$owner`
// grants access to the member's owner, through the controller's `owner` slot.
export type Authorize =
  | boolean
  | string
  | string[]
  | ((c: DitoContext) => boolean | Promise<boolean>)

// `next` runs the definition this one wraps: the ORM package's default verb,
// or a feature's action of the same name. It returns that handler's result.
// `I` types `c.req.valid()` with the action's `query` and `body`.
export type Handler<I extends Input = {}> = (
  c: Context<DitoEnv, any, I>,
  next: () => Promise<unknown>
) => unknown

// The validated input of an action with these `query` and `body` schemas.
export interface ActionInput<Q, B> {
  out: (Q extends StandardSchemaV1
    ? { query: StandardSchemaV1.InferOutput<Q> }
    : {}) &
    (B extends StandardSchemaV1
      ? { json: StandardSchemaV1.InferOutput<B> }
      : {})
}

export interface ActionDefinition<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
> {
  authorize?: Authorize
  // Read in the handler with `c.req.valid('query')` and `c.req.valid('json')`.
  query?: Q
  body?: B
  // Middleware around this action only, such as caching.
  around?: MiddlewareHandler<DitoEnv> | MiddlewareHandler<DitoEnv>[]
  // Writes run in a transaction unless this is false. Reads can set true.
  transacted?: boolean
  handler: Handler<ActionInput<Q, B>>
}

export type ActionValue = Handler | ActionDefinition<any, any>

export type Actions = { allow?: Verb[] } & {
  [key in Verb | `${Verb} ${string}`]?: ActionValue
}

export interface Slots {
  // Loads the member of a member action, behind `c.var.load()`.
  load?: (c: DitoContext, id: number) => Promise<unknown>
  // Turns a row a handler returns into JSON, before `serialize`.
  toJSON?: (c: DitoContext, row: unknown) => unknown
  // Whether a value a handler returns is a row of this controller, which
  // goes through `toJSON` and `serialize`. Other values are sent as they are.
  isRow?: (value: unknown) => boolean
  // Runs once on the result of the handlers, before `toJSON`, and inside the
  // transaction if there is one. It gets every result, also `undefined` and
  // values that aren't rows. It returns nothing, or a result to send instead.
  finish?: (c: DitoContext, result: unknown) => unknown
  // The id of the member's owner, for `authorize: '$owner'`.
  owner?: (c: DitoContext) => Promise<unknown>
}

export interface FeatureDefinition extends Slots {
  authorize?: Authorize
  transacted?: boolean
  around?: MiddlewareHandler<DitoEnv> | MiddlewareHandler<DitoEnv>[]
  use?: FeatureDefinition[]
  collection?: Actions
  member?: Actions
  // Called per row after `toJSON`. Returns the JSON to send.
  serialize?: (c: DitoContext, row: any, json: any) => unknown
}

export interface ControllerDefinition extends FeatureDefinition {
  // The path under the app's base, such as `font-families`.
  path: string
}

// The parsed list parameters, for ORM packages to apply.
export interface ListQuery {
  // `filter[name]=value`, or Dito 6's `filter=name:args` and `scope=name`,
  // which the admin still sends.
  filters: { name: string; args: unknown[] }[]
  // `order=name desc`
  order: { property: string; direction: 'asc' | 'desc' }[]
  // `range=0,49`, inclusive.
  range: [number, number] | null
  // `fields=id,name,designers.name`
  fields: string[] | null
}

// Runs `fn` in a transaction and sets `c.var.trx` for it. An ORM package
// provides it, and `createApp` runs the transacted actions through it. During
// `fn`, `c.var.db` is `c.var.trx`.
export type Transaction = <T>(
  c: DitoContext,
  fn: () => Promise<T>
) => Promise<T>

// RFC 9457. `errors` holds validation errors by JSON Pointer. Other members
// are extension members, such as the `message` of Dito 6's errors.
export interface Problem {
  [member: string]: unknown
  type?: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, { message: string; keyword?: string }[]>
}

export interface AppConfig {
  // The prefix of every controller path, such as `/api/admin`.
  base?: string
  controllers: ControllerDefinition[]
  transaction?: Transaction
  // The database handle of a request, as `c.var.db`. An ORM package provides
  // it.
  connect?: (c: DitoContext) => unknown
  // The signed-in user of the request, or null.
  getUser: (c: DitoContext) => Promise<User | null>
}
