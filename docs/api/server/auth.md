# Auth

```js
import {
  createUsers,
  useSession,
  hashPassword,
  verifyPassword
} from '@ditojs/auth'
```

`@ditojs/auth` keeps sessions in signed cookies. It also has the actions of the
admin's users:

- login and logout;
- reading the logged-in user;
- confirmed access;
- password change and reset;
- passkeys and TOTP.

The app keeps its users in its own entities, and sets them up with
[`createUsers()`](#createusers). Sessions and credentials are stored in the
`session` and `credential` tables. Auth reads these tables through
[Kysely](https://kysely.dev).

The peer dependencies are `@ditojs/server`, `@mikro-orm/core`, `hono`, `kysely`
and `zod`. See [Users and sessions](../../guide/server/auth.md) in the guide.

The package exports the types `User`, `Session`, `Users`, `CreateUsersOptions`
and `DefineActionsOptions`.

## createUsers()

```ts
createUsers<U extends User>(
  entity: EntityClass<U>,
  options: CreateUsersOptions<U>
): Users<U>
```

```js
const admins = createUsers(Admin, {
  orm,
  secrets: config.keys,
  session: { cookieName: 'admin.sess', maxAge: '24h' },
  serialize: ['id', 'username', 'roles']
})

createApi({ controllers, adapter, users: admins })
```

Sets up one kind of users, such as admins or members, on an entity, with their
sessions and credentials. The app passes the result as `users` to
[`createApi()`](api.md#apiconfig), `app.routeApi()` and
[`createAdmin()`](../admin/server.md#createadminoptions).

| Option             | Type                                    | Description                                                                                                                                                              |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orm`              | `{ em: EntityManager }`                 | The ORM with the `session` and `credential` tables, set up with [`defineMikroConfig()`](mikro.md#definemikroconfig).                                                     |
| `secrets`          | `string[]`                              | The secrets that sign the cookies and the password reset links. The first one signs, and all of them verify, so they can rotate. `createUsers()` throws without any.     |
| `session`          | `{ cookieName, maxAge }`                | The name of the cookie, such as `admin.sess`, and the lifetime of a session.                                                                                             |
| `session.maxAge`   | `number \| string`                      | In milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Browsers cap cookies at 400 days.                             |
| `serialize`        | `string[] \| ({ user }) => unknown`     | The properties that clients get, plus `computed`, or a function that returns the JSON. By default, the entity's own serialization, without hidden properties.            |
| `computed`         | `Record<string, ({ user }) => unknown>` | Values computed from the user, added to the properties of `serialize`.                                                                                                   |
| `where`            | `object`                                | A condition that users also need to meet to be found, such as `{ isActive: true }`.                                                                                      |
| `usernameProperty` | `string`                                | The property of the username. Default: `username`.                                                                                                                       |
| `password`         | `ZodType<string>`                       | The schema of new passwords, in the actions of [`defineActions()`](#defineactions) and in the [user records](#user-records). Default: a string of at least 8 characters. |

The entity hides `hash` with `.hidden()`, so that no response sends it. The
users throw when they load users of an entity that doesn't.

### The users

`createUsers()` returns these:

| Member                      | Description                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `findById(id)`              | Resolves to the user with the id, a string, or `null`, also for an id that doesn't fit the primary key.                                                                                                      |
| `findByUsername(username)`  | Resolves to the user with the username, or `null`.                                                                                                                                                           |
| `patch(user, values)`       | Writes the values at once, and sets them on the user. It doesn't flush the request's other changes.                                                                                                          |
| `serialize(user)`           | Returns what `serialize` and `computed` describe.                                                                                                                                                            |
| `middleware`                | The session middleware, see [The middleware](#the-middleware).                                                                                                                                               |
| `getUser({ c })`            | Resolves to `{ id, roles }` of the session's user, or `null`. `createApi()` and `createAdmin()` use it as their `getUser`.                                                                                   |
| `readSignedCookie(c, name)` | Returns the value of the cookie `name` if one of `secrets` signed it, else `null`. It reads the app's own cookies, which the app writes with `setSignedCookie(c, name, value, secrets[0])` of `hono/cookie`. |
| `deleteExpiredSessions()`   | Deletes the expired rows of the `session` table. The app runs it on a timer.                                                                                                                                 |
| `defineActions(options?)`   | Returns the mixin with the actions of the users, see [`defineActions()`](#defineactions).                                                                                                                    |
| `name`                      | The name of the entity, which names the users in sessions and credentials, as `'<name>-<id>'`.                                                                                                               |
| `usernameProperty`          | The option of the same name.                                                                                                                                                                                 |
| `password`                  | The option of the same name.                                                                                                                                                                                 |

The finding and writing methods use the entity manager of the running request,
else a fork of `orm.em`.

### The middleware

`middleware` is Hono middleware. `createApi()` and `createAdmin()` run it, and
the app's own Hono routes run it with `app.use()`.

- It loads the session into `c.var.session` before the action.
- After the action, it saves the session if it changed. It does this even when
  the action throws.
- It adds its `Set-Cookie` header to the response, also to error responses.
- It restores the previous `c.var.session` when it ends.

The last point lets one action run with the session of other users, through
`middleware: members.middleware`. The action logs in a member, while the admin's
session is saved as usual.

Sessions and credentials use a Kysely outside of the requests' transactions. So
sessions save after a failed request, and failed TOTP codes stay counted.

### The tables

The app creates the `session` and `credential` tables. All users of an app share
them. `post login` reads the `credential` table, also without passkeys and TOTP.

```sql
create table session (
  id text primary key,
  value jsonb,
  expires_at timestamptz
);

create table credential (
  id serial primary key,
  type text not null,
  user_model text not null,
  user_id text not null,
  key text,
  name text,
  data jsonb,
  created_at timestamptz,
  last_used_at timestamptz,
  unique (user_model, key)
);
```

The cookie holds the id of the session, signed with Hono's
[signed cookies](https://hono.dev/docs/helpers/cookie). It is `SameSite=Lax` and
`HttpOnly`. It is `Secure` when the request's URL is https. A row without
`expires_at`, or with one in the past, isn't a session.

The `credential` table holds the users' passkeys and TOTP secrets, with `data`
as JSON. No foreign keys tie the credentials to their users. So
[User records](#user-records) delete them with their user.

## Session

The session of a request, from [`useSession()`](#usesession), `session` of the
handler's context, or `c.var.session`. The package exports the type `Session`.

| Member                     | Description                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                    | The session's data, which handlers change in place.                                                                                                                         |
| `login(user)`              | Logs the user in, with the fingerprint of their password.                                                                                                                   |
| `logout()`                 | Clears the session.                                                                                                                                                         |
| `getUser()`                | Returns the user of the session, else `null`. It loads the user once per request. It returns `null` if the user changed the password since the login.                       |
| `refreshFingerprint(user)` | Keeps the session valid after the user changed the password, if the request succeeds. The user's other sessions end.                                                        |
| `checkConfirmedAccess()`   | Resolves to the user. Without a login, it throws 401. Without confirmed access, it throws 403 with `confirmationRequired: true`. Use it for actions such as changing roles. |

## useSession()

```ts
useSession(): Session
```

```js
const member = await useSession().getUser()
```

Returns the session of the running request, in actions and in the functions that
they call. It throws if the middleware of the users didn't run.

`createApi()` and `createAdmin()` run Hono's `contextStorage()`, which
`useSession()` needs. The app's own Hono routes run it themselves, before
`middleware`. `createApp()` of the kit runs it for all routes.

## defineActions()

```ts
users.defineActions(options?: DefineActionsOptions<U>): MixinDefinition
```

```js
defineController({
  path: 'admins',
  mixins: [admins.defineActions({ totp: { issuer, secret } })]
})
```

Returns a mixin with the login, session and security actions of the users. The
app lists it in the `mixins` of a controller of its own. A model controller
doesn't fit, as it would flush and serialize the responses of the actions.

Other users, such as a site's members, can also log in through the app's own
actions. These call [`Session`](#session) and [`verifyPassword()`](#passwords).

The actions:

- need the session middleware;
- check the login themselves, as the mixin sets `authorize: true`;
- run outside the API's transactions, as the mixin sets `transacted: false`.
  TOTP opens a transaction of its own, so failed codes stay counted.

A controller that mixes it in and sets `authorize` or `transacted` replaces
these settings, also for the mixed-in actions. Set them on its own actions
instead.

| Option           | Type                       | Description                                                                                                                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passkeys`       | `object`                   | Enables passkeys, see [Passkeys](#passkeys).                                                                                                                        |
| `totp`           | `object`                   | Enables TOTP, see [TOTP](#totp).                                                                                                                                    |
| `passwordReset`  | `object`                   | Enables password resets, see [Password reset](#password-reset).                                                                                                     |
| `reconfirmAfter` | `number \| string`         | How long a confirmed access lasts, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Default: ten minutes. |
| `afterLogin`     | `({ c, user }) => unknown` | Runs after each login, such as to set a cookie.                                                                                                                     |

The actions, under the controller's path:

| Action                                                                                                                             | Option          |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `post login`, `post logout`, `get self`, `get capabilities`, `post confirm-access`, `post password`                                | always          |
| `post password-reset`, `post password-reset-confirm`                                                                               | `passwordReset` |
| `post passkey-login-options`, `post passkey-login`, `get passkeys`, `post passkey-options`, `post passkeys`, `delete passkeys/:id` | `passkeys`      |
| `post login-code`, `get totp`, `post totp`, `post totp-confirm`, `delete totp`                                                     | `totp`          |

Their bodies and responses:

- The body of `post login` and `post password-reset` names the user as
  `username`.
- `post password` takes `{ password }`, and needs a confirmed access.
- `post confirm-access` takes `{ password, code? }` or `{ passkey }`.
- A login responds with `{ user }`. When it needs a TOTP code, it responds with
  `{ codeRequired: true }`, and `post login-code` takes the code.
- `post confirm-access` responds with `{ codeRequired: true }` when it needs a
  code. It responds with 204 once it confirms the access.
- `get self` responds with the user, or `null`.
- `get capabilities` responds with the capabilities that the actions offer,
  as `hasPasskeys`, `hasTotp`, `hasPasswordChange` and `hasPasswordReset`,
  also without a login. The admin loads them when it starts, see
  [capabilities](../admin/admin.md#capabilities).
- Other actions without a result, such as `post logout` and `post password`,
  respond with 204.

Users change their other values, such as their email, through an action of the
app, such as `patch self`, see [Account settings](../../guide/admin/views.md).

### Passkeys

```js
passkeys: { rpName: 'Book Catalog', origins: ['https://admin.example.com'] }
```

Enables passkeys, as discoverable WebAuthn credentials.

- `rpName` is the name that the browser shows.
- `domain` defaults to the request's host.
- `origins` defaults to the request's origin.

An app behind a proxy runs the `forwarded()` middleware of
`@ditojs/server`, so that the request's URL is the public one. An admin on
another host than the API sets `origins`, such as
`['https://admin.example.com']`.

### TOTP

```js
totp: { issuer: 'Book Catalog', secret: config.totpSecret }
```

Enables time-based one-time codes, with backup codes.

- `issuer` is the name that authenticator apps show.
- `secret` is a long random string of the app. The keys that encrypt the TOTP
  secrets are derived from it.
- Ten wrong codes in a row lock the codes for 15 minutes.
- Users with TOTP need a code, also when `defineActions()` doesn't get `totp`.
  Their logins then fail.

### Password reset

| Option         | Type                            | Description                                                                                                                                          |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirmUrl`   | `string`                        | The link, with a `{token}` placeholder.                                                                                                              |
| `send`         | `({ c, user, url }) => unknown` | Sends the email. The response doesn't wait for it.                                                                                                   |
| `expiresAfter` | `number \| string`              | How long a link lasts, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Default: one hour. |
| `resendAfter`  | `number \| string`              | The time before a user gets another link, as `expiresAfter`. Default: one minute.                                                                    |
| `onError`      | `({ error, c }) => void`        | Gets the errors of `send`.                                                                                                                           |

Enables password resets by email. The `secrets` of `createUsers()` sign the
tokens.

- `post password-reset` responds the same way whether the user exists or not. It
  does so also when `resendAfter` holds the link back.
- `resendAfter` counts per process.
- A token holds the user's id and its time.
- The token is signed with HMAC-SHA256 over these, the user's hash, last login
  and username. So a login, a password change or a username change makes the
  link invalid. This includes the password change that the link itself makes.

## User records

`createUsers()` guards the default actions `post`, `patch :id` and `delete :id`
of every model controller of its entity, see
[`guardEntity()`](mikro.md#guardentity). The controllers need no mixin, and the
guards add no routes. An action with its own handler gets them when it calls
`next()`. The API needs a session middleware, of these users or of others.

- The body of `post` and `patch :id` sets `password`.
- The default action gets the body without `password`.
- The hash of the password goes to `hash` on the user, which the model
  controller writes.
- The `password` schema of the users checks new passwords.
- A `hash` in the body responds with 400.
- In `patch :id`, changing a password or a username in `usernameProperty` needs
  confirmed access of the session's user, as in `post password`. This holds also
  for other users, and when the written users belong to another `createUsers()`
  than the session's user. See `checkConfirmedAccess()` of
  [`Session`](#session). A request without a session user skips this check, so
  the controller's `authorize` asks for a user.
- When users change their own password, their session stays, and their other
  sessions end. See `refreshFingerprint()` of [`Session`](#session).
- `delete :id` deletes the credentials of the user in the request's transaction.

## User

```ts
interface User {
  id: number | string
  username?: string | null
  hash?: string | null
  roles?: string[] | null
  lastLogin?: Date | string | null
}
```

The values that auth reads from the users of an entity.

- `hash` is the bcrypt hash, or `null` for users without a password. Sessions
  keep its fingerprint, and end when it changes.
- `roles` go to `authorize`.
- A login sets `lastLogin`, which ends password reset links.

## Passwords

| Function                         | Description                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hashPassword(password)`         | Returns the bcrypt hash.                                                                                                         |
| `verifyPassword(password, hash)` | Returns whether the password matches the hash. Without a hash, it compares against a dummy hash, so that it takes the same time. |
