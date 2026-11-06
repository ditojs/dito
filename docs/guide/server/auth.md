# Users and sessions

`@ditojs/auth` keeps sessions in signed cookies and a `session` table. It adds
the actions of the admin's users:

- login and logout;
- reading the logged-in user;
- confirmed access;
- password change and reset;
- passkeys and TOTP.

The app stores its users in its own entities. `createUsers()` sets up one kind
of users on an entity, with their sessions and credentials.

## Users

```js
import { z } from 'zod'
import { createMikroAdapter } from '@ditojs/mikro'
import { createUsers } from '@ditojs/auth'

export const adapter = createMikroAdapter(orm)

export const admins = createUsers(Admin, {
  adapter,
  // Sign the cookies and the password reset links.
  secrets: config.keys,
  session: { cookieName: 'admin.sess', maxAge: '24h' },
  // The property of the username, `username` by default.
  usernameProperty: 'username',
  // Inactive admins don't log in.
  where: { isActive: true },
  // What the admin and `get self` get: properties, or a function `({ user })`.
  serialize: ['id', 'username', 'roles'],
  // Values computed from the user, added to the properties.
  computed: { initials: ({ user }) => user.username.slice(0, 2) },
  // New passwords, at least 8 characters by default:
  password: z.string().min(12)
})
```

[`createUsers()`](../../api/server/auth.md#createusers) returns the users. The
app passes them to the API as `users`, with the same adapter:

```js
import { createApi, createHono } from '@ditojs/server'

const api = createApi({ controllers, adapter, users: admins })

const app = createHono()
app.route('/api/admin', api)
```

The users also find and change single users, and prepare them for clients:

- `admins.findById(id)` and `admins.findByUsername(username)` use the request's
  entity manager, else a fork of `orm.em`.
- `admins.patch(user, values)` writes the values at once, and sets them on the
  user. It doesn't flush the request's other changes.
- `admins.serialize(user)` returns what `serialize` and `computed` describe.
  Without `serialize`, it returns the entity's own serialization, which leaves
  out hidden properties.

The entity hides `hash`, such as with `p.string().nullable().hidden()`, so that
no response sends it. The users throw when they load users of an entity that
doesn't.

Auth reads `id`, `username`, `hash`, `roles` and `lastLogin` from the users. The
entity's name names the users in sessions and credentials, such as `Admin-1`.

## Sessions

```js
import { useSession } from '@ditojs/auth'

function rememberBook(id) {
  useSession().value.lastBook = id
}
```

The API loads the session before the action, reads its user, and saves the
session after the action, see
[`users.middleware`](../../api/server/auth.md#the-middleware).

Handlers get the session as `session` of their context. `useSession()` returns
the session of the running request, also in functions that a handler calls.

Sessions use the database outside of the action's transaction. This is because
they load before the action, and save after it.
`deleteExpiredSessions(adapter)` deletes the expired rows. The `jobs` of the
[kit](kit.md#jobs) run it, or the app's own schedule.

The cookie holds the session's id, signed with Hono's signed cookies. The first
of `secrets` signs, and all of them verify. So to rotate the secrets, a new
secret goes first. The old one stays until its sessions have expired.

Sessions keep a fingerprint of the user's password hash. So a password change
ends the user's other sessions.

## The users controller

```js
import { defineController } from '@ditojs/server'

export const adminUsers = defineController({
  path: 'admins',
  mixins: [
    admins.defineActions({
      passkeys: { rpName: 'Book Catalog' },
      totp: { issuer: 'Book Catalog', secret: config.totpSecret }
    })
  ]
})
```

`users.defineActions()` returns a mixin with the actions of the admin's users.

- It routes `post login`, `post logout`, `get self`, `get capabilities`,
  `post confirm-access` and `post password`, and the actions of `passkeys`,
  `totp` and `passwordReset`.
- Logins post `username` and `password`. They respond with `{ user }`, or with
  `{ codeRequired: true }` for users with TOTP.
- `get self` responds with the user, or with 204 without a login.
- `get capabilities` tells the admin what to offer, also before the login.

See [`defineActions()`](../../api/server/auth.md#defineactions) for all actions.

The mixin sets `authorize: true` and `transacted: false`. A controller that
mixes it in, and sets these settings, replaces them for the mixed-in actions
too.

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

### User records

```js
import { crud, defineModelController } from '@ditojs/mikro'

export const adminRecords = defineModelController({
  path: 'admins',
  entity: Admin,
  authorize: 'admin',
  mixins: [crud]
})
```

Every model controller of the entity of `createUsers()` protects its
[user records](../../api/server/auth.md#user-records). It needs no mixin.

- The body of `post` and `patch :id` sets `password`, which the user stores as
  `hash`.
- Changing a password or username through `patch :id` needs
  [confirmed access](#confirmed-access) of the session's user. This holds also
  for other users, and for users of another `createUsers()`, as password reset
  links go to the username.
- Users who change their own password stay logged in, and their other sessions
  end.
- `delete :id` deletes the user's credentials with the user.

This controller is separate from the one of `defineActions()`, and doesn't mix
it in. If it did, its `authorize` would apply to the logins too. The writes
would also run outside of a transaction.

### Credentials

Passkeys and TOTP keep their secrets in the `credential` table. No foreign keys
tie them to their users. So deleting a user through a model controller deletes them too.

### Passkeys

The option `passkeys: { rpName, domain?, origins? }` of `defineActions()` adds
logins with passkeys. It also adds the actions to list, add and remove passkeys.

The passkeys belong to the request's host and origin, unless `domain` and
`origins` say otherwise, see [Passkeys](../../api/server/auth.md#passkeys).

### Two-factor authentication

The option `totp: { issuer, secret }` of `defineActions()` adds codes from an
authenticator app, with backup codes.

- Users with TOTP enter a code after the password.
- `secret` is a long random string of the app. It encrypts the TOTP secrets in
  the `credential` table.

### Password reset

```js
admins.defineActions({
  passwordReset: {
    confirmUrl: 'https://example.com/admin/#password-reset={token}',
    send: ({ user, url }) => mailer.send(user.email, 'Reset your password', url)
  }
})
```

The option `passwordReset` of `defineActions()` adds two actions:

- `post password-reset`, which emails a link;
- `post password-reset-confirm`, which sets the new password.

The `secrets` of `createUsers()` sign the links. A link expires after an hour.
It expires earlier with the next login or password change, including the one
that the link makes. A user gets one link per minute. The response is the same
whether the user exists or not.

### Confirmed access

```js
'patch :id': async ({ session, next }) => {
  await session.checkConfirmedAccess()
  return next()
}
```

A login confirms the user's access for ten minutes. The option `reconfirmAfter`
of `defineActions()` sets this time. Actions that change security settings, such
as roles, need confirmed access. `post password` and the
[user records](#user-records) check it themselves.

Without confirmed access, the action responds with 403 and
`confirmationRequired: true`. The admin then asks for the password, and posts it
to `post confirm-access`. Then it sends the request again.

## Other users

```js
import { HttpError } from '@ditojs/server'
import { createUsers, verifyPassword } from '@ditojs/auth'

export const members = createUsers(Member, {
  adapter,
  secrets: config.keys,
  session: { cookieName: 'member.sess', maxAge: '30d' },
  usernameProperty: 'email',
  serialize: ['id', 'email']
})

actions: {
  async 'post login'({ body: { email, password }, session }) {
    const member = await members.findByUsername(email)
    if (!(await verifyPassword(password, member?.hash))) {
      throw new HttpError(401, { message: 'Password or email is incorrect' })
    }
    session.login(member)
    return { user: members.serialize(member) }
  },

  'post logout': ({ session }) => {
    session.logout()
  }
}
```

Users other than the admin's, such as the members of a library, have a
`createUsers()` of their own, and so a session of their own. Their API takes
them as `users`. They log in through `members.defineActions()`, or through
the app's own actions, as above.

## Users outside of Dito

`createAdmin()` takes `users`, as `createApi()` does. It checks the roles of
the user in `authorize`, see [Serving the admin](admin.md).

```js
import { contextStorage } from 'hono/context-storage'
import { useSession } from '@ditojs/auth'

app.use('/account/*', contextStorage(), members.middleware)
app.get('/account/name', async c => {
  const member = await useSession().getUser()
  return c.text(member?.email ?? 'Nobody')
})
```

The app's own Hono routes run `contextStorage()` and the middleware of the users
themselves. `createApp()` of the kit already runs `contextStorage()`.
