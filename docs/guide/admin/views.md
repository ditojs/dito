# Views

Views are the pages of the admin. Each view gets an entry in the navigation
menu and a URL, and holds the fields that it displays. The `views` option
of `DitoAdmin` maps names to views, or to menus that group them.

## Single-field views

Most views display one list. Give the view a `field`, and the view acts on
that list: the list fills the page without a label of its own, and the forms
of its items are routed under the view's path, e.g. `/admin/authors/1`.

```js
// src/admin/views/authors.js
export const authors = {
  type: 'view',
  label: 'Authors',
  field: {
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

## Views with several fields

With `fields`, a view lays out several fields like a form, e.g. two
lists side by side:

```js
// src/admin/views/orders.js
export const orders = {
  type: 'view',
  label: 'Orders',
  fields: {
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

A view's fields edit the view's own data, which it doesn't load or save
itself: lists with a `resource` load and save their items, and
[buttons](./buttons.md) can send requests. Views without a button of type
`submit` are never dirty, see
[Dirty state](./dirty-state.md#only-data-that-can-be-saved-is-dirty).

## Pages

A `page` is a view whose content is a Vue component, e.g. for tools that don't
edit data through fields:

```js
// src/admin/views/cachePurge.js
export const cachePurge = {
  type: 'page',
  label: 'Cache Purge',
  path: 'tools/cache-purge',
  component: () => import('./CachePurgePage.vue')
}
```

The component reads the page's context with
[`useDitoContext()`](../../api/admin/index.md), e.g. for `context.request()` or
`context.notify()`. Pages have no data or form of their own.

The `path` of a page can hold route params, which the component reads with
vue-router's `useRoute()`. Pages with required params, like
`path: 'products/:id'`, have no menu item, as there is nothing to link to
without them. Optional ones, like `:id?`, keep it.

### Forms in pages

A page sets up a form of its own with `useDitoForm()`, which takes the options
of a [form](./forms.md), e.g. `fields`, `buttons`, `tabs` and its events, and
`resource` and `id`. It loads the item of `id` from `resource` and saves it,
loads the next item when `id` changes, and creates a new one when `id` is
`null`, which it saves after creating it. It returns the form's
[context](./context.md), e.g. for `context.isDirty` or `context.submit()`.
`DitoSchemaForm` renders the form with its buttons:

```js
// src/admin/views/product.js
export const product = {
  type: 'page',
  label: 'Product',
  path: 'products/:id?',
  component: () => import('./ProductPage.vue')
}
```

```vue
<!-- src/admin/views/ProductPage.vue -->
<template>
  <DitoSchemaForm>
    <DitoPane />
    <aside>{{ form.item?.name }}</aside>
  </DitoSchemaForm>
  <button type="button" @click="form.submit()">Publish</button>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useDitoForm, DitoSchemaForm, DitoPane } from '@ditojs/admin'

const route = useRoute()
const form = useDitoForm({
  resource: 'products',
  id: () => route.params.id || null,
  fields: {
    name: { type: 'text', label: 'Name', required: true },
    price: { type: 'number', label: 'Price' }
  }
})
</script>
```

The default slot of `DitoSchemaForm` lays out the fields, as in
[Laying out fields](./custom-types.md#laying-out-fields); without it, the
fields render in rows. The submit button saves or creates the item, and there
is no cancel button. Without a `resource`, submitting validates the data and
fires `onSuccess()`, without a request. Each component sets up one form;
lists with forms of their own route, e.g. without `inlined: true`, aren't
supported in it.

The page's route takes the form's changes: leaving it, or switching to another
`id`, asks to discard them, and the trail and the browser warn about them. The
same component also works in a [dialog](./dialogs.md), as the `component` of a
`type: 'component'` field, without the route: there, the form has a cancel
button, and its submit button closes the dialog with the saved item.

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
  field: { … }
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
  fields: {
    email: {
      type: 'email',
      label: 'Email',
      required: true
    }
  }
}
```

The Security dialog of the account menu changes the password through
`'post password'` of the `UsersController`, which needs no `patch`, see
[Confirmed access](../server/controllers.md#confirmed-access).

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

- [`view`, `page` and `menu`](../../api/admin/schemas.md#view) options.
- [`DitoAdmin` options](../../api/admin/admin.md), including `views`.
