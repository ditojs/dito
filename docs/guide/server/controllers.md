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
passed on to [koa-session](https://github.com/koajs/session).

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
  allowed. The admin's [account settings](../admin/views.md#account-settings)
  use it.

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
peer dependency `@simplewebauthn/server`, add a model for the credentials, and
turn on passkeys:

```js
import { Model, CredentialMixin } from '@ditojs/server'

export class Credential extends CredentialMixin(Model) {}
```

```js
// config/index.js
export default {
  app: {
    session: { modelClass: 'Session' },
    auth: {
      credentials: { modelClass: 'Credential' },
      passkeys: {
        name: 'Example',
        id: 'example.com',
        origins: ['https://example.com']
      }
    }
  }
}
```

The users controller then adds the passkey routes, see
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
const response = await startRegistration({ optionsJSON })
await post('passkeys', { name: 'Laptop', response })
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

`GET /users/passkeys` lists the user's passkeys, and
`DELETE /users/passkeys/:id` removes one. The admin offers both with its
`login.passkeys` option, see [`DitoAdmin`](../../api/admin/admin.md#parameters).

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
