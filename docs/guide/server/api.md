# API

An API is a list of controllers in one [Hono](https://hono.dev) app.
[`createApi()`](../../api/server/api.md#createapi) builds it, and the app routes
it with `app.route()`. The app passes in what Dito.js doesn't do itself: the
database and the user of a request.

```js
import { createApi } from '@ditojs/server'
import { mikroDb } from '@ditojs/mikro'

const api = createApi({
  controllers: [books, authors, orders],
  middleware: [sessions.middleware],
  db: mikroDb(orm),
  getUser: sessionUser(admins)
})
app.route('/api/admin', api)
```

`createApi()` throws for invalid controllers, such as two actions on the same
route or a write without `authorize`, so errors show when the app starts, not on
the first request.

`controllers` is a list, or an object such as a module namespace. In an object,
only the results of `defineController()` count, so the module can export other
things too:

```js
import * as controllers from './controllers/index.js'

const api = createApi({ controllers, db: mikroDb(orm) })
```

Each controller is a sub-app at its path. Hono runs the first route that
matches, so within a controller Dito adds the routes with static segments first:
`get subscribe` matches before `get :id`. The API handles only the paths of its
actions and leaves the others to the app, so it also works at `/`. For paths
that nothing matches, the app adds Dito's JSON 404, see
[`errorHandler()`](../../api/server/errors.md#errorhandler):

```js
app.onError(errorHandler())
app.notFound(notFound)
```

## Hosting with Hono

The app keeps its own `Hono` instance, so any Hono middleware works with it.
`@ditojs/server/node` serves it on Node.

```js
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { errorHandler, hostMiddleware, notFound } from '@ditojs/server'
import { forwarded, serve } from '@ditojs/server/node'

const app = new Hono()
app.use(forwarded(true), ...hostMiddleware())
app.onError(errorHandler())
app.notFound(notFound)
app.use(
  '/assets/*',
  serveStatic({
    root: 'storage/public',
    rewriteRequestPath: path => path.slice('/assets'.length)
  })
)
app.route('/api', api)

const { close } = await serve(app, {
  port: 8080,
  shutdownTimeout: 5000,
  onClose: () => orm.close()
})
```

- [`hostMiddleware()`](../../api/server/hono.md#hostmiddleware) returns Hono's
  `secureHeaders()`, `csrf()` and `bodyLimit()`, and optionally `cors()` and
  `etag()`. An app that wants its own middleware leaves it out and calls Hono's
  with `app.use()`. Multipart bodies have no limit there: the reverse proxy sets
  it, such as `client_max_body_size` in nginx.
- Each API sends its own errors as Dito's error JSON.
  [`errorHandler()`](../../api/server/errors.md#errorhandler) does the same for
  the errors of the app's own middleware, such as the 403 of `csrf()`.
- `serve()` listens on Node. On SIGINT and SIGTERM it stops the server, then
  runs `onClose`.
- Hono treats `/api/books/` and `/api/books` as different paths, so a path with
  a trailing slash responds with 404. The admin sends some paths with one.
  Create the host with `new Hono({ strict: false })` to route both the same way.

Other hosts call the app's `fetch()` directly:
`Bun.serve({ fetch: app.fetch })`, or `await api.request('/books')` in a test.

## Behind a proxy

Behind reverse proxies, such as nginx or a load balancer,
[`forwarded(proxy)`](../../api/server/hono.md#forwarded) sets how many proxies
the app trusts. `true` means one. Add it first. With it:

- Requests have the public URL of the first `X-Forwarded-Proto` and
  `X-Forwarded-Host`, as `c.req.url`. Hono's `csrf()` and the APIs see it.
- `getClientAddress(c)` returns the `X-Forwarded-For` entry that is `proxy` hops
  from the right, as each proxy adds the address that it got the request from.
  Without a proxy, it returns the socket's address.

Requests without these headers keep their own URL and address.

## Several APIs in one host

Each area of the app can be an API of its own, with its own path, session and
users. The middleware of an API runs on all paths below it, so route the APIs at
deeper paths first. Otherwise, requests to `/api/admin` also run the middleware
of the API at `/api`:

```js
const adminApi = createApi({
  controllers: adminControllers,
  middleware: [adminSessions.middleware],
  db: mikroDb(orm),
  getUser: sessionUser(adminSource)
})
const frontApi = createApi({
  controllers: frontControllers,
  middleware: [customerSessions.middleware],
  db: mikroDb(orm),
  getUser: sessionUser(customerSource)
})

app.route('/api/admin', adminApi)
app.route('/api', frontApi)
```

## The database

`db` connects the API to the database. It has three parts:

- `connect()` returns the database handle of a request. Handlers read it as `db`
  of their input, and middleware as `c.var.db`.
- `transaction` runs an action in a transaction. While it runs, `db` is the
  transaction's handle.
- `toHttpError()` maps the database's errors.

`mikroDb(orm)` of `@ditojs/mikro` forks the entity manager for each request, and
runs the action in a transaction of the fork:

```js
db: mikroDb(orm)
```

Handlers get the entity manager as `db` of their input. Middleware and other
code that has Hono's context use `getEntityManager(c)` of `@ditojs/mikro`.

Writes run in a transaction unless their action sets `transaction: false`. Reads
run in one only if they set `transaction: true`. The transaction covers the
middleware of the controller, its mixins and the action, so middleware that
throws after `next()` rolls the write back. The API's own `middleware` runs
outside of the transaction.

The app handles MikroORM's setup, migrations and seeds. Use its
[migrations](https://mikro-orm.io/docs/migrations) and
[seeders](https://mikro-orm.io/docs/seeding), or keep the tools you have, such
as Knex migrations.

## Users

`getUser(c)` returns the user of a request as `{ id, roles }`, or `null`. Dito
sets it as `c.var.user`, which handlers read as `user` of their input, and
`authorize` checks its roles. With the sessions of `@ditojs/auth`, use
`sessionUser(source)`, see [Users and sessions](auth.md):

```js
middleware: [adminSessions.middleware],
getUser: sessionUser(adminSource)
```

`getUser` runs after the API's `middleware`, so the session is loaded by then.

## Errors and logging

First, `toHttpError()` of the `db` adapter maps the errors of the ORM, such as a
unique violation to 409. Then the API sends each error as JSON:

- An `HttpError`, or another error with a numeric `status`, responds with that
  status.
- All other errors respond with 500, without their message.

Errors with a status of 500 or above go to `onError(error, c)`. By default, it
logs them through `c.var.logger`, else through `console.error()`. `c.var.logger`
is any object with `error()` that the app's middleware sets, such as that of
[hono-pino](https://github.com/maou-shonen/hono-pino). Other apps pass their own
hook:

```js
onError: error => logger.error(error)
```

See [Errors](../../api/server/errors.md). For request logs, use the logger of
the host, such as hono-pino.

Log the values of entities, or `wrap(entity).toObject()`, not the entities
themselves. Pino's `redact` copies the objects on its paths by assignment. This
runs MikroORM's setters on the copy, which can add the copy to loaded
collections. Name `redact` paths by their keys, such as `req.headers["cookie"]`,
not with a leading `*`.

## Variables

Dito sets its variables in Hono's context: `c.var.user`, `c.var.db`,
`c.var.action`, the key of the action, and `c.var.body` for writes. Model
controllers add `c.var.id`, `c.var.record()`, `c.var.find()`, `c.var.list()` and
`c.var.listQuery()`. Middleware sets the app's own with `c.set()`, such as the
session. Handlers get them all in their input:

```js
const api = createApi({
  controllers,
  middleware: async (c, next) => {
    c.set('requestId', c.req.header('X-Request-Id'))
    await next()
  }
})
```

TypeScript apps declare their types by augmenting `DitoVariables`:

```ts
declare module '@ditojs/server' {
  interface DitoVariables {
    requestId: string
  }
}
```

## Services

Dito.js has no services and no app object. Code that sends emails, talks to
other APIs or runs on a timer goes in the app's own modules, which handlers
import. The host starts and stops them around `serve()`.
