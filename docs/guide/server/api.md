# API

An API is a list of controllers in one [Hono](https://hono.dev) app.
[`createApi()`](../../api/server/api.md#createapi) builds it, and the app routes
it with `app.route()`. The app passes in what Dito.js doesn't do itself: the
database and the user of a request.

```js
import { createApi } from '@ditojs/server'
import { createMikroAdapter } from '@ditojs/mikro'

const api = createApi({
  controllers: [books, authors, loans],
  middleware: [sessions.middleware],
  adapter: createMikroAdapter(orm),
  getUser: c => getSessionUser(c, admins)
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

const api = createApi({ controllers, adapter: createMikroAdapter(orm) })
```

Hono runs the first route that matches, so Dito adds the routes with static
segments first, also across controllers: `get subscribe` matches before
`get :id`. The API handles only the paths of its
actions and leaves the others to the app, so it also works at `/`. For paths
that nothing matches, the app adds Dito's JSON 404, see
[`createErrorHandler()`](../../api/server/errors.md#createerrorhandler):

```js
app.onError(createErrorHandler())
app.notFound(notFound)
```

## Hosting with Hono

The app keeps its own `Hono` instance, so any Hono middleware works with it.
`@ditojs/server/node` serves it on Node.

```js
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { createErrorHandler, hostMiddleware, notFound } from '@ditojs/server'
import { forwarded, serve } from '@ditojs/server/node'

const app = new Hono()
app.use(forwarded(true), ...hostMiddleware())
app.onError(createErrorHandler())
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
  closeTimeout: 5000,
  onClose: () => orm.close()
})
```

- [`hostMiddleware()`](../../api/server/hono.md#hostmiddleware) returns Hono's
  `secureHeaders()`, `csrf()` and `bodyLimit()`, and optionally `cors()` and
  `etag()`. An app that wants its own middleware leaves it out and calls Hono's
  with `app.use()`. Multipart bodies have no limit there: the reverse proxy sets
  it, such as `client_max_body_size` in nginx.
- Each API sends its own errors as Dito's error JSON.
  [`createErrorHandler()`](../../api/server/errors.md#createerrorhandler) does
  the same for the errors of the app's own middleware, such as the 403 of
  `csrf()`.
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
  adapter: createMikroAdapter(orm),
  getUser: c => getSessionUser(c, adminSource)
})
const frontApi = createApi({
  controllers: frontControllers,
  middleware: [memberSessions.middleware],
  adapter: createMikroAdapter(orm),
  getUser: c => getSessionUser(c, memberSource)
})

app.route('/api/admin', adminApi)
app.route('/api', frontApi)
```

## The database

The `adapter` is `createMikroAdapter(orm)` of `@ditojs/mikro`. It forks the
entity manager for each request, runs the action in a transaction of the fork,
and maps MikroORM's errors:

```js
adapter: createMikroAdapter(orm)
```

Handlers get the entity manager as `em` of their input, which is the
transaction's while one runs. Middleware and other code that has Hono's context
read it as `c.var.em`, which `import '@ditojs/mikro/types'` types.

Writes run in a transaction unless their action sets `transacted: false`. Reads
run in one only if they set `transacted: true`. The transaction covers the
middleware of the controller, its mixins and the action, so middleware that
throws after `next()` rolls the write back. The API's own `middleware` runs
outside of the transaction.

The app handles MikroORM's setup, migrations and seeds, with its
[migrations](https://mikro-orm.io/docs/migrations) and
[seeders](https://mikro-orm.io/docs/seeding). Apps that come from knex run their
old migrations with knex's CLI until the Migrator takes over, see
[Upgrading to 7.x](../../upgrading-to-7.x.md#11-move-the-migrations-to-mikroorm).

## Users

`getUser(c)` returns the user of a request as `{ id, roles }`, or `null`. Dito
sets it as `c.var.user`, which handlers read as `user` of their input, and
`authorize` checks its roles. With the sessions of `@ditojs/auth`, use
`getSessionUser(c, source)`, see [Users and sessions](auth.md):

```js
middleware: [adminSessions.middleware],
getUser: c => getSessionUser(c, adminSource)
```

`getUser` runs after the API's `middleware`, so the session is loaded by then.

## Errors and logging

First, `toHttpError()` of the adapter maps the errors of the ORM, such as a
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

Dito sets its variables in Hono's context: `c.var.user`, `c.var.em`,
`c.var.action`, the key of the action, and `c.var.body` for writes. Model
controllers add `c.var.id`, `c.var.entity`, `c.var.getRecord()`, `c.var.find()`,
`c.var.list()` and `c.var.getListQuery()`. Middleware sets the app's own with
`c.set()`, such as the session. Handlers get them all in their input:

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
