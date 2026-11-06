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

`@ditojs/auth` keeps sessions in signed cookies. It also has the actions of the
admin's users:

- login and logout;
- reading the logged-in user;
- confirmed access;
- password change and reset;
- passkeys and TOTP.

The app keeps its users in its own entities, and describes them in a
[`UserSource`](#usersource). Sessions and credentials are stored in the
`session` and `credential` tables. Auth reads these tables through
[Kysely](https://kysely.dev).

The peer dependencies are `@ditojs/server`, `hono`, `kysely` and `zod`.
Passkeys also need `@simplewebauthn/server` and `aaguids`, and TOTP needs
`otpauth`. See [Users and sessions](../../guide/server/auth.md) in the guide.

## createSessions()

```ts
createSessions(options: CreateSessionsOptions): {
  cookieName: string
  middleware: MiddlewareHandler
  readSignedCookie(c: Context, name: string): Promise<string | null>
  deleteExpired(): Promise<void>
}
```

| Option       | Type                           | Description                                                                                                                                                             |
| ------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter`    | `{ getKysely(): Kysely<any> }` | The adapter of the API, such as [`createMikroAdapter(orm)`](mikro.md#createmikroadapter). Its Kysely holds the `session` table, outside of the requests' transactions.  |
| `secrets`    | `string[]`                     | The secrets that sign the cookie. The first one signs, and all of them verify, so they can rotate.                                                                      |
| `cookieName` | `string`                       | The cookie name, such as `admin.sess`.                                                                                                                                  |
| `maxAge`     | `number \| string`             | The lifetime of a session, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Browsers cap cookies at 400 days. |

The app creates the `session` table:

```sql
create table session (
  id text primary key,
  value jsonb,
  expires_at timestamptz
);
```

The cookie holds the id of the session, signed with Hono's
[signed cookies](https://hono.dev/docs/helpers/cookie). It is `SameSite=Lax` and
`HttpOnly`. It is `Secure` when the request's URL is https. A row without
`expires_at`, or with one in the past, isn't a session.

`createSessions()` returns these:

| Member                      | Description                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cookieName`                | The option of the same name.                                                                                                                                                                                 |
| `middleware`                | The session middleware, see below.                                                                                                                                                                           |
| `readSignedCookie(c, name)` | Returns the value of the cookie `name` if one of `secrets` signed it, else `null`. It reads the app's own cookies, which the app writes with `setSignedCookie(c, name, value, secrets[0])` of `hono/cookie`. |
| `deleteExpired()`           | Deletes the expired rows. The app runs it on a timer.                                                                                                                                                        |

`middleware` is Hono middleware. The app passes it to the `middleware` of
`createApi()`, or uses it in its own Hono routes.

- The API runs it before `getUser`, which reads the session.
- It loads the session into `c.var.session` before the action.
- After the action, it saves the session if it changed. It does this even when
  the action throws.
- It adds its `Set-Cookie` header to the response, also to error responses.

[`createAdmin()`](../admin/server.md#createadminoptions) takes the middleware, and the
`getUser` of [`getSessionUser()`](#getsessionuser), as `createApi()` does.

## Session

The session of a request, from `getSession(c)` or `c.var.session`. The package
exports the type `Session`, not the class.

| Member                                  | Description                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                                 | The session's data, which handlers change in place.                                                                                                                             |
| `login(source, user)`                   | Logs the user in, with the fingerprint of their password.                                                                                                                       |
| `logout()`                              | Clears the session.                                                                                                                                                             |
| `regenerate()`                          | Gives the session a new id when it's saved.                                                                                                                                     |
| `getUser(source)`                       | Returns the user of the session if it belongs to `source`, else `null`. It loads the user once per request. It returns `null` if the user changed the password since the login. |
| `refreshFingerprint(source, user)`      | Keeps the session valid after the user changed the password, if the request succeeds. The user's other sessions end.                                                            |
| `confirmAccess(source, user, duration)` | Confirms the user's access for `duration` milliseconds.                                                                                                                         |
| `checkConfirmedAccess(source)`          | Resolves to the user. Without a login, it throws 401. Without confirmed access, it throws 403 with `confirmationRequired: true`. Use it for actions such as changing roles.     |

## getSession()

```ts
getSession(c: Context): Session
```

Returns the session of the request, in actions and in the app's own Hono routes.
It throws if the middleware of `createSessions()` didn't run.

## getSessionUser()

```ts
getSessionUser(c: Context, source: UserSource): Promise<User | null>
```

```js
getUser: ({ c }) => getSessionUser(c, admins)
```

Returns `{ id, roles }` of the session's user, if the user belongs to `source`.
It is meant for the `getUser` of `createApi()`.

## defineUserActions()

```ts
defineUserActions<U>(options: DefineUserActionsOptions<U>): MixinDefinition
```

```js
defineController({
  path: 'admins',
  mixins: [defineUserActions({ source: adminSource })]
})
```

Returns a mixin with the actions of the admin's users. The app lists it in the
`mixins` of a controller of its own. A model controller doesn't fit, as it would
flush and serialize the responses of the actions.

Other users, such as a site's members, log in through the app's own actions.
These call [`Session`](#session) and [`verifyPassword()`](#passwords).

The actions:

- need the session middleware;
- check the login themselves, as the mixin sets `authorize: true`;
- run outside the API's transactions, as the mixin sets
  `transacted: false`. TOTP opens a transaction of its own, so failed codes stay
  counted.

A controller that mixes it in and sets `authorize` or `transacted` replaces
these settings, also for the mixed-in actions. Set them on its own actions
instead.

| Option           | Type                        | Description                                                                                                                                                         |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`         | [`UserSource`](#usersource) | The users.                                                                                                                                                          |
| `credentials`    | `Credentials`               | From [`createCredentials()`](#createcredentials). Needed for passkeys and TOTP.                                                                                     |
| `passkeys`       | `Passkeys`                  | From [`createPasskeys()`](#createpasskeys).                                                                                                                         |
| `totp`           | `Totp`                      | From [`createTotp()`](#createtotp).                                                                                                                                 |
| `passwordReset`  | `PasswordReset`             | From [`createPasswordReset()`](#createpasswordreset).                                                                                                               |
| `reconfirmAfter` | `number \| string`          | How long a confirmed access lasts, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Default: ten minutes. |
| `afterLogin`     | `({ c, user }) => unknown`  | Runs after each login, such as to set a cookie.                                                                                                                     |

The actions, under the controller's path:

| Action                                                                                                                             | Feature         |
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

## definePasswordWrites()

```ts
definePasswordWrites<U>(options: {
  source: UserSource<U>
}): MixinDefinition
```

```js
defineModelController({
  path: 'admins',
  entity: Admin,
  authorize: 'admin',
  mixins: [definePasswordWrites({ source: adminSource })],
  actions: { 'get': true, 'get :id': true }
})
```

A mixin for the model controller of the users. It routes `post` and
`patch :id`, where the body sets `password`.

- The handler beneath gets the body without `password`.
- The mixin sets the hash of the password as `hash` on the user that the
  handler returns. The model controller writes it.
- The `password` schema of the source checks new passwords, see
  [`UserSource`](#usersource).
- A `hash` in the body responds with 400.
- Changing a password, or a username in the source's `usernameProperty`, needs
  confirmed access of a user of the source, as in `post password`, also for
  other users of the source. See `checkConfirmedAccess()` of
  [`Session`](#session).
- When users change their own password, their session stays, and their other
  sessions end. See `refreshFingerprint()` of [`Session`](#session).

## UserSource

```ts
interface UserSource<U> {
  name: string
  findById(c, id: string): Promise<U | null | undefined>
  findByUsername(c, username: string): Promise<U | null | undefined>
  patch(c, user: U, values: { hash?: string, lastLogin?: Date }): Promise<void>
  serialize(c, user: U): unknown
  usernameProperty?: string
  password?: ZodType<string>
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
entity. The app can also write one itself. Auth reads `id`, `username`, `hash`,
`roles` and `lastLogin` of its users. The functions get `c`, which holds the
request's entity manager in `c.var.em`.

- `name` names the users in sessions and credentials, as `'<name>-<id>'`.
- The source loads `hash`. Sessions keep its fingerprint, and end when it
  changes.
- `findById()` resolves to `null` for ids that it can't read.
- `patch()` stores the values and sets them on the user: a new `hash`, or the
  `lastLogin` of a login.
- `serialize()` returns what the actions send.
- `usernameProperty` names the username in the bodies of
  `definePasswordWrites()`. Default: `username`.
- `password` is the schema of new passwords, in the actions of
  `defineUserActions()` and in `definePasswordWrites()`. By default, a new
  password is a string of at least 8 characters.

## createCredentials()

```ts
createCredentials(options: {
  adapter: { getKysely(): Kysely<any> }
}): Credentials
```

Returns the store of the users' passkeys and TOTP secrets. They are kept in the
`credential` table, which all sources share, with `data` as JSON. Like
`createSessions()`, it uses the adapter's Kysely, outside of the requests'
transactions. The app creates the table:

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

No foreign keys tie the credentials to their users. So when the app deletes
users, it calls `credentials.deleteUsers(source, ids, { c? })`. With the
request's `c`, it deletes in the transaction of the deletion.

## createPasskeys()

```ts
createPasskeys(options: {
  credentials: Credentials
  rpName: string
  domain?: string
  origins?: string[]
}): Passkeys
```

From `@ditojs/auth/passkeys`. Enables passkeys, as discoverable WebAuthn
credentials.

- `credentials` hold the passkeys, from
  [`createCredentials()`](#createcredentials).
- `rpName` is the name that the browser shows.
- `domain` defaults to the request's host.
- `origins` defaults to the request's origin.

An app behind a proxy runs the `forwarded()` middleware of
`@ditojs/server/node`, so that the request's URL is the public one. An admin on
another host than the API sets `origins`, such as
`['https://admin.example.com']`.

## createTotp()

```ts
createTotp(options: {
  credentials: Credentials
  issuer: string
  secret: string
}): Totp
```

From `@ditojs/auth/totp`. Enables time-based one-time codes, with backup codes.

- `credentials` hold the TOTP secrets, from
  [`createCredentials()`](#createcredentials).
- `issuer` is the name that authenticator apps show.
- `secret` is a long random string of the app. The keys that encrypt the TOTP
  secrets are derived from it.
- Ten wrong codes in a row lock the codes for 15 minutes.
- Users with TOTP need a code while `defineUserActions()` gets `credentials`,
  also when it doesn't get `totp`. Their logins then fail. Without
  `credentials`, they log in without a code.

## createPasswordReset()

```ts
createPasswordReset(options: CreatePasswordResetOptions): PasswordReset
```

| Option         | Type                            | Description                                                                                                                                          |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secrets`      | `string[]`                      | The secrets that sign the tokens, such as the ones of the sessions. The first signs.                                                                 |
| `expiresAfter` | `number \| string`              | How long a link lasts, in milliseconds, or a duration string such as `'24h'`, see [`parseDuration()`](../utils.md#parseduration). Default: one hour. |
| `resendAfter`  | `number \| string`              | The time before a user gets another link, as `expiresAfter`. Default: one minute.                                                                    |
| `confirmUrl`   | `string`                        | The link, with a `{token}` placeholder.                                                                                                              |
| `send`         | `({ c, user, url }) => unknown` | Sends the email. The response doesn't wait for it.                                                                                                   |
| `onError`      | `({ error, c }) => void`        | Gets the errors of `send`.                                                                                                                           |

Enables password resets by email.

- `post password-reset` responds the same way whether the user exists or not. It
  does so also when `resendAfter` holds the link back.
- `resendAfter` counts per process.
- A token holds the user's id and its time.
- The token is signed with HMAC-SHA256 over these, the user's hash, last login
  and username. So a login, a password change or a username change makes the
  link invalid. This includes the password change that the link itself makes.

## Passwords

| Function                         | Description                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hashPassword(password)`         | Returns the bcrypt hash.                                                                                                         |
| `verifyPassword(password, hash)` | Returns whether the password matches the hash. Without a hash, it compares against a dummy hash, so that it takes the same time. |
