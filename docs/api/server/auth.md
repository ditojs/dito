# Auth

```js
import {
  createSessions,
  getSession,
  getSessionUser,
  defineUserActions,
  definePasswordWrites,
  createCredentials,
  createPasswordReset,
  hashPassword,
  verifyPassword
} from '@ditojs/auth'
import { createPasskeys } from '@ditojs/auth/passkeys'
import { createTotp } from '@ditojs/auth/totp'
```

Sessions in signed cookies, and the actions of the admin's users: login, logout,
reading the logged-in user, confirmed access, password change and reset,
passkeys and TOTP. The app keeps its users in its own entities, and describes
them in a [`UserSource`](#usersource). Sessions and credentials are stored in
the `session` and `credential` tables, which auth reads through
[Kysely](https://kysely.dev).

Peer dependencies: `@ditojs/server`, `hono`, `kysely` and `zod`, plus
`@simplewebauthn/server` and `aaguids` for passkeys, and `otpauth` for TOTP. See
[Users and sessions](../../guide/server/auth.md) in the guide.

## createSessions()

```ts
createSessions(options: CreateSessionsOptions): {
  cookieName: string
  middleware: MiddlewareHandler
  readSignedCookie(c: Context, name: string): Promise<string | null>
  deleteExpired(): Promise<void>
}
```

| Option       | Type                           | Description                                                                                                                                                              |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter`    | `{ getKysely(): Kysely<any> }` | The adapter of the API, such as [`createMikroAdapter(orm)`](mikro.md#createmikroadapter), whose Kysely holds the `session` table, outside of the requests' transactions. |
| `secrets`    | `string[]`                     | The secrets that sign the cookie. The first one signs, and all of them verify, so they can rotate.                                                                       |
| `cookieName` | `string`                       | The cookie name, such as `admin.sess`.                                                                                                                                   |
| `maxAge`     | `number`                       | The lifetime of a session, in milliseconds. Browsers cap cookies at 400 days.                                                                                            |

The app creates the `session` table:

```sql
create table session (
  id text primary key,
  value jsonb,
  expires_at timestamptz
);
```

The cookie holds the id, signed with Hono's
[signed cookies](https://hono.dev/docs/helpers/cookie). It is `SameSite=Lax`,
`HttpOnly`, and `Secure` when the request's URL is https. A row without
`expires_at`, or with one in the past, isn't a session.
`deleteExpired()` deletes the expired rows. The app runs it on a timer.

Returns the `cookieName`, the session `middleware`, `readSignedCookie()` and
`deleteExpired()`. `middleware` is Hono middleware, which the app passes to the
`middleware` of `createApi()`, or uses in its own Hono routes. The API runs it
before `getUser`, which reads the session. It loads the session into
`c.var.session` before the action. After the action, it saves the session if it
changed, even when the action throws, and adds its `Set-Cookie` header to the
response, also to error responses.

`readSignedCookie(c, name)` returns the value of the cookie `name` if one of
`secrets` signed it, or `null`, for the app's own cookies, which it writes with
`setSignedCookie(c, name, value, secrets[0])` of `hono/cookie`.

[`createAdmin()`](../admin/server.md#adminoptions) takes the middleware and the
`getUser` of [`getSessionUser()`](#getsessionuser), as `createApi()` does:

```js
createAdmin({
  ...options,
  middleware: adminSessions.middleware,
  getUser: ({ c }) => getSessionUser(c, adminSource),
  authorize: 'admin'
})
```

## Session

The session of a request, from `getSession(c)` or `c.var.session`. The package
exports the type `Session`, not the class.

| Member                                  | Description                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`                                 | The session's data, which handlers change in place.                                                                                                                            |
| `login(source, user)`                   | Logs the user in, with the fingerprint of their password.                                                                                                                      |
| `logout()`                              | Clears the session.                                                                                                                                                            |
| `regenerate()`                          | Gives the session a new id when it's saved.                                                                                                                                    |
| `getUser(source)`                       | Returns the user of the session if it belongs to `source`, or `null`. It loads the user once per request. If the user changed the password since the login, it returns `null`. |
| `refreshFingerprint(source, user)`      | Keeps the session valid after the user changed the password, if the request succeeds. The user's other sessions end.                                                           |
| `confirmAccess(source, user, duration)` | Confirms the user's access for `duration` milliseconds.                                                                                                                        |
| `checkConfirmedAccess(source)`          | Resolves to the user. Throws 401 without a login, and 403 with `confirmationRequired: true` without confirmed access. Use it for actions such as changing roles.               |

## getSession()

```ts
getSession(c: Context): Session
```

Returns the session of the request, in actions and in the app's own Hono routes.
Throws if the middleware of `createSessions()` didn't run.

## getSessionUser()

```ts
getSessionUser(c: Context, source: UserSource): Promise<User | null>
```

Returns `{ id, roles }` of the session's user, if the user belongs to `source`,
for the `getUser` of `createApi()`: `getUser: ({ c }) => getSessionUser(c, admins)`.

## defineUserActions()

```ts
defineUserActions<U>(options: DefineUserActionsOptions<U>): {
  controller: ControllerDefinition
  features: {
    hasPasskeys: boolean
    hasTotp: boolean
    hasPasswordChange: boolean
    hasPasswordReset: boolean
  }
}
```

Returns a controller with the actions of the admin's users, and the features it
routes, which the admin's login and account views read. The app passes
`controller` to `createApi()`, or lists it in the `mixins` of a controller of
its own. A model controller doesn't fit, as it would flush and serialize the
answers of the actions. It passes `features` to the admin as
[`authentication`](../admin/server.md#adminoptions). Other users, such as a site's
members, log in through the app's own actions, which call
[`Session`](#session) and [`verifyPassword()`](#passwords). The actions:

- need the session middleware;
- check the login themselves, as the controller sets `authorize: true`;
- run outside the API's transactions, as the controller sets
  `transacted: false`. TOTP opens a transaction of its own, so failed codes
  stay counted.

A controller that mixes in `controller` and sets `authorize` or `transacted`
replaces these settings, also for the mixed-in actions. Set them on its own
actions instead.

| Option           | Type                                   | Description                                                                                                                    |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `path`           | `string`                               | The path of the users, such as `admins`.                                                                                       |
| `source`         | [`UserSource`](#usersource)            | The users.                                                                                                                     |
| `credentials`    | `Credentials`                          | From [`createCredentials()`](#createcredentials). Needed for passkeys and TOTP.                                                |
| `features`       | `{ passkeys?, totp?, passwordReset? }` | From [`createPasskeys()`](#createpasskeys), [`createTotp()`](#createtotp) and [`createPasswordReset()`](#createpasswordreset). |
| `password`       | `ZodType<string>`                      | The schema of new passwords, in `post password` and `post password-reset-confirm`. Default: a string of at least 8 characters. |
| `reconfirmAfter` | `number`                               | How long a confirmed access lasts, in milliseconds. Default: ten minutes.                                                      |
| `afterLogin`     | `({ c, user }) => unknown`             | Runs after each login, such as to set a cookie.                                                                                |

The actions, under `path`:

| Action                                                                                                                             | Feature         |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `post login`, `post logout`, `get self`, `post confirm-access`, `post password`                                                    | always          |
| `post password-reset`, `post password-reset-confirm`                                                                               | `passwordReset` |
| `post passkey-login-options`, `post passkey-login`, `get passkeys`, `post passkey-options`, `post passkeys`, `delete passkeys/:id` | `passkeys`      |
| `post login-code`, `get totp`, `post totp`, `post totp-confirm`, `delete totp`                                                     | `totp`          |

The body of `post login` and `post password-reset` names the user as `username`.
`post password` takes `{ password }` and needs a confirmed access, and
`post confirm-access` takes `{ password, code? }` or `{ passkey }`.
A login responds with `{ user }`, or with `{ codeRequired: true }` when it needs
a TOTP code, which `post login-code` takes. `post confirm-access` responds with
`{ codeRequired: true }` when it needs a code, and with 204 once it confirms the
access. `get self` responds with the user, or `null`. Other actions without a
result, such as `post logout` and `post password`, respond with 204. Users
change their other values, such as their email, through an action of the app,
such as `patch self`, see [Account settings](../../guide/admin/views.md).

## definePasswordWrites()

```ts
definePasswordWrites<U>(options: {
  source: UserSource<U>
  password?: ZodType<string>
}): MixinDefinition
```

A mixin for the model controller of the users, which routes `post` and
`patch :id`. The body sets `password`, and the handler beneath gets the body
without it. The mixin sets the hash of the password as `hash` on the user that
the handler returns, and the model controller writes it. `password` is the
schema of new passwords, by default a string of at least 8 characters. A `hash`
in the body responds with 400. When users change their own password, their
session stays and their other sessions end, see `refreshFingerprint()` of
[`Session`](#session).

```js
defineModelController({
  path: 'admins',
  entity: Admin,
  authorize: 'admin',
  mixins: [definePasswordWrites({ source: adminSource })],
  actions: { 'get': true, 'get :id': true }
})
```

## UserSource

```ts
interface UserSource<U> {
  name: string
  findById(c, id: string): Promise<U | null | undefined>
  findByUsername(c, username: string): Promise<U | null | undefined>
  patch(c, user: U, values: { hash?: string, lastLogin?: Date }): Promise<void>
  serialize(c, user: U): unknown
}

interface User {
  id: number | string
  username?: string | null
  hash?: string | null
  roles?: string[] | null
  lastLogin?: Date | string | null
}
```

The users of one kind, such as admins or members.
[`createEntityUserSource()`](mikro.md#createentityusersource) returns one for an
entity, or the app implements it. Auth reads `id`, `username`, `hash`, `roles`
and `lastLogin` of its users. The functions get Hono's context `c`, which holds
the API's database handle in `c.var.em`.

- `name` names the users in sessions and credentials, as `'<name>-<id>'`.
- The source loads `hash`, as sessions keep its fingerprint and end when it
  changes.
- `findById()` resolves to `null` for ids it can't read.
- `patch()` stores the values and sets them on the user: a new `hash`, or the
  `lastLogin` of a login.
- `serialize()` returns what the actions send.

## createCredentials()

```ts
createCredentials(options: {
  adapter: { getKysely(): Kysely<any> }
}): Credentials
```

Returns the store of the users' passkeys and TOTP secrets, in the `credential`
table that all sources share, with `data` as JSON. It uses the Kysely of the
`adapter` outside of the requests' transactions, like `createSessions()`. The
app creates the table:

```sql
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

No foreign keys tie the credentials to their users. When the app deletes users,
it calls `credentials.deleteUsers(source, ids, { c? })`, with the request's `c`
to delete in the transaction of the deletion.

## createPasskeys()

```ts
createPasskeys(options: {
  rpName: string
  domain?: string
  origins?: string[]
}): Passkeys
```

From `@ditojs/auth/passkeys`. Enables passkeys, as discoverable WebAuthn
credentials. `rpName` is the name that the browser shows. `domain` defaults to
the request's host, and `origins` to the request's origin. An app behind a proxy
runs the `forwarded()` middleware of `@ditojs/server/node`, so that the
request's URL is the public one. An admin on another host than the API sets
`origins`, such as `['https://admin.example.com']`.

## createTotp()

```ts
createTotp(options: { issuer: string, secret: string }): Totp
```

From `@ditojs/auth/totp`. Enables time-based one-time codes, with backup codes.
`issuer` is the name that authenticator apps show. `secret` is a long random
string of the app, from which the keys that encrypt the TOTP secrets are
derived. Ten wrong codes in a row lock the codes for 15 minutes.

## createPasswordReset()

```ts
createPasswordReset(options: CreatePasswordResetOptions): PasswordReset
```

| Option         | Type                            | Description                                                                          |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `secrets`      | `string[]`                      | The secrets that sign the tokens, such as the ones of the sessions. The first signs. |
| `expiresAfter` | `number`                        | In milliseconds. Default: one hour.                                                  |
| `resendAfter`  | `number`                        | The time before a user gets another link, in milliseconds. Default: one minute.      |
| `confirmUrl`   | `string`                        | The link, with a `{token}` placeholder.                                              |
| `send`         | `({ c, user, url }) => unknown` | Sends the email. The response doesn't wait for it.                                   |
| `onError`      | `({ error, c }) => void`        | Gets the errors of `send`.                                                           |

Enables password resets by email. `post password-reset` responds the same way
whether the user exists or not, and even when `resendAfter` holds the link back.
`resendAfter` counts per process. Tokens hold the user's id and their time,
signed with HMAC-SHA256 over these and the user's hash, last login and username.
So a login, a password change or a username change makes the link invalid,
including the password change that the link itself makes.

## Passwords

| Function                         | Description                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `hashPassword(password)`         | Returns the bcrypt hash.                                                                                                |
| `verifyPassword(password, hash)` | Returns whether the password matches the hash. Without a hash, it compares against a dummy hash, to take the same time. |
