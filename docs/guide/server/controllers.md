# Controllers

Controllers map HTTP routes to code. Each controller is a class; the
application creates one instance of each and sets up its routes. Dito.js
provides these base classes:

- `Controller`: routes of your own, e.g. a checkout or a report.
- `ModelController`: the REST routes of a model: its collection, members and
  relations.
- `UsersController`: a model controller for users, with login and logout.
- `AdminController`: serves the admin interface.

The [Controllers API](../../api/server/controllers.md) describes every option
and method.

## Controller

A controller's `actions` object holds its actions. Each key names the HTTP
method and the path of an action, relative to the controller's path:

```js
import { Controller } from '@ditojs/server'

export class Shop extends Controller {
  actions = {
    // GET /api/shop
    get(ctx) {
      return { name: 'The Bookshop', isOpen: true }
    },

    // GET /api/shop/opening-hours
    'get opening-hours'(ctx) {
      return [{ day: 'Monday', from: '9:00', to: '18:00' }]
    }
  }
}
```

Actions receive the [Koa context](https://koajs.com/#context) as `ctx`. What
they return becomes the response body: objects, arrays and models are sent as
JSON. An action that returns nothing leaves `ctx.body` to the action, e.g. to
send files or redirect.

Controllers are registered through the application's `controllers` option:

```js
const app = new Application({
  config,
  models,
  controllers: { api: { Shop, Books } }
})
```

## Paths

A controller's name is its class name without a `Controller` suffix:
`Books` and `BooksController` are both named `Books`. The name gives the
path, hyphenated when `app.normalizePaths` is set in the
[configuration](configuration.md#keys): `OrderLines` serves `/order-lines`.
Set `path` to choose another one:

```js
export class Books extends ModelController {
  modelClass = Book
  path = 'catalog' // /api/catalog
}
```

Nested objects in the application's `controllers` option add their keys as
namespaces, e.g. `/api`, see [Application](application.md#namespaces).

The paths of actions are used as written: `'get opening-hours'`. They can
contain route parameters, e.g. `'get :year/published'`, available in
`ctx.params`, or as [parameters](#parameters) with `from: 'path'`:

```js
'get :year/published': {
  parameters: {
    year: { type: 'integer', from: 'path' }
  },
  handler(ctx, { year }) {
    return Book.query()
      .withScope('published')
      .applyFilter('publishedAt', `${year}-01-01`, `${year}-12-31`)
  }
}
```

## Action options

Instead of a function, an action can be an object with the handler and
options:

```js
'get search': {
  parameters: {
    text: { type: 'string', required: true },
    limit: { type: 'integer', default: 20 }
  },
  response: {
    type: 'array',
    items: { $ref: 'Book' }
  },
  handler(ctx, { text, limit }) {
    return Book.query().applyFilter('search', text).limit(limit)
  }
}
```

Besides `handler`, an action takes `parameters` (see
[Parameters](#parameters)), `response`, a schema that validates the returned
value, `authorize` (see [Authorization](#authorization)), `transacted` (see
[Transactions](#transactions)), `scope` and `path`. The
[API](../../api/server/controllers.md#action-options) describes each.

Other options are kept on the action, which middleware can read as
`ctx.action`, e.g. a `cached: true` for your own caching middleware.

`this` in a handler is the actions object, which inherits from the
controller: `this.app` and the controller's methods are available, and
`this.controller` is the controller itself.

## Parameters

`parameters` maps the request's data to the handler's arguments, coerces it to
the schemas' types and validates it. Parameters come from the request body for
`post`, `put` and `patch` actions, and from the query string for all others.
Invalid parameters respond with a
[`ValidationError`](errors.md#validation-errors).

The schemas are the same as for [model properties](models.md#properties). A
`type` can also name a model; the parameter is then validated as that model's
data and passed on as a model instance:

```js
'post preview': {
  parameters: {
    book: { type: 'Book', required: true }
  },
  handler(ctx, { book }) {
    return { title: book.title, price: book.price }
  }
}
```

With an object of schemas, the handler receives one object with the
parameters. With an array of schemas with `name`, it receives one argument per
parameter. Set such an array on a handler function: in an action object, an
array is read as `[parameters, options]`, with Ajv options for the validation
as second entry.

```js
'get price': Object.assign(
  async function (ctx, bookId, quantity) {
    const book = await Book.findById(bookId).throwIfNotFound()
    return { total: book.price * quantity }
  },
  {
    parameters: [
      { name: 'bookId', type: 'integer', required: true },
      { name: 'quantity', type: 'integer', default: 1 }
    ]
  }
)
```

`from` takes a parameter from elsewhere: `'query'`, `'body'`, `'path'` (a
route parameter), `'root'` (the whole query or body, validated against the
schema) or `'member'` (see [Members](#members)). The
[Controllers API](../../api/server/controllers.md#parameters) describes these.

## Model controllers

A `ModelController` gives a model REST routes. It has two objects of actions:
`collection` for the whole table, and `member` for single models. The default
actions are only routed when they are listed in `allow`:

```js
import { ModelController } from '@ditojs/server'
import { Book } from '../models/index.js'

export class Books extends ModelController {
  modelClass = Book

  collection = {
    allow: ['get', 'post']
  }

  member = {
    allow: ['get', 'patch', 'delete']
  }
}
```

`collection.get` finds books with the
[query parameters](queries.md#query-parameters) of the request, `post` inserts
one book or an array, and `put`, `patch` and `delete` change several books at
once. The `member` actions `get`, `put`, `patch` and `delete` work on one book
at `/books/:id`. The
[default actions](../../api/server/controllers.md#default-actions) are
described in the API.

Without `modelClass`, the controller looks up the model by its singularized
name: `Books` finds `Book` or `BookModel`.

### Settings

A model controller's settings apply to all its queries: `scope` adds
[scopes](queries.md#scopes), `allowScope`, `allowFilter` and `allowParam`
restrict what the query parameters of requests may use, `graph` saves with
the [graph methods](queries.md#graphs) so that requests can save related
models too, `relations` adds [relation routes](#relations), and `assets` adds
[upload routes](storages.md#uploads). See
[`CollectionController`](../../api/server/controllers.md#collectioncontroller).

```js
export class Books extends ModelController {
  modelClass = Book
  graph = true
  scope = 'published'
  allowScope = ['inStock', 'withChapters']
  allowFilter = ['title', 'search', 'price']

  collection = { allow: ['get'] }
  member = { allow: ['get'] }
}
```

### Custom actions

Actions defined in `collection` and `member` are routed without being listed
in `allow`. Member actions are routed below the member's path:

```js
export class Books extends ModelController {
  modelClass = Book

  collection = {
    allow: ['get'],

    // GET /books/in-stock
    'get in-stock'(ctx) {
      return this.query().withScope('inStock').limit(10)
    }
  }

  member = {
    allow: ['get'],

    // POST /books/:id/publish
    'post publish': {
      transacted: true,
      parameters: {
        book: { from: 'member', forUpdate: true }
      },
      handler(ctx, { book }) {
        return book.$query(ctx.transaction).patchAndFetch({
          publishedAt: new Date()
        })
      }
    }
  }
}
```

`this.query()` starts a query of the model with the controller's scopes and
allowed scopes and filters applied.

An `allow` array replaces what base classes allow: a subclass that sets
`allow` lists every action it inherits, including custom actions of base
classes. `'*'` allows all of them.

### Overriding default actions

Default actions can be overridden in `collection` and `member`, and reach
their default version through `super`. They receive `(ctx, modify)`, where
`modify` is a function that changes the query:

```js
collection = {
  allow: ['get'],

  async get(ctx) {
    const books = await super.get(ctx, query => query.where('stock', '>', 0))
    return books
  }
}
```

### Members

Member actions find their model through `member.get`. A parameter with
`from: 'member'` receives it, and the request responds with a 404 error if
it doesn't exist. Its options:

- `query`: query parameters to find the member with, e.g.
  `{ scope: 'withChapters' }`.
- `forUpdate`: locks the row until the transaction ends; requires
  `transacted: true`.
- `modify`: a function that changes the query.

Where `allow` routes it, `member.get` also fetches the members for
`'$owner'` authorization and for the routes of [relations](#relations). Overriding it controls which members
these see, along with `GET` requests. The default `PUT`, `PATCH` and `DELETE`
actions find their member by id directly, so restrict them separately, e.g.
with `'$owner'`. Pass `modify` on, so that the requesting action's settings
still apply:

```js
member = {
  allow: ['get', 'patch'],

  get(ctx, modify) {
    return super.get(ctx, query => {
      query.where('isArchived', false).modify(modify)
    })
  }
}
```

## Relations

`relations` adds routes for the relations of the model. Each relation has
`relation` for its collection of related models and `member` for single
related models, with the same default actions and `allow`:

```js
export class Authors extends ModelController {
  modelClass = Author
  member = { allow: ['get'] }

  relations = {
    books: {
      relation: { allow: ['get', 'post', 'delete'] },
      member: { allow: ['get', 'patch'] }
    }
  }
}
```

This serves `GET /authors/:id/books`, `POST /authors/:id/books` and so on,
and `GET /authors/:id/books/:id1`.

Relations that aren't [owners](relations.md#owners) relate and unrelate
their models: `POST` relates existing models by their ids, and `DELETE`
unrelates them without deleting them. Owner relations insert and delete.

A relation is part of its parent: reading it requires the authorization of the
parent's `member.get`, changing it also that of the parent's `member.patch`,
whether these actions are allowed or not. The parent has to exist, too.
Changes that the relation authorizes itself only need the parent's `get`
authorization, e.g. order lines that sales staff may add to an order that only
admins may change. `Order.lines` is an owner relation, so `POST` inserts new
lines:

```js
export class Orders extends ModelController {
  modelClass = Order

  member = {
    allow: ['get', 'patch'],
    authorize: { get: ['sales', 'admin'], patch: 'admin' }
  }

  relations = {
    lines: {
      relation: {
        allow: ['get', 'post'],
        authorize: { post: 'sales' }
      }
    }
  }
}
```

## Authorization

`authorize` decides who may call an action. It can be set on an action, on an
actions object for all its actions or per action name, and on the controller as
a fallback for actions without a setting. Its value can be `true` (everyone,
also when unset), `false` (nobody), a role (logged-in users for whom
`user.$hasRole(role)` is true), `'$self'` (the user whose member it is, in
controllers of the user model), `'$owner'` (users for whom
`member.$hasOwner(user)` returns `true`), an array of these, or a function of
`ctx` and the member that returns one of them. See
[`authorize`](../../api/server/controllers.md#authorize).

An action's own `authorize` replaces the one of its actions object and
controller. `false` denies wherever it is set.

Staff notes belong to the user who wrote them: everyone with a role may read
them, but only their author or an admin may change them. Actions that the
per-name `authorize` object doesn't list, here `get`, fall back to the
controller's:

```js
export class Notes extends ModelController {
  modelClass = Note
  authorize = ['editor', 'sales', 'admin']

  collection = {
    allow: ['get', 'post']
  }

  member = {
    allow: ['get', 'patch', 'delete'],
    authorize: { patch: ['admin', '$owner'], delete: ['admin', '$owner'] }
  }
}
```

`'$owner'` calls `$hasOwner()` on the member, which the model defines:

```js
export class Note extends Model {
  $hasOwner(user) {
    return this.userId === user.id
  }
}
```

Denied requests respond with an [`AuthorizationError`](errors.md) (401).
Authentication itself, i.e. who the user is, comes from the session, see
[Users and sessions](#users-and-sessions).

## Hooks

`hooks` runs code before and after actions. Keys are
`'before:<type>:<action>'` and `'after:<type>:<action>'`, where `<type>` is
`collection` or `member` in model controllers and `actions` in plain
controllers. Relations take `hooks` in their relation object, with the type
`collection` for their `relation` actions. `*` matches any part:

```js
export class Notes extends ModelController {
  modelClass = Note

  hooks = {
    'before:collection:post'(ctx) {
      ctx.request.body.userId = ctx.state.user.id
    },

    'after:member:patch'(ctx, note) {
      this.logger.info(`Note ${note.id} was changed`)
    },

    'after:*:get'(ctx, result) {
      ctx.set('Cache-Control', 'no-store')
    }
  }
}
```

`before:` hooks run after authorization and receive the handler's arguments.
`after:` hooks receive the result; a returned value replaces it.

Hooks identify custom actions by their method and path, without colons, e.g.
`'before:member:get-tech-doc-format'` for `'get tech-doc-:format'`, and
actions take their own `before` and `after` hooks, see
[Hooks](../../api/server/controllers.md#hooks).

## Transactions

`transacted: true` runs an action in a database transaction, available as
`ctx.transaction`. It is committed when the action succeeds, and rolled back
when it throws. Pass it to the queries of the action, e.g.
`Book.query(ctx.transaction)`; see [Queries](queries.md#transactions).

Set on the controller, `transacted = true` is the default for all its
actions, including the default ones and `get`. Without either, the default
write actions of controllers with `graph` or `assets` are transacted, and
the others aren't; `transacted = false` turns that off.

```js
export class Orders extends ModelController {
  modelClass = Order
  graph = true
  transacted = true
}
```

## Shared base controllers

Settings and actions are inherited, so controllers that share them can extend
a base class of your own. Subclasses inherit its fields, the actions of its
`collection` and `member`, and its hooks, which run along with their own:

```js
// src/server/controllers/CatalogController.js
import { ModelController } from '@ditojs/server'

export class CatalogController extends ModelController {
  graph = true
  transacted = true
  authorize = ['editor', 'admin']

  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }

  hooks = {
    'after:member:patch'(ctx, model) {
      this.logger.info(`${ctx.state.user.username} changed ${model.id}`)
    }
  }
}
```

```js
// src/server/controllers/api/Books.js
import { CatalogController } from '../CatalogController.js'
import { Book } from '../../models/index.js'

export class Books extends CatalogController {
  modelClass = Book
}
```

Keep the base class out of the modules that the application receives, as
every exported controller is registered and routed.

## Users and sessions

Logging in needs sessions, a user model and a users controller.

The configuration turns on sessions, and the keys that sign the session cookie:

```js
// config/index.js
export default {
  app: {
    session: { modelClass: 'Session' },
    keys: [process.env.APP_KEY]
  }
}
```

`session.modelClass` names a model that stores the sessions in the database.
Without it, the session is stored in the cookie. Further `session` options are
passed on to [koa-session](https://github.com/koajs/session). Expired sessions
are deleted by
[`app.deleteExpiredRecords()`](../../api/server/application.md#deleteexpiredrecords),
except those with `maxAge: 'session'`, which have no expiry.

The models use `SessionMixin` and `UserMixin`:

```js
import { Model, SessionMixin, UserMixin } from '@ditojs/server'

export class Session extends SessionMixin(Model) {}

export class User extends UserMixin(Model) {
  static properties = {
    roles: { type: 'array', items: { type: 'string' }, default: [] }
  }
}
```

`UserMixin` adds `username` and `password`, which stores a hash of the
password in `hash`, and `lastLogin`. `options.usernameProperty` and
`options.passwordProperty` rename the first two, e.g. to log in with an
`email`. `$hasRole()` checks the `roles` array, if the model has one. See the
[Mixins API](../../api/server/model.md#usermixin).
[Logging in](index.md#logging-in) shows how to create their tables and the
first user.

The users controller adds the routes that log in and out:

```js
import { UsersController } from '@ditojs/server'

export class Users extends UsersController {
  modelClass = User

  member = {
    allow: ['get', 'patch'],
    authorize: ['$self', 'admin']
  }
}
```

- `POST /users/login` logs in with `{ username, password }` in the body.
- `POST /users/logout` logs out.
- `GET /users/session` returns `{ authenticated, user }`.
- `GET /users/self` returns the logged-in user.
- In member routes, `self` stands for the logged-in user, e.g.
  `PATCH /users/self` runs the member's `patch` action on them, if it is
  allowed, but doesn't change passwords, see
  [Confirmed access](#confirmed-access). The admin's
  [account settings](../admin/views.md#account-settings) use it.

Wrong passwords don't lock accounts, so that others can't lock users out:
limit the rate of login and `'post confirm-access'` requests per client in the
proxy in front of the app instead. Logins with unknown usernames compare the
password against a dummy hash, so they take about as long as wrong passwords, as
long as the stored hashes have the default cost, `sessionScope` doesn't load
extra relations and `$verifyPassword()` isn't overridden.

`authorize` on the controller doesn't apply to login, logout and session,
which authenticate, so users can always log in; `self` follows it. Member
actions are only allowed for the user themselves (`'$self'`) by default; the
example also allows admins. If a subclass sets `collection.allow`, it has to
list the routes above too, e.g.
`allow: ['get', 'post login', 'post logout', 'get session', 'get self']`.

In actions, `ctx.state.user` is the logged-in user. The admin logs in through
these routes, see the [admin guide](../admin/index.md).

### Passkeys

Users can also log in with passkeys, without a password. Install the optional
peer dependencies `@simplewebauthn/server` and `aaguids`, add a model for the
credentials, and register `PasskeyService`:

```js
import { Model, CredentialMixin } from '@ditojs/server'

export class Credential extends CredentialMixin(Model) {}
```

```js
import { Application, PasskeyService } from '@ditojs/server'

const app = new Application({
  config,
  services: { passkeys: PasskeyService },
  models,
  controllers
})
```

```js
// config/index.js
export default {
  app: {
    name: 'Example', // Shown by passkey managers.
    session: { modelClass: 'Session' },
    auth: {
      credentials: { modelClass: 'Credential' }
    }
  },
  services: {
    passkeys: true
  }
}
```

The passkeys belong to the domain of the requests, and the pages of that domain
and its subdomains can use them. [`PasskeyService`](../../api/server/service.md#passkeyservice)
configures another domain, e.g. to share them between subdomains, or limits the
pages. The users controller then adds the passkey routes, see
[`UsersController`](../../api/server/controllers.md#userscontroller). In the
browser, `@simplewebauthn/browser` runs them against the authenticator. A
logged-in user adds a passkey:

```js
import { startRegistration } from '@simplewebauthn/browser'

const post = async (path, body) => {
  const response = await fetch(`/api/users/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return response.json()
}

const optionsJSON = await post('passkey-options')
// Named after its provider, e.g. '1Password':
const passkey = await post(
  'passkeys',
  await startRegistration({ optionsJSON })
)
```

And logs in with it later, without a username:

```js
import { startAuthentication } from '@simplewebauthn/browser'

const optionsJSON = await post('passkey-login-options')
const { user } = await post(
  'passkey-login',
  await startAuthentication({ optionsJSON })
)
```

`'post passkey-login-options'` keeps its challenge in the session, so each
request without a session stores a new one: limit its rate like that of
[logins](#users-and-sessions). `GET /users/passkeys` lists the user's passkeys,
and `DELETE /users/passkeys/:id` removes one. The admin offers both with its
`login.passkeys` option, see [`DitoAdmin`](../../api/admin/admin.md#parameters).

### Two-factor authentication

Users can protect their password logins with a second factor, the codes of an
authenticator app (TOTP). Install the optional peer dependency `otpauth`, add
the model for the credentials and `app.name` as for passkeys, and register
`TotpService` (`services: { totp: TotpService }`) with a secret, a long random
string that encrypts the users' TOTP secrets:

```js
// config/index.js
export default {
  app: {
    name: 'Example', // Shown by authenticator apps.
    session: { modelClass: 'Session' },
    auth: {
      credentials: { modelClass: 'Credential' }
    }
  },
  services: {
    totp: { secret: process.env.TOTP_SECRET }
  }
}
```

A logged-in user sets up TOTP by scanning the QR code of `uri` in their
authenticator app, e.g. rendered with a QR code library, and confirming it with
a code. The response holds the backup codes, which are only shown once:

```js
const { uri, secret } = await post('totp')
// Show `uri` as QR code, and `secret` to enter by hand:
const { backupCodes } = await post('totp-confirm', { code: '123456' })
```

From then on, their password login answers `codeRequired` instead of logging
in, and the code of the app, or one of the backup codes, completes it:

```js
let response = await post('login', { username, password })
if (response.codeRequired) {
  response = await post('login-code', { code: '123456' })
}
const { user } = response
```

Ten wrong codes in a row lock the account for 15 minutes.
`'post confirm-access'` isn't transacted, also in transacted controllers, so
that failed requests don't roll back the count of wrong codes: overrides of it
need `transacted: false` too. `GET /users/totp` tells whether TOTP is set up
and how many backup codes are left, and `DELETE /users/totp` turns it off, with
[confirmed access](#confirmed-access). Only password logins through
`'post login'` ask for the code, while `ctx.login(user)` logs in without it,
e.g. to impersonate users. Users with TOTP can't log in with their password
while the app doesn't register `TotpService`. The admin's login
dialog asks for the code, and its `login.totp` option sets up and turns off
TOTP in the account menu, see
[`DitoAdmin`](../../api/admin/admin.md#parameters).

### Password reset

Users who forgot their password can set a new one through a link that the app
emails them. Set `app.keys`, which sign the links, and the URL of the page that
the link opens, and send the emails in the users controller:

```js
// config/index.js
export default {
  app: {
    keys: [process.env.APP_KEY],
    auth: {
      passwordReset: {
        confirmUrl: 'https://example.com/reset-password#token={token}',
        expiresAfter: '1h'
      }
    }
  }
}
```

```js
export class Users extends UsersController {
  modelClass = User

  async sendPasswordReset(ctx, user, url) {
    await sendEmail({
      to: user.email,
      subject: 'Reset your password',
      text: `Set a new password within the next hour: ${url}`
    })
  }
}
```

The token goes in the fragment of the URL, which browsers don't send to
servers, also not in the `Referer` header. The page of the link reads it and
posts it with the new password. The request answers with the same response and
status whether the user exists or not:

```js
await post('password-reset', { username })
// On the page of the link:
const token = new URLSearchParams(location.hash.slice(1)).get('token')
await post('password-reset-confirm', { token, password })
```

Nothing is stored for the links: the token carries the id of the user and its
creation time, signed with the first of `app.keys` together with the values
of
[`getPasswordResetTokenValues()`](../../api/server/controllers.md#getpasswordresettokenvalues).
Links signed with the other keys stay valid, so new keys can be added in front
while the old ones are rotated out.
A link works until `expiresAfter`, or until one of these values changes: a
login, a password change or a username change invalidates it, and the new hash
makes each link work once. It doesn't log in: the user logs in with the new
password afterwards, and changing the password ends their other sessions.
Limit the rate of requests per client in the proxy in front of the app, like
that of [logins](#users-and-sessions): there is no limit of emails per user.
The admin's `login.passwordReset` option adds
the request to its login dialog, with `confirmUrl` pointing to the admin, e.g.
`'https://example.com/admin/#password-reset={token}'`, see
[`DitoAdmin`](../../api/admin/admin.md#parameters).

### Confirmed access

Security changes need confirmed access, so that a session alone, e.g. a stolen
one, can't change how the account logs in: changing the password through
`'post password'` or the username, adding and removing passkeys, and turning
TOTP on and off. Logging in confirms the access, also with a passkey or with
the TOTP code, for the time of `reconfirmAccessAfter`:

```js
// config/index.js
export default {
  app: {
    auth: {
      reconfirmAccessAfter: '10m' // The default
    }
  }
}
```

Later, these actions answer status 403 with `confirmationRequired`, and the
user confirms the access again with their password, plus the code of their
authenticator app or a backup code if they use TOTP, or with a passkey:

```js
let response = await post('confirm-access', { password })
if (response.codeRequired) {
  response = await post('confirm-access', { password, code: '123456' })
}
// Or with a passkey, through the options of passkey logins:
const optionsJSON = await post('passkey-login-options')
await post('confirm-access', {
  passkey: await startAuthentication({ optionsJSON })
})
```

Wrong codes count towards the lock of the account, as in logins. The `patch`
and `put` actions of users controllers need it too, to set a password, also
when admins set the passwords of other users, and to change the username, as
password resets go to it. They answer 400 for bodies with the `hash`, while
`post` creates users with a password without it. The admin asks to confirm the
access whenever an action answers `confirmationRequired`, and then repeats the
action.

Protect other changes the same way, e.g. the `email` that the app sends the
password resets to, or custom actions with
`authorize: { 'post export': ctx => this.hasConfirmedAccess(ctx) }`:

```js
export class Users extends UsersController {
  modelClass = User

  member = {
    allow: ['get', 'patch'],

    async patch(ctx, modify) {
      const { email } = ctx.request.body
      if (email !== undefined) {
        // Compare with the user that is patched, not the logged-in one:
        const user = await this.modelClass.query().findById(ctx.memberId)
        // `hasConfirmedAccess()` throws 403 with `confirmationRequired` without
        // confirmed access, and returns `false` for users of other models:
        if (email !== user?.email && !this.hasConfirmedAccess(ctx)) {
          throw new AuthorizationError()
        }
      }
      return super.patch(ctx, modify)
    }
  }
}
```

To invalidate the links of password resets already sent to the old `email`
too, add it to the values that the links depend on, see
[`getPasswordResetTokenValues()`](../../api/server/controllers.md#getpasswordresettokenvalues):

```js
export class Users extends UsersController {
  modelClass = User

  // @override
  getPasswordResetTokenValues(user) {
    return [...super.getPasswordResetTokenValues(user), user.email]
  }
}
```

Passwords set through other routes of the app aren't covered: relations and
graphs that include user models, other controllers, and new users created
through an authorized collection `post`. Keep such routes to admins. Deleting
users through the member `delete`, e.g. `DELETE /users/self`, doesn't need
confirmed access either: apps that allow it can protect it with
`authorize: { delete: ctx => this.hasConfirmedAccess(ctx) && '$self' }` in
`member`, keeping `'$self'`, which the setting replaces, so that users only
delete themselves.

## Admin

The `AdminController` serves the admin interface at its path. In development
it serves the admin's sources through Vite with hot reloading, in production
the built files in `config.admin.dist`:

```js
import { AdminController } from '@ditojs/server'

export class Admin extends AdminController {
  authorize = ['editor', 'sales', 'admin']
}
```

Register it at the top level of the application's `controllers`, so that it
is served at `/admin`, see [Application](application.md#namespaces). Its
`authorize` protects the admin's views. The admin receives
`config.admin.api` and `config.admin.settings` in the browser; overriding
`getGlobalConfig()` changes what it receives. Setting up the admin is
described in the [admin guide](../admin/index.md).
