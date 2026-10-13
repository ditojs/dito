# Roles

The shop's staff have roles: editors work on books, sales staff on orders, and
only admins may delete books. Each user should see the views and buttons of
their roles, and the server has to enforce the same rules.

## Solution

On the server, users store their roles, and controllers authorize by them:

```js
import { Model, ModelController, UserMixin } from '@ditojs/server'

// `UserMixin` adds `username` and `password`:
export class User extends UserMixin(Model) {
  static properties = {
    roles: {
      type: 'array',
      items: { type: 'string', enum: ['editor', 'sales', 'admin'] },
      default: []
    }
  }
}

export class Books extends ModelController {
  modelClass = Book
  // For all actions without their own setting:
  authorize = ['editor', 'admin']
  collection = { allow: ['get', 'post'] }
  member = {
    allow: ['get', 'patch', 'delete'],
    authorize: { delete: 'admin' }
  }
}

export class Orders extends ModelController {
  modelClass = Order
  authorize = ['sales', 'admin']
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch'] }
}
```

In the admin, `context.user` is the logged-in user, with its roles:

```js
export const books = {
  type: 'view',
  if: ({ user }) => user.hasRole('editor', 'admin'),
  component: {
    type: 'list',
    resource: 'books',
    form: bookForm,
    creatable: true,
    editable: true,
    deletable: ({ user }) => user.hasRole('admin')
  }
}

export const orders = {
  type: 'view',
  if: ({ user }) => user.hasRole('sales', 'admin'),
  component: { type: 'list', resource: 'orders', form: orderForm }
}
```

## Why

A string in `authorize` names a role, which the server checks with
`user.$hasRole()`; an array authorizes any of its roles, and an object keyed by
action name sets them per action. The admin's `user.hasRole()` reads the same
`roles` array of the session's user, so the admin only shows what the server
allows. A view's `if` also blocks opening it by its URL, but the admin's checks
are for the interface only: the server's `authorize` settings protect the
data. The `AdminController` itself needs to let all of them in, with
`authorize = ['editor', 'sales', 'admin']`.

See also: [Authorize](../api/server/controllers.md#authorize),
[`UserMixin`](../api/server/model.md#usermixin),
[`user`](../api/admin/context.md#user),
[Controllers](../guide/server/controllers.md).
