# Upgrading to Dito.js 5.x

This guide describes how to upgrade an app from Dito.js 4.x to 5.x.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

## Objection 4

Dito.js uses objection 4.2, an ES module that needs knex 3.3, and TypeScript
5.8 for its types: update the app's `objection` dependency to `^4.2.0`, the
peer of `@ditojs/server`. Its
[migration guide](https://ditojs.github.io/objection/release-notes/migration.html)
covers its own changes. Check these in your app:

- `after:` hooks get a `result` in the shape that the query returns, e.g. one
  model or `undefined` for `first()`, and `before:` hooks get none.
- JSON in PostgreSQL `text` columns is no longer parsed.
- Graph writes reject conflicting graphs and missing related rows before they
  write anything, and `insertDitoGraph()` rejects upsert options.
- `limit` and `offset` in the modifiers of graph fetches apply per parent.
- On PostgreSQL, JSON refs with one key compile to `->` and `->>`: rebuild
  expression indexes on them.
- `toFindQuery()` leaves out the resolved value and the fetched graph of the
  write too, besides its `runAfter()` callbacks.
- `insert()` and `insertAndFetch()` insert arrays of models in one transaction
  on all databases, and outside PostgreSQL through objection's own batches
  instead of `insertGraph()`. On MySQL, they throw for arrays of models without
  ids: insert these with `insertGraph()`.
- A model listed twice in a many-to-many relation of a graph gets one join row.
- In TypeScript, `patchAndFetch()`, `updateAndFetch()`, `upsert()` and
  `upsertAndFetch()` take objection's `PartialModelPatch` and
  `PartialModelRow`, which reject relation data and `Partial<M>`. Custom query
  builders that extend dito's `QueryBuilder` declare `RebindType` instead of
  the five `*QueryBuilderType` members.
- Validation errors of nested models in graphs have keys with slashes, e.g.
  `chapters/1/title`, starting with the model's index for array input, e.g.
  `1/chapters/1/title`.
- Deletes and unrelates with `range`, `limit` or `offset` throw a
  `QueryBuilderError`, which collection and member `DELETE` requests answer
  with 400. With `offset`, they deleted all matching rows.

## Server

### Logins and sessions

Dito.js logs users in and keeps them in the session itself, without
koa-passport:

- Remove `app.passport` from the configuration, it's gone. Users are always
  handled, with sessions when `app.session` is set.
- `ctx.req.user` and custom Passport strategies are gone. Use
  `ctx.state.user`. `ctx.login()`, `ctx.logout()` and `ctx.isAuthenticated()`
  stay, see [Sessions](api/server/model.md#sessions).
- Existing sessions stay valid: the session keeps the user under the same key
  as Passport did.
- The session cookie defaults to `sameSite: 'lax'`, see
  [`config.app`](api/server/application.md#configapp) for admins on another
  site than the server.
- [`UsersController`](api/server/controllers.md#userscontroller) needs
  `app.session`, else its setup throws.
- `UsersController` only treats users of its own model class as logged in, not
  users of its subclasses.
- Apps that override `UserMixin.sessionQuery()` set the `sessionScope` option
  instead, see [`UserMixin`](api/server/model.md#usermixin).

### Errors

The app always listens to its `'error'` events, also before `start()`.
`log.errors: false` only stops it from logging them, and then nothing logs
request errors, not even Koa's fallback: apps that turn it off log them in an
`'error'` listener of their own.

### Expired records

Once started with `app.start()`, the application deletes expired records every
hour through
[`app.deleteExpiredRecords()`](api/server/application.md#deleteexpiredrecords),
which calls [`deleteExpiredRecords()`](api/server/model.md#static-deleteexpiredrecords)
on every model. See
[`config.app.deleteExpiredRecordsEvery`](api/server/application.md#configapp)
for the interval, and for apps that don't call `app.start()` or only run
briefly.

### Sessions

Session models built on [`SessionMixin`](api/server/model.md#sessionmixin)
store the expiry of sessions in a new `expiresAt` column, through which
expired sessions are deleted. Add it to the sessions table with a migration:

```js
export async function up(knex) {
  await knex.schema.alterTable('session', table => {
    table.timestamp('expires_at').nullable().index()
  })
  // Sessions get their expiry on their next write. On PostgreSQL, set it for
  // all of them, so that sessions that are never used again are deleted too:
  if (knex.client.dialect === 'postgresql') {
    await knex('session').update({
      expires_at: knex.raw(`to_timestamp((value->>'_expire')::bigint / 1000.0)`)
    })
  }
}

export async function down(knex) {
  await knex.schema.alterTable('session', table => {
    table.dropColumn('expires_at')
  })
}
```

### Assets

- Renamed: `config.assets.cleanupTimeThreshold` is `deleteUnusedAfter`,
  `danglingTimeThreshold` is `deleteUnsavedAfter`, and the `timeThreshold`
  option of `app.releaseUnusedAssets()` is `olderThan`. `false` keeps the
  assets. Unknown asset options and invalid durations throw on startup.
- Unused assets are released by `app.deleteExpiredRecords()`, at its first
  run after `deleteUnusedAfter`, instead of after writes of asset data. With
  `deleteUnusedAfter: 0`, they are released at the next run, up to an hour
  later, no longer right after the write. Tests that check the release call
  `app.deleteExpiredRecords()` or `app.releaseUnusedAssets()`.
- Apps that call `app.releaseUnusedAssets()` on a schedule of their own, e.g.
  from a service, can drop it.

### Controllers

- Actions that a subclass redefines keep the `authorize` of the inherited
  action unless they set their own, which can open as well as close access.
- An `authorize` on a subclass's actions object, one value for all its actions
  or an entry for one, ranks above the `authorize` of inherited actions, which
  can open them: `actions = { authorize: true }` in a subclass opens a parent
  action with `authorize: 'admin'`.
- To check, look for actions with their own `authorize` in controllers that
  are subclassed, and compare them with the `authorize` of the subclasses'
  actions objects and of the actions they redefine. See
  [`authorize`](api/server/controllers.md#authorize) for the order.
- Authorize functions are called with the controller as `this`. This only
  changes methods and `function`s, where `this` was `undefined`; arrow
  functions keep theirs.
- `super` calls in actions in the options form, e.g. `{ handler, parameters }`,
  reach the inherited action instead of throwing.

### Users

- `UserMixin.login(ctx)` is `authenticate(ctx)`. It only checks the
  credentials, read only from the request body, and returns the user, so code
  that logs users in itself calls `ctx.login(await User.authenticate(ctx))`,
  which skips TOTP. Users with TOTP log in through `'post login'` of
  `UsersController`.
- The `post`, `patch` and `put` actions of `UsersController` reject `hash`.
  Setting a password or changing the username needs
  [confirmed access](guide/server/controllers.md#confirmed-access), also when
  admins change other users. Without it, they answer 403 with
  `confirmationRequired`, and the admin asks the user to confirm. Sessions
  from before the upgrade have no confirmed access yet.
- Only logged-in users of the controller's own model class can set passwords
  and change usernames through it, others get 401, also admins of another
  user model class.
- Users controllers that route actions that need confirmed access, e.g.
  `patch`, also need `'post confirm-access'`, else their setup throws, see
  [`UsersController`](api/server/controllers.md#userscontroller): subclasses
  that set `collection.allow` add it to the list, and `'post password'` for the
  admin's password change.
- Changing a user's password ends their other sessions. The session of the
  request in which users change their own password stays logged in.

## Admin

- Install the peer dependencies `@simplewebauthn/browser` and `lean-qr`, which
  `@ditojs/admin` requires.
- Dialogs validate their data on submit, like forms, and only resolve once it
  is valid.
- The `width` setting of dialogs is the width of their content, without their
  padding. Reduce the widths of dialogs that set one by 32 pixels to keep their
  size.

## New

Passkeys, two-factor authentication and password resets are opt-in. The admin
offers each one when the users controller at `api.users` in the server's
`config.admin.api` routes it, and requests it under the action names of
`UsersController` below `api.users.path`, see
[`authentication`](api/admin/admin.md#globalconfig).

- [Passkeys](guide/server/controllers.md#passkeys), through
  [`PasskeyService`](api/server/service.md#passkeyservice), with the new
  optional peer dependencies `@simplewebauthn/server` and `aaguids`.
- [Two-factor authentication](guide/server/controllers.md#two-factor-authentication),
  through [`TotpService`](api/server/service.md#totpservice), with the new
  optional peer dependency `otpauth`.
- [Password reset](guide/server/controllers.md#password-reset) by email,
  through `app.authentication.passwordReset`.

`PasskeyService` and `TotpService` list the configuration that they need, e.g.
sessions stored on the server.
