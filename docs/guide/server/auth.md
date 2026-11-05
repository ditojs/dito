# Users and sessions

`@ditojs/auth` keeps sessions in signed cookies and a `session` table. It adds
the actions of the admin's users:

- login and logout;
- reading the logged-in user;
- confirmed access;
- password change and reset;
- passkeys and TOTP.

The app stores its users in its own entities. It describes them to auth in a
user source.

## Sessions

```js
import { Hono } from 'hono'
import { createSessions, getSessionUser } from '@ditojs/auth'
import { createMikroAdapter } from '@ditojs/mikro'

export const adapter = createMikroAdapter(orm)

export const adminSessions = createSessions({
  adapter,
  secrets: config.keys,
  cookieName: 'admin.sess',
  maxAge: '24h'
})

const api = createApi({
  controllers,
  adapter,
  middleware: [adminSessions.middleware],
  getUser: ({ c }) => getSessionUser(c, adminSource)
})

const app = new Hono()
app.route('/api/admin', api)
```

`adminSessions.middleware` is Hono middleware. The API runs it before `getUser`,
which reads the session. It loads the session before the action, and saves it
after the action, see
[`createSessions()`](../../api/server/auth.md#createsessions).

`getSession(c)` returns the session, also in the app's own Hono routes.
`getSessionUser(c, source)` returns the id and roles of the session's user, for
the `getUser` of the API.

Sessions use `adapter.getKysely()`, outside of the action's transaction. This is
because they load before the action, and save after it.
`adminSessions.deleteExpired()` deletes the expired rows. Call it from a timer
of the app.

The cookie holds the session's id, signed with Hono's signed cookies. The first
of `secrets` signs, and all of them verify. So to rotate the secrets, a new
secret goes first. The old one stays until its sessions have expired.

## User sources

```js
import { z } from 'zod'
import { createEntityUserSource } from '@ditojs/mikro'

export const adminSource = createEntityUserSource(Admin, {
  // For the queries outside of the API, such as `createAdmin()`'s `authorize`.
  em: () => orm.em,
  // The property of the username, `username` by default.
  usernameProperty: 'username',
  // Inactive admins don't log in.
  where: { isActive: true },
  // What the admin and `get self` get: properties, or a function
  // `({ c, user })`.
  serialize: ['id', 'username', 'roles'],
  // Values computed from the user, added to the properties.
  computed: { initials: ({ user }) => user.username.slice(0, 2) },
  // New passwords, at least 8 characters by default:
  password: z.string().min(12)
})
```

A user source tells auth how to find and change users, and how to send them to
clients. `createEntityUserSource()` of `@ditojs/mikro` makes one for a MikroORM
entity.

- It finds users with the request's entity manager, else with a fork of `em`.
- `patch()` writes the new `hash`, or the `lastLogin` of a login, at once. It
  doesn't flush the request's other changes. It sets the values on the user.
- The source's `password` checks new passwords. It does this in the users
  controller, and in the password writes below.

An app can also write the source itself. It has `name`, `findById(c, id)`,
`findByUsername(c, username)`, `patch(c, user, values)`, `serialize(c, user)`
and the schema `password`.

Auth reads `id`, `username`, `hash`, `roles` and `lastLogin` from the users.
`name`, the entity's name, names the users in sessions and credentials, such as
`Admin-1`. Sessions keep a fingerprint of the user's password hash. So a
password change ends the user's other sessions.

## The users controller

```js
import { defineController } from '@ditojs/server'
import { createCredentials, defineUserActions } from '@ditojs/auth'
import { createPasskeys } from '@ditojs/auth/passkeys'
import { createTotp } from '@ditojs/auth/totp'

export const credentials = createCredentials({ adapter })

export const adminUsers = defineController({
  path: 'admins',
  mixins: [
    defineUserActions({
      source: adminSource,
      credentials,
      features: {
        passkeys: createPasskeys({ rpName: 'Book Catalog' }),
        totp: createTotp({ issuer: 'Book Catalog', secret: config.totpSecret })
      }
    })
  ]
})
```

`defineUserActions()` returns a mixin with the actions of the admin's users.

- It routes `post login`, `post logout`, `get self`, `get features`,
  `post confirm-access` and `post password`, and the actions of its features.
- Logins post `username` and `password`. They respond with `{ user }`, or with
  `{ codeRequired: true }` for users with TOTP.
- `get self` responds with the user, or `null`.
- `get features` tells the admin what to offer, also before the login.

See [`defineUserActions()`](../../api/server/auth.md#defineuseractions) for all
actions.

The mixin sets `authorize: true` and `transacted: false`, see
[`defineUserActions()`](../../api/server/auth.md#defineuseractions). A
controller that mixes it in, and sets these settings, replaces them for the
mixed-in actions too.

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

A controller that lists the mixin in its `mixins` can replace or wrap its
actions, as with any mixin.

### Password writes

```js
import { definePasswordWrites } from '@ditojs/auth'
import { defineModelController } from '@ditojs/mikro'

export const admins = defineModelController({
  path: 'admins',
  entity: Admin,
  authorize: 'admin',
  mixins: [definePasswordWrites({ source: adminSource })],
  actions: { 'get': true, 'get :id': true, 'delete :id': true }
})
```

[`definePasswordWrites()`](../../api/server/auth.md#definepasswordwrites) is a
mixin for the model controller of the users. It routes `post` and `patch :id`.
Their body sets `password`, which the user stores as `hash`. Users who change
their own password stay logged in, and their other sessions end.

This controller is separate from the one of `defineUserActions()`, and doesn't
mix it in. If
it did, its `authorize` would apply to the logins too. The writes would also run
outside of a transaction.

### Credentials

```js
await credentials.deleteUsers(adminSource, ids, { c })
```

Passkeys and TOTP keep their secrets in the `credential` table, through
`createCredentials({ adapter })`. No foreign keys tie them to their users. So an
action that deletes users deletes their credentials too, as above.

### Passkeys

`createPasskeys({ rpName, domain?, origins? })` from `@ditojs/auth/passkeys`
adds logins with passkeys. It also adds the actions to list, add and remove
passkeys.

- It needs `credentials`, and the packages `@simplewebauthn/server` and
  `aaguids`.
- The passkeys belong to the request's host and origin, unless `domain` and
  `origins` say otherwise, see
  [`createPasskeys()`](../../api/server/auth.md#createpasskeys).

### Two-factor authentication

`createTotp({ issuer, secret })` from `@ditojs/auth/totp` adds codes from an
authenticator app, with backup codes.

- Users with TOTP enter a code after the password.
- `secret` is a long random string of the app. It encrypts the TOTP secrets in
  the `credential` table.
- `createTotp()` needs `credentials` and the package `otpauth`.

### Password reset

```js
passwordReset: createPasswordReset({
  secrets: config.keys,
  confirmUrl: 'https://example.com/admin/#password-reset={token}',
  send: ({ user, url }) =>
    mailer.send(user.email, 'Reset your password', url)
})
```

`createPasswordReset({ secrets, confirmUrl, send })` adds two actions:

- `post password-reset`, which emails a link;
- `post password-reset-confirm`, which sets the new password.

The link expires after an hour. It expires earlier with the next login or
password change, including the one that the link makes. A user gets one link
per minute. The response is the same whether the user exists or not.

### Confirmed access

```js
'patch :id': async ({ c, next }) => {
  await getSession(c).checkConfirmedAccess(adminSource)
  return next()
}
```

A login confirms the user's access for ten minutes. `reconfirmAfter` sets this
time. Actions that change security settings, such as roles, need confirmed
access.

Without confirmed access, the action responds with 403 and
`confirmationRequired: true`. The admin then asks for the password, and posts it
to `post confirm-access`. Then it sends the request again.

## Other users

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

Users other than the admin's, such as the members of a library, log in through
the app's own actions. They have a session of their own.

## Users outside of Dito

`createAdmin()` takes the session middleware and `getSessionUser()`, as
`createApi()` does. It checks the roles of the user in `authorize`, see
[Serving the admin](admin.md).

The app's own Hono routes run the session middleware with `app.use()`. They read
the user with `getSessionUser()`.
