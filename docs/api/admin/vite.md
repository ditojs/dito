# Admin Vite config

```js
import { defineAdminViteConfig } from '@ditojs/admin/vite'
```

Builds the [Dito.js Admin](index.md) of an app with Vite. In development, it
also serves the admin's sources through [`createAdmin()`](server.md#createadmin).
The entry needs the optional peer dependencies `vite`, `@vitejs/plugin-vue` and
`autoprefixer`.

## defineAdminViteConfig()

```ts
defineAdminViteConfig(options: AdminViteOptions, config?: InlineConfig): Promise<InlineConfig>
```

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

Returns the Vite config of the admin, for its build and for its dev server. It
deeply merges `config` into it.

| Option | Type                            | Description                       |
| ------ | ------------------------------- | --------------------------------- |
| `root` | `string`                        | The admin's sources.              |
| `base` | `string`                        | The path of the admin.            |
| `mode` | `'production' \| 'development'` | Default: `'production'`.          |
| `dist` | `string`                        | Where the build writes the admin. |

An `admin.vite.config.js` builds the admin with it. As a function, as above,
the same file also works for [`createAdmin()`](server.md#createadmin) in
development. `createAdmin()` loads it with the mode `development`.

The build puts the views into a chunk of their own, below `views/`:

- `authorize` protects this chunk. It also protects the sources that Vite serves
  in development.
- The chunk holds only the views' own modules. So the login, which loads before
  the user is known, doesn't need it.
- Files that the views load from outside of `views/`, such as `forms/book.js`,
  end up in `assets/`. Anyone may read `assets/`, so keep what needs protection
  below `views/`.
- Vite's own URLs, such as `/@fs/`, aren't protected. So only use `vite` in
  development.
- A build that gives the views no chunk fails.

In development, Vite opens the HMR websocket on its `server.port`. By default,
this is a free port.
