# Serving the admin

`@ditojs/admin-server` serves the [Dito.js Admin](../admin/index.md) under a
path. In production, it serves the built files. In development, given a Vite
config, it runs Vite in middleware mode, with hot reloading of the admin's
views, which needs the Node server of `@hono/node-server`. Production never
loads Vite.

```js
import path from 'node:path'
import { createAdmin } from '@ditojs/admin-server'
import { sessionUser } from '@ditojs/auth'

const admin = createAdmin({
  base: '/admin',
  dist: path.resolve('dist/admin'),
  // Only development loads the file and the build tools.
  vite:
    process.env.NODE_ENV === 'development' ? 'admin.vite.config.js' : undefined,
  api: { url: '/api/admin', users: { path: 'admins' } },
  settings: { language: 'en' },
  authentication: users.features,
  // The session middleware loads the session that `getUser` reads.
  middleware: adminSessions.middleware,
  getUser: sessionUser(adminSource),
  authorize: ['admin', 'editor']
})

app.route('/admin', admin)
// Stops Vite in development.
await serve(app, { onClose: () => admin.close() })
```

- `dist` holds the built admin, and `root` of the Vite config its sources:
  `index.html` and the `views/` that create the `DitoAdmin`.
- `api`, `settings` and `authentication` become the `dito` object in the
  browser, served as `/admin/dito.js`.
- `authentication` is the `features` of the
  [users controller](auth.md#the-users-controller), which tells the login and
  account views what to offer.
- `createAdmin()` returns a Hono app, which the host routes at `base`.
- `middleware`, `getUser` and `authorize` work as in
  [`createApi()`](controllers.md#authorization). `authorize` decides whether a
  request may load the admin's views. `middleware` runs only on those requests.
  Other requests, such as the login's, need no user.

## Building

An `admin.vite.config.js` builds the admin with the same config that development
uses:

```js
import { defineAdminViteConfig } from '@ditojs/admin-server/vite'

export default ({ mode }) =>
  defineAdminViteConfig(
    { root: 'admin', base: '/admin', dist: 'dist/admin', mode },
    { resolve: { dedupe: ['vue', 'vue-router'] } }
  )
```

```sh
vite build --config admin.vite.config.js
```

The second argument is merged into the config. In development, pass the file's
path to `createAdmin()` as `vite`, which loads it with the mode `development`.
