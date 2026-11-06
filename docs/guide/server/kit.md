# The kit

```js
// server/app.js
import { createApp } from '@ditojs/kit'
import * as entities from './entities/index.js'

export const app = createApp({
  entities,
  database: { dbName: 'catalog', user: 'catalog' },
  server: { port: 8080, proxy: true },
  secrets: [process.env.SECRET],
  storages: {
    covers: { type: 'disk', path: 'storage/covers', url: '/covers/' }
  }
})
```

`@ditojs/kit` sets up an app in one call. See
[`createApp()`](../../api/server/kit.md#createapp) for its options.

The kit is optional. It only calls the functions of the other packages, see
[Without the kit](#without-the-kit).

This module imports no controllers and no services:

- Controllers and services import `app`.
- The module that starts the app imports them.
- Scripts import `app` alone.

## Routing and starting

```js
// server/index.js
import { createAdmin } from '@ditojs/admin/server'
import { app } from './app.js'
import * as controllers from './controllers/index.js'
import { mailer } from './services/mailer.js'
import { admins } from './users.js'

app.routeApi('/api', { controllers, users: admins })
app.hono.route(
  '/admin',
  createAdmin({
    base: '/admin',
    dist: 'dist/admin',
    users: admins,
    authorize: 'admin'
  })
)
app.addService('mailer', mailer)
await app.start()
```

- `app.routeApi()` routes an API on the app's database. The user of a request is
  the one of its session.
- `users` takes the result of `app.createUsers()`, see [Users](#users).
- `app.start()` runs until `app.close()`, SIGINT or SIGTERM.
- `app.hono` takes the app's own middleware and other Hono apps, such as the
  [admin](admin.md). Middleware goes before the routes.

## Users

```js
// server/users.js
import { app } from './app.js'
import { Admin } from './entities/index.js'

export const admins = app.createUsers(Admin, {
  session: { expiresAfter: '24h' },
  serialize: ['id', 'username', 'roles']
})
```

`app.createUsers(entity, options)` calls
[`createUsers()`](../../api/server/auth.md#createusers) with the app's adapter
and `secrets`. The controllers import the users for their mixins, see
[Users and sessions](auth.md).

## Services

```js
// server/services/mailer.js
let transport

export const mailer = {
  async start() {
    transport = await connect()
  },

  async stop() {
    await transport.close()
  },

  send(message) {
    return transport.send(message)
  }
}
```

```js
app.addService('mailer', mailer)
```

A service has `start()`, `stop()` or both. Other code reads it by name, as
`app.services.mailer`, so it doesn't have to import the module.

- Services start in the order of `app.addService()`, before the server.
- They stop in reverse order, after the server.
- `stop()` waits for the service's work, as the database may close next.
- `app.isRunning` is true from after they start until a shutdown has ended all
  requests. Work that outlives the requests can check it, to fail with a clear
  message.

## Jobs

```js
jobs: {
  sessions: '1h',
  assets: '24h'
}
```

`jobs` says how often the recurring jobs run: deleting the expired sessions, and
[`assets.runJobs()`](storage.md#tracking-files). They start with `app.start()`
and stop with `app.close()`. The logger gets the result of each run of the asset
jobs. Once the app has users, the sessions job runs every hour unless `sessions`
says otherwise. `false` turns it off. Other jobs need an interval. See
[Jobs](../../api/server/kit.md#jobs).

## Logging

```js
logger: { level: 'info', transport: { target: 'pino-pretty' } }
```

`logger` holds the options of [pino](https://getpino.io). Without `transport`,
the logger writes JSON lines. The app installs `pino-pretty` itself.

Each API action logs one line, such as `GET /books 200 12ms`, also when it fails
before the action runs. The line leaves out the query, as tokens travel in it.
Files and unknown paths log nothing, as a reverse proxy logs them.

`app.logger` adds the id of the current request, and responses send it as
`X-Request-Id`. Errors with a status of 500 or above log with it too.

## Scripts and the playground

```js
// scripts/count.js
import { app } from '../server/app.js'
import { Book } from '../server/entities/index.js'

console.log(await app.orm.em.fork().count(Book))
await app.close()
```

A script imports the app and closes it at the end.

A script that needs the services calls `await app.startServices()` first, and
`app.close()` stops them. Jobs and the server don't run.

`runPlayground()` runs piped code, with the entities, `orm`, `em` and `services`
in scope. The app's services run around the code, and `scope` adds names:

```js
// scripts/playground.js
import { runPlayground } from '@ditojs/kit'
import { app } from '../server/app.js'

await runPlayground(app)
```

```sh
echo "console.log(await em.count(Book))" | node scripts/playground.js
```

## Without the kit

The kit decides these things for an app:

- one ORM on PostgreSQL for all APIs;
- a server on Node;
- pino as the logger;
- the order of the middleware.

An app that wants otherwise calls the functions itself, see
[Hosting with Hono](api.md#hosting-with-hono). Controllers, entities and mixins
don't depend on the kit, so they stay the same.
