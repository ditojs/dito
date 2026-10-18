# `class` Application

```js
import { Application } from '@ditojs/server'
```

`Application` extends [Koa](https://koajs.com/) and is the root of a Dito.js
server: it holds the configuration, the Knex instance, and the registries of
storages, services, models and controllers, sets up the middleware, and starts
and stops the HTTP server.

Its event methods are Dito.js' asynchronous event emitter, see
[Event methods](#event-methods).

## Constructor

```js
const app = new Application({
  basePath,
  config,
  validator,
  router,
  events,
  middleware,
  services,
  models,
  controllers
})
```

Creates the application, sets up the logger, Knex and the middleware, and adds
the storages from `config.storages` and the passed services, models and
controllers. Nothing is initialized until [`setup()`](#setup) or
[`start()`](#start) is called. All options are optional.

#### Parameters

| Name          | Type                                       | Description                                                                                                                                                                     |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basePath`    | `string`                                   | The project directory: disk storage paths are resolved against it, [`db:seed`](#dbseed) and [`db:create_migration`](#dbcreate_migration) use its `seeds` and `migrations` folders, and [`loadAdminViteConfig()`](#loadadminviteconfig) looks for `admin.vite.config.*` in it. Default: `process.cwd()`. |
| `config`      | [`ApplicationConfig`](#applicationconfig)  | The configuration.                                                                                                                                                              |
| `validator`   | [`Validator`](validator.md)                | A custom validator. Default: `new Validator()`.                                                                                                                                 |
| `router`      | `object`                                   | A custom router. The app calls its `add(method, path, route)` with the upper-case method and a route object, and `find(method, path)`, which returns `{ status, handler, params, allowed }` with the route object as `handler`. Default: a `@ditojs/router` instance. |
| `events`      | `Record<string, Function \| Function[]>`   | Event listeners, keyed by event name. Several comma-separated names may share one key. See [Events](#events).                                                                   |
| `middleware`  | `Koa.Middleware`                           | Application-level middleware, installed after the route lookup and before the body parser, transactions, session and user handling. Combine several with [koa-compose](https://github.com/koajs/compose). |
| `services`    | `Record<string, Service \| Class<Service>>` | Services to add, see [`addServices()`](#addservices).                                                                                                                          |
| `models`      | `Record<string, Class<Model>>`             | Models to add, see [`addModels()`](#addmodels).                                                                                                                                 |
| `controllers` | `ApplicationControllers`                   | Controllers to add, see [`addControllers()`](#addcontrollers).                                                                                                                  |

#### Example

```js
// src/server/app.js
const app = new Application({ config, models, controllers, services })
export default app
```

See [Application](../../guide/server/application.md) for the whole file.

## ApplicationConfig

The `config` object passed to the constructor, see
[Configuration](../../guide/server/configuration.md). Extend it through module
augmentation of `ApplicationConfig` for project-specific settings.

| Key                       | Type                                             | Default         | Description                                                                                                                              |
| ------------------------- | ------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `env`                     | `'production' \| 'development' \| string`        |                 | The environment. The admin's `mode` defaults to `'development'` when this is `'development'`, else to `'production'`.                     |
| `server`                  | `object`                                         |                 | Options for Node's `server.listen()`, e.g. `{ host, port }`.                                                                             |
| `log`                     | `object \| false`                                | `{}`            | Logging options, see [`config.log`](#configlog). `false`, `log.silent` or the env variable `DITO_SILENT` clear all of them, which also hides the start message. Errors emitted on the app are still logged then. |
| `logger`                  | `object`                                         | see below       | [Pino](https://getpino.io/) options, plus `prettyPrint` with [pino-pretty](https://github.com/pinojs/pino-pretty) options. Default level `'info'`, pretty printing on. |
| `app`                     | `object`                                         |                 | Koa and middleware options, see [`config.app`](#configapp).                                                                             |
| `admin`                   | `AdminConfig`                                    |                 | The settings of `AdminController`, see [`config.admin`](#configadmin).                                                                  |
| `knex`                    | `object`                                         |                 | The [Knex configuration](https://knexjs.org/guide/#configuration-options), plus `normalizeDbNames` and `typeParsers`. Knex is only set up when `knex.client` is set. |
| `knex.normalizeDbNames`   | `boolean \| object`                              | `false`         | Maps camelCase property names to snake_case columns through Objection's `knexSnakeCaseMappers()`; an object passes options to it.         |
| `knex.typeParsers`        | `Record<number, (value) => any>`                 |                 | PostgreSQL type parsers by type OID, applied when `knex.client` is `'postgresql'`. Parsers for `numeric` (1700) and `int8` (20) also install the matching array parsers. |
| `storages`                | `Record<string, StorageConfig>`                  |                 | Storage configurations by name, see [Storage](storage.md).                                                                              |
| `services`                | `Record<string, object \| boolean>`              |                 | Service configurations by service name. `true` uses the defaults of the service, `false` removes it. Each added service needs an entry.  |
| `assets.deleteUnusedAfter`  | `string \| number \| false`                 | `'24h'`         | Minimum age of unused assets without changes before they are deleted, at the next run of [`deleteExpiredRecords()`](#deleteexpiredrecords). `false` keeps them. Strings are parsed by [parse-duration](https://www.npmjs.com/package/parse-duration). |
| `assets.deleteUnsavedAfter` | `string \| number \| false`                 | `'24h'`         | Minimum age of uploaded but never saved assets before they are deleted, like `deleteUnusedAfter`. Must not be `0`. |

### config.log

| Key        | Type                                               | Default | Description                                                                              |
| ---------- | -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `requests` | `boolean \| 'console' \| 'file'`                   | `false` | Logs responses at level `info` (`warn` on errors), and requests at level `trace`. `'console'` and `'file'` act like `true`. |
| `routes`   | `boolean`                                          | `false` | Logs the routes of the controllers when they are set up.                                 |
| `schema`   | `boolean \| string \| string[]`                    | `false` | Logs the JSON schemas of all models (`true`), or of the named models.                    |
| `relations`| `boolean \| string \| string[]`                    | `false` | Logs the relation mappings of all models (`true`), or of the named models.               |
| `sql`      | `boolean`                                          | `false` | Logs SQL queries with bindings and durations.                                            |
| `silent`   | `boolean`                                          | `false` | Clears all `log` options, like `log: false`.                                             |
| `errors`   | `boolean \| { sql?, stack?, json? }`               | `true`  | `false` stops logging the errors emitted on the app. `sql`: keep the SQL query in database errors. `stack: false`: omit stack traces. `json`: keep the invalid data in validation errors. |

### config.app

| Key              | Type                                             | Default | Description                                                                                                  |
| ---------------- | ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| `name`           | `string`                                         |         | The name of the app, shown by passkey managers and authenticator apps. Required by [`PasskeyService`](service.md#passkeyservice) and [`TotpService`](service.md#totpservice). |
| `normalizePaths` | `boolean`                                        | `false` | Hyphenates camelCase route paths (`relatedBooks` → `related-books`). Passed on to the admin.                 |
| `proxy`          | `boolean`                                        | `false` | Trusts proxy header fields (Koa's `app.proxy`).                                                              |
| `keys`           | `string[]`                                       |         | Signed cookie keys (Koa's `app.keys`), which also sign the links of `authentication.passwordReset`: the first key signs, all keys verify, so keys can rotate. Removed from `app.config`. |
| `responseTime`   | `boolean \| object`                              | `true`  | Adds the `X-Response-Time` header, options of koa-response-time.                                             |
| `helmet`         | `boolean \| object`                              | `true`  | Security headers, options of [helmet](https://helmetjs.github.io/).                                          |
| `cors`           | `boolean \| object`                              | `true`  | CORS, options of [@koa/cors](https://github.com/koajs/cors#corsoptions).                                     |
| `compress`       | `boolean \| object`                              | `true`  | Response compression, options of [koa-compress](https://github.com/koajs/compress#options). Brotli quality defaults to 4. |
| `etag`           | `boolean`                                        | `true`  | Conditional GET and ETag headers.                                                                            |
| `bodyParser`     | `object`                                         |         | Options of [koa-bodyparser](https://github.com/koajs/bodyparser#options).                                    |
| `deleteExpiredRecordsEvery` | `string \| number \| false`          | `'1h'`  | How often [`deleteExpiredRecords()`](#deleteexpiredrecords) runs, only in apps that call [`start()`](#start), first one interval after it, at most 24 days (Node's timers can't wait longer). `false` never runs it. Apps that don't start the server, e.g. with their own HTTP server through `app.callback()` or in short-lived processes, call `deleteExpiredRecords()` themselves or run [`db:delete_expired_records`](#commands) on a schedule. |
| `session`        | `boolean \| object`                              | `false` | Sessions through [koa-session](https://github.com/koajs/session), with `sameSite: 'lax'` as the default for the cookie: admins on another site than the server need `'none'`, which requires `secure`, and behind a TLS proxy also `app.proxy: true`. `modelClass` (a name or a model class) stores them in a model, e.g. one using [`SessionMixin`](model.md#sessionmixin). `autoCommit` (default `true`) commits the session after each request, on transacted routes only when the request succeeds. |
| `passport`       | `boolean`                                        |         | Deprecated, without effect: users are always handled, see [`UserMixin`](model.md#usermixin). |
| `authentication` | `object`                                       |         | Authentication beyond passwords, see [`config.app.authentication`](#configappauthentication).                |

### config.app.authentication

```js
app: {
  session: { modelClass: 'Session' },
  authentication: {
    credentials: { modelClass: 'Credential' },
    passwordReset: {
      confirmUrl: 'https://example.com/admin/#password-reset={token}'
    }
  }
}
```

| Key                      | Type                       | Description                                                                                      |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `credentials.modelClass` | `string \| Class<Model>`   | The model that stores the credentials of all user models, using [`CredentialMixin`](model.md#credentialmixin). Needed by [`PasskeyService`](service.md#passkeyservice) and [`TotpService`](service.md#totpservice). |
| `passwordReset`          | `object`                   | Enables password resets by email in [`UsersController`](controllers.md#userscontroller), which sends the emails through [`sendPasswordReset()`](controllers.md#sendpasswordreset). Needs `keys`, else the setup fails. |
| `passwordReset.confirmUrl` | `string`                 | The URL of the page that the emails link to, with a `{token}` placeholder for the token, best in the fragment, e.g. `'https://example.com/admin/#password-reset={token}'` for the admin's [password reset](../admin/admin.md#globalconfig). One URL for the whole app: all users controllers send links to it. |
| `passwordReset.expiresAfter` | `number \| string`     | How long the links are valid, in milliseconds or as a duration string, e.g. `'30m'`. Default `'1h'`. |
| `reconfirmAccessAfter`   | `number \| string`         | How long logins and `'post confirm-access'` confirm the access for the security changes of [`UsersController`](controllers.md#userscontroller), in milliseconds or as a duration string. Default `'10m'`. |

### config.admin

| Key        | Type                            | Default                                       | Description                                                                         |
| ---------- | ------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `root`     | `string`                        |                                               | Path to the admin's source directory, relative to the working directory. Required in development mode and by `defineAdminViteConfig()`. |
| `dist`     | `string`                        |                                               | Path to the built admin, relative to the working directory. Required in production mode. |
| `mode`     | `'production' \| 'development'` | `'development'` if `env` is, else `'production'` | Development serves the sources through Vite with hot reloading.                 |
| `api`      | `ApiConfig`                     |                                               | The admin's API settings (`url`, `locale`, `formats`, `notifications`, `timeout`, `cors`, `normalizePaths`, `users`, `headers`), passed to the browser. `normalizePaths` defaults to `app.normalizePaths`. |
| `settings` | `object`                        |                                               | The admin's global settings, sent to the browser with `window.dito` and read there as `admin.context.settings`, e.g. `rootClass` and `forceDragFallback`. |

The admin settings are read by
[`AdminController`](controllers.md#admincontroller). A complete example is in
[Configuration](../../guide/server/configuration.md#example).

## Properties

| Name             | Type                                     | Description                                                                                         |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `basePath`       | `string`                                 | The project directory, see the [constructor](#constructor).                                         |
| `config`         | `ApplicationConfig`                      | The configuration, with the defaults of `logger` and `assets` merged in and `app.keys` removed.     |
| `knex`           | `Knex`                                   | The Knex instance.                                                                                  |
| `server`         | `http.Server \| null`                    | The HTTP server while running.                                                                      |
| `isRunning`      | `boolean`                                | Whether the server is running.                                                                      |
| `validator`      | [`Validator`](validator.md)              | The shared validator of all models and actions.                                                     |
| `router`         | `object`                                 | The router that holds the routes of the controllers.                                                |
| `storages`       | `Record<string, Storage>`                | Storages by name. Augment `ApplicationStorages` for typed access.                                    |
| `services`       | `Record<string, Service>`                | Services by name. Augment `ApplicationServices` for typed access.                                    |
| `models`         | `Record<string, Class<Model>>`           | Model classes by class name.                                                                        |
| `controllers`    | `Record<string, Controller>`             | Controllers by URL.                                                                                 |
| `logger`         | `pino.Logger`                            | The logger of the current request (with its request id) inside a request, else the app's logger.   |
| `requestStorage` | `AsyncLocalStorage`                      | The async local storage that carries the request locals through each request.                        |
| `requestLocals`  | `{ transaction?, logger?, session? }`    | The locals of the current request: its transaction (on transacted routes), logger and session. `{}` outside of requests. |

#### Example

```js
// Somewhere deep in a service, run a query in the transaction of the request:
const { transaction } = this.app.requestLocals
await Book.query(transaction).patch({ isAvailable: false }).where('id', id)
```

## Lifecycle

### setup()

```js
await app.setup()
```

Initializes everything added and not yet initialized, in this order: storages,
services, models, controllers. Can be called repeatedly; only new entries are
initialized. Called by [`start()`](#start). Returns `Promise<void>`.

### start()

```js
await app.start()
```

Calls [`setup()`](#setup), emits `'before:start'` (which starts the services),
listens on `config.server`, sets `isRunning`, starts the timer of
[`deleteExpiredRecords()`](#deleteexpiredrecords) and emits `'after:start'`.
Returns `Promise<void>`.

### stop()

```js
await app.stop(timeout)
```

Stops the timer of [`deleteExpiredRecords()`](#deleteexpiredrecords), emits
`'before:stop'`, clears `isRunning`, closes the server, and emits
`'after:stop'` (which stops the services). Rejects if the server isn't
running.

#### Parameters

| Name      | Type     | Description                                                     |
| --------- | -------- | --------------------------------------------------------------- |
| `timeout` | `number` | Milliseconds after which stopping rejects. `0` (default): none. |

Returns `Promise<void>`.

### execute()

```js
await app.execute()
```

Calls [`start()`](#start), and on failure logs the error and exits the process
with code `-1`. Returns `Promise<void>`.

### deleteExpiredRecords()

```js
await app.deleteExpiredRecords()
```

Calls [`deleteExpiredRecords()`](model.md#static-deleteexpiredrecords) on every
model, each on its own, so that one failing doesn't stop the others. Their
errors are emitted as `'error'` events. Runs every
`config.app.deleteExpiredRecordsEvery` while the server is started, and can be
called directly, e.g. from a script. Returns `Promise<void>`. *Hook.*

## Events

Listen through the `events` constructor option, or `app.on()`. Listeners may
be async; `emit()` awaits them.

| Event            | Arguments | Emitted                                                     |
| ---------------- | --------- | ----------------------------------------------------------- |
| `'before:start'` |           | In `start()`, after `setup()`, before the server listens.   |
| `'after:start'`  |           | In `start()`, once the server listens.                      |
| `'before:stop'`  |           | In `stop()`, before the server closes.                      |
| `'after:stop'`   |           | In `stop()`, once the server is closed.                     |
| `'error'`        | `error, ctx?` | On errors: failed requests (with their `ctx`; errors thrown in controller actions arrive wrapped in a `ResponseError`), failed logins, failed asset removals, and uploaded images whose size can't be read (with a message string as `error`). |

```js
const app = new Application({
  config,
  events: {
    'after:start'() {
      this.logger.info('Bookshop server is up')
    },
    'before:stop, after:stop'() {
      // One listener for several events.
    }
  }
})
```

## Event methods

The same asynchronous emitter, based on
[EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) with `:` as
delimiter, is mixed into applications, controllers and model classes. Besides
the methods below, EventEmitter2's other methods are available, e.g.
`listenerCount()` and `waitFor()`.

### on()

```js
app.on(event, listener)
app.on([event, …], listener)
app.on({ [event]: listener })
```

Adds a listener to one event, to several events, or listeners by event name.
Returns the emitter.

### off()

```js
app.off(event, listener)
app.off([event, …], listener)
app.off({ [event]: listener })
```

Removes listeners, with the same arguments as `on()`.

### once()

```js
app.once(event, listener)
```

Adds a listener that is removed after its first call, with the same arguments
as `on()`.

### emit()

```js
const results = await app.emit(event, ...args)
```

Calls the listeners of `event` with `args`, awaits them, and resolves to their
return values. Events of your own work too:

```js
app.on('order:placed', async order => {
  await app.services.mail.sendConfirmation(order)
})
await app.emit('order:placed', order)
```

Returns `Promise<any[]>`.

## Storages

### addStorage()

```js
app.addStorage(config, name)
app.addStorage(storage, name?)
```

Adds a storage from its configuration, created by the storage class registered
for `config.type` as `new StorageClass(app, name, config)`, or adds a storage
instance, renamed to `name` when given. Throws for unknown types and storages
without a name. Values that are neither are ignored, returning `null`.

#### Parameters

| Name      | Type                       | Description                                      |
| --------- | -------------------------- | ------------------------------------------------ |
| `config`  | `StorageConfig \| Storage` | A configuration (`{ type: 'disk' \| 's3', … }`) or an instance. |
| `name`    | `string`                   | The storage's name.                              |

Returns [`Storage`](storage.md) `| null`.

### addStorages()

```js
app.addStorages({ [name]: config })
```

Adds several storages under their keys, see [`addStorage()`](#addstorage).
Called by the constructor with `config.storages`.

### setupStorages()

```js
await app.setupStorages()
```

Calls `await storage.setup()` and `await storage.initialize()` on all storages
not yet initialized, and sets their `isInitialized`.

### getStorage()

```js
const storage = app.getStorage(name)
```

Returns the storage registered under `name`. Returns [`Storage`](storage.md) `|
null`.

## Services

### addService()

```js
app.addService(service, name?)
```

Adds a service under its `name`. A class is instantiated as
`new ServiceClass(app, name)`; without `name`, the service names itself from
its class name (`MailService` → `mail`). An instance keeps the name it was
created with, `name` is ignored. Throws for anything else.

#### Parameters

| Name      | Type                         | Description                     |
| --------- | ---------------------------- | ------------------------------- |
| `service` | `Service \| Class<Service>`  | The service class or instance.  |
| `name`    | `string`                     | The name of a service class.    |

### addServices()

```js
app.addServices({ [name]: service })
```

Adds several services, see [`addService()`](#addservice). Classes are named by
their keys.

```js
app.addServices({ mail: MailService })
```

### setupServices()

```js
await app.setupServices()
```

For each service not yet initialized: throws if `config.services` has no entry
for it, removes it if the entry is `false`, else calls
`service.configure(config)`, registers `start()` / `stop()` for
`'before:start'` / `'after:stop'`, awaits `service.initialize()` and sets its
`isInitialized`. See [Service](service.md).

### getService()

```js
const service = app.getService(name)
```

Returns the service registered under `name`. Returns [`Service`](service.md) `|
null`.

### findService()

```js
const service = app.findService(service => service instanceof MailService)
```

Returns the first service the callback returns truthy for. Returns
[`Service`](service.md) `| null`.

## Models

### addModel()

```js
app.addModel(modelClass)
```

Adds a model class, see [`addModels()`](#addmodels).

### addModels()

```js
app.addModels({ Book, Author })
```

Adds model classes under their class names, calls each one's
[`configure(app)`](model.md#static-configure), then adds their JSON schemas to
the validator, so that the foreign keys of relations are included regardless of
the order of the models. Logs schemas and relations as set in
[`config.log`](#configlog). Throws for values that aren't model classes.

#### Parameters

| Name     | Type                                            | Description                     |
| -------- | ----------------------------------------------- | ------------------------------- |
| `models` | `Record<string, Class<Model>> \| Class<Model>[]` | The model classes, e.g. a module namespace. |

### setupModels()

```js
await app.setupModels()
```

For each model not yet initialized, calls [`setup()`](model.md#static-setup),
awaits [`initialize()`](model.md#static-initialize) and sets
`isInitialized`.

### getModel()

```js
const Book = app.getModel('Book')
```

Returns a model class by name, also trying `${name}Model` when the name doesn't
end in `Model`. Returns `Class<Model> | null`.

### findModel()

```js
const modelClass = app.findModel(modelClass => Book.isPrototypeOf(modelClass))
```

Returns the first model class the callback returns truthy for. Returns
`Class<Model> | null`.

## Controllers

### addController()

```js
app.addController(controller, namespace?)
```

Adds a controller. A class is instantiated as
`new ControllerClass(app, namespace)`; then its `configure()` is called and it
is registered under its `url`. See [Controllers](controllers.md).

#### Parameters

| Name         | Type                              | Description                                   |
| ------------ | --------------------------------- | --------------------------------------------- |
| `controller` | `Controller \| Class<Controller>` | The controller class or instance.             |
| `namespace`  | `string`                          | Path namespace, e.g. `'admin'`.               |

### addControllers()

```js
app.addControllers(controllers, namespace?)
```

Adds controllers. Nested objects and modules add their controllers with their
key appended to the namespace. The keys of the controllers themselves aren't
used: each controller takes its URL from its `path`, or from its class name
(`BooksController` → `Books`, or `books` with `app.normalizePaths`).

```js
// With `app.normalizePaths: true`:
app.addControllers(
  {
    books: BooksController, // /api/books
    admin: { users: UsersController } // /api/admin/users
  },
  'api'
)
```

### setupControllers()

```js
await app.setupControllers()
```

For each controller not yet initialized, calls `setup()`, awaits
`initialize()`, mounts what `compose()` returns at its URL, and sets
`isInitialized`.

### getController()

```js
const controller = app.getController('/api/books')
```

Returns the controller registered under the URL. Returns
[`Controller`](controllers.md) `| null`.

### findController()

```js
const controller = app.findController(it => it.modelClass === Book)
```

Returns the first controller the callback returns truthy for. Returns
[`Controller`](controllers.md) `| null`.

### getAdminController()

```js
const admin = app.getAdminController()
```

Returns the first registered
[`AdminController`](controllers.md#admincontroller). Returns `AdminController |
null`.

### defineAdminViteConfig()

```js
// admin.vite.config.js
import app from './src/server/app.js'
export default app.defineAdminViteConfig({ /* Vite config to merge */ })
```

Returns the Vite configuration of the admin, built by the admin controller and
deep-merged with `config`. Throws without `config.admin.root`. Returns
`Promise<UserConfig | null>`: `null` without an admin controller.

### loadAdminViteConfig()

```js
const viteConfig = await app.loadAdminViteConfig()
```

Imports the default export of the first of `admin.vite.config.js`, `.mjs`,
`.cjs` and `.ts` found in `basePath`. The admin controller uses it in
development mode, falling back to `defineAdminViteConfig()`. Returns
`Promise<UserConfig | null>`: `null` when there is no such file.

## Routes

### addRoute()

```js
app.addRoute(method, path, transacted, middlewares, controller?, action?)
```

Adds a route to the router. Controllers call this for their actions. Throws
for unsupported HTTP methods.

#### Parameters

| Name          | Type                         | Description                                                  |
| ------------- | ---------------------------- | ------------------------------------------------------------ |
| `method`      | `HttpMethod`                 | `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, …         |
| `path`        | `string`                     | The route path.                                              |
| `transacted`  | `boolean`                    | Whether requests run in a transaction (`ctx.transaction`).   |
| `middlewares` | `Middleware \| Middleware[]` | The handlers, composed when several.                         |
| `controller`  | `Controller \| null`         | The owning controller, exposed as `ctx.controller`.          |
| `action`      | `object \| null`             | The action, exposed as `ctx.action`.                         |

Matched requests get `ctx.route`, the route object `{ method, path,
transacted, middleware, controller, action }`, and `ctx.params`.

### normalizePath()

```js
app.normalizePath('relatedBooks') // 'related-books' with `app.normalizePaths`
```

Hyphenates a camelCase path when `config.app.normalizePaths` is set, else
returns it unchanged. Returns `string`.

## Database

### normalizeIdentifier()

```js
app.normalizeIdentifier('createdAt') // 'created_at' with `normalizeDbNames`
```

Converts a property name to its column name through Knex's `wrapIdentifier`.
Returns `string`.

### denormalizeIdentifier()

```js
app.denormalizeIdentifier('created_at') // 'createdAt'
```

Converts a column name to its property name through Knex's
`postProcessResponse`. Returns `string`.

## Validation

### compileValidator()

```js
const validate = app.compileValidator(jsonSchema, options?)
```

Compiles a JSON schema with the app's [validator](validator.md). Returns
`ValidateFunction | null`: `null` without a schema.

### compileParametersValidator()

```js
const { list, schema, asObject, dataName, validate } =
  app.compileParametersValidator(parameters, options?)
```

Compiles action parameters, given as an object of schemas by name (the action
receives one object) or an array of schemas with `name` (the action receives
separate arguments). Types are coerced, arrays included. Returns
`CompiledParametersValidator`: `{ list, schema, asObject, dataName, validate,
hasModelRefs }`.

### createValidationError()

```js
throw app.createValidationError({ type, message, errors, options, json })
```

Creates a [`ValidationError`](errors.md) from Ajv errors. `json` is only kept
with `log.errors.json`. *Hook.* Returns [`ValidationError`](errors.md).

### createDatabaseError()

```js
const error = app.createDatabaseError(dbError)
```

Wraps an Objection `DBError` in a [`DatabaseError`](errors.md), moving the SQL
query out of the message (kept with `log.errors.sql`). *Hook.* Returns
[`DatabaseError`](errors.md).

## Errors and logging

### logError()

```js
app.logError(error, ctx?)
```

Logs an error, unless its `expose` flag or Koa's `app.silent` is set:
`ResponseError`s with a status below 500 at level `info`, others at `error`,
through the request's logger if `ctx` is given. The app calls it for its
`'error'` events, unless `log.errors` is `false`. *Hook.*

### formatError()

```js
const formatted = app.formatError(error)
```

Prepares an error for logging: drops CORS headers, and the stack and cause with
`log.errors.stack === false`; formats it with `util.inspect()` when pretty
printing. *Hook.* Returns `unknown`: the error copy, or a string when pretty
printing.

## Assets

These methods do nothing and return `[]` unless a model named `Asset` or
`AssetModel` is registered, see [`AssetMixin`](model.md#assetmixin). Models
with [`static assets`](model.md#static-assets) call them from their hooks, and
controllers call `createAssets()` for uploads.

### releaseUnusedAssets()

```js
const released = await app.releaseUnusedAssets({
  olderThan,
  transaction,
  concurrency
})
```

Removes the files and records of assets that are no longer referenced
(`count` 0) and unchanged for `assets.deleteUnusedAfter`, or never saved for
`assets.deleteUnsavedAfter`. Assets that data still references despite their
count are kept and get their count corrected, with a warning. The asset model
calls it from [`deleteExpiredRecords()`](#deleteexpiredrecords).

#### Parameters

| Name            | Type                  | Description                                           |
| --------------- | --------------------- | ----------------------------------------------------- |
| `olderThan`     | `string \| number \| false` | Overrides `deleteUnusedAfter` and `deleteUnsavedAfter`. `false` keeps the assets. Invalid durations throw. |
| `transaction`   | `Transaction`         | Transaction to run in.                                |
| `concurrency`   | `number`              | Concurrent file removals. Default `8`.                |

Returns `Promise<Model[]>`: the released asset records. Files that failed to be
removed carry the `error`, which is also emitted as `'error'`.

### getAssetReferences()

```js
const references = await app.getAssetReferences({
  models,
  storage,
  keys,
  transaction
})
```

Finds every place in the data that stores an asset file, one reference for each
occurrence, as the reference counts count them.

#### Parameters

| Name          | Type          | Description                                     |
| ------------- | ------------- | ----------------------------------------------- |
| `models`      | `string[]`    | Names of the models to search. Default: all.    |
| `storage`     | `string`      | Only find files of this storage.                |
| `keys`        | `string[]`    | Only find files with these keys.                |
| `transaction` | `Transaction` | Transaction to run in.                          |

Returns `Promise<object[]>`: a reference for each occurrence, with the file's
`key`, the `file` itself, the `model` name, the record's `id`, the `dataPath` of
the file inside the record, e.g. `'photos/1'`, the `storage` name, and the
`config` of the model's asset data path that the file was found through, e.g.
`{ storage: 'photos', readDimensions: true }`.

### recountAssets()

```js
const { changed, missing, lost } = await app.recountAssets({
  dryRun,
  transaction
})
```

Sets the count of every asset to the number of its references, as
[`getAssetReferences()`](#getassetreferences) finds them, and creates the
missing assets of referenced files that their storage still has, as files
without assets can't be stored in other places, and throws for storages that
can't list their keys. It locks the assets while counting, unless it runs as a
dry run. Counts drift when writes skip the model hooks, e.g. deletes through
database cascades, scripts and seeds. The [`db:recount_assets`](#commands)
command runs it.

#### Parameters

| Name          | Type          | Description                                 |
| ------------- | ------------- | ------------------------------------------- |
| `dryRun`      | `boolean`     | Only return what it would change.           |
| `transaction` | `Transaction` | Transaction to run in.                      |

Returns `Promise<{ changed, missing, lost }>`: `changed` holds `{ asset, count }` for
each asset whose count differs, with the asset as it was and the counted
`count`, `missing` holds `{ key, references }` for each referenced file without
an asset, and `lost` the same for referenced files that their storage doesn't
have anymore, which it only reports.

### createAssets()

```js
await app.createAssets(storage, files, count = 0, transaction?)
```

Inserts asset records for files, with the reference count `count`. Returns
`Promise<Model[]>`.

### handleAddedAndRemovedAssets()

```js
await app.handleAddedAndRemovedAssets(
  storage,
  addedFiles,
  removedFiles,
  changedFiles,
  transaction?
)
```

Imports foreign files among the added and changed ones, and adjusts the
reference counts. Returns `Promise<AssetFile[]>`: the imported files. Each
occurrence of a file in `addedFiles` and `removedFiles` adds or removes one
reference. Throws an `AssetError` when an added file's asset was released in the
meantime.

### addForeignAssets()

```js
await app.addForeignAssets(storage, files, transaction?)
```

Imports files without asset records from their `data`, or their `url` if the
storage's `allowedImports` allow it (`file://` and HTTP URLs), and creates their
records. Files of assets in another storage are copied to `storage` under a new
key. Returns `Promise<AssetFile[]>`: the imported and copied files.

### handleModifiedAssets()

```js
await app.handleModifiedAssets(storage, files, transaction?)
```

Replaces the stored content of existing assets whose files carry new `data`.
Returns `Promise<AssetFile[]>`: the modified files.

### getAssetConfig()

```js
const config = app.getAssetConfig({ models?, normalizeDbNames? })
```

Returns the [`static assets`](model.md#static-assets) of the models (all by
default) as `{ [modelName]: { [column]: { [dataPath]: assetConfig } } }`, with
the names normalized when `normalizeDbNames` is set (default:
`knex.normalizeDbNames`). Throws for assets on relations. The
[`db:list_asset_config`](#dblist_asset_config) command prints it. Returns
`Record<string, Record<string, Record<string, object>>>`.

## Setup methods

The constructor calls these once. Override them to change what they set up.

### setupLogger()

```js
app.setupLogger()
```

Creates the Pino logger from `config.logger`, pretty printed through pino-pretty
when `prettyPrint` is set. *Hook.*

### setupKnex()

```js
app.setupKnex()
```

Creates the Knex instance from `config.knex` when `knex.client` is set, with the
snake case mappers and type parsers, and SQL logging with `log.sql`. *Hook.*

### setupMiddleware()

```js
app.setupMiddleware(middleware?)
```

Installs the middleware: logger, response time, request logging, error handling,
context extensions, helmet, CORS, compression, ETag, request storage, route
lookup, the passed `middleware`, body parser, transactions, session, the user
handling, and the route handler. Middleware added later through
Koa's `app.use()` sees the requests that the route handler passes on, e.g. those
without a route. *Hook.*

## Internal members

`fixModuleClassNames()`, `logModels()` and `setupKnexLogging()` are internal
helpers of the methods above, and not part of the types.

## CLI

`@ditojs/server` installs the `dito` command for database tasks and an
interactive console:

```sh
dito <command> <module> [...args]
```

`<module>` is the path of a module whose default export the command works
on: an [`Application`](#class-application), or a configuration object with a
`knex` entry, from which the command creates a Knex instance. The default
export may also be a function that returns either, or a promise of it. The
module is imported with logging silenced.

The `db:migrate`, `db:rollback`, `db:reset` and `db:unlock` commands need a
configuration, as they work on the Knex instance; the others need the
application. Projects usually wrap them in `package.json` scripts:

```json
{
  "scripts": {
    "console": "dito console ./src/server/app.js",
    "db:migrate": "dito db:migrate ./config/index.js",
    "db:rollback": "dito db:rollback ./config/index.js",
    "db:reset": "dito db:reset ./config/index.js",
    "db:unlock": "dito db:unlock ./config/index.js",
    "db:seed": "dito db:seed ./src/server/app.js",
    "db:create_migration": "dito db:create_migration ./src/server/app.js",
    "db:list_asset_config": "dito db:list_asset_config ./src/server/app.js",
    "db:recount_assets": "dito db:recount_assets ./src/server/app.js",
    "db:delete_expired_records": "dito db:delete_expired_records ./src/server/app.js"
  }
}
```

Command names are camelized, so `db:create_migration`, `db:create-migration`
and `db:createMigration` are the same command. The process exits with `0`
when the command succeeds, and `1` with the error printed otherwise.

### Commands

| Command                | Module        | Description |
| ---------------------- | ------------- | ----------- |
| `db:migrate`           | configuration | Runs all pending migrations, as Knex's `migrate.latest()`. |
| `db:rollback`          | configuration | Rolls back the last batch of migrations. |
| `db:reset`             | configuration | Rolls back all batches, then runs all migrations again. |
| `db:unlock`            | configuration | Frees the lock of the migrations table after an aborted migration. |
| `db:seed`              | application   | Runs the seeds in the `seeds` folder. |
| `db:create_migration`  | application   | Creates a migration for the tables of models. |
| `db:list_asset_config` | application   | Prints the asset configuration of models. |
| `db:recount_assets`    | application   | Recounts the references of all assets, see [`recountAssets()`](#recountassets). `--dry-run` only prints what it would change. |
| `db:delete_expired_records` | application | Sets up the application and runs [`deleteExpiredRecords()`](#deleteexpiredrecords) once. Fails when a model's deletion fails. |
| `console`              | application   | Starts the application with an interactive console. |

Migrations are read from the directory set in the `knex.migrations`
configuration, see [Knex](https://knexjs.org/guide/migrations.html).

#### db:seed

```sh
dito db:seed ./src/server/app.js
```

Runs the `.js` and `.json` files in the `seeds` folder of the application's
`basePath`, see [Seeds](../../guide/server/database.md). A file named after a
model, by its class name (`Book.js`) or by its name in plural or singular,
camel, snake or kebab case (`books.json`, `order_lines.js`,
`order-lines.json`), provides that model's data as an array of graphs: the
model's table is truncated (with `cascade`, so on PostgreSQL also the tables
that reference it), and the data inserted with `insertGraph()`. A `.js` file
can instead export a function, which receives `app.models`, returns the
created records, and truncates nothing. Seeds run in the order of their models
in `app.models`, seeds without a model last. A failing seed is logged, the
next one runs, and the command exits with `1` at the end:

```js
// seeds/authors.js
export default [
  { name: 'Ada Lovelace', books: [{ title: 'Notes' }] }
]
```

```js
// seeds/orders.js
export default async ({ Order, Customer }) => {
  const customer = await Customer.query().first()
  return Order.query().insert([{ customerId: customer.id }])
}
```

#### db:create_migration

```sh
dito db:create_migration ./src/server/app.js create_books Author Book
```

Arguments: the migration name, then the names of the models. Writes
`migrations/<timestamp>_<name>.js` to the application's `basePath`, with `up()`
creating the models' tables and the join tables of their many-to-many relations
(`BookGenre` with `bookId` and `genreId`, named like
[`through`](model.md#static-relations) names them, and snake-cased with
`normalizeDbNames`), and `down()` dropping them. It always writes to
`migrations`, also when `knex.migrations.directory` names another folder.
Columns are created from the [properties](model.md#static-properties) and their
`type` (or that of the definition a `$ref` names), `specificType`, `primary`,
`foreign`, `unique`, `index`, `unsigned`, `nullable`, `required`, `default` and
`description`; computed properties are left out. Review the generated migration before running it.

#### db:list_asset_config

```sh
dito db:list_asset_config ./src/server/app.js Book Author
```

Prints [`app.getAssetConfig()`](#getassetconfig) for the given
models, or all models without arguments, with database names.

#### console

```sh
dito console ./src/server/app.js
```

Starts the application and a REPL. Its context holds `app`, `objection` and
every model by name. Promises are awaited, so queries can be written as
expressions:

```text
dito > book = Book.query().findOne({ title: 'Notes' })
dito > book.$patch({ price: 12.5 })
```

The commands `.models` and `.usage` list the models and the available
references. The history is kept in `.console_history` in the current
directory. Exiting stops the application.
