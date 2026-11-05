# API

```js
import { createApi } from '@ditojs/server'
import { createMikroAdapter } from '@ditojs/mikro'

const api = createApi({
  controllers: [books, authors, loans],
  middleware: [sessions.middleware],
  adapter: createMikroAdapter(orm),
  getUser: ({ c }) => getSessionUser(c, admins)
})
app.route('/api/admin', api)
```

An API is a list of controllers in one [Hono](https://hono.dev) app.
[`createApi()`](../../api/server/api.md#createapi) builds it, and the app routes
it with `app.route()`. The app passes in what Dito.js doesn't do itself: the
database and the user of a request.

`createApi()` throws for invalid controllers, such as two actions on the same
route, or a write without `authorize`. So errors show when the app starts, not
on the first request.

`controllers` is a list, or an object such as a module namespace. In an object,
only the results of `defineController()` count. So the module can export other
things too:

```js
import * as controllers from './controllers/index.js'

const api = createApi({ controllers, adapter: createMikroAdapter(orm) })
```

Hono runs the first route that matches. So Dito adds the routes with static
segments first, also across controllers. `get subscribe` matches before
`get :id`.

The API handles only the paths of its actions, and leaves the others to the app.
So it also works at `/`. For the paths that nothing matches, the app adds Dito's
JSON 404, see
[`createErrorHandler()`](../../api/server/errors.md#createerrorhandler):

```js
app.onError(createErrorHandler())
app.notFound(notFound)
```

## Hosting with Hono

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

The app keeps its own `Hono` instance, so any Hono middleware works with it.
`@ditojs/server/node` serves it on Node.

- [`hostMiddleware()`](../../api/server/hono.md#hostmiddleware) returns Hono's
  `secureHeaders()`, `csrf()` and `bodyLimit()`. It can also add `cors()` and
  `etag()`.
- An app that wants its own middleware leaves `hostMiddleware()` out, and calls
  Hono's middleware with `app.use()`.
- `bodyLimit()` sets no limit on multipart bodies. The reverse proxy limits
  them, such as with `client_max_body_size` in nginx.
- Each API sends its own errors as Dito's error JSON.
  [`createErrorHandler()`](../../api/server/errors.md#createerrorhandler) does
  the same for the errors of the app's own middleware, such as the 403 of
  `csrf()`.
- `serve()` listens on Node. On SIGINT and SIGTERM, it stops the server, then
  runs `onClose`.
- Hono treats `/api/books/` and `/api/books` as different paths. So a path with
  a trailing slash responds with 404. The admin sends some paths with one.
  Create the host with `new Hono({ strict: false })` to route both the same way.

Other hosts call the app's `fetch()` directly, such as
`Bun.serve({ fetch: app.fetch })`. A test calls `await api.request('/books')`.

## Behind a proxy

Apps behind reverse proxies, such as nginx or a load balancer, add
[`forwarded(proxy)`](../../api/server/hono.md#forwarded) first. `proxy` is the
number of proxies that the app trusts. `true` means one. With it:

- `c.req.url` is the public URL, from the first `X-Forwarded-Proto` and
  `X-Forwarded-Host`. Hono's `csrf()` and the APIs see this URL.
- `getClientAddress(c)` returns the entry of `X-Forwarded-For` that is `proxy`
  hops from the right. Each proxy adds the address that it got the request
  from.
- Without a proxy, `getClientAddress(c)` returns the socket's address.

Requests without these headers keep their own URL and address.

## Several APIs in one host

```js
const adminApi = createApi({
  controllers: adminControllers,
  middleware: [adminSessions.middleware],
  adapter: createMikroAdapter(orm),
  getUser: ({ c }) => getSessionUser(c, adminSource)
})
const frontApi = createApi({
  controllers: frontControllers,
  middleware: [memberSessions.middleware],
  adapter: createMikroAdapter(orm),
  getUser: ({ c }) => getSessionUser(c, memberSource)
})

app.route('/api/admin', adminApi)
app.route('/api', frontApi)
```

Each area of the app can be an API of its own, with its own path, sessions and
users. The middleware of an API runs on all paths below it. So route the APIs at
deeper paths first. Otherwise, requests to `/api/admin` also run the middleware
of the API at `/api`.

## The database

```js
adapter: createMikroAdapter(orm)
```

The `adapter` is `createMikroAdapter(orm)` of `@ditojs/mikro`:

- It forks the entity manager for each request.
- It runs the action in a transaction of the fork.
- It maps MikroORM's errors.

Handlers get the entity manager as `em` of their context. While a transaction
runs, it is the transaction's. Middleware and other code that has `c` read it as
`c.var.em`. `import '@ditojs/mikro/types'` types it.

Writes run in a transaction, unless their action sets `transacted: false`. Reads
only run in one if they set `transacted: true`. The transaction covers the
middleware of the controller, of its mixins and of the action. So middleware
that throws after `next()` rolls the write back. The API's own `middleware` runs
outside of the transaction.

The app handles MikroORM's setup, with its
[migrations](https://mikro-orm.io/docs/migrations) and
[seeders](https://mikro-orm.io/docs/seeding). Apps that come from knex run their
old migrations with knex's CLI until the Migrator takes over, see
[Upgrading to 7.x](../../upgrading-to-7.x.md#11-move-the-migrations-to-mikroorm).

## Users

```js
middleware: [adminSessions.middleware],
getUser: ({ c }) => getSessionUser(c, adminSource)
```

`getUser({ c })` returns the user of a request as `{ id, roles }`, or `null`.

- Dito sets the user as `c.var.user`.
- Handlers read it as `user` of their context.
- `authorize` checks its roles.

With the sessions of `@ditojs/auth`, use `getSessionUser(c, source)`, see
[Users and sessions](auth.md). `getUser` runs after the API's `middleware`, so
the session is loaded by then.

## Errors and logging

```js
onError: ({ error }) => logger.error(error)
```

First, the adapter's `toHttpError()` maps the errors of the ORM, such as a
unique violation to 409. Then the API sends each error as JSON:

- An `HttpError`, or another error with a numeric `status`, responds with that
  status.
- All other errors respond with 500, without their message.

Errors with a status of 500 or above go to `onError({ error, c })`.

- By default, it logs them through `c.var.logger`, else through
  `console.error()`.
- `c.var.logger` is any object with `error()` that the app's middleware sets,
  such as the logger of [hono-pino](https://github.com/maou-shonen/hono-pino).
- Other apps pass their own hook, as above.

See [Errors](../../api/server/errors.md). For request logs, use the logger of
the host, such as hono-pino.

Log the values of records, or `wrap(record).toObject()`, not the records
themselves. Pino's `redact` copies the objects on its paths by assignment. This
runs MikroORM's setters on the copy, which can add the copy to loaded
collections. Name `redact` paths by their keys, such as `req.headers["cookie"]`,
not with a leading `*`.

## Variables

```js
const api = createApi({
  controllers,
  middleware: async (c, next) => {
    c.set('requestId', c.req.header('X-Request-Id'))
    await next()
  }
})
```

Dito sets its variables in `c.var`:

- `c.var.user`, `c.var.em`, and `c.var.action`, the key of the action;
- `c.var.body`, for writes;
- in model controllers, also `c.var.id`, `c.var.entity`, `c.var.getRecord()`,
  `c.var.find()`, `c.var.list()` and `c.var.getListQuery()`.

Middleware sets the app's own variables with `c.set()`, such as the session.
Handlers get all variables in their context.

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
other APIs or runs on a timer goes in the app's own modules. Handlers import
these modules. The host starts and stops them around `serve()`.
