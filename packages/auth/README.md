# Dito.js Auth

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/auth` adds sessions and users to Dito.js apps.

- `createUsers()` sets up one kind of users on an entity, with sessions in
  signed cookies and a `session` table.
- Its actions have login, logout, confirmed access, password change and reset,
  passkeys and TOTP.

```js
import { createApi, createHono, defineController } from '@ditojs/server'
import { createUsers } from '@ditojs/auth'

const admins = createUsers(Admin, {
  orm,
  secrets,
  session: { cookieName: 'admin.sess', maxAge },
  serialize: ['id', 'username']
})

const users = defineController({
  path: 'admins',
  mixins: [admins.defineActions()]
})

const api = createApi({
  controllers: [users, ...controllers],
  adapter,
  users: admins
})

const app = createHono()
app.route('/api/admin', api)
```

See
[Users and sessions](https://github.com/ditojs/dito/blob/main/docs/guide/server/auth.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/auth.md).
