# API

```js
import { createApi, sendFile } from '@ditojs/server'
```

An API is a list of controllers in one [Hono](https://hono.dev) app. The app
routes it with `app.route()`. `api.fetch()` takes a web-standard `Request`. So
an API runs anywhere a `fetch` handler runs:

- on Node, through [`serve()`](hono.md#serve);
- on Bun and Deno;
- in a test that calls `api.request()`.

See [API](../../guide/server/api.md) in the guide.

## createApi()

```ts
createApi(config: ApiConfig): Hono<DitoEnv>
```

```js
const app = new Hono()
app.route('/api/admin', createApi({ controllers: adminControllers }))
app.route('/api', createApi({ controllers }))
app.onError(createErrorHandler())
app.notFound(notFound)
```

Resolves the controllers and their mixins, and adds their routes to one new Hono
app. It throws for invalid definitions, so errors appear when the app starts,
not on the first request. These are invalid:

- an action key that isn't `'verb'` or `'verb path'`, or a path with empty
  segments;
- a controller `path` with empty segments, such as `/books` or
  `books//chapters`;
- a controller `path` that holds `:id`;
- two actions that route the same method and path, in one controller or across
  controllers;
- a write action (`post`, `put`, `patch`, `delete`) without `authorize`, on the
  action or on a layer, see [Authorization](controllers.md#authorize);
- a routed action without a handler;
- an action whose `authorize` holds roles when the API has no `getUser`, as no
  user could have them;
- an action with `transacted: true` when the adapter has no `transaction`.

Hono runs the first route that matches. So Dito adds the routes by how much
they match, also across controllers:

1. static segments;
2. parameters with a pattern;
3. plain parameters;
4. wildcards and patterns of any text.

So `get subscribe` matches before `get :id{[0-9]+}`, and that before
`get :slug`.

An API handles only the paths of its actions, and leaves the others to the app.
So it also works at `/`. The app's [`notFound`](errors.md#notfound) handles the
other paths.

### ApiConfig

| Key           | Type                                               | Description                                                                                                                                                                              |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controllers` | `ControllerDefinition[] \| object`                 | The controllers, from `defineController()` of `@ditojs/server` or `defineModelController()` of `@ditojs/mikro`. In an object, such as a module namespace, Dito ignores all other values. |
| `users`       | `{ middleware, getUser? }`                         | The result of [`createUsers()`](auth.md#createusers). Its middleware runs first, and `getUser` defaults to its own.                                                                      |
| `middleware`  | `Middleware \| Middleware[]`                       | Hono middleware for every request of the API, such as sessions. It runs first, before Dito sets `c.var.em` and `c.var.user`.                                                             |
| `adapter`     | [`Adapter`](#adapter)                              | The database: [`createMikroAdapter(orm)`](mikro.md#createmikroadapter). Without it, `em` is undefined, and no action runs in a transaction.                                              |
| `getUser`     | `({ c }) => User \| null \| Promise<User \| null>` | Returns the signed-in user, `{ id, roles }`, which becomes `c.var.user`. Without it, the user is `null`.                                                                                 |
| `onError`     | `({ error, c }) => void \| Promise<void>`          | Gets each error with a status of 500 or above, for the app's logs, not the response. By default, it logs through `c.var.logger`, else through `console`. See [Errors](errors.md).        |

### The request

For each request of an action, Hono and Dito:

1. match the route. `HEAD` runs the `GET` action and sends no body;
2. run Hono's `contextStorage()`, for functions such as
   [`useEm()`](mikro.md#useem) and [`useSession()`](auth.md#usesession);
3. run the middleware of `users`, and the API's `middleware`;
4. set `c.var.em` with `connect()` of the adapter;
5. set `c.var.user` with `getUser`;
6. set `c.var.action`, the key of the action;
7. check the action's `authorize`, which responds with 401 without a user, and
   with 403 with one;
8. validate the query and the body with the action's schemas, through
   `validator()` of `hono/validator`;
9. set `c.var.body` for writes, so that invalid JSON fails before the
   transaction;
10. open the adapter's transaction, for writes unless `transacted: false`, and for
    reads with `transacted: true`;
11. run the `middleware` of the layers and of the action;
12. run the handler with its context, and send the result, see
    [Handler](controllers.md#handler).

Errors go to the API's error handler. It works like
[`createErrorHandler()`](errors.md#createerrorhandler), with the API's `onError`
and the adapter's `toHttpError()`. Hono handles an error where it is thrown. So
the `await next()` of middleware returns, and `c.error` holds the error. The
transaction rolls back when `c.error` is set.

### The handler's context

```ts
interface HandlerContext<Query, Body> extends DitoVariables {
  query: Query
  body: Body
  params: Record<string, string>
  c: DitoContext<Query, Body>
  next: () => Promise<unknown>
}
```

Dito builds the context for each request and each layer:

| Key      | Description                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `query`  | The result of the action's `query` schema. Without a schema, the first value of each parameter.                                           |
| `body`   | For writes, the result of the action's `body` schema. Without a schema, the JSON body. See [The body](#the-body).                         |
| `params` | The parameters of the path, by name, such as `params.id` of a record action.                                                              |
| `user`   | The signed-in user, or `null`.                                                                                                            |
| `em`     | The request's entity manager, from `connect()` of the `adapter`. During a transaction, the transaction's entity manager.                  |
| `action` | The key of the action that runs, such as `'get'` or `'post :id/publish'`.                                                                 |
| `c`      | [Hono's context](controllers.md#ditocontext) of the request.                                                                              |
| `next`   | Runs the handler beneath, and returns its result. That handler sees the changes that this one makes to its context, such as a new `body`. |

`user`, `em`, `action` and `body` are also Hono variables, such as `c.var.user`.
Middleware and `authorize` read them there. They read the parameters with
`c.req.param()`, such as `c.req.param('id')`.

The context also holds all other variables:

- `getRecord()`, `find()` and `list()` of
  [model controllers](mikro.md#definemodelcontroller);
- the app's own, such as a session that middleware sets with `c.set()`.

Apps type their own variables by augmenting `DitoVariables`:

```ts
declare module '@ditojs/server' {
  interface DitoVariables {
    session?: Session
  }
}
```

### The body

The `body` of a write, and the input of a `body` schema, follow these rules:

- An empty body is `{}`.
- A body without `Content-Type` is `{}` too. So a JSON body without it is
  dropped, and a `PATCH` then changes nothing.
- The type is read in any case, such as `Application/JSON`.
- Invalid JSON responds with 400.
- Bodies of other types are `undefined`. Handlers read them from `c.req`, such
  as `c.req.arrayBuffer()`.

### Adapter

```ts
interface Adapter {
  connect?(c: DitoContext): DitoVariables['em'] | Promise<DitoVariables['em']>
  transaction?: Transaction
  toHttpError?(error: unknown, c: DitoContext): HttpError | undefined
}
```

The object that [`createMikroAdapter()`](mikro.md#createmikroadapter) returns:

- `connect()` returns the request's entity manager, which becomes `c.var.em`.
- `transaction` runs the actions that need a transaction. Without it, no action
  runs in one.
- `toHttpError()` maps the database's errors to an `HttpError`. It returns
  `undefined` for other errors.

### Transaction

```ts
type Transaction = <T>(c: DitoContext, fn: () => Promise<T>) => Promise<T>
```

Runs `fn` in a transaction. When `fn` throws, it rolls the transaction back.
While `fn` runs, `c.var.em` is the transaction's entity manager.

## sendFile()

```ts
sendFile(
  c: Context,
  body: BodyInit | AsyncIterable<Uint8Array>,
  options: SendFileOptions
): Response
interface SendFileOptions {
  filename?: string
  type?: string
  inline?: boolean
}
```

```js
'get export': async ({ em, c }) =>
  sendFile(c, await createCsv(em), { filename: 'loans.csv' })
```

Returns a response with a file, such as a generated export.

- `body` may be a stream, such as a Node `Readable`.
- `Content-Disposition` is `attachment`, or `inline` with `inline: true`. It
  names `filename`, if given.
- `Content-Type` is `type`. By default, it is the type of the file's extension,
  else `application/octet-stream`.
