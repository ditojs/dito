# API

```js
import { createApi, sendFile } from '@ditojs/server'
```

An API is a list of controllers in one [Hono](https://hono.dev) app. The host
routes it with `app.route()`. `api.fetch()` takes a web-standard `Request`
anywhere a `fetch` handler runs: on Node through [`serve()`](hono.md#serve), on
Bun and Deno, or in a test that calls `api.request()`. See
[API](../../guide/server/api.md) in the guide.

## createApi()

```ts
createApi(config: ApiConfig): Hono<DitoEnv>
```

Resolves the controllers and their mixins, and adds their routes to a new Hono
app, with one sub-app per controller at its path. It throws for invalid
definitions, so errors appear when the app starts, not on the first request.
These are invalid:

- an action key that isn't `'verb'` or `'verb path'`, or a path with empty
  segments;
- a controller `path` with empty segments, such as `/books` or
  `books//chapters`, or that holds `:id`;
- two actions that route the same method and path, in one controller or across
  controllers;
- a write action (`post`, `put`, `patch`, `delete`) without `authorize` on the
  action or on a layer, see [Authorization](controllers.md#authorize);
- a routed action without a handler.

Hono runs the first route that matches. Dito adds the routes by how much they
match, also across controllers: static segments first, then parameters with a
pattern, plain parameters, and last wildcards and patterns of any text. So
`get subscribe` matches before `get :id{[0-9]+}`, and that before `get :slug`.

```js
const app = new Hono()
app.route('/api/admin', createApi({ controllers: adminControllers }))
app.route('/api', createApi({ controllers }))
app.onError(errorHandler())
app.notFound(notFound)
```

An API handles only the paths of its actions and leaves the others to the app,
so it also works at `/`. The app's [`notFound`](errors.md#notfound) handles
them.

### ApiConfig

| Key           | Type                                           | Description                                                                                                                                                 |
| ------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controllers` | `ControllerDefinition[] \| object`             | The controllers, from `defineController()` of `@ditojs/server` or `@ditojs/mikro`. In an object, such as a module namespace, all other values are ignored.  |
| `middleware`  | `Middleware \| Middleware[]`                   | Hono middleware for every request of the API, such as sessions. It runs first, before Dito sets `c.var.db` and `c.var.user`.                                |
| `db`          | [`DbAdapter`](#dbadapter)                      | The database adapter, such as [`mikroDb(orm)`](mikro.md#mikrodb). Without it, `db` is undefined and no action runs in a transaction.                        |
| `getUser`     | `(c) => User \| null \| Promise<User \| null>` | Returns the signed-in user, `{ id, roles }`, which becomes `c.var.user`. Without it, the user is `null`.                                                    |
| `onError`     | `(error, c) => void \| Promise<void>`          | Called with each error with a status of 500 or above, for the app's logs. By default, logs through `c.var.logger`, else `console`. See [Errors](errors.md). |

### The request

For each request of an action, Hono and Dito:

1. match the route. `HEAD` runs the `GET` action and sends no body;
2. run the API's `middleware`;
3. set `c.var.db` with `connect()` of `db`, and `c.var.user` with `getUser`;
4. set `c.var.action`, the key of the action;
5. check the action's `authorize`, which responds with 401 without a user and
   403 with one;
6. validate the query and the body with the action's schemas, through
   `validator()` of `hono/validator`;
7. set `c.var.body` for writes, so invalid JSON fails before the transaction;
8. open the transaction of `db`, for writes unless `transaction: false`, and for
   reads with `transaction: true`;
9. run the `middleware` of the layers and of the action;
10. run the handler with its input, and send the result, see
    [Handler](controllers.md#handler).

Errors go to the API's error handler, which works like
[`errorHandler()`](errors.md#errorhandler), with `onError` and `toHttpError()`
of `db`. Hono handles an error where it is thrown, so the `await next()` of
middleware returns, with the error in `c.error`. The transaction rolls back when
`c.error` is set.

### The handler's input

```ts
interface DitoInput<Query, Body> extends DitoVariables {
  query: Query
  body: Body
  params: Record<string, string>
  c: DitoContext<Query, Body>
  next: () => Promise<unknown>
}
```

Dito builds the input for each request and each layer:

| Key      | Description                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`  | The result of the action's `query` schema, or else the first value of each parameter.                                                                                                                                                                                                                            |
| `body`   | For writes, the result of the action's `body` schema, or else the JSON body. An empty body and a body without `Content-Type` are `{}`, so a JSON body without it is dropped, and invalid JSON responds with 400. Bodies of other types, such as form data, are `undefined`, and handlers read them from `c.req`. |
| `params` | The parameters of the path, by name, such as `params.id` of a member action.                                                                                                                                                                                                                                     |
| `user`   | The signed-in user, or `null`.                                                                                                                                                                                                                                                                                   |
| `db`     | The database handle of the request, from `connect()` of `db`, such as a fork of the entity manager. During a transaction, the transaction's handle.                                                                                                                                                              |
| `action` | The key of the action that runs, such as `'get'` or `'post :id/publish'`.                                                                                                                                                                                                                                        |
| `c`      | [Hono's context](controllers.md#ditocontext) of the request.                                                                                                                                                                                                                                                     |
| `next`   | Runs the handler beneath, and returns its result. That handler sees the changes that this one makes to its input, such as a new `body`.                                                                                                                                                                          |

`user`, `db`, `action` and `body` are also Hono variables, `c.var.user` and so
on, which middleware and `authorize` read. They read parameters with
`c.req.param()`, such as `c.req.param('id')`. The input also holds all other
variables, such as `record()`, `find()` and `list()` of
[model controllers](mikro.md#definecontroller), and a session that middleware
sets with `c.set()`. Apps type their own by augmenting `DitoVariables`:

```ts
declare module '@ditojs/server' {
  interface DitoVariables {
    session?: Session
  }
}
```

### DbAdapter

```ts
interface DbAdapter {
  connect?(c: DitoContext): unknown
  transaction?: Transaction
  toHttpError?(error: unknown, c: DitoContext): HttpError | undefined
}
```

The database adapter of an API, such as [`mikroDb()`](mikro.md#mikrodb).
`connect()` returns the database handle of a request, which becomes `c.var.db`.
`transaction` runs the actions that need one. Without it, no action runs in a
transaction. `toHttpError()` maps the database's errors to an `HttpError`, and
returns `undefined` for others.

### Transaction

```ts
type Transaction = <T>(c: DitoContext, fn: () => Promise<T>) => Promise<T>
```

Runs `fn` in a transaction, and rolls it back when `fn` throws. While `fn` runs,
`c.var.db` is the transaction's handle.

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

Returns a response with a file, such as a generated export. `body` may be a
stream, such as a Node `Readable`. `Content-Disposition` is `attachment`, or
`inline` with `inline: true`, and names `filename`, if given. `Content-Type` is
`type`, by default the type of the file's extension, else
`application/octet-stream`.

```js
'get export': async ({ db, c }) =>
  sendFile(c, await createCsv(db), { filename: 'orders.csv' })
```
