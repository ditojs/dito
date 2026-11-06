# Admin server

```js
import { createAdmin } from '@ditojs/admin/server'
```

Serves the [Dito.js Admin](index.md) under a path.

- In production, it serves the built files with `serveStatic()` of
  `@hono/node-server`.
- In development, with a `vite` config, it serves the sources through Vite in
  middleware mode.
- Only development loads Vite.

The entry needs the optional peer dependencies `@ditojs/server`, `hono` and
`@hono/node-server`. Development also needs those of
[`@ditojs/admin/vite`](vite.md). See
[Serving the admin](../../guide/server/admin.md) in the guide.

## createAdmin()

```ts
createAdmin(options: CreateAdminOptions): Hono & { stop(): Promise<void> }
```

```js
const admin = createAdmin({
  base: '/admin',
  dist: path.resolve('dist/admin'),
  vite:
    process.env.NODE_ENV === 'development' ? 'admin.vite.config.js' : undefined,
  api: { url: '/api/admin', users: { path: 'admins' } },
  sessions: adminSessions,
  authorize: 'admin'
})
app.route('/admin', admin)
```

Returns a Hono app that serves the admin. The app routes it at `base` with
`app.route(base, admin)`. The admin's config, the `dito` object, is served as
`<base>/dito.js`.

Without `vite`, the app serves the built files of `dist` to GET and HEAD
requests.

- Browsers cache the build's files below `assets/` and `views/` for good.
  Shared caches, such as CDNs, don't keep the views that `authorize` protects.
- They check the other files again on each load.
- Paths of missing files get `index.html`, except for scripts and styles, which
  respond with 404.
- Without `vite` and without `dist`, `createAdmin()` throws, as it does for roles
  in `authorize` without `getUser`. While `dist` has no build, the admin answers
  404, so that apps without it still start, such as in tests.

With `vite`, Vite handles the requests through the Node request and response of
`@hono/node-server`. So the app needs that Node server. `stop()` stops Vite.

### CreateAdminOptions

| Key          | Type                                                                         | Description                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`       | `string`                                                                     | The path of the admin, such as `/admin`.                                                                                                                          |
| `dist`       | `string`                                                                     | The built admin, served without `vite`.                                                                                                                           |
| `api`        | `object`                                                                     | `dito.api` in the browser, such as `url` and `users`.                                                                                                             |
| `settings`   | `object`                                                                     | `dito.settings` in the browser.                                                                                                                                   |
| `sessions`   | `{ middleware, getUser? }`                                                   | The sessions, such as those of [`createSessions()`](../server/auth.md#createsessions). `getUser` defaults to theirs.                                              |
| `middleware` | `Middleware \| Middleware[]`                                                 | Hono middleware that `getUser` and `authorize` need, such as the session middleware. It runs only on the requests that `authorize` checks.                        |
| `getUser`    | `({ c }) => User \| null \| Promise<…>`                                      | The signed-in user of the request, such as the one of [`getSessionUser()`](../server/auth.md#getsessionuser). `authorize` reads it as `c.var.user`.               |
| `authorize`  | `true \| string \| string[] \| ({ c, user }) => boolean \| Promise<boolean>` | Who may load the admin's views. It takes the values of an action's [`authorize`](../server/controllers.md#authorize). Without it, anyone may.                     |
| `vite`       | `InlineConfig \| string`                                                     | The Vite config of development, or the path of its file, such as one that exports [`defineAdminViteConfig()`](vite.md). With it, Vite serves the admin's sources. |
