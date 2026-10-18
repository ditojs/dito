# Controllers

Controllers map HTTP routes to actions. Dito.js provides these classes, all
exported by `@ditojs/server`:

| Class                                     | Description |
| ----------------------------------------- | ----------------------------------------------------- |
| [`Controller`](#controller)               | Base class: plain actions, asset uploads, hooks, authorization. |
| [`CollectionController`](#collectioncontroller) | Base class of model and relation controllers. Not extended directly. |
| [`ModelController`](#modelcontroller)     | CRUD routes for a model's collection and members, plus its relations. |
| [`RelationController`](#relationcontroller) | Routes for a relation of a model controller. Created from `relations`, never extended. |
| [`UsersController`](#userscontroller)     | A model controller with login, logout, session, passkey, TOTP and password reset actions. |
| [`AdminController`](#admincontroller)     | Serves Dito.js Admin. |

Controllers are registered through the `controllers` option of the
[`Application`](application.md#addcontrollers); nested objects become
namespaces, see [Namespaces](../../guide/server/application.md#namespaces).
The [Controllers guide](../../guide/server/controllers.md) explains how to use
them.

## Actions

An action is a property named `'<method>'` or `'<method> <path>'`, e.g.
`'get'`, `'post import'` or `'get :isbn/preview'`. `<method>` is an
[`HttpMethod`](#httpmethod); names without one throw. The path is used as
given, relative to the controller's route (`Controller`: `actions`,
`ModelController`: `collection` and `member`, relations: `relation` and
`member`). The path `.` routes the action to the controller's own URL, e.g.
`'get .'`. Route parameters are read through `from: 'path'`
[parameters](#parameters) or `ctx.params`. See
[Controllers](../../guide/server/controllers.md#paths) for examples.

An action is a handler function or an options object with a `handler`. The
handler is called with the actions object as `this`, which inherits from the
controller (`this.query()`, `this.app`, …) and exposes it as
`this.controller`. `super.<action>()` calls the inherited action of the same
object, e.g. `super.get(ctx)`, in both forms. In the options form, `super`
depends on the object the `handler` is written in: for handlers assigned from
elsewhere and for options objects that are copied or shared between
controllers, use the function form, as shared options objects follow the last
controller set up with them, also in the `authorize` they inherit. A returned
value other than `undefined` becomes the response body.

### Action options

| Option        | Type                                    | Description |
| ------------- | --------------------------------------- | ------------------------------------------------ |
| `handler`     | `function(ctx, ...args)`                | The action. Required. |
| `before`      | `function(ctx, ...args)`                | A `before:` [hook](#hooks) of this action only. |
| `after`       | `function(ctx, result)`                 | An `after:` [hook](#hooks) of this action only. |
| `parameters`  | `object` \| `array` \| `[schema, options]` | Validated parameters, see [Parameters](#parameters). |
| `response`    | `Schema & { name? }` \| `[schema, options]` | Schema of the returned value. With `name`, the value is sent wrapped as `{ [name]: value }`. |
| `authorize`   | [`Authorize`](#authorize)               | Authorization of this action, overriding the one of its actions object and controller. |
| `transacted`  | `boolean`                               | Runs the action in a transaction, available as `ctx.transaction`. Default: the controller's `transacted`; without either, the default write actions of controllers with `graph` or `assets` are transacted. |
| `scope`       | `string \| string[]`                    | Scopes applied to the member query of `from: 'member'` parameters. |
| `path`        | `string`                                | Overrides the path taken from the action name. |
| `options`     | `{ parameters?, response? }`            | Validation options for parameters and response (Ajv options, see [Validator](./validator.md#validation-options)). |

Any other property, e.g. `cached: true`, is copied to the action object
(`ctx.action`), for application middleware to read.

In the function form, the same options can be set as properties of the
function, e.g. `handler.parameters = { … }`; there, `parameters` and
`response` are always schemas. In the options form, an array is read as
`[schema, options]`, so an array of parameter schemas needs wrapping:
`parameters: [[{ name: 'title', … }, { name: 'year', … }]]`.

### Parameters

`parameters` are read from `ctx.request.body` for `post`, `put` and `patch`
actions and from `ctx.query` otherwise, coerced and validated. A failed
validation responds with a [`ValidationError`](./errors.md#validationerror).

- **Object** of schemas, keyed by parameter name: the handler receives one
  object with the same keys, `handler(ctx, { title, year })`.
- **Array** of schemas with `name`: the handler receives one argument per
  parameter, `handler(ctx, title, year)`. A schema without `name` receives the
  whole query or body.

Each schema is a [`Schema`](./validator.md#schema-extensions) plus:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `type`   | `string` | Also accepts `'date'`/`'datetime'`/`'timestamp'` (coerced to `Date`) and the names of models (coerced to model instances). |
| `from`   | `'path' \| 'query' \| 'body' \| 'root' \| 'member'` | Where the value comes from instead of the default source: route parameters, the query, the body, the whole parameters object (`'root'`), or the requested member (`'member'`, see below). |

`from: 'member'` parameters of member actions receive the member model, fetched
through the controller's [`member.get`](#overriding-memberget) action, and
respond with a 404 error when it isn't found. In `relation` actions of
one-to-one relations they receive the single related model. They take these
options:

| Option      | Type                    | Description |
| ----------- | ----------------------- | --------------------------------------------- |
| `query`     | `object`                | Query parameters to fetch the member with, e.g. `{ scope: 'published' }`. The request's own query parameters don't apply. |
| `forUpdate` | `boolean`               | Locks the member row until the end of the transaction. Requires `transacted: true`. |
| `modify`    | `(query) => void`       | Modifies the member query. |

```js
member = {
  'post publish': {
    transacted: true,
    parameters: {
      book: { from: 'member', forUpdate: true }
    },
    handler(ctx, { book }) {
      return book
        .$query(ctx.transaction)
        .patchAndFetch({ publishedAt: new Date() })
    }
  }
}
```

The query parameters that `parameters` don't consume are available as
`ctx.filteredQuery`, and the default actions pass them on to
[`find()`](./query-builder.md).

### Request context

Requests of actions have these members on the Koa context:

| Property              | Description |
| --------------------- | -------------------------------------------------- |
| `ctx.action`          | The action object, with `name` (its key), `identifier` (its part of [hook](#hooks) keys), `type`, `method`, `path`, `authorize`, `transacted` and any extra options. |
| `ctx.controller`      | The controller. |
| `ctx.params`          | The route parameters, e.g. `{ id: '1' }`. |
| `ctx.route`           | The route, see [`addRoute()`](./application.md#addroute). |
| `ctx.logger`          | The logger of the request, with its request id and user. |
| `ctx.memberId`        | The validated member id, in member actions. |
| `ctx.filteredQuery`   | The query parameters not consumed by `parameters`. |
| `ctx.transaction`     | The transaction of transacted actions. |
| `ctx.state.user`      | The authenticated user, if any. |

### `allow`

Every actions object (`actions`, `collection`, `member`, `relation`, `assets`)
accepts an `allow` array:

- Actions defined on the object itself are always routed.
- The default actions of [`CollectionController`](#default-actions) are
  routed only when listed in `allow`.
- Actions inherited from the actions objects of base classes are routed as
  long as no class in between sets `allow`. An `allow` array replaces the
  ones of base classes, so then they need to be listed too.
- `'*'` allows all actions of the object, inherited ones included, and on
  `collection` and `member` also all default actions.

```js
collection = {
  allow: ['get', 'post'],
  'get count'(ctx) { … } // routed without being listed
}
```

## Authorize

```ts
type Authorize =
  | boolean
  | string
  | string[]
  | ((
      this: Controller,
      ctx: KoaContext,
      member?: Model
    ) => Authorize | Promise<Authorize>)

// On controllers and actions objects, also keyed by action name (or by data
// path on `assets`):
type ControllerAuthorize = Authorize | Record<string, Authorize>
```

| Value      | Authorized when |
| ---------- | ---------------------------------------------------------------- |
| unset      | Always (public). |
| `true`     | Always. It doesn't check for a user; use a role for that. |
| `false`    | Never. |
| `'$self'`  | The member is the authenticated user (users controllers). |
| `'$owner'` | `member.$hasOwner(user)` returns a truthy value, see [`$hasOwner()`](./model.md#hasowner). |
| any string | `user.$hasRole(role)` returns a truthy value, see [`UserMixin`](./model.md#usermixin). |
| array      | Any of its entries authorizes. |
| function   | Called with `(ctx, member)` and the controller as `this`, in [relations](#relationcontroller) their `RelationController`, with the declaring controller as `this.parent`; its result is checked like a setting. Returning `undefined` denies, returning `null` authorizes like unset. |

Strings and arrays deny requests without an authenticated user
(`ctx.state.user`, see [`UserMixin`](./model.md#sessions)).

In controllers that are subclassed, write functions that use `this` as methods,
not arrow functions: subclasses inherit them from a separate instance of the
controller, which an arrow function keeps as its `this`.

`authorize` can be set in three places, from strongest to weakest:

1. On an action itself.
2. On an actions object: one value for all its actions, or an object keyed by
   action name. Settings of base classes' actions objects apply too.
3. On the controller, as a fallback for the actions without one. An object
   keyed by action name works here too.

`false` denies on all three levels. A denied request responds with an
[`AuthorizationError`](./errors.md#authorizationerror) (401).

See [Authorization](../../guide/server/controllers.md#authorization) for
examples.

## Hooks

```js
hooks = {
  'before:member:patch'(ctx) { … },
  'after:collection:get'(ctx, result) { … },
  'after:*:delete'(ctx, { count }) { … },
  'before:member:put, before:member:patch'(ctx) { … }
}
```

Hook keys are `'<before|after>:<identifier>'`, where the identifier of an
action, `ctx.action.identifier`, is `'<type>:<action>'`. `<type>` is `actions`
(`Controller`), `collection` or `member`; relation actions use `collection` for
their `relation` actions. `<action>` is the method and the parts of the path,
parameters included, joined with hyphens, with camelCase hyphenated and
without `:` and wildcards: `'get'` and `'get .'` are `get`, `'get :section'`
is `get-section`, `'get :shopOrderId'` is `get-shop-order-id`,
`'get tech-doc-:format'` is `get-tech-doc-format` and
`'get job-status/:token'` is `get-job-status-token`. `*` matches any segment,
the first one too (`'*:member:patch'` runs before and after), and keys
separated by commas register the same hook for several events. Each value is
one function.

Two actions of the same type with the same identifier throw when the
controller is set up, e.g. `'get :token'` and `'get token'`: change the route
of one of them. Keys with the action's key instead of its identifier, e.g.
`'before:member:get tech-doc-:format'`, keep working until 5.0, with a
deprecation warning.

- `before:` hooks receive `(ctx, ...args)`, the arguments of the handler
  after `ctx` (none for the default actions), and run after authorization.
- `after:` hooks receive `(ctx, result)`. A returned value other than
  `undefined` replaces the result.

Hooks run with the controller as `this`, in sequence, base class hooks first.
`hooks` objects inherit from the ones of base classes, and relation objects
accept their own `hooks`. The `before` and `after` options of an action run
after the controller's hooks of the action, with the same arguments:

```js
member = {
  'get tech-doc-:format': {
    handler(ctx) { … },
    after(ctx, result) {
      ctx.set('Cache-Control', 'max-age=3600')
    }
  }
}
```

## Controller

```js
import { Controller } from '@ditojs/server'
```

The base class of all controllers, for plain [actions](#actions), see
[Controllers](../../guide/server/controllers.md#controller).

### Instance fields

| Field        | Type                       | Description |
| ------------ | -------------------------- | -------------------------------------------------- |
| `app`        | [`Application`](./application.md) | The application. |
| `name`       | `string`                   | Default: the class name without a `Controller` suffix. |
| `path`       | `string`                   | Route path relative to the namespace. Default: the name (`Books`), hyphenated with `config.app.normalizePaths` (`books`, `sales-reports`). |
| `namespace`  | `string`                   | The namespace path, see [Namespaces](../../guide/server/application.md#namespaces). |
| `url`        | `string`                   | The resolved route, `/<namespace>/<path>`. Set by `configure()`. |
| `actions`    | `object`                   | The actions, see [Actions](#actions). |
| `assets`     | `object`                   | Asset upload routes, see [Assets](#assets). |
| `hooks`      | `object`                   | Hooks by key, see [Hooks](#hooks). |
| `authorize`  | [`ControllerAuthorize`](#authorize) | Fallback authorization of all actions and uploads, or by action name. |
| `transacted` | `boolean`                  | Default `transacted` for all actions. |
| `isInitialized` | `boolean`               | Whether `setupControllers()` set the controller up. |
| `level`      | `number`                   | `0`, and the nesting depth for relation controllers. |
| `logRoutes`  | `boolean`                  | Whether routes are logged during setup, from `config.log.routes`. |
| `logger`     | `pino.Logger`              | Getter: `getLogger()` without a request context. |

### configure()

```js
controller.configure()
```

Called right after the constructor, when the controller is added to the
application. Sets up `hooks`, `name`, `path` and `url`. Call
`super.configure()`. *Hook.*

### setup()

```js
controller.setup()
```

Sets up the routes of the actions and asset uploads. Call `super.setup()`.
*Hook.*

### initialize()

```js
await controller.initialize()
```

Asynchronous initialization, after `setup()`. Does nothing by default. *Hook.*
Returns `Promise<void>`.

### compose()

```js
const middleware = controller.compose()
```

Returns a Koa application or middleware to mount at the controller's `url` with
koa-mount, or nothing. Used by `AdminController`. *Hook.* Returns `Koa |
Koa.Middleware | undefined`.

### getLogger()

```js
const logger = controller.getLogger(ctx?)
```

Returns the logger of the request `ctx` (without `ctx`, the application's
[`logger`](./application.md#properties)), named after the controller. Returns
`pino.Logger`.

### getMember()

```js
const member = await controller.getMember(ctx, base?, options?)
```

Resolves the member of the request. Returns `null` in `Controller`; collection
controllers fetch it through `member.get`, see
[`CollectionController.getMember()`](#getmember-1). Returns `Promise<Model |
null>`.

### processAuthorize()

```js
const authorization = controller.processAuthorize(authorize)
```

Converts an [`Authorize`](#authorize) setting to an authorization function.
Throws a [`ControllerError`](./errors.md#controllererror) for unsupported
values. Returns `(ctx, member?) => boolean | Promise<boolean>`.

### handleAuthorization()

```js
await controller.handleAuthorization(authorization, ctx, member?)
```

Calls an authorization function from `processAuthorize()` and throws an
[`AuthorizationError`](./errors.md#authorizationerror) unless it returns `true`.
Actions and asset uploads authorize through it, so overrides can add checks:
`RelationController` also authorizes the parent member here. *Hook.* Returns
`Promise<void>`.

### emitHook()

```js
const result = await controller.emitHook(type, handleResult, ctx, ...args)
```

Runs the [hooks](#hooks) registered for `type`, e.g. `'after:member:get'`, in
sequence. With `handleResult`, the first of `args` is the result, passed to each
hook and replaced by the value it returns. Returns `Promise<unknown>`: the
result with `handleResult`, else `undefined`.

### getPath()

```js
const path = controller.getPath(type, path)
```

Returns the route path of an action of `type` (`'actions'`, `'collection'`,
`'member'` or `'controller'`), relative to the controller. Collection
controllers prefix member paths with `:id`. *Hook.* Returns `string`.

### getUrl()

```js
const url = controller.getUrl(type, path)
```

Returns the full route of an action: `url` joined with `getPath()`, or `url`
itself for the path `.`. Returns `string`.

### logController()

```js
controller.logController()
```

Logs the controller during setup, if `config.log.routes` is set. *Hook.*

### Internal members

`setupRoute()`, `setupActions()`, `setupActionRoute()`, `setupAssets()`,
`setupAssetRoute()`, `inheritValues()`, `processValues()`, `setProperty()`,
`logRoute()` and `describeAuthorize()` are declared in the types for
subclasses that change how routes are set up. Their behaviour is not part of
the documented API. `markAsCoreActions()` and `setupAction()` are internal
helpers, and not part of the types.

## Assets

```js
assets = {
  authorize: 'editor',
  cover: { storage: 'covers', readDimensions: true },
  samplePages: { storage: 'samplePages' }
}
```

`assets` maps data paths, with `*` and `**` wildcards, to upload routes:
`POST <url>/upload/<data path>`, e.g. `/books/upload/samplePages`, or
`/books/upload/sample-pages` with `config.app.normalizePaths`. The uploaded
files are stored in the named [storage](./storage.md), recorded as `Asset`
models when the application has one (see
[`AssetMixin`](./model.md#assetmixin)), and returned as an array of
[file objects](storage.md#assetfileobject). `allow` and `authorize` work as on
actions objects. Uploads run no hooks. See
[Uploads](../../guide/server/storages.md#uploads).

| Option           | Type      | Description |
| ---------------- | --------- | ------------------------------------------- |
| `storage`        | `string`  | The storage name. Required. |
| `readDimensions` | `boolean` | Reads `width` and `height` of images and videos. |
| `transacted`     | `boolean` | Runs the upload in a transaction. |
| *other*          |           | Passed on to multer, e.g. `limits`. |

In model controllers, `assets: true` uses the model's
[`assets`](./model.md#static-assets) definitions, and an object is merged over
them; the merged entries are all routed.

## CollectionController

```js
import { CollectionController } from '@ditojs/server'
```

The base class of `ModelController` and `RelationController`. Its members are
available on both. Extend `ModelController` rather than this class.

### Instance fields

| Field         | Type                         | Description |
| ------------- | ---------------------------- | ----------------------------------------- |
| `modelClass`  | `typeof Model`               | The model class. |
| `collection`  | `object`                     | Collection actions, see [Default actions](#default-actions). |
| `member`      | `object`                     | Member actions. |
| `graph`       | `boolean`                    | Write through the graph methods (`insertDitoGraphAndFetch()` …). Default `false`. |
| `scope`       | `string \| string[]`         | Scopes applied to the queries of the controller. The default `delete` actions leave them out. |
| `allowParam`  | `string \| string[]`         | Query parameters the default actions accept, see [`QueryParameterOptions`](./query-builder.md). Default: all. |
| `allowScope`  | `boolean \| string \| string[]` | Scopes the `scope` query parameter may request. Default: all. |
| `allowFilter` | `boolean \| string \| string[]` | Filters the `filter` query parameter may request. Default: all. |
| `relate`      | `boolean`                    | `post` relates existing models instead of inserting. |
| `unrelate`    | `boolean`                    | `delete` unrelates instead of deleting. |
| `isOneToOne`  | `boolean`                    | Whether the controller addresses a single related model. |
| `idParam`     | `string`                     | The route parameter of member ids: `id`, `id1`, … per level. |

### Default actions

Routed only when listed in `allow`.

| Action              | Route                | Query method |
| ------------------- | -------------------- | ------------------------------------------ |
| `collection.get`    | `GET <url>`          | `find(ctx.filteredQuery)`; a `range` query parameter returns a page `{ results, total }`. |
| `collection.post`   | `POST <url>`         | `insertAndFetch()` / `insertDitoGraphAndFetch()`, or relates with `relate`. Responds `201` with a `Location` header. |
| `collection.put`    | `PUT <url>`          | `updateAndFetch()` / `updateDitoGraphAndFetch()` |
| `collection.patch`  | `PATCH <url>`        | `patchAndFetch()` / `patchDitoGraphAndFetch()` |
| `collection.delete` | `DELETE <url>`       | `delete()`, or `unrelate()`; returns `{ count }`. |
| `member.get`        | `GET <url>/:id`      | `findById()` |
| `member.put`        | `PUT <url>/:id`      | `updateAndFetchById()` / `updateDitoGraphAndFetchById()` |
| `member.patch`      | `PATCH <url>/:id`    | `patchAndFetchById()` / `patchDitoGraphAndFetchById()` |
| `member.delete`     | `DELETE <url>/:id`   | `findById().delete()`, or `unrelate()`; returns `{ count }`. |

Collection `PUT` and `PATCH` update existing models only: every model in the
body needs its id, also with `graph: true`; otherwise they respond with a
[`ValidationError`](./errors.md#validationerror) (400). New models are
created with `POST`. Without `graph`, the body must be an array; with
`graph`, it may be one model or an array, and only models nested in the
graphs may be new.

The default actions are called with `(ctx, modify)`, where `modify` is an
optional `(query, trx) => void`. Overrides can pass their own:

```js
collection = {
  allow: ['get'],
  get(ctx) {
    return super.get(ctx, query => query.whereNotNull('publishedAt'))
  }
}
```

### Overriding member.get

Where `allow` routes it, `member.get` also fetches the members of
`from: 'member'` parameters, of `'$owner'` authorizations and of the parent
check of relation routes, otherwise `fetchMember()` does. Overriding it
controls which members these receive; the default `put`, `patch` and `delete` actions query by id
directly. It is called with
`(ctx, modify)`: `ctx.memberId` and `ctx.filteredQuery` describe the member,
`modify` applies the requesting action's scope, the `modify` option and the
`forUpdate` lock. Pass both on:

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

### query()

```js
const query = controller.query(trx?)
```

Returns a query builder for `modelClass`, with the controller's `scope`,
`allowScope` and `allowFilter` applied.

#### Parameters

| Name  | Type          | Description               |
| ----- | ------------- | ------------------------- |
| `trx` | `Transaction` | The transaction to use.   |

Returns [`QueryBuilder`](./query-builder.md).

### setupQuery()

```js
controller.setupQuery(query, base?)
```

Applies `allowScope`, `allowFilter` and the `scope` of `base` (the controller by
default, or an action) to `query`. Returns [`QueryBuilder`](./query-builder.md):
`query`.

### execute()

```js
const result = await controller.execute(ctx, (query, trx) => …)
```

Calls the callback with a query builder for the request, in `ctx.transaction`,
and returns its result. Relation controllers build the query from the parent
member's `$relatedQuery()`. Returns `Promise`: the callback's result.

### getMember()

```js
const member = await controller.getMember(ctx, base?, options?)
```

Fetches the member of the request through `member.get` where `allow` routes
it, otherwise through [`fetchMember()`](#fetchmember).

#### Parameters

| Name                | Type              | Description                                                                  |
| ------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `ctx`               | `KoaContext`      | The request context, with `ctx.memberId`.                                    |
| `base`              | `object`          | The controller or action whose `scope` applies. Default: the controller.     |
| `options.query`     | `object`          | Query parameters, used instead of the request's.                             |
| `options.modify`    | `(query) => void` | Modifies the query.                                                          |
| `options.forUpdate` | `boolean`         | Locks the row; requires a transaction.                                       |

Returns `Promise<Model>`. The default `member.get` responds with a 404 error
when the member isn't found.

### fetchMember()

```js
const member = await controller.fetchMember(ctx, {
  id, query, modify, forUpdate
})
```

Fetches the member with `id`, applying `query` with `find()`. Used by the
default `member.get`. One-to-one relations fetch their single related model
without `id`. Responds with a 404 error when not found. Returns
`Promise<Model>`.

### executeAndFetch()

```js
const result = await controller.executeAndFetch(action, ctx, modify?, body?)
```

Calls `<action>AndFetch(body)` (`<action>DitoGraphAndFetch()` with `graph`),
e.g. `executeAndFetch('patch', ctx)`. `body` defaults to `ctx.request.body`.
Returns `Promise<Model | Model[]>`.

### executeAndFetchById()

```js
const model = await controller.executeAndFetchById(action, ctx, modify?, body?)
```

Calls `<action>AndFetchById(ctx.memberId, body)` (or its graph variant). `body`
defaults to `ctx.request.body`. Responds with a 404 error when not found.
Returns `Promise<Model>`.

### relateAndFetch()

```js
const result = await controller.relateAndFetch(ctx, modify?)
```

Used by `collection.post` with `relate`. Inserts the body and relates the
existing models of its graph; `RelationController` relates the models in the
body by id. *Hook.* Returns `Promise<Model | Model[]>`.

### getMemberId()

```js
const id = controller.getMemberId(ctx)
```

Returns the validated id from the route parameter `idParam`. Returns `Id |
Id[]`: an array for composite ids.

### getModelId()

```js
const id = controller.getModelId(model)
```

Returns the id of a model. Returns `Id | Id[]`: an array for composite ids.

### getCollectionIds()

```js
const ids = controller.getCollectionIds(ctx)
```

Returns the validated ids of the models in the body. Returns `Array<Id | Id[]>`.

### validateCollectionBody()

```js
controller.validateCollectionBody(ctx)
```

Used by the collection's `put` and `patch` actions. Throws a
[`ValidationError`](./errors.md#validationerror) unless the body is an array
of models with ids, or with `graph`, models with ids at the root.

### getIds()

```js
const ids = controller.getIds(ctx)
```

Returns `[memberId]` in member actions, the ids of the body in collection
actions, else `[]`. Returns `Array<Id | Id[]>`.

### getContextWithMemberId()

```js
const memberCtx = controller.getContextWithMemberId(ctx, memberId?)
```

Returns a context that inherits from `ctx`, with `memberId` (by default
`getMemberId(ctx)`). Returns `KoaContext`.

### validateId()

```js
const id = controller.validateId(id)
```

Coerces an id to the types of the model's id properties. Throws a
[`ValidationError`](./errors.md#validationerror) for invalid ids. Returns `Id |
Id[]`.

### Internal members

`idValidator` is internal, and not part of the types.

## ModelController

```js
import { ModelController } from '@ditojs/server'

export class Books extends ModelController {
  modelClass = Book
  graph = true
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
  relations = {
    author: { relation: { allow: ['get'] } }
  }
}
```

Extends [`CollectionController`](#collectioncontroller).

### Instance fields

| Field       | Type                        | Description |
| ----------- | --------------------------- | ------------------------------------------ |
| `modelClass` | `typeof Model`             | Default: `resolveModelClass()`. |
| `assets`    | `boolean \| object`         | See [Assets](#assets). |
| `relations` | `object`                    | Relation routes by relation name, see [`RelationController`](#relationcontroller). After setup, each entry is its `RelationController`. |

### resolveModelClass()

```js
const modelClass = controller.resolveModelClass()
```

Called when no `modelClass` is set. Looks up the singularized, camel-cased
controller name with `app.getModel()` (`Books` → `Book` or `BookModel`). Without
a result, `configure()` throws a
[`ControllerError`](./errors.md#controllererror). *Hook.* Returns `Class<Model>
| null`.

### Internal members

`setupRelations()` and `setupRelation()` are internal, and not part of the
types.

## RelationController

Created by `ModelController` for each entry of `relations`, at
`<url>/:id/<relation path>`. A relation object takes:

| Key          | Description |
| ------------ | ------------------------------------------------------- |
| `relation`   | The collection actions of the relation (the related models). |
| `member`     | The member actions, at `<relation url>/:id1`. Not routed for one-to-one relations. |
| `hooks`      | Hooks of the relation's actions. |
| `path`, `graph`, `transacted`, `scope`, `allowParam`, `allowScope`, `allowFilter`, `authorize`, `assets` | As on controllers; `graph`, `transacted` and graph scopes default to the parent's. |

For relations without `owner: true`, `relate` and `unrelate` are set:
`post` relates existing models by id (including extra columns of join tables)
and `delete` unrelates. Set them on the relation object to override this.

Requests are also authorized for the parent member: reading a relation
requires the parent's `get` member authorization, changing it also its `patch`
authorization, unless the relation sets `authorize` for the action: on the
action, its actions object, or the relation object. Asset uploads always need
the parent's `patch` authorization. The parent must then be found through its
`member.get`, or the request responds with a 404 error. `'$owner'` and
`'$self'` in the parent check refer to the parent member.

```js
export class Books extends ModelController {
  modelClass = Book
  member = {
    allow: ['get', 'patch'],
    authorize: { get: true, patch: 'editor' }
  }
  relations = {
    // GET /books/:id/chapters needs the book's `get` authorization,
    // POST also its `patch` authorization:
    chapters: {
      relation: { allow: ['get', 'post'] },
      member: { allow: ['get', 'patch', 'delete'] }
    }
  }
}
```

### Instance fields

| Field                | Type                    | Description |
| -------------------- | ----------------------- | ------------------------------ |
| `parent`             | `ModelController`       | The parent controller. |
| `object`             | `object`                | The relation object from `relations`. |
| `relationInstance`   | `objection.Relation`    | The Objection relation. |
| `relationDefinition` | `object`                | The model's relation definition. |

It overrides [`handleAuthorization()`](#handleauthorization),
[`execute()`](#execute) and [`relateAndFetch()`](#relateandfetch).
`getParentColumns()` and `getRelateReferences()` are internal, and not part of
the types.

## UsersController

Extends [`ModelController`](#modelcontroller) for models with
[`UserMixin`](./model.md#usermixin), with these collection actions. They are
inherited actions, see [`allow`](#allow): a subclass that sets
`collection.allow` has to list them too, e.g.
`allow: ['get', 'post login', 'post logout', 'get session', 'get self']`, and
`'post password'` to let users change their password.

| Action               | Response |
| -------------------- | ------------------------------------------------------- |
| `'post login'`       | Logs in the user of [`modelClass.authenticate(ctx)`](./model.md#static-authenticate) and sets `lastLogin`: `{ success, authenticated, user, error }`. A failed login responds with the error's status, by default 401, and emits it as `'error'` on the app. |
| `'post logout'`      | `{ success, authenticated }` |
| `'get session'`      | `{ authenticated, user }` |
| `'get self'`         | The authenticated user through `member.get`, or `null`. |
| `'post password'`    | Changes the password of the authenticated user to `password` in the body, after verifying `currentPassword`: `{ success }`, or 400 if `currentPassword` is wrong. The new password is validated by the user model, e.g. its `minLength`. Needs confirmed access. |
| `'post confirm-access'` | Confirms the access of the authenticated user with `{ password }`, plus `code` for users with TOTP, or with `{ passkey }`, the response of `startAuthentication()` for the options of `'post passkey-login-options'`: `{ success }`, `{ success: false, codeRequired: true }` without a code, or 401 with `'Password is incorrect'`, `'Code is incorrect'` or `'Passkey is incorrect'`. |

Logins and `'post confirm-access'` confirm the access of the session for
[`app.auth.reconfirmAccessAfter`](./application.md#configappauth). Without
it, `'post password'`, `'post passkey-options'`, `'post passkeys'`,
`'delete passkeys/:id'`, `'post totp'`, `'post totp-confirm'` and
`'delete totp'` answer 403 with
`{ message: 'Confirmation required', confirmationRequired: true }`, see
[Confirmed access](../../guide/server/controllers.md#confirmed-access), and so
do `patch` and `put` actions that change the username.
`hasConfirmedAccess(ctx)` does the same for the `authorize` of other actions.
The `patch`, `put` and `post` actions answer 400 for bodies with the `hash`,
and `patch` and `put` also for bodies with the password. With `relate`, `post`
treats users with ids like updates.

With [`PasskeyService`](./service.md#passkeyservice) registered, users log in
with passkeys and manage their own ones through these collection actions,
which aren't routed without it:

| Action                         | Response |
| ------------------------------ | ------------------------------------------------------- |
| `'post passkey-login-options'` | The options of a passkey login for `startAuthentication()` of `@simplewebauthn/browser`, without a username. |
| `'post passkey-login'`         | Logs in with the response of `startAuthentication()` in the body, like `'post login'`: `{ success, authenticated, user, error }`. |
| `'get passkeys'`               | The passkeys of the authenticated user: `[{ id, name, createdAt, lastUsedAt }]`. |
| `'post passkey-options'`       | The options of a new passkey for `startRegistration()`, which excludes the user's passkeys. |
| `'post passkeys'`              | Stores the passkey of the response of `startRegistration()` in the body, named after its provider, e.g. `'1Password'`, or `'Passkey'` for unknown ones: `{ id, name, createdAt, lastUsedAt }`, or 409 for passkeys that are already registered. |
| `'delete passkeys/:id'`        | Deletes a passkey of the authenticated user: `{ success }`, or 404 for other passkeys. |

A subclass that sets `collection.allow` has to list the passkey actions too,
else they aren't routed. The challenges of the options are kept in the
session, and can be answered once within 5 minutes. Failed passkey logins
answer `'Passkey is incorrect'`, and emit the reason as `'error'` on the app.
Passkeys are discoverable and verify the user, e.g. with a fingerprint, so a
passkey login counts as two factors. It only logs in users of the controller's
`modelClass`, through their `sessionScope`, and fires the
[login events](./model.md#login-events).

With [`TotpService`](./service.md#totpservice) registered, users with TOTP enter
a code after their password, and set up and turn off their TOTP through these
collection actions, which aren't routed without it:

| Action                 | Response |
| ---------------------- | ------------------------------------------------------- |
| `'post login-code'`    | Logs in the user of the pending login with `{ code }`, a TOTP code or a backup code, like `'post login'`: `{ success, authenticated, user, error }`. |
| `'get totp'`           | `{ enabled, backupCodes }`, with the number of the remaining backup codes. |
| `'post totp'`          | A new secret, kept in the session until it is confirmed: `{ uri, secret }`, the `otpauth://` URI for the QR code of authenticator apps, and the secret in base32 to enter by hand. 409 if TOTP is already set up. |
| `'post totp-confirm'`  | Stores the secret with `{ code }`, a code of the new secret, and creates 10 backup codes: `{ backupCodes }`, only shown in this response. |
| `'delete totp'`        | Turns TOTP off and deletes the backup codes: `{ success }`. Needs confirmed access. |

For users with TOTP, `'post login'` with the right password doesn't log in, but
responds with status 200 and `{ success: false, codeRequired: true,
authenticated: false, user: null }`, and keeps a pending login in the session,
with a new session id. `'post login-code'` completes it within 5 minutes.
While `TotpService` isn't registered, users with TOTP can't log in with their
password: `'post login'` and `'post confirm-access'` answer like for a wrong
password, and emit the misconfiguration as `'error'` on the app. Wrong codes
answer `'Code is incorrect'` with status 401, also in `'post totp-confirm'`
and `'post confirm-access'`, and missing or expired pending logins and setups
status 400.
Ten wrong codes in a row lock the account for 15 minutes, across pending
logins and sessions: the tenth and all codes during the lock answer
`'Too many attempts'` with status 400. Ten wrong codes in `'post totp-confirm'`
end the setup the same way. Each TOTP code is accepted once, also the one that
confirmed the setup and of concurrent requests, as well as the codes before
and after the current one for clocks that drift. Each backup code is deleted
once used. Passkey logins don't ask for codes. A subclass that sets
`collection.allow` has to list the TOTP actions too, else they aren't routed.

With [`app.auth.passwordReset`](./application.md#configappauth), users who
forgot their password set a new one through a link that the app emails them,
with these collection actions, which aren't routed without it:

| Action                           | Response |
| -------------------------------- | ------------------------------------------------------- |
| `'post password-reset'`          | Emails a link to the user of the username in the body, under the model's `usernameProperty`, through [`sendPasswordReset()`](#sendpasswordreset): `{ success: true }`, also for unknown usernames, or 400 without a username or with one that isn't a string. |
| `'post password-reset-confirm'`  | Sets the password of the link's user to `{ token, password }`, validated by the user model: `{ success }`, or 400 with `'Invalid or expired token'`. Doesn't log in. |

`'post password-reset'` answers with the same response and status whether the
user exists or not, and doesn't wait for the email, but the time it takes can
still differ, as it only signs a link for existing users. See
[Password reset](../../guide/server/controllers.md#password-reset) for the
links and their limits. Only
users of the controller's `modelClass` are found, through their `sessionScope`.
A subclass that sets `collection.allow` has to list the password reset actions
too, else they aren't routed, and only controllers that route
`'post password-reset'` need to override `sendPasswordReset()`. All users
controllers of the app share the one `confirmUrl` of `app.auth.passwordReset`.

Any change of a user's `hash` ends the sessions of the user. Sessions without a
fingerprint of the password, from before fingerprints or from `ctx.login(user)`
with users loaded without `hash`, get one on their next request: a change before
that doesn't end them. The session of the
request that changes the password stays logged in after `'post password'` and
`'post password-reset-confirm'`. Elsewhere, e.g. in other controllers or custom
actions, it ends too, unless the action logs the user in again with
`ctx.login(user)` afterwards.

TOTP is only asked for by `'post login'`. `ctx.login(user)` logs in without
it, by design, e.g. for impersonation or custom login flows. The credentials
of TOTP are stored under the name of the user model class, which also encrypts
their secrets: renaming the class drops them, also when their `userModel` is
updated, and two user model classes on one table each have their own, so TOTP
set up through one isn't asked for by logins through the other.

The controller's [`authorize`](#authorize) doesn't apply to `login`, `logout`,
`session`, `password`, the passkey, TOTP and password reset actions, which
authenticate users, or are only allowed for the authenticated user; `self`
follows it. Its member actions default to `authorize: ['$self']`, and are
routed when listed in `allow` like on other model controllers. In member
routes, `self` stands for the authenticated user, see
[`getMemberId()`](#getmemberid-1), e.g. `PATCH /users/self` runs
`member.patch` on them.

```js
import { UsersController } from '@ditojs/server'

export class Users extends UsersController {
  modelClass = User
  member = { allow: ['get', 'patch'] } // `$self` only
}
```

### isAuthenticated()

```js
const isAuthenticated = controller.isAuthenticated(ctx)
```

Returns whether the request is authenticated with a user of `modelClass`.

### sendPasswordReset()

```js
export class Users extends UsersController {
  modelClass = User

  // @override
  async sendPasswordReset(ctx, user, url) {
    await this.app.services.mailer.send({
      to: user.email,
      subject: 'Reset your password',
      text: `Set a new password within the next hour: ${url}`
    })
  }
}
```

Sends `user` the email with `url`, the `confirmUrl` of
[`app.auth.passwordReset`](./application.md#configappauth) with the token, for
`'post password-reset'`. Controllers that route it override it, else the setup
fails. It may be asynchronous. The answer doesn't wait for it, so its errors,
also synchronous ones, are only emitted as `'error'` on the app.

### getPasswordResetTokenValues()

```js
const values = controller.getPasswordResetTokenValues(user)
```

Returns the values of `user` that the links of its password resets depend on,
by default its `hash`, `lastLogin` and username, so that a login, a password
change or a username change invalidates them. Overrides add further values,
e.g. the `email`, see
[Confirmed access](../../guide/server/controllers.md#confirmed-access). Dates
count as ISO strings, missing values as `null`.

### getMemberId()

```js
const id = controller.getMemberId(ctx)
```

Returns the id of the authenticated user where the route parameter is `self`,
and responds with 401 without a login, otherwise the validated id like
[`CollectionController#getMemberId()`](#getmemberid). So `self` works in all
member routes and in the routes of relations, e.g. `/users/self/notes`, which
grants nothing beyond the user's own id. A user with the id `'self'` can't be
addressed by id.

## AdminController

```js
import { AdminController } from '@ditojs/server'

export class Admin extends AdminController {
  authorize = ['editor', 'sales', 'admin']
}
```

Serves Dito.js Admin at its `url`: in `development` mode through a Vite dev
server with hot reloading over the app's server, in `production` mode the
pre-built files in `config.admin.dist`. `authorize` protects the requests of
views (URLs containing `/views`). Configured through
[`config.admin`](./application.md#configadmin).

### Instance fields

| Field      | Type                           | Description |
| ---------- | ------------------------------ | ------------------------------------- |
| `config`   | `AdminConfig`                  | The application's `config.admin`. |
| `mode`     | `'development' \| 'production'` | `config.admin.mode`, else `'development'` when the app's `config.env` is `'development'`, else `'production'`. |
| `isClosed` | `boolean`                      | `true` once the dev server is closing; requests then respond with 408. |
| `koa`      | `Koa`                          | The composed Koa application. |

### getGlobalConfig()

```js
const { base, api, settings } = controller.getGlobalConfig()
```

Returns the configuration that the admin receives in the browser as
`window.dito`: `base` (the controller's `url`), `api` (`config.admin.api` with
`normalizePaths` defaulting to `config.app.normalizePaths`) and `settings`
(`config.admin.settings`). *Hook.* Returns `{ base: string, api: ApiConfig,
settings: object }`.

### sendGlobalConfig()

```js
controller.sendGlobalConfig(ctx)
```

Responds with `window.dito = <getGlobalConfig()>` as JavaScript. Served at
`<url>/dito.js`, which the generated `index.html` loads before the admin.

### resolveConfigPath()

```js
const root = controller.resolveConfigPath(name)
```

Resolves `config.admin[name]`, e.g. `'root'` or `'dist'`, to an absolute path.
Throws a [`ControllerError`](./errors.md#controllererror) if it isn't
configured. Returns `string`.

### defineViteConfig()

```js
const viteConfig = await controller.defineViteConfig(config?)
```

Returns the Vite configuration for building and serving the admin, deeply merged
with `config`. Throws without `config.admin.root`.
[`app.defineAdminViteConfig()`](./application.md#defineadminviteconfig) calls
it, e.g. in an `admin.vite.config.js` in the app's `basePath`. Returns
`Promise<UserConfig>`.

### middleware()

```js
const middleware = controller.middleware()
```

Returns the Koa middleware that serves `dito.js` and authorizes view requests.
Returns `Koa.Middleware`.

### setupViteServer()

```js
await controller.setupViteServer()
```

Creates the Vite dev server, on `'after:start'` in development mode, and closes
it on `'before:stop'`. Returns `Promise<void>`.

## HttpMethod

```ts
type HttpMethod =
  | 'get' | 'head' | 'post' | 'put' | 'delete'
  | 'patch' | 'options' | 'trace' | 'connect'
```

The methods of action names and routes, lowercase. At runtime, every method
that Node.js supports is accepted.

`HTTPMethod` is a deprecated alias of `HttpMethod`.
