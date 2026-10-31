import type { StandardSchemaV1 } from '@standard-schema/spec'

// The controller model of Dito's server, on `Request` and `Response`. A
// controller is a plain object: actions on its collection and on each member,
// keyed `'verb path'`, and the verbs `get`, `post`, `patch`, `put` and `delete`
// without a path. The core knows no ORM. An ORM package builds its model
// controllers as a base layer of handlers and slots (`load`, `finish`,
// `toJSON`) under the controller's own definitions, which wrap them through
// `next`.

export type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface User {
  id: number | string
  roles: string[]
}

// The values of `ctx.locals`: what the host passes to `fetch()`, and what
// middleware sets. Apps and packages add theirs by augmenting this interface.
export interface DitoLocals {}

// The status and headers of the response. Dito uses them for the data that a
// handler returns, and adds the headers to a `Response` that it returns.
export interface ResponseInit {
  status: number | undefined
  headers: Headers
}

export interface DitoContext<Query = Record<string, string>, Body = any> {
  req: Request
  url: URL
  params: Record<string, string>
  // The validated query with a `query` schema, else the first value of each
  // parameter. `ctx.url.searchParams` holds all values.
  query: Query
  // The JSON body, parsed once per request. It returns the same value each
  // time, which handlers may change. With a `body` schema, it is the
  // validated body. An empty body is `{}`, or undefined on a GET, and invalid
  // JSON answers 400.
  body: () => Promise<Body>
  res: ResponseInit
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
  locals: DitoLocals
}

export interface ActionInfo {
  controller: string
  on: 'collection' | 'member'
  // The definition key, such as `get` or `post publish`.
  name: string
  verb: Verb
  // The action's schemas, for code that reads the raw query or body.
  query: StandardSchemaV1 | undefined
  body: StandardSchemaV1 | undefined
}

// Runs around an action. `next()` runs the rest of the chain and returns its
// response. Middleware returns that response, or one of its own.
export type Middleware = (
  ctx: DitoContext,
  next: () => Promise<Response>
) => Response | Promise<Response>

// Roles, any of which grant access, or a function of the context. `$owner`
// grants access to the member's owner, through the controller's `owner` slot.
export type Authorize =
  | boolean
  | string
  | string[]
  | ((ctx: DitoContext) => boolean | Promise<boolean>)

// `next` runs the definition this one wraps: the ORM package's default verb,
// or a feature's action of the same name. It returns that handler's result.
// A handler returns data, which Dito sends as JSON, or a `Response`.
export type Handler<Query = Record<string, string>, Body = any> = (
  ctx: DitoContext<Query, Body>,
  next: () => Promise<unknown>
) => unknown

type Output<S, Default> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<S>
  : Default

export interface ActionDefinition<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
> {
  authorize?: Authorize
  // Validate `ctx.query` and `ctx.body()`.
  query?: Q
  body?: B
  // Middleware around this action only, such as caching.
  around?: Middleware | Middleware[]
  // Writes run in a transaction unless this is false. Reads can set true.
  transacted?: boolean
  handler: Handler<Output<Q, Record<string, string>>, Output<B, any>>
}

export type ActionValue = Handler | ActionDefinition<any, any>

// `allow` lists the default verbs of the base to route, `*` for all of them.
export type Actions = { allow?: (Verb | '*')[] } & {
  [key in Verb | `${Verb} ${string}`]?: ActionValue
}

export interface Slots {
  // Loads the member of a member action, behind `ctx.load()`.
  load?: (ctx: DitoContext, id: number) => Promise<unknown>
  // Turns a row a handler returns into JSON, before `serialize`.
  toJSON?: (ctx: DitoContext, row: unknown) => unknown
  // Whether a value a handler returns is a row of this controller, which
  // goes through `toJSON` and `serialize`. Other values are sent as they are.
  isRow?: (value: unknown) => boolean
  // Runs once on the result of the handlers, before `toJSON`, and inside the
  // transaction if there is one. It gets every result, also `undefined` and
  // values that aren't rows. It returns nothing, or a result to send instead.
  finish?: (ctx: DitoContext, result: unknown) => unknown
  // The id of the member's owner, for `authorize: '$owner'`.
  owner?: (ctx: DitoContext) => Promise<unknown>
}

export interface FeatureDefinition extends Slots {
  authorize?: Authorize
  transacted?: boolean
  around?: Middleware | Middleware[]
  use?: FeatureDefinition[]
  collection?: Actions
  member?: Actions
  // Called per row after `toJSON`. Returns the JSON to send.
  serialize?: (ctx: DitoContext, row: any, json: any) => unknown
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

// Runs `fn` in a transaction and sets `ctx.trx` for it. An ORM package
// provides it, and `createApp` runs the transacted actions through it. It
// rolls back when `fn` throws. During `fn`, `ctx.db` is `ctx.trx`.
export type Transaction = <T>(
  ctx: DitoContext,
  fn: () => Promise<T>
) => Promise<T>

// RFC 9457. `errors` holds validation errors by JSON Pointer, such as
// `/sets/8/name`. Other members are extension members.
export interface HttpErrorBody {
  [member: string]: unknown
  type?: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, { message: string; code?: string }[]>
}

export interface AppConfig {
  // The prefix of every controller path, such as `/api/admin`.
  base?: string
  controllers: ControllerDefinition[]
  // Middleware of every action, before the action's authorization, such as
  // sessions.
  around?: Middleware | Middleware[]
  transaction?: Transaction
  // The database handle of a request, as `ctx.db`. An ORM package provides
  // it.
  connect?: (ctx: DitoContext) => unknown
  // The signed-in user of the request, or null.
  getUser?: (ctx: DitoContext) => User | null | Promise<User | null>
  // Turns an error into its response, `errorResponse()` by default. The app
  // logs errors here.
  onError?: (error: unknown, ctx: DitoContext) => Response | Promise<Response>
}

export interface App {
  // Answers a request. `locals` become `ctx.locals`.
  fetch: (request: Request, locals?: Partial<DitoLocals>) => Promise<Response>
}
