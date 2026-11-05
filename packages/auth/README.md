# Dito.js Auth

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/auth` adds sessions and users to Dito.js apps. It has Hono middleware
that keeps sessions in signed cookies and a `session` table, and a controller
for login, logout, confirmed access, password change and reset, passkeys
(`@ditojs/auth/passkeys`) and TOTP (`@ditojs/auth/totp`). The app stores its
users in its own entities and finds them through a user source.

```js
import { Hono } from 'hono'
import { createSessions, defineUserActions, getSessionUser } from '@ditojs/auth'

const sessions = createSessions({
  db: () => kysely,
  secrets,
  cookieName: 'admin.sess',
  maxAge
})
const users = defineUserActions({ path: 'admins', source: adminSource })

const api = createApi({
  controllers: [users.controller, ...controllers],
  middleware: [sessions.middleware],
  getUser: c => getSessionUser(c, adminSource)
})

const app = new Hono()
app.route('/api/admin', api)
```

See
[Users and sessions](https://github.com/ditojs/dito/blob/main/docs/guide/server/auth.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/auth.md).
