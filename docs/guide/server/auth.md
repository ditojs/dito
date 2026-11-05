# Users and sessions

`@ditojs/auth` keeps sessions in signed cookies and a `session` table. It adds
the actions of the admin's users: login, logout, reading the logged-in user,
confirmed access, password change and reset, passkeys and TOTP. The app stores
its users in its own entities, and describes them to auth in a user source.

## Sessions

```js
import { Hono } from 'hono'
import { createSessions, sessionUser } from '@ditojs/auth'

export const adminSessions = createSessions({
  db: () => getRootKysely(orm),
  secrets: config.keys,
  name: 'admin.sess',
  maxAge: 24 * 60 * 60 * 1000
})

const api = createApi({
  controllers,
  middleware: [adminSessions.middleware],
  getUser: sessionUser(adminSource)
})

const app = new Hono()
app.route('/api/admin', api)
```

`adminSessions.middleware` is Hono middleware. The API runs it before `getUser`,
which reads the session. It loads the session into `c.var.session` before the
action. After the action, it saves the session if it changed, even when the
action throws, and adds its cookie to the response. `getSession(c)` returns the
session, also in the app's own Hono routes. `sessionUser(source)` is the
`getUser` of the API, which returns the id and roles of the session's user.

Sessions use their own database handle, `db()`, because they load before the
action's transaction and save after it. `deleteExpiredSessions(kysely)` deletes
the expired rows. Call it from a timer of the app.

The cookie holds the session's id, signed with Hono's signed cookies. The first
of `secrets` signs, and all of them verify. So a new secret goes first, and the
old one stays until its sessions have expired. Session cookies are
`SameSite=Lax`, `HttpOnly`, and `Secure` on https.
`readSignedCookie(c, secrets, name)` reads the app's own cookies, which it signs
with `setSignedCookie()` of `hono/cookie` and the first secret.

## User sources

A user source tells auth how to find and change users, and how to send them to
clients. `createEntityUserSource()` of `@ditojs/mikro` makes one for a MikroORM
entity:

```js
import { createEntityUserSource } from '@ditojs/mikro'

export const adminSource = createEntityUserSource(Admin, {
  // For the queries outside of the API, such as `createAdmin()`'s `authorize`.
  em: () => orm.em,
  // The property of the username, `username` by default.
  usernameProperty: 'username',
  // Inactive admins don't log in.
  where: { isActive: true },
  // What the admin and `get self` get: properties, or a function `(c, user)`.
  serialize: ['id', 'username', 'roles'],
  // Values computed from the user, added to the properties.
  computed: { initials: admin => admin.username.slice(0, 2) }
})
```

It finds users with the request's entity manager, else with a fork of `em`.
`patch()` writes the new `hash` or the `lastLogin` of a login at once, without
flushing the request's other changes, and sets them on the user. An app can also
write the object itself, with `name`, `findById(c, id)`,
`findByUsername(c, username)`, `patch(c, user, values)` and
`serialize(c, user)`.

Auth reads `id`, `username`, `hash`, `roles` and `lastLogin` from the users.
`name`, the entity's name, names the users in sessions and credentials, such as
`Admin-1`. Sessions keep a fingerprint of the user's password hash, so a
password change ends the user's other sessions.

## The users controller

`usersRoutes()` returns a controller with the actions of the admin's users, and
the features that the controller offers, which the admin reads:

```js
import { z } from 'zod'
import { defineController } from '@ditojs/server'
import { createCredentials, usersRoutes } from '@ditojs/auth'
import { passkeys } from '@ditojs/auth/passkeys'
import { totp } from '@ditojs/auth/totp'

const users = usersRoutes({
  path: 'admins',
  source: adminSource,
  // New passwords, 8 characters at least by default:
  password: z.string().min(12),
  credentials: createCredentials(() => getRootKysely(orm)),
  features: {
    passkeys: passkeys({ rpName: 'Book Catalog' }),
    totp: totp({ issuer: 'Book Catalog', secret: config.totpSecret })
  }
})

export const adminUsers = defineController({
  path: 'admins',
  mixins: [users.controller]
})
```

It routes `post login`, `post logout`, `get self`, `post confirm-access` and
`post password`, and the actions of its features. Logins post `username` and
`password`, and respond with `{ user }`, or with `{ codeRequired: true }` for
users with TOTP. `get self` responds with the user, or `null`. See
[`usersRoutes()`](../../api/server/auth.md#usersroutes) for all actions.

The actions check the login themselves, as the controller sets
`authorize: true`. They run outside the API's transactions, as it sets
`transacted: false`. TOTP opens a transaction of its own, so failed codes stay
counted when a request fails. A controller that mixes it in and sets these
settings replaces them for the mixed-in actions too.

A controller that lists `users.controller` in its `mixins` can replace or wrap
its actions, as with any mixin:

```js
import { deleteCookie } from 'hono/cookie'

actions: {
  // Removes a cookie of the app, then logs out.
  'post logout': ({ c, next }) => {
    deleteCookie(c, 'preview_access')
    return next()
  }
}
```

### Password writes

[`passwordWrites()`](../../api/server/auth.md#passwordwrites) is a mixin for the
model controller of the users. It routes `post` and `patch :id`, where the body
sets `password`, which the user stores as `hash`. Users who change their own
password stay logged in, and their other sessions end.

```js
import { passwordWrites } from '@ditojs/auth'
import { defineModelController } from '@ditojs/mikro'

export const admins = defineModelController({
  path: 'admins',
  entity: Admin,
  authorize: 'admin',
  mixins: [passwordWrites({ source: adminSource })],
  actions: { 'get': true, 'get :id': true, 'delete :id': true }
})
```

This controller is separate from `users.controller` and doesn't mix it in. Its
`authorize` would then apply to the logins too, and the writes would run outside
of a transaction.

### Credentials

Passkeys and TOTP keep their secrets in the `credential` table, through
`createCredentials(() => getRootKysely(orm))`. No foreign keys tie them to their
users, so an action that deletes users deletes their credentials too:

```js
import { deleteUserCredentials } from '@ditojs/auth'

await deleteUserCredentials(getRootKysely(orm), adminSource, ids)
```

### Passkeys

`passkeys({ rpName, domain?, origins? })` from `@ditojs/auth/passkeys` adds
logins with passkeys, and the actions to list, add and remove passkeys. It needs
`credentials` and the packages `@simplewebauthn/server` and `aaguids`. The
passkeys belong to the request's host and origin, unless `domain` and `origins`
say otherwise, see [`passkeys()`](../../api/server/auth.md#passkeys).

### Two-factor authentication

`totp({ issuer, secret })` from `@ditojs/auth/totp` adds codes from an
authenticator app, with backup codes. Users with TOTP enter a code after the
password. `secret` is a long random string of the app, which encrypts the TOTP
secrets in the `credential` table. `totp()` needs `credentials` and the package
`otpauth`.

### Password reset

`passwordReset({ secrets, confirmUrl, send })` adds `post password-reset`, which
emails a link, and `post password-reset-confirm`, which sets the new password:

```js
passwordReset: passwordReset({
  secrets: config.keys,
  confirmUrl: 'https://example.com/admin/#password-reset={token}',
  send: (c, user, url) => mailer.send(user.email, 'Reset your password', url)
})
```

The link expires after an hour, or earlier with the next login or password
change, including the one that the link makes. A user gets one link per minute,
and the response is the same whether the user exists or not.

### Confirmed access

A login confirms the user's access for ten minutes. `reconfirmAfter` sets this
time. Actions that change security settings, such as roles, need confirmed
access:

```js
'patch :id': async ({ c, next }) => {
  await getSession(c).checkConfirmedAccess(adminSource)
  return next()
}
```

Without confirmed access, the action responds with 403 and
`confirmationRequired: true`. The admin then asks for the password, posts it to
`post confirm-access`, and sends the request again.

## Other users

Users other than the admin's, such as the members of a library, log in through
the app's own actions, with a session of their own:

```js
import { HttpError } from '@ditojs/server'
import { getSession, verifyPassword } from '@ditojs/auth'

actions: {
  async 'post login'({ body: { email, password }, c }) {
    const member = await memberSource.findByUsername(c, email)
    if (!(await verifyPassword(password, member?.hash))) {
      throw new HttpError(401, { message: 'Password or email is incorrect' })
    }
    getSession(c).login(memberSource, member)
    return { user: memberSource.serialize(c, member) }
  },

  'post logout': ({ c }) => {
    getSession(c).logout()
  }
}
```

## Users outside of Dito

`createAdmin()` takes the session middleware and `sessionUser()` as
`createApi()` does, and checks the roles of the user in `authorize`:

```js
createAdmin({
  ...options,
  middleware: adminSessions.middleware,
  getUser: sessionUser(adminSource),
  authorize: 'admin'
})
```

The app's own Hono routes run the session middleware with `app.use()`, and read
the user with the function that `sessionUser()` returns.
