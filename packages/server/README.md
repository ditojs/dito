# Dito.js Server

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/server` is the core of Dito.js Server, built on
[Hono](https://hono.dev).

- `createApi()` turns a list of controllers into a Hono app. The app routes it
  in the app of `createHono()`.
- Handlers get one object, their context,
  `{ query, body, params, user, em, action, c, next }`. `c` is Hono's context.
  `next()` runs the handler beneath, and returns its result.
- Middleware is Hono middleware.
- `@ditojs/mikro` connects MikroORM, with `adapter: createMikroAdapter(orm)`.

```js
import {
  createApi,
  createHono,
  defineAction,
  defineController
} from '@ditojs/server'
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

const app = createHono()
app.route('/api', createApi({ controllers: [greetings] }))
await serve(app, { port: 8080 })
```

- `@ditojs/server`: `createApi()`, `defineController()`, `defineMixin()`,
  `defineAction()`, `sendFile()`, `createHono()`, `HttpError` and
  `createValidationError()`.
- `@ditojs/server/node`: `serve()` and `getClientAddress()`. Needs
  `@hono/node-server`, an optional peer.

See the
[server guide](https://github.com/ditojs/dito/blob/main/docs/guide/server/index.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/index.md).
