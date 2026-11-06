# API

```js
import { createApi } from '@ditojs/server'
import { createMikroAdapter } from '@ditojs/mikro'

const api = createApi({
  controllers: [books, authors, loans],
  users: admins,
  adapter: createMikroAdapter(orm)
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
So it also works at `/`. For the paths that nothing matches, the Hono app of
[`createHono()`](../../api/server/hono.md#createhono) sends Dito's JSON 404.

## Hosting with Hono

The app routes its APIs in a `Hono` app, so any Hono middleware works with it. `@ditojs/server/node` serves it on Node.

```js
import { serveStatic } from '@hono/node-server/serve-static'
import { createHono } from '@ditojs/server'
import { serve } from '@ditojs/server/node'

const hono = createHono({ proxy: true })
hono.use(
  '/assets/*',
  serveStatic({
    root: 'storage/public',
    rewriteRequestPath: path => path.slice('/assets'.length)
  })
)
hono.route('/api', api)

const { close } = await serve(hono, {
  port: 8080,
  closeTimeout: '5s',
  services: [{ stop: () => orm.close() }]
})
```

- [`createHono()`](../../api/server/hono.md#createhono) returns a `Hono` app
  with Hono's `secureHeaders()`, `csrf()` and `bodyLimit()`, and optionally
  `cors()` and `etag()`, and Dito's JSON errors, in the order that they need.
  Multipart bodies have no limit there: the reverse proxy sets it, such as
  `client_max_body_size` in nginx.
- Each API sends its own errors as Dito's error JSON. The Hono app does the
  same for the errors of its own middleware, such as the 403 of `csrf()`, and for
  unknown paths.
- It routes `/api/books/` like `/api/books`. The admin sends some paths
  with a trailing slash.
- `serve()` listens on Node. On SIGINT and SIGTERM it stops the server and its
  `services`.

Other runtimes call the app's `fetch()` directly, such as
`Bun.serve({ fetch: hono.fetch })`. A test calls `await api.request('/books')`.

## Behind a proxy

Behind reverse proxies, such as nginx or a load balancer, the `proxy` option of
`createHono()` sets how many proxies the app trusts. `true` means one, see
[Proxies](../../api/server/hono.md#proxies). With it:

- `c.req.url` is the public URL, from the first `X-Forwarded-Proto` and
  `X-Forwarded-Host`. Hono's `csrf()` and the APIs see this URL.
- `getClientAddress(c)` returns the entry of `X-Forwarded-For` that is `proxy`
  hops from the right. Each proxy adds the address that it got the request
  from.
- Without a proxy, `getClientAddress(c)` returns the socket's address.

Requests without these headers keep their own URL and address.

## Several APIs in one app

```js
const adapter = createMikroAdapter(orm)

const adminApi = createApi({
  controllers: adminControllers,
  users: admins,
  adapter
})
const frontApi = createApi({
  controllers: frontControllers,
  users: members,
  adapter
})

app.route('/api/admin', adminApi)
app.route('/api', frontApi)
```

Each area of the app can be an API of its own, with its own path, sessions and
users. The middleware of an API runs on its own actions only. So a request to
`/api/admin` loads the admin session alone, in any order of the routes.
The APIs share the adapter of `createUsers()` and `createAssets()`, which wrap
the model controllers of their entities through it.

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
`c.var.em`. Functions that a handler calls get it from
[`useEm()`](../../api/server/mikro.md#useem), without passing it on.
`import '@ditojs/mikro/types'` types it.

Writes run in a transaction, and reads don't, see
[Transactions](controllers.md#transactions).

The app handles MikroORM's setup, with its
[migrations](https://mikro-orm.io/docs/migrations) and
[seeders](https://mikro-orm.io/docs/seeding). Apps that come from knex run their
old migrations with knex's CLI until the Migrator takes over, see
[Upgrading to 7.x](../../upgrading-to-7.x.md#11-move-the-migrations-to-mikroorm).

## Users

```js
users: admins
```

`getUser({ c })` returns the user of a request as `{ id, roles }`, or `null`.

- Dito sets the user as `c.var.user`.
- Handlers read it as `user` of their context.
- `authorize` checks its roles.

`users` takes the result of `createUsers()` of `@ditojs/auth`, see
[Users and sessions](auth.md). They load the session and read its user.

## Errors and logging

First, the adapter's `toHttpError()` maps the errors of the ORM, such as a
unique violation to 409. Then the API sends each error as JSON:

- An `HttpError`, or another error with a numeric `status`, responds with that
  status.
- All other errors respond with 500, without their message.

Errors with a status of 500 or above go to `onError({ error, c })`. By default,
it logs them with `console.error()`. Apps with a logger pass their own hook to
`createApi()` and `createHono()`:

```js
const onError = ({ error }) => logger.error(error)

const api = createApi({ controllers, onError })
const hono = createHono({ onError })
```

Dito logs nothing else, so any logger works, and so does any logging middleware
for Hono. [The kit](kit.md#logging) comes with a logger for all of this.

See [Errors](../../api/server/errors.md).

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

Code that sends emails, talks to other APIs or runs on a timer goes in the app's
own modules, which handlers import. What has to start and stop with the server
goes to the `services` of [`serve()`](../../api/server/hono.md#serve).
