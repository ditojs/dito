# Serving the admin

```js
import path from 'node:path'
import { createAdmin } from '@ditojs/admin/server'
import { getSessionUser } from '@ditojs/auth'

const admin = createAdmin({
  base: '/admin',
  dist: path.resolve('dist/admin'),
  // Only development loads the file and the build tools.
  vite:
    process.env.NODE_ENV === 'development' ? 'admin.vite.config.js' : undefined,
  api: { url: '/api/admin', users: { path: 'admins' } },
  settings: { language: 'en' },
  // The session middleware loads the session that `getUser` reads.
  middleware: adminSessions.middleware,
  getUser: ({ c }) => getSessionUser(c, adminSource),
  authorize: ['admin', 'editor']
})

app.route('/admin', admin)
// Stops Vite in development.
await serve(app, { onClose: () => admin.close() })
```

`@ditojs/admin/server` serves the [Dito.js Admin](../admin/index.md) under a
path.

- In production, it serves the built files. Production never loads Vite.
- In development, given a Vite config, it runs Vite in middleware mode. The
  admin's views reload while they are edited. This needs the Node server of
  `@hono/node-server`.

The options:

- `dist` holds the built admin. `root` of the Vite config holds its sources:
  `index.html` and the `views/` that create the `DitoAdmin`.
- `api` and `settings` become the `dito` object in the browser. It is served
  as `/admin/dito.js`.
- The admin loads the features of the
  [users controller](auth.md#the-users-controller) at `api.users` when it
  starts. They tell the login and account views what to offer.
- `createAdmin()` returns a Hono app, which the host routes at `base`.
- `middleware`, `getUser` and `authorize` work as in
  [`createApi()`](controllers.md#authorization).
- `authorize` decides whether a request may load the admin's views.
  `middleware` runs only on those requests. Other requests, such as the
  login's, need no user.

## Building

```js
import { defineAdminViteConfig } from '@ditojs/admin/vite'

export default ({ mode }) =>
  defineAdminViteConfig(
    { root: 'admin', base: '/admin', dist: 'dist/admin', mode },
    { resolve: { dedupe: ['vue', 'vue-router'] } }
  )
```

```sh
vite build --config admin.vite.config.js
```

An `admin.vite.config.js` builds the admin with the same config that
development uses. The second argument is merged into the config. In
development, pass the file's path to `createAdmin()` as `vite`. It loads the
file with the mode `development`.
