import type { StandardSchemaV1 } from '@standard-schema/spec'

// The controller model of Dito's server, on `Request` and `Response`. A
// controller is a plain object: actions on its collection and on each member,
// keyed `'verb path'`, and the verbs `get`, `post`, `patch`, `put` and `delete`
// without a path. Path segments such as `:name` become `ctx.params`. The core
// knows no ORM. An ORM package builds its model controllers as a base layer
// of default verbs and slots under the controller's own definitions, which
// wrap them through `next`.

export type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'

export type ActionKey = Verb | `${Verb} ${string}`

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

export interface DitoContext<
  Params = Record<string, string>,
  Query = Record<string, string>,
  Body = any
> {
  req: Request
  url: URL
  params: Params
  // The validated query with a `query` schema, else the first value of each
  // parameter. `ctx.url.searchParams` holds all values.
  query: Query
  // The JSON body, validated with a `body` schema. An empty body is `{}`, and
  // undefined on a GET. It is undefined for bodies of other types, such as
  // form data, which handlers read from `ctx.req`. Invalid JSON answers 400.
  body: Body
  res: ResponseInit
  user: User | null
  // The id from the path of a member action, undefined on the collection.
  // The ORM package's base converts it for the model's primary key.
  id: string | undefined
  // Loads the member through the controller's `load` slot, once per request.
  member: <T = any>() => Promise<T>
  // The database handle of the request, which handlers query through: the
  // one that the app's `connect()` returns, such as an entity manager fork or
  // a knex instance, and the transaction's handle during a transaction.
  db: unknown
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

// Runs before and after an action. `next()` runs the rest of the chain and
// returns its response. Middleware returns that response, or one of its own.
export type Middleware = (
  ctx: DitoContext,
  next: () => Promise<Response>
) => Response | Promise<Response>

// Roles, any of which grant access, or a function of the context.
export type Authorize =
  | string
  | string[]
  | ((ctx: DitoContext) => boolean | Promise<boolean>)

// `next` runs the definition this one wraps: the ORM package's default verb,
// or a feature's action of the same name. It returns that handler's result.
// A handler returns data, which Dito sends as JSON, or a `Response`.
export type Handler<
  Params = Record<string, string>,
  Query = Record<string, string>,
  Body = any
> = (
  ctx: DitoContext<Params, Query, Body>,
  next: () => Promise<unknown>
) => unknown

type Output<S, Default> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<S>
  : Default

interface ActionSettings {
  authorize?: Authorize
  // Middleware of this action only, such as caching.
  middleware?: Middleware | Middleware[]
  // Writes run in a transaction unless this is false, for actions that run
  // their own. Reads run in one if this is true.
  transaction?: boolean
}

// An action with schemas, from `action()`, which types `ctx.query` and
// `ctx.body` from them.
export interface ActionDefinition<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
> extends ActionSettings {
  query?: Q
  body?: B
  handler: Handler<
    Record<string, string>,
    Output<Q, Record<string, string>>,
    Output<B, any>
  >
}

export type ActionValue<Params = Record<string, string>> =
  | Handler<Params>
  | (ActionSettings & {
      query?: StandardSchemaV1
      body?: StandardSchemaV1
      handler: Handler<Params, any, any>
    })

// `allow` lists the default verbs of the base to route, `*` for all of them.
export type Actions = { allow?: (Verb | '*')[] } & {
  [key in ActionKey]?: ActionValue<any>
}

// The names of the `:name` and `:name+` segments of a path.
type ParamNames<P extends string> = P extends `${infer A}/${infer B}`
  ? ParamNames<A> | ParamNames<B>
  : P extends `:${infer N}+`
    ? N
    : P extends `:${infer N}`
      ? N
      : never

type PathOf<K> = K extends `${Verb} ${infer P}` ? P : ''

// The `ctx.params` of the action of key `K`. Member actions also have `id`.
export type ActionParams<K, On> = {
  [N in ParamNames<PathOf<K>> | (On extends 'member' ? 'id' : never)]: string
}

// The actions of `defineController()` and `defineFeature()`, whose handlers
// get the params of their own keys.
export type TypedActions<T, On> = { allow?: (Verb | '*')[] } & {
  [K in keyof T]: K extends 'allow'
    ? (Verb | '*')[]
    : K extends ActionKey
      ? ActionValue<ActionParams<K, On>>
      : never
}

export interface Slots {
  // Loads the member of a member action, behind `ctx.member()`.
  load?: (ctx: DitoContext, id: string) => Promise<unknown>
  // Whether a value a handler returns is a record of this controller, which
  // goes through `serialize`. Other values are sent as they are. Only the base
  // of an ORM package sets it.
  isRecord?: (value: unknown) => boolean
  // Runs once on the result of the handlers, before `serialize`, and inside
  // the transaction if there is one. It gets every result, also `undefined`
  // and values that aren't records. It returns nothing, or a result to send
  // instead.
  onResult?: (ctx: DitoContext, result: unknown) => unknown
}

export interface FeatureDefinition extends Slots, ActionSettings {
  features?: FeatureDefinition[]
  collection?: Actions
  member?: Actions
  // Called per record, in layer order. `json` is the record for the first
  // layer, which is the ORM package's base, and the result of the previous
  // layer for the others. Returns the JSON to send.
  serialize?: (ctx: DitoContext, record: any, json: any) => unknown
}

export interface ControllerDefinition extends FeatureDefinition {
  // The path under the app's prefix, such as `font-families`.
  path: string
}

// The parsed list parameters, for ORM packages to apply.
export interface ListQuery {
  // `filter[name]=value`, repeated for filters of several arguments.
  filters: { name: string; args: string[] }[]
  // `order=name desc`
  order: { property: string; direction: 'asc' | 'desc' }[]
  // `range=0,49`, inclusive. A list with a range answers
  // `{ results, total }`.
  range: [number, number] | null
  // `fields=id,name,designers.name`
  fields: string[] | null
}

// Runs `fn` in a transaction. An ORM package provides it, and `createApp`
// runs the actions that need one through it. It sets `ctx.db` to the
// transaction's handle during `fn` and restores it after, and it rolls back
// when `fn` throws.
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
  prefix?: string
  controllers: ControllerDefinition[]
  // Middleware of every action, before the action's authorization, such as
  // sessions.
  middleware?: Middleware | Middleware[]
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
