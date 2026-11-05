# Admin server

```js
import { createAdmin } from '@ditojs/admin-server'
import { defineAdminViteConfig } from '@ditojs/admin-server/vite'
```

Serves the [Dito.js Admin](../admin/index.md) under a path. In production, it
serves the built files with `serveStatic()` of `@hono/node-server`. In
development, with a `vite` config, it serves the sources through Vite in
middleware mode. Only development loads Vite.

Peer dependencies: `hono`, `@hono/node-server`, and for building or developing
the admin `vite`, `@vitejs/plugin-vue` and `autoprefixer`. See
[Serving the admin](../../guide/server/admin.md) in the guide.

## createAdmin()

```ts
createAdmin(options: AdminOptions): Hono & { close(): Promise<void> }
```

Returns a Hono app that serves the admin. The host routes it at `base` with
`app.route(base, admin)`. The admin's config, the `dito` object, is served as
`<base>/dito.js`.

Without `vite`, the app serves the built files of `dist` to GET and HEAD
requests. Browsers cache the build's files below `assets/` and `views/` for
good, and check other files again on each load. Paths without an extension get
`index.html`.

With `vite`, Vite handles the requests through the Node request and response of
`@hono/node-server`, so the app needs that Node server. `close()` stops Vite.

### AdminOptions

| Key              | Type                                                               | Description                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `base`           | `string`                                                           | The path of the admin, such as `/admin`.                                                                                                               |
| `dist`           | `string`                                                           | The built admin, served without `vite`.                                                                                                                |
| `api`            | `object`                                                           | `dito.api` in the browser, such as `url` and `users`.                                                                                                  |
| `settings`       | `object`                                                           | `dito.settings` in the browser.                                                                                                                        |
| `authentication` | `AuthenticationFeatures`                                           | `dito.authentication`: the `features` of [`defineUserActions()`](auth.md#defineuseractions), which tell the login and account views what to offer.     |
| `middleware`     | `Middleware \| Middleware[]`                                       | Hono middleware that `getUser` and `authorize` need, such as the session middleware. It runs only on the requests that `authorize` checks.             |
| `getUser`        | `(c) => User \| null \| Promise<…>`                                | The signed-in user of the request, such as the one of [`getSessionUser()`](auth.md#getsessionuser). `authorize` reads it as `c.var.user`.              |
| `authorize`      | `true \| string \| string[] \| (c) => boolean \| Promise<boolean>` | Who may load the admin's views. It takes the values of an action's [`authorize`](controllers.md#authorize). Without it, anyone may.                    |
| `vite`           | `InlineConfig \| string`                                           | The Vite config of development, or the path of its file, such as one that exports `defineAdminViteConfig()`. With it, Vite serves the admin's sources. |

```js
const admin = createAdmin({
  base: '/admin',
  dist: path.resolve('dist/admin'),
  vite:
    process.env.NODE_ENV === 'development' ? 'admin.vite.config.js' : undefined,
  api: { url: '/api/admin', users: { path: 'admins' } },
  authentication: adminUsers.features,
  middleware: adminSessions.middleware,
  getUser: c => getSessionUser(c, adminSource),
  authorize: 'admin'
})
app.route('/admin', admin)
```

## defineAdminViteConfig()

```ts
defineAdminViteConfig(options: AdminViteOptions, config?: InlineConfig): Promise<InlineConfig>
```

From `@ditojs/admin-server/vite`. Returns the Vite config of the admin, for its
build and for its dev server, deeply merged with `config`.

| Option | Type                            | Description                       |
| ------ | ------------------------------- | --------------------------------- |
| `root` | `string`                        | The admin's sources.              |
| `base` | `string`                        | The path of the admin.            |
| `mode` | `'production' \| 'development'` | Default: `'production'`.          |
| `dist` | `string`                        | Where the build writes the admin. |

The build puts the views into a chunk of their own below `views/`, which
`authorize` protects, also for the sources that Vite serves in development. The
chunk holds only the views' own modules, so the login, which loads before the
user is known, doesn't need it. Files that the views load from outside of
`views/`, such as `forms/book.js`, end up in `assets/`, which anyone may read:
keep what needs protection below `views/`. Vite's own urls, such as `/@fs/`,
aren't protected, so only use `vite` in development.

An `admin.vite.config.js` builds the admin with it. As a function, the same file
also works for `createAdmin()` in development, which loads it with the mode
`development`:

```js
import { defineAdminViteConfig } from '@ditojs/admin-server/vite'

export default ({ mode }) =>
  defineAdminViteConfig({
    root: 'admin',
    base: '/admin',
    dist: 'dist/admin',
    mode
  })
```

In development, Vite opens the HMR websocket on its `server.port`, by default a
free one.
