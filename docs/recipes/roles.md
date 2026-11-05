# Roles

The library's staff have roles: editors work on books, desk staff on loans, and
only admins may delete books. Each user should see the views and buttons of
their roles, and the server has to enforce the same rules.

## Solution

On the server, users store their roles. The user source passes the roles to
the sessions and to the admin:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { schemaJson } from '@ditojs/mikro'
import { z } from 'zod'

const roleNames = z.array(z.enum(['editor', 'desk', 'admin']))

const UserSchema = defineEntity({
  name: 'User',
  properties: {
    id: p.integer().primary(),
    username: p.string().unique(),
    hash: p.string().nullable().hidden(),
    roles: schemaJson(roleNames).onCreate(() => [])
  }
})
export class User extends UserSchema.class {}
UserSchema.setClass(User)

// In the user source of `@ditojs/auth`, which reads `id`, `hash` and
// `roles` from the users:
toJSON: (c, user) => ({
  id: user.id,
  username: user.username,
  roles: user.roles
})
```

The controllers authorize by the roles:

```js
import { defineController } from '@ditojs/mikro'

export const books = defineController({
  path: 'books',
  entity: Book,
  // For all actions without their own setting:
  authorize: ['editor', 'admin'],
  actions: {
    'get': true,
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': { authorize: 'admin' }
  }
})

export const loans = defineController({
  path: 'loans',
  entity: Loan,
  authorize: ['desk', 'admin'],
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

In the admin, `context.user` is the logged-in user, with its roles:

```js
export const books = {
  type: 'view',
  if: ({ user }) => user.hasRole('editor', 'admin'),
  field: {
    type: 'list',
    resource: 'books',
    form: bookForm,
    creatable: true,
    editable: true,
    deletable: ({ user }) => user.hasRole('admin')
  }
}

export const loans = {
  type: 'view',
  if: ({ user }) => user.hasRole('desk', 'admin'),
  field: { type: 'list', resource: 'loans', form: loanForm }
}
```

## Why

A string in `authorize` names a role. An array lets in users with any of its
roles. An action's own `authorize` replaces the controller's.

`sessionUser()` passes the `roles` of the session's user to `authorize`.
`toJSON()` sends them to the admin, whose `user.hasRole()` reads them. So the
admin only shows what the server allows.

A view's `if` also blocks opening the view by its URL. But the admin's checks
only affect the interface. The server's `authorize` settings protect the data.
The `authorize` of `createAdmin()` must let users of all three roles load the
admin's views:

```js
createAdmin({
  ...options,
  middleware: sessions.middleware,
  getUser: sessionUser(source),
  authorize: ['editor', 'desk', 'admin']
})
```

See [Users outside of Dito](../guide/server/auth.md#users-outside-of-dito).

See also: [Authorization](../guide/server/controllers.md#authorization),
[Users and sessions](../guide/server/auth.md),
[Serving the admin](../guide/server/admin.md),
[`user`](../api/admin/context.md#user).
