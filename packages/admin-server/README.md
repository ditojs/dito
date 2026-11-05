# Dito.js Admin Server

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/admin-server` serves the Dito.js Admin under a path. In production it
serves the built files and never loads Vite. In development it serves the
sources through Vite in middleware mode. `@ditojs/admin-server/vite` has the
Vite config that builds the admin.

```js
import { createAdmin } from '@ditojs/admin-server'

const admin = createAdmin({
  base: '/admin',
  dist: 'dist/admin',
  api: { url: '/api/admin' },
  // Only admins may load the admin's views.
  middleware: sessions.middleware,
  getUser: sessionUser(adminSource),
  authorize: 'admin'
})
// The admin is a Hono app, routed at its base.
app.route('/admin', admin)
```

See
[Serving the admin](https://github.com/ditojs/dito/blob/main/docs/guide/server/admin.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/admin-server.md).
