# The kit

```js
// server/app.js
import { createApp } from '@ditojs/kit'
import * as entities from './entities/index.js'

export const app = createApp({
  entities,
  database: { dbName: 'catalog', user: 'catalog' },
  server: { port: 8080 },
  http: { proxy: true },
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
import * as mailer from './services/mailer.js'
import { admins } from './users.js'

const sessions = app.createSessions({
  cookieName: 'admin.sess',
  maxAge: 24 * 60 * 60 * 1000,
  users: admins
})

app.routeApi('/api', { controllers, sessions })
app.hono.route('/admin', createAdmin({ base: '/admin', dist: 'dist/admin' }))
await app.start({ services: [mailer] })
```

- `app.routeApi()` routes an API on the app's database. The user of a request is
  the one of its session.
- `app.start()` runs until `app.close()`, SIGINT or SIGTERM.
- `app.hono` takes the app's own middleware and other Hono apps, such as the
  [admin](admin.md). Middleware goes before the routes.

## Services

```js
// server/services/mailer.js
let transport

export async function start() {
  transport = await connect()
}

export async function stop() {
  await transport.close()
}
```

A service has `start()`, `stop()` or both.

- Services start in their order, before the server.
- They stop in reverse order, after the server.
- `stop()` waits for the service's work, as the database may close next.

## Logging

```js
logger: { level: 'info', transport: { target: 'pino-pretty' } }
```

`logger` holds the options of [pino](https://getpino.io). Without `transport`,
the logger writes JSON lines. The app installs `pino-pretty` itself.

Each API action logs one line, such as `GET /books 200 12ms`. Files and unknown
paths log nothing, as a reverse proxy logs them.

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

`runPlayground()` runs piped code, with the entities, `orm` and `em` in scope:

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
