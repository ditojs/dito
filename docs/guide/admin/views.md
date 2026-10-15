# Views

Views are the pages of the admin. Each view gets an entry in the navigation
menu and a URL, and holds the components that it displays. The `views` option
of `DitoAdmin` maps names to views, or to menus that group them.

## Single-component views

Most views display one list. Give the view a `component`, and the view acts on
that list: the list fills the page without a label of its own, and the forms
of its items are routed under the view's path, e.g. `/admin/authors/1`.

```js
// src/admin/views/authors.js
export const authors = {
  type: 'view',
  label: 'Authors',
  component: {
    type: 'list',
    resource: 'authors',
    columns: ['name'],
    creatable: true,
    editable: true,
    form: () => import('../forms/author.js')
  }
}
```

The view's name, its key in `views`, sets its path: `authors` is served at
`/admin/authors`. `path` sets another one.

## Views with several components

With `components`, a view lays out several components like a form, e.g. two
lists side by side:

```js
// src/admin/views/orders.js
export const orders = {
  type: 'view',
  label: 'Orders',
  components: {
    openOrders: {
      type: 'list',
      label: 'Open',
      resource: { path: 'orders', query: { status: 'open' } },
      columns: ['number', 'customer', 'createdAt'],
      editable: true,
      form: () => import('../forms/order.js'),
      width: '1/2'
    },
    shippedOrders: {
      type: 'list',
      label: 'Shipped',
      resource: { path: 'orders', query: { status: 'shipped' } },
      columns: ['number', 'customer', 'createdAt'],
      editable: true,
      form: () => import('../forms/order.js'),
      width: '1/2'
    }
  }
}
```

The forms of such lists are routed under the view's path and the list's name,
e.g. `/admin/orders/open-orders/12` with `app.normalizePaths`.

A view's components edit the view's own data, which it doesn't load or save
itself: lists with a `resource` load and save their items, and
[buttons](./buttons.md) can send requests. Views without a button of type
`submit` are never dirty, see
[Dirty state](./dirty-state.md#only-data-that-can-be-saved-is-dirty).

## Menus

A `menu` groups views under one entry of the navigation menu. Its `items`
take the same forms as `views`:

```js
// src/admin/views/index.js
export const catalog = {
  type: 'menu',
  label: 'Catalog',
  items: {
    books: import('./books.js'),
    authors: import('./authors.js')
  }
}

export * from './orders.js'
```

A module with a single export, like `books.js`, stands for that export, so
`import()` can be passed as it is.

## Lists of modules

`views` and the `items` of menus can be arrays too. Each entry is a view, a
menu, or the `import()` of a module with one named export, whose name becomes
the view's name. Menus in arrays are named after their label:

```js
// src/admin/views/index.js
export default [
  {
    type: 'menu',
    label: 'Catalog',
    items: [
      import('./books.js'),
      import('./authors.js'),
      import('./genres.js')
    ]
  },
  {
    type: 'menu',
    label: 'Sales',
    items: [import('./orders.js'), import('./customers.js')]
  }
]
```

With `views: () => import('./views/index.js')`, the module's default export is
used. Arrays keep the order of the menu in one place, and each view's file
names it.

## Who sees a view

`if` hides a view from the menu and blocks direct access to its URL, which
redirects to the start page:

```js
export const users = {
  type: 'view',
  label: 'Users',
  if: ({ user }) => user.hasRole('admin'),
  component: { … }
}
```

`if` only hides the admin's interface. Protect the data on the server, with
the `authorize` settings of the controllers, see
[Controllers](../server/controllers.md).

The admin resolves its views again for each login: a `views` function is
called again, e.g. to load schemas that depend on the API.

## Account settings

`account.settings` gives each user a form to edit their own account, opened
through the menu under their name in the sidebar, without an item in the main
menu. The admin shows it at `/account/settings`, loads the user from
`GET /api/users/self` and saves it with `PATCH /api/users/self`, then shows the
changes, e.g. of the username, right away:

```js
// src/admin/index.js
new DitoAdmin('#dito-admin', {
  views: () => import('./views/index.js'),
  account: {
    settings: () => import('./account-settings.js')
  }
})
```

```js
// src/admin/account-settings.js
export default {
  type: 'form',
  label: 'Account',
  components: {
    email: {
      type: 'email',
      label: 'Email',
      required: true
    },
    // Only sent when a new password is entered:
    password: {
      type: 'password',
      label: 'New Password'
    }
  }
}
```

On the server, `PATCH /users/self` goes through the `patch` member action of
the `UsersController`, so the users need to be allowed to patch themselves:
`member = { allow: ['get', 'patch'] }`, which only allows users to patch
themselves (`'$self'`) by default. To keep users from changing some of their
fields, e.g. their roles, override the member's `patch` action, which applies
to both routes:

```js
export class Users extends UsersController {
  modelClass = User

  member = {
    allow: ['get', 'patch'],
    authorize: ['$self', 'admin'],

    patch(ctx) {
      if (!ctx.state.user.$hasRole('admin')) {
        delete ctx.request.body.roles
      }
      return super.patch(ctx)
    }
  }
}
```

## Panels and tabs

Views take `panels`, shown in the sidebar, and `tabs`, like forms. See
[Layout](./layout.md).

## Reference

- [`view` and `menu`](../../api/admin/schemas.md#view) options.
- [`DitoAdmin` options](../../api/admin/admin.md), including `views`.
