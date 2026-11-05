# Admin Vite config

```js
import { defineAdminViteConfig } from '@ditojs/admin/vite'
```

Builds the [Dito.js Admin](index.md) of an app with Vite, and serves its sources
in development through [`createAdmin()`](server.md#createadmin). The entry
needs the optional peer dependencies `vite`, `@vitejs/plugin-vue` and
`autoprefixer`.

## defineAdminViteConfig()

```ts
defineAdminViteConfig(options: AdminViteOptions, config?: InlineConfig): Promise<InlineConfig>
```

Returns the Vite config of the admin, for its build and for its dev server,
deeply merged with `config`.

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
also works for [`createAdmin()`](server.md#createadmin) in development, which loads it with the mode
`development`:

```js
import { defineAdminViteConfig } from '@ditojs/admin/vite'

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
