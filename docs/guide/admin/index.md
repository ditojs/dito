# Getting Started with Dito.js Admin

Dito.js Admin renders an admin interface from plain objects, the schemas. You
describe views, lists, forms and fields; the admin loads the data from your
Dito.js Server API, lets users edit it, validates it and saves it back.

This guide builds the admin of a bookshop step by step. The pages of the guide
explain the concepts; the [API reference](../../api/admin/index.md) lists every
option and member.

## How the pieces fit

- The server hosts the admin through an `AdminController`, and serves the
  global `dito` object with the `api` and `settings` of `config.admin`.
- The admin's entry module creates a `DitoAdmin` with your views.
- Views hold fields, e.g. a list of books. Lists open forms to edit their
  items, and forms hold fields.
- Data is loaded from and saved to API resources, e.g. `books` for
  `/api/books`, which the server's model controllers provide.

## Server setup

Add an `AdminController` at the top level of the app's controllers, next to
the API namespace. Its name gives its path: `Admin` is served at `/admin` with
`app.normalizePaths`, see [Controllers](../server/controllers.md#paths):

```js
// src/server/controllers/index.js
import { AdminController } from '@ditojs/server'

export class Admin extends AdminController {
  authorize = ['editor', 'sales', 'admin']
}

export * as api from './api/index.js'
```

The admin's users log in through a `UsersController`, e.g. at `/api/users`,
see [Controllers](../server/controllers.md).

Configure the admin in `config.admin`:

```js
// config/index.js
export default {
  admin: {
    // The folder with the admin's sources, `index.html` and `index.js`:
    root: './src/admin',
    // Where the production build of the admin goes:
    dist: './dist/admin',
    // Passed to the admin as `dito.api`:
    api: {
      url: '/api',
      locale: 'en-US'
    },
    // Passed to the admin as `dito.settings`:
    settings: {
      rootClass: 'bookshop-admin'
    }
  }
}
```

`settings` holds `rootClass`, a class for the admin's root element, and
`forceDragFallback`, see
[AdminContext](../../api/admin/admin.md#settings).

In development (`config.env === 'development'`), the controller serves the
admin's sources through Vite with hot reloading. Otherwise it serves the build
in `dist`. Both need the build tools, see
[Installation](../server/index.md#installation). To build, add
`admin.vite.config.js` to the app's root folder and run
`vite build --config admin.vite.config.js`:

```js
// admin.vite.config.js
import app from './src/server/app.js'

export default app.defineAdminViteConfig()
```

`defineAdminViteConfig(config)` takes Vite options to merge, e.g. `resolve`
aliases. The controller reads the same file in development.

## The admin entry

`index.html` in the admin's root folder loads the entry module:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bookshop Admin</title>
  </head>
  <body>
    <div id="dito-admin"></div>
    <script type="module" src="/index.js"></script>
  </body>
</html>
```

`index.js` creates the admin. The controller injects the global `dito` object
into `index.html`, which is the default of the `dito` option of `DitoAdmin`.
The `api` option is merged over `dito.api`, so settings that belong to code,
like functions, go here. `api.users` could live in `config.admin.api` too:

```js
// src/admin/index.js
import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

new DitoAdmin('#dito-admin', {
  api: {
    users: { path: 'users' }
  },
  views: () => import('./views/index.js')
})
```

See [DitoAdmin](../../api/admin/admin.md) for all options, and
[ApiConfig](../../api/admin/admin.md#apiconfig) for the `api` settings.

## A first view

```js
// src/admin/views/index.js
export * from './books.js'
```

```js
// src/admin/views/books.js
export const books = {
  type: 'view',
  label: 'Books',
  field: {
    type: 'list',
    resource: 'books',
    columns: {
      title: { sortable: true, defaultSort: 'asc' },
      price: {}
    },
    paginate: 25,
    creatable: true,
    editable: true,
    deletable: true,
    form: () => import('../forms/book.js')
  }
}
```

```js
// src/admin/forms/book.js
export const bookForm = {
  type: 'form',
  label: 'Book',
  fields: {
    title: { type: 'text', required: true },
    price: { type: 'number', decimals: 2, prefix: '€', width: '1/2' },
    publishedAt: { type: 'date', width: '1/2' },
    summary: { type: 'textarea', lines: 6 }
  }
}
```

This gives a menu entry "Books", a paginated, sortable table of the books at
`/admin/books`, and a form at `/admin/books/1` that loads `GET /api/books/1`
and saves with `PATCH`. New books are posted to `/api/books`. Leaving a form
with unsaved changes asks first.

## Schemas and callbacks

Almost every option takes either a value or a callback that receives a
[context](./context.md) and returns it. Callbacks run again when the data they
read changes:

```js
stock: {
  type: 'integer',
  // Only shown for books that are for sale:
  if: ({ item }) => item.isAvailable,
  disabled: ({ user }) => !user.hasRole('sales')
}
```

Event handlers are `on…` options, e.g. `onChange()` or `onClick()`, and
receive the context too, see [Events](./events.md).

## Next steps

- [Views](./views.md) and menus, [Lists and objects](./lists.md),
  [Forms](./forms.md) with the clipboard, and [Fields](./fields.md).
- [Buttons](./buttons.md), [Layout](./layout.md) and
  [the context](./context.md) that callbacks receive.
- [Events](./events.md), [Validation](./validation.md),
  [Dirty state](./dirty-state.md), [Nested forms](./nested-forms.md) and
  [Dialogs](./dialogs.md).
- [Forms with properties and widgets](./widgets.md): forms in Vue templates.
- [Custom types](./custom-types.md): your own components and type defaults.

Upgrading from Dito.js 3.x: see [Upgrading to 4.x](../../upgrading-to-4.x.md).
