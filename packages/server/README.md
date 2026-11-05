# Dito.js Server

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/server` is the core of Dito.js Server, built on
[Hono](https://hono.dev). `createApi()` turns a list of controllers into a Hono
app, which the host routes with `app.route()`. Handlers get one object, the
input of the request, `{ query, body, params, user, db, action, c, next }`. `c`
is Hono's context, and `next()` runs the handler beneath. Middleware is Hono
middleware. `@ditojs/mikro` connects MikroORM, with `db: mikroDb(orm)`.

```js
import { Hono } from 'hono'
import { createApi, defineAction, defineController } from '@ditojs/server'
import { serve } from '@ditojs/server/node'
import { z } from 'zod'

const greetings = defineController({
  path: 'greetings',
  actions: {
    'get': () => ({ hello: 'world' }),
    'post': defineAction({
      authorize: true,
      body: z.object({ name: z.string() }),
      handler: ({ body: { name } }) => ({ hello: name })
    })
  }
})

const app = new Hono()
app.route('/api', createApi({ controllers: [greetings] }))
await serve(app, { port: 8080 })
```

- `@ditojs/server`: `createApi()`, `defineController()`, `defineMixin()`,
  `defineAction()`, `sendFile()`, `hostMiddleware()`, `HttpError`,
  `createErrorHandler()`, `notFound` and `createValidationError()`.
- `@ditojs/server/node`: `serve()`, and `forwarded()` and `getClientAddress()`
  for apps behind reverse proxies. Needs `@hono/node-server`, an optional peer.
- `@ditojs/server/zod`: `q`, Zod schemas for query values.

See the
[server guide](https://github.com/ditojs/dito/blob/main/docs/guide/server/index.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/index.md).
