# Upgrading to Dito.js 7.x

This guide is for apps that move from Dito.js 6.x to Dito.js 7.0. It lists what
replaces each part of Dito.js 6, then [the steps](#migrating-an-app) of the
move, in order. Each step names what changes, and links to the
[API reference](api/server/index.md) and the
[server guide](guide/server/index.md) for the details.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

Dito.js 7 replaces the server. The admin keeps its schemas and views, but its
`api` config changes, see
[step 10](#10-update-the-admin-the-clients-and-the-tests). The UI and the utils
keep their API.

## What Dito.js 7 is

- **A core on Hono.** `createApi({ controllers })` of `@ditojs/server` returns a
  [Hono](https://hono.dev) app, which the app routes in its own Hono app. There
  is no configuration and no CLI.
- **MikroORM.** `@ditojs/mikro` builds model controllers on
  [MikroORM](https://mikro-orm.io) 7 entities. Objection.js isn't supported.
- **Controllers as objects**, with one `actions` map keyed `'verb path'`. Mixins
  replace features and class inheritance.
- **Zod.** Every schema that an app passes is a [Zod](https://zod.dev) schema.

## What replaces each part of Dito.js 6

This table lists each part of Dito.js 6 that an app relies on, what replaces it,
and how much work the move is. Low means a change of configuration or a few
lines, medium one module of the app, and high every model or every controller.

| Dito.js 6                                                                              | Dito.js 7                                                                                                                                                                                                          | Work                    |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `dito db:migrate`, `db:rollback`, `db:reset`, `db:unlock`, `db:create_migration`       | MikroORM's Migrator, whose `create()` writes migrations from the entities, see [step 11](#11-move-the-migrations-to-mikroorm)                                                                                      | medium, once            |
| The app's knex migrations, until step 11                                               | knex's own CLI, as a bridge, see [step 1](#1-run-the-migrations-with-knexs-cli)                                                                                                                                    | low                     |
| `dito db:seed` and `seeds/`                                                            | MikroORM's [seeder](https://mikro-orm.io/docs/seeding), or a script with an entity manager                                                                                                                         | medium                  |
| `dito console`                                                                         | A REPL script of ten lines, see [step 4](#4-set-up-the-orm-the-services-and-the-scripts)                                                                                                                           | low                     |
| `dito db:list_asset_config`, `db:recount_assets`                                       | The asset paths of the app, and `assets.runJobs()`                                                                                                                                                                 | low                     |
| `dito db:delete_expired_records`, `deleteExpiredRecordsEvery`                          | `sessions.deleteExpired()` of `@ditojs/auth` on a timer of the app                                                                                                                                                 | low                     |
| `new Application()`, `app.execute()`, `start()`, `stop()`                              | `new Hono()` as the host, the controllers in one `createApi()` per area, routed with `app.route()`, and `serve()` of `@ditojs/server/node`, which stops on signals                                                 | medium                  |
| `config` and its sections                                                              | The app's own config module, whose sections the app passes to `hostMiddleware()`, `createSessions()`, `createStorages()` and `createAdmin()`                                                                       | low                     |
| `config.knex`, `app.knex`, `normalizeDbNames`                                          | `new MikroORM(defineMikroConfig({ dbName, host, user, password }))`, passed to `createApi({ adapter: createMikroAdapter(orm) })`; MikroORM maps camelCase names to snake_case by default; `em.getKysely()` for SQL | low                     |
| The `typeParsers` of knex, such as numeric to float                                    | `p.decimal('number')` and `p.bigint('number')` on the entity                                                                                                                                                       | low                     |
| `Service`, `config.services`, `app.services`                                           | The app's own modules, started and stopped around `serve()`, see [step 4](#4-set-up-the-orm-the-services-and-the-scripts)                                                                                          | low, or medium for many |
| `app.on()`, `before:start` and the other events                                        | Plain calls, or an `EventEmitter` of the app                                                                                                                                                                       | low                     |
| `config.log`, `config.logger`, `app.logger`, `ctx.logger`                              | The host's logger, such as hono-pino, which errors go through by default; MikroORM's `debug` for SQL                                                                                                               | low                     |
| `useApp()`, `ctx.app`                                                                  | Imports of the app's modules                                                                                                                                                                                       | low                     |
| Models: `properties`, `relations`, `TimestampedModel`, model hooks                     | MikroORM entities with `defineEntity()`, `onCreate()`, `onUpdate()`, MikroORM's hooks                                                                                                                              | high                    |
| Model scopes, modifiers, `static filters`, `allowScope`, `allowFilter`                 | `find` and `filters` of the controllers, `defineTextFilter()`, `defineDateRangeFilter()`                                                                                                                           | high                    |
| JSON schemas of JSON columns, the `Validator`'s formats, keywords and types            | `defineJsonType()` with Zod schemas, converted by hand, see [step 5](#5-turn-models-into-entities)                                                                                                                 | medium                  |
| `$parseJson()`, `$formatJson()`, read-only properties, `$validateGraph()`              | `deserialize`, `serialize` and `beforeSerialize` of the controller, rules as functions run by a mixin                                                                                                              | medium                  |
| Graph writes: `upsertGraph()`, `relate`, `#id`, `#ref`                                 | Nested writes of owned relations, `createRecord()`, `assignRecord()`                                                                                                                                               | medium                  |
| `Controller`, `ModelController`, `RelationController`, `collection`, `member`, `allow` | `defineController()` and `defineModelController()` with one `actions` map, mixins, `crud`                                                                                                                          | high                    |
| Controller hooks, `parameters`, `returns`, `transacted`                                | Handlers that call `next()`, middleware of mixins, `query` and `body` schemas, `transacted: true`                                                                                                                  | high                    |
| Koa's `ctx` in handlers and middleware                                                 | The handler's context, `{ query, body, params, user, em, action, getRecord, find, list, c, next }`, with Hono's context `c`, see [step 8](#8-rewrite-the-controllers)                                              | high                    |
| `ResponseError` and its subclasses, `app.logError()`                                   | `HttpError`, `toHttpError()` of the adapter, and the `onError` hook, which logs by default                                                                                                                         | low                     |
| Koa middleware, `config.http`                                                          | Hono middleware on the host: `hostMiddleware()` with Hono's `secureHeaders()`, `csrf()`, `bodyLimit()`, `cors()` and `etag()`                                                                                      | low                     |
| `app.proxy`, `config.server.proxy`                                                     | `forwarded(proxy)` of `@ditojs/server/node`, and `getClientAddress(c)` for the client's address                                                                                                                    | low                     |
| `UsersController`, `UserMixin`, `SessionMixin`, `PasskeyService`, `TotpService`        | `@ditojs/auth`: `createSessions()`, `getSessionUser()`, `defineUserActions()`, `definePasswordWrites()`, `createPasskeys()`, `createTotp()`, and `createEntityUserSource()` of `@ditojs/mikro`                     | medium                  |
| `config.storages`, model `assets`, `AssetFile`, asset counts in hooks                  | `@ditojs/storage`: `createStorages()`, asset paths, `createAssets()`, `serveStorage()`                                                                                                                             | medium                  |
| `AdminController`, `config.admin`, the admin's build                                   | `createAdmin()` of `@ditojs/admin/server` and `defineAdminViteConfig()` of `@ditojs/admin/vite`                                                                                                                    | low                     |
| Tests on `app.knex` and models                                                         | Tests on an entity manager of the ORM, and `app.request()` of Hono                                                                                                                                                 | medium                  |

## Migrating an app

Take the steps in this order:

- Steps 1 and 2 run on Dito.js 6. The app keeps running after each one.
- Steps 3 to 10 replace the server, on a branch. The app runs again after step 9.
- Step 11 moves the migrations to MikroORM, which is where they end up. It comes
  last because every database must first have run the last knex migration.

### 1. Run the migrations with knex's CLI

Migrations end up on MikroORM's Migrator in [step 11](#11-move-the-migrations-to-mikroorm).
Until then knex is a bridge: the existing migrations and the ones of steps 2 and
10 stay knex migrations, because the Migrator can only take over from a schema
that every database has reached.

Dito.js 7 has no CLI. The `dito` CLI ran the migrations with knex, and knex's
own CLI does the same with a `knexfile.js` next to `package.json`. This also
works on Dito.js 6. Keep `knex` and `pg` as dependencies until step 11.

```js
// knexfile.js
import config from './config/index.js'

export default config.knex
```

| Dito.js 6                                       | knex                                                 |
| ----------------------------------------------- | ---------------------------------------------------- |
| `dito db:migrate ./config/index.js`             | `knex migrate:latest`                                |
| `dito db:rollback ./config/index.js`            | `knex migrate:rollback`                              |
| `dito db:reset ./config/index.js`               | `knex migrate:rollback --all && knex migrate:latest` |
| `dito db:unlock ./config/index.js`              | `knex migrate:unlock`                                |
| `dito db:create_migration ./server/app.js name` | `knex migrate:make name -x mjs`, an empty ES module  |

### 2. Change the schema for Dito.js 7

Write knex migrations that prepare the schema. They also run on Dito.js 6,
unless one of its models reads the `id` of a join table.

- Give each join table with columns of its own a composite primary key of its
  two foreign keys, instead of a serial `id`. With a serial `id`, MikroORM
  orders the relation by it, writes kept pairs again without their columns, and
  upserts pairs twice.
- Add a unique key of the two foreign keys to the other join tables.
- If the app stores files, add `unreferenced_since` to the `asset` table:
  `table.timestamp('unreferenced_since', { useTz: true }).nullable()`.

### 3. Swap the dependencies

1. Remove `@ditojs/server` 6, `@ditojs/schema`, `@ditojs/router`,
   `@ditojs/build`, `objection`, `koa` and its middleware. The admin holds the
   validators that it used from `@ditojs/schema`. Building the admin needs
   `vite`, `@vitejs/plugin-vue` and `autoprefixer`, which came with
   `@ditojs/build`.
2. Add `@ditojs/server` and `@ditojs/mikro`, and `@ditojs/storage` and
   `@ditojs/auth` if the app needs them. `@ditojs/admin` serves and builds the
   admin, in `@ditojs/admin/server` and `@ditojs/admin/vite`.
3. Add `@mikro-orm/core`, `@mikro-orm/postgresql`, `kysely`, `hono`,
   `@hono/node-server` and `zod`.

All server packages are written in TypeScript and need Node.js 24. See
[Server packages](api/server/index.md).

### 4. Set up the ORM, the services and the scripts

Dito.js 7 has no app object, no services and no CLI, so the app owns these
parts.

**The ORM.** Create it from the knex config. MikroORM maps camelCase properties
to snake_case columns by default, as `normalizeDbNames` did. The sessions,
credentials and asset jobs of step 9 use its `adapter`:

```js
// server/orm.js
import { createMikroAdapter, defineMikroConfig } from '@ditojs/mikro'
import { MikroORM } from '@mikro-orm/postgresql'
import config from '../config/index.js'
import * as entities from './entities/index.js'

const { connection, pool } = config.knex

export const orm = new MikroORM(
  defineMikroConfig({
    entities,
    dbName: connection.database,
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    pool
  })
)

export const adapter = createMikroAdapter(orm)
```

**Services** become modules of the app. Each module exports functions such as
`start()` and `stop()`, and imports the config and the ORM instead of reading
them from `this.app`. The server calls them around `serve()`:

```js
// server/index.js
import * as mailer from './services/mailer.js'
import * as scheduler from './services/scheduler.js'

const services = [mailer, scheduler]
await Promise.all(services.map(service => service.start()))
await serve(app, {
  port: config.server.port,
  async onClose() {
    await Promise.all(services.map(service => service.stop()))
    await orm.close()
  }
})
```

**Logging** moves to the host. `config.logger` and `ctx.logger` become a logger
of the app, such as pino with hono-pino as middleware of the host.
`config.log.sql` becomes MikroORM's `debug` option. See
[Errors and logging](guide/server/api.md#errors-and-logging), also for how to
use pino's `redact` with entities.

**The console** of `dito console` becomes a REPL script:

```js
// scripts/console.js
import repl from 'node:repl'
import { orm } from '../server/orm.js'
import * as entities from '../server/entities/index.js'

const server = repl.start({ prompt: 'app > ' })
server.setupHistory('.console_history', () => {})
Object.assign(server.context, entities, { orm, em: orm.em.fork() })
server.on('exit', () => orm.close())
```

### 5. Turn models into entities

Write one MikroORM entity for each model, with `defineEntity()` and the `p`
builders, see [Entities and controllers](guide/server/mikro.md).

- Don't declare foreign key properties such as `authorId`. The relation holds
  the column.
- `TimestampedModel` becomes `onCreate()` and `onUpdate()`. `$beforeInsert()`
  and the other model hooks become `onCreate()`, `deserialize`, or MikroORM's
  lifecycle hooks.
- For each nullable relation that must refuse deletes, declare its delete rule
  with `.deleteRule('no action')`.
- Rules of a whole graph, `$validateGraph()`, become plain functions that return
  issues, see
  [Rules on rows and graphs](guide/server/writes.md#rules-on-rows-and-graphs).
- Model `assets` become the [`assets` of `defineJsonType()`](#storage).
- Entities need a single primary key, see
  [Known limitations](#known-limitations).
- Hide fields with `.hidden()`. For fields that only some users see, use
  `exclude` in a `find` function. Serialization `groups` aren't supported.
- Dito.js 6 stored a `Date` in a `date` column as its local day. `p.date()` of
  MikroORM stores its UTC day, also for strings with a time.
  [`defineMikroConfig()`](api/server/mikro.md#definemikroconfig) of
  `@ditojs/mikro` keeps the local day.

**JSON columns.** Convert the JSON schemas of JSON columns to Zod by hand, and
pass them to `defineJsonType()`. The formats and
keywords of other columns become a custom type with a `schema` getter, see
[Rules on values](guide/server/writes.md#rules-on-values).

```js
meta: p
  .type(
    defineJsonType({
      schema: z.object({ featured: z.boolean().default(false) })
    })
  )
  .nullable()
```

Dito.js 6 filled in the defaults of its schemas on insert.
[`defineMikroConfig()`](api/server/mikro.md#definemikroconfig) keeps this.

**Many-to-many relations.** A join table with columns of its own becomes a pivot
entity, with `p.manyToOne(Post).primary()` on both foreign keys.
`defineMikroConfig()` warns of pivot entities with an id of their own, see
[step 2](#2-change-the-schema-for-ditojs-7). A body writes the relation as ids,
on either side. Dito.js 6 wrote the other columns of the join table in graphs.
A one-to-many relation to the pivot entity with `orphanRemoval` writes them as
owned rows, see
[Many-to-many relations](guide/server/writes.md#many-to-many-relations).

### 6. Turn scopes into find shapes

Each controller decides what it loads and returns with `find`. `find` holds
MikroORM's find options, plus `where` and `maxRows`. It can also be a function
that returns them. It replaces `scope`, `allowScope`, `allowFilter`,
`allowParam`, `graph` and the model's default scope. `filters` declares the
list filters. See [Find](api/server/mikro.md#find) and
[Filters](api/server/mikro.md#filters).

```js
// Dito.js 6
static scopes = {
  list: query => query.withGraph('author').orderBy('createdAt', 'desc'),
  choose: query => query.select('id', 'title').orderBy('title')
}
static filters = {
  authorId: { handler: (query, id) => query.where('authorId', id) }
}
// GET /posts?scope=choose&filter=authorId:12

// Dito.js 7
mixins: [defineChoices({ fields: ['id', 'title'], orderBy: { title: 'asc' } })],
find: { populate: ['author'], orderBy: { createdAt: 'desc' } },
filters: {
  title: defineTextFilter(),
  createdAt: defineDateRangeFilter(),
  'author.id': z.number().int()
}
// GET /posts/choices?filter=author.id:12
```

- Rows that `find.where` hides respond with 404 on `getRecord()` and the default
  handlers.
- `?fields=` is gone. `?scope=` no longer chooses what a list loads. Instead, a
  controller routes the shapes that its clients need, such as `'get :id/full'`.
  `defineChoices()` routes the options of a select at `get choices`.
- List `scopes` of the admin keep their name and `defaultScope`. Each scope now
  sets list filters with `filter`, and optionally the order with `order`, such
  as `published: { label: 'Published', filter: { published: true } }`. The
  controller needs a filter of each name.
- `?scope=` stays in the admin's URL only. The admin doesn't send it to the
  server.
- Dito.js 6's filter types `text` and `date-range` become `defineTextFilter()`
  and `defineDateRangeFilter()`. They read what the admin's filters send.
- Custom actions query through `find(options)` of the handler's context, or
  through `c.var.find()`.
- `list(options)`, or `c.var.list()`, runs the list with its filters, `order`
  and `range`. `defineListHandler(find)` returns such a list as a handler.
- Both keep to the rows of the controller's `find`. Only `where` and `filters`
  merge. The other options replace the controller's.
- `getListQuery()` of the context returns the `where`, `orderBy` and `range` of
  the list. Use it for summaries and exports over its rows.

`fields` alone defines what goes out, see [Output](api/server/mikro.md#output):

- Paths in `fields`, such as `author.name`, populate their relations and send
  them nested, as `author: { name }`, instead of flat names such as
  `authorName`. Where a label needs a flat value, add a `.formula()` property.
- Responses send each relation to one row as `{ id }`, such as
  `author: { id: 12 }`, unless `find` populates it.
- Writes take the relation, `{ author: { id: 12 } }`, so a client can send back
  what it loaded. There are no `<name>Id` keys: a body with `authorId` has an
  unknown key, which writes ignore.
- `order` and filters name the relation too, such as `order=author.id` and
  `filter=author.id:12`.

### 7. Turn features and hooks into mixins

Controllers are plain objects, so they share code through mixins.
`defineMixin()` takes what a controller takes, without `path`. Turn features and
base controllers into mixins, see [Mixins](api/server/controllers.md#mixins):

```js
// Dito.js 6
export class EditorController extends ModelController {
  authorize = ['admin', 'editor']
  transacted = true
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
}

// Dito.js 7
export const editor = defineMixin({
  authorize: ['admin', 'editor'],
  transacted: true,
  mixins: [crud]
})
```

[`crud`](api/server/mikro.md#crud) of `@ditojs/mikro` routes the five default
handlers. When two layers set a handler for the same action, the later one runs
the handler of the layer beneath as `next()`, and gets its result. See
[Mixins](api/server/controllers.md#mixins) for how the layers combine their
settings. Writes run in a transaction by default. `transacted: true` adds the
reads, see [Transactions](guide/server/controllers.md#transactions).

Hooks that ran after an action become a handler that calls `next()`, or
middleware of a mixin. Both run inside the transaction, so an error after
`next()` rolls back the write. In model controllers, a handler's `next()`
returns the record before the base flushes it. The `next()` of middleware
returns after the flush.

An audit log of every write moves to a MikroORM
[event subscriber](https://mikro-orm.io/docs/events). It sees each row that a
flush writes, also from scripts and custom actions:

```js
export class Audit {
  onFlush({ em, uow }) {
    for (const change of uow.getChangeSets()) {
      if (change.entity instanceof AuditLog) continue
      const log = em.create(AuditLog, {
        entity: change.name,
        entityId: change.getPrimaryKey(),
        type: change.type,
        changes: change.payload
      })
      uow.computeChangeSet(log)
    }
  }
}

// new MikroORM(defineMikroConfig({ ...options, subscribers: [new Audit()] }))
```

### 8. Rewrite the controllers

Rewrite each controller with `defineModelController()` of `@ditojs/mikro` for an
entity, and with `defineController()` of `@ditojs/server` without one. Each one
needs its `path`, `true` for each default handler it keeps, and `authorize` on
every write. See [Controllers](guide/server/controllers.md).

```js
// Dito.js 6
export class PostsController extends ModelController {
  modelClass = Post
  authorize = ['admin', 'editor']
  collection = { allow: ['get'] }

  member = {
    allow: ['get', 'patch'],

    'post publish': {
      async handler(ctx) {
        await Post.query().findById(ctx.memberId).patch({ published: true })
        return this.getMember(ctx)
      }
    }
  }

  static hooks = {
    async 'after:member:patch'(ctx, post) {
      await notifySubscribers(post)
    }
  }
}
```

```js
// Dito.js 7
export const posts = defineModelController({
  path: 'posts',
  entity: Post,
  authorize: ['admin', 'editor'],
  actions: {
    'get': true,
    'get :id': true,

    async 'patch :id'({ next }) {
      const post = await next()
      await notifySubscribers(post)
      return post
    },

    async 'post :id/publish'({ getRecord }) {
      const post = await getRecord()
      post.published = true
      return post
    }
  }
})
```

#### Actions

One `actions` map holds every route, keyed `'verb path'`, see
[Actions](api/server/controllers.md#actions):

| Dito.js 6                                 | Dito.js 7                                           |
| ----------------------------------------- | --------------------------------------------------- |
| `collection.get`, `collection.post`       | `'get'`, `'post'`                                   |
| `member.get`, `.patch`, `.delete`         | `'get :id'`, `'patch :id'`, `'delete :id'`          |
| `collection: { 'get by-name': … }`        | `'get by-name'`                                     |
| `member: { 'post publish': … }`           | `'post :id/publish'`                                |
| `'get preview-:format'` with `parameters` | `'get :id/preview-:format'` or one action per value |

- Each controller states its `path`, as the URL has it, such as `blog-posts`.
  Nothing is derived from class names. `createApi()` throws for a path with
  leading, trailing or double slashes, or with `:id`.
- Paths use Hono's syntax: `:name` matches one segment, and `:name{.+}` one or
  more. The `*` and `**` wildcards of Dito.js 6 become named parameters.
- Default handlers are off. A forgotten key leaves the route out. There is no
  default `put` and no write on the whole collection. Bulk writes are custom
  actions, such as `'post order'`.
- `parameters` and `returns` become the Zod schemas `query` and `body`,
  which `defineAction()` types. The `query` schema is plain Zod. Dito converts
  the strings of the query to the types that it expects, as Dito.js 6 did for
  `parameters`, see [Query values](api/server/controllers.md#query-values).

#### Handlers and the context

Koa's `ctx` splits in two. A handler gets one object, its
[context](api/server/api.md#the-handlers-context), which holds Hono's context `c`
and `next()`. Middleware gets `c`, and reads Dito's variables from it, such as
`c.var.user`. Every other callback, such as `authorize`, gets one object with
`c` and what it needs, such as `({ c, user })`.

| Dito.js 6 (Koa)                              | Dito.js 7                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ctx.request`, `ctx.headers`                 | `c.req`; `c.req.header(name)`, and `c.req.raw`, the `Request`                           |
| `ctx.href`, `ctx.url`, `ctx.path`            | `c.req.url`, the full URL; `c.req.path`                                                 |
| `ctx.query`                                  | `query` of the context, the output of the `query` schema                                |
| `ctx.request.body`                           | `body` of the context; `c.var.body` in middleware                                       |
| `ctx.params`                                 | `params` of the context; `c.req.param(name)`                                            |
| `ctx.memberId`                               | `id` of the context in model controllers, a number for integer keys; else `params.id`   |
| `this.getMember(ctx)`, `super.get(ctx)`      | `getRecord()` of the context; `c.var.getRecord()`; `next()`                             |
| `this.modelClass`, `modelClass.tableName`    | `entity` of the context in model controllers; `em.getMetadata(entity).tableName`        |
| `ctx.status`, `ctx.set()`                    | `c.status()`, `c.header()`                                                              |
| `ctx.type`, `ctx.body =`, `ctx.attachment()` | A returned `Response`, such as `c.body()` or [`sendFile()`](api/server/api.md#sendfile) |
| `ctx.state.user`                             | `user` of the context, `{ id, roles }`; `c.var.user`                                    |
| `ctx.state.*`                                | `c.set()` and `c.var`, also in the context, typed by augmenting `DitoVariables`         |
| `ctx.transaction`                            | `em` of the context, the transaction's entity manager during one; `c.var.em`            |
| `ctx.ip`                                     | `getClientAddress(c)` of `@ditojs/server/node`                                          |
| `ctx.session`                                | `session` of the context, or `getSession(c)` of `@ditojs/auth`                          |
| `ctx.action`                                 | `action` of the context, the key such as `'post :id/publish'`; `c.var.action`           |
| `ctx.action.type`                            | `params.id !== undefined` for record actions; `c.req.method`                            |

- Handlers return data or a `Response`, see
  [Handler](api/server/controllers.md#handler). `undefined` responds with 204,
  also for `post`. A custom `post` that creates calls `c.status(201)` itself.
- `params.id` and `c.req.param('id')` are the string of the path. See
  [Variables](api/server/mikro.md#variables) for `id`.
- Hono doesn't send a thrown `Response`. Throw an `HttpError`, or return the
  `Response`.
- Middleware is Hono middleware. It goes on the host, in
  `createApi({ middleware })`, or on controllers, mixins and actions.
- Middleware reads the request's entity manager as `c.var.em`. Its Kysely,
  `c.var.em.getKysely()`, runs the queries that MikroORM doesn't build.
  `import '@ditojs/mikro/types'` types `em` as MikroORM's `EntityManager`.

#### Authorization

`authorize` takes `true`, a role, a list of roles, or a function, see
[authorize](api/server/controllers.md#authorize). Every write needs it, or
`createApi()` throws. Front controllers that let anyone write set
`authorize: true`.

`$authorize()` and `handleAuthorization()` become a function that gets
`{ c, user }`. It reads the id with `c.req.param('id')`. It runs before the body
is read, and before `getRecord()` is set. So it loads what it checks itself.
Only `true` grants access. A function that returned a truthy value, such as a
user or a count, returns a boolean. `$self` and `$owner` become such functions.

Relation controllers don't exist. A nested route is a controller of its own,
with a path such as `books/:bookId/chapters`. It inherits nothing from a parent.
So it sets its own `authorize`, and checks that the parent row may be read.

A mixin with `actions` keeps its settings for its own actions, see
[ActionSettings](api/server/controllers.md#actionsettings).

#### Writes

A write runs the action's `body` schema, `deserialize`, the checks of the body
and the app's rules, see [Writes](guide/server/writes.md). Then it flushes once.

- **The checks of the body replace Ajv.** They read the entity's metadata, see
  [The checks of a body](guide/server/writes.md#the-checks-of-a-body). They
  check lengths, empty required strings and the digits of decimals. Postgres
  checks the rest, such as the ranges of numbers. For stricter rules, give the
  action a Zod `body` schema, such as `'post': { body: postSchema }`. The writes
  of a website need one. The messages name the expected type, such as
  `expected int` for integer columns.
- **`deserialize({ json, record, c })`** decides what a user may write. It
  replaces `$parseJson()`, the read-only rules of properties, and the
  `before:*:patch` hooks that changed the body. Custom handlers don't run it.
- **Graphs.** `graph: true`, `upsertGraph()`, `relate` and `unrelate` are gone.
  Owned relations, with `orphanRemoval`, are written nested, see
  [Nested rows](guide/server/writes.md#nested-rows). Other relations link by id.
  `#id` and `#ref` stay, but only new rows carry `#id`. `#dbRef` becomes an id
  or `{ id }`. Two owned rows with the same id respond with 400.
- **Custom handlers** write a body with `createRecord(em, entity, data)` and
  `assignRecord(em, record, data)`, see
  [Writes in custom handlers](guide/server/writes.md#writes-in-custom-handlers).
- **Deletes.** Call `em.remove(record)` and flush. Declare the delete rules of
  the foreign keys on the entities, see [Deletes](guide/server/writes.md#deletes).

`serialize({ record, json, c })` replaces `$formatJson()` and the hooks that
changed responses. `beforeSerialize({ records, c })` lets a mixin load what the
records need in one query. See
[Serialize and deserialize](guide/server/controllers.md#serialize-and-deserialize).

#### Errors

| Dito.js 6                                                                                                  | Dito.js 7                                                         |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ResponseError(message, { status })`                                                                       | `new HttpError(status, { message })`                              |
| `NotFoundError`                                                                                            | `new HttpError(404)`                                              |
| `AuthorizationError`, `AuthenticationError`                                                                | `new HttpError(403)`, `new HttpError(401)`                        |
| `ValidationError`                                                                                          | `createValidationError(issues, { message, type, status, cause })` |
| `DatabaseError`                                                                                            | `toHttpError()` of `createMikroAdapter()`                         |
| `ControllerError`, `ModelError`, `QueryBuilderError`, `RelationError`, `GraphError`, `NotImplementedError` | Plain `Error`s, which respond with 500                            |
| `app.logError()`                                                                                           | The `onError` hook, which logs by default                         |

Errors respond with the JSON of Dito.js 6, `{ type, message, status, code,
errors }`, see [Errors](api/server/errors.md). Field errors have a `message` and
a `keyword`, such as Zod's `invalid_type`. Errors with a numeric `status`, as
Dito.js 6 and http-errors throw them, still respond with that status. So the
app can move its error classes one by one.

The `onError` hook gets the original error, also a database error, not the
`HttpError` of the response.

### 9. Host the app

Replace the `Application` with a host, so that the app runs again. The app's own
`Hono` app is the host, and the controllers go into one `createApi()` per area,
each with its own sessions and users. See
[Hosting with Hono](guide/server/api.md#hosting-with-hono).

```js
const api = createApi({
  controllers,
  middleware: [sessions.middleware],
  adapter,
  getUser: ({ c }) => getSessionUser(c, adminSource)
})

const app = new Hono({ strict: false })
app.use(forwarded(config.server.proxy ?? false), ...hostMiddleware())
app.use('/assets/public/*', serveStorage(storages.get('public')))
app.onError(createErrorHandler())
app.notFound(notFound)
app.route('/api', api)
await serve(app, { port, closeTimeout: '5s', onClose: () => orm.close() })
```

- `config.http` becomes the options of
  [`hostMiddleware()`](api/server/hono.md#hostmiddleware). Add it before
  `app.route()`. As in Dito.js 6, `csrf()` only checks requests with `Origin`.
- `cors` works differently. Dito.js 6 echoed the request's origin. Hono's
  `cors()` allows any origin by default, without credentials. With
  `credentials: true`, it needs the allowed `origin`.
- `app.proxy` becomes [`forwarded(proxy)`](api/server/hono.md#forwarded), the
  first middleware. Then `csrf()` compares the origin with the public URL.
- Routes with a trailing slash respond with 404, unless the host is
  `new Hono({ strict: false })`. The admin sends some paths with one.
- Route the APIs at deeper paths first, see
  [Several APIs in one host](guide/server/api.md#several-apis-in-one-host).
- An API handles only the paths of its actions, and its own errors. The host
  handles the rest with `notFound` and `createErrorHandler()`, as above.

#### Sessions and users

`UsersController`, `UserMixin`, `SessionMixin` and `CredentialMixin` become
`@ditojs/auth`. The `session` and `credential` tables stay the same. So passkeys
and TOTP secrets stay valid. See [Users and sessions](guide/server/auth.md).

- [`createSessions()`](api/server/auth.md#createsessions) returns the session
  `middleware`. `getSessionUser(c, source)` returns the user for the `getUser`
  of `createApi()`.
- [`createEntityUserSource()`](api/server/mikro.md#createentityusersource)
  describes the users of an entity. It takes `usernameProperty` as before. For
  users that no entity holds, the app writes the
  [`UserSource`](api/server/auth.md#usersource) itself.
- [`defineUserActions()`](api/server/auth.md#defineuseractions) serves the
  admin's users. It returns a mixin for the `mixins` of the users controller.
  Its `get features` tells the admin what to offer. Other users, such as a
  site's members, log in through the app's own actions, see
  [Other users](guide/server/auth.md#other-users).
- `post login` and `post password-reset` name the user as `username` in the
  body, whatever the property is.
- `get session` becomes `get self`.
- `self` in record actions, such as `PATCH users/self`, isn't built in. A
  controller that keeps it sets `load`, which gets the id as a string.
- Actions that change security settings call
  `getSession(c).checkConfirmedAccess(source)`, see
  [Confirmed access](guide/server/auth.md#confirmed-access).
- `definePasswordWrites()` doesn't ask for confirmed access. An app that asked
  for it on password changes calls `checkConfirmedAccess()` in its own action.
- `config.app.authentication.reconfirmAccessAfter` becomes `reconfirmAfter` of
  `defineUserActions()`.
- Responses have no `success` or `authenticated`. The actions respond as in
  [`defineUserActions()`](api/server/auth.md#defineuseractions).
- New passwords need at least 8 characters by default. Dito.js 6 took any
  password that wasn't empty.
- The `password` schema of the user source replaces the `password` property of
  the model, such as `createEntityUserSource(Admin, { password })`. The actions
  of `defineUserActions()` and `definePasswordWrites()` check new passwords
  with it.
- The session saves after the action if it changed, even when the action throws.
  So used challenges and codes stay used. A session that a parallel request
  ended stays ended.
- `refreshFingerprint()` applies when the session saves after a request without
  an error. So a failed write keeps the old hash, and the fingerprint that
  matches it.
- `PasskeyService` and `TotpService` become
  [`createPasskeys()`](api/server/auth.md#createpasskeys) and
  [`createTotp()`](api/server/auth.md#createtotp).
- `config.app.authentication.passwordReset` becomes
  [`createPasswordReset()`](api/server/auth.md#createpasswordreset). It takes
  `secrets` instead of `app.keys`, and `send` instead of
  `sendPasswordReset()`.
- When the app deletes users, it calls `credentials.deleteUsers()`, see
  [Credentials](guide/server/auth.md#credentials).

#### Storage

`config.storages` and model `static assets` become `@ditojs/storage`. See
[Storages and files](guide/server/storage.md).

```js
export const storages = createStorages(config.storages)

// In the properties of the entity, instead of `static assets`:
cover: p
  .type(defineJsonType({ assets: [{ path: '', storage: 'public' }] }))
  .nullable(),
chapters: p
  .type(defineJsonType({ assets: [{ path: '*/images', storage: 'public' }] }))
  .nullable(),

export const assets = createAssets({
  adapter,
  paths: getAssetPaths(entities),
  storages,
  deleteUnusedAfter: '24h'
})
```

- `mixins: [assets.defineWrites('book'), assets.defineUploads('book')]`
  replaces `assets = true` of a controller.
- `assets.runJobs()` runs on a timer of the app.
- `serveStorage()` of `@ditojs/storage/node` serves public disk storages.
- `S3Storage` comes from the main entry of the package.
- The `PutObject` options of S3 storages, such as `acl` and `cacheControl`,
  become a `params` object, such as
  `{ ACL: 'public-read', CacheControl: 'max-age=31536000' }`.
- Each controller has one upload action, `post upload/:path{.+}`, see
  [Uploads](api/server/storage.md#uploads). Its `uploads` option takes the
  fields that no asset path describes.
- Uploads still stream into their storage. S3 storages upload them in parts of
  8 MB.
- `limits.fileSize` becomes `maxSize`, the limit of each file. It also takes a
  size with a unit, such as `'500mb'`.
- File objects are plain objects of the type `AssetFile`, without signatures. A
  write accepts the files that the `asset` table holds, see
  [Writes](api/server/storage.md#writes).
- `allowedImports` match the origin and path of a URL, without its query and
  hash.
- Code that creates files, such as `AssetFile.create()` in scripts, calls
  [`assets.store()`](api/server/storage.md#stored-files).
- The `asset` table has no `count`. Scans of the data replace the hooks on each
  write, see [Tracking files](guide/server/storage.md#tracking-files).

#### Admin server

`AdminController` and `config.admin` become
[`createAdmin()`](api/admin/server.md#createadmin), which returns a Hono app.
See [Serving the admin](guide/server/admin.md).

```js
const admin = createAdmin({
  base: '/admin',
  dist: path.resolve('dist/admin'),
  vite: isDevelopment ? 'admin.vite.config.js' : undefined,
  api: { url: '/api/admin', users: { path: 'admins' } },
  middleware: sessions.middleware,
  getUser: ({ c }) => getSessionUser(c, adminSource),
  authorize: 'admin'
})
app.route('/admin', admin)
```

- With `vite`, the host runs on `serve()`. Without it, the admin serves the
  build of `dist`. `createAdmin()` throws if the build is missing.
- `authorize` protects the admin's views, which the build puts below `views/`.
  Other chunks go below `assets/`.
- The admin's build splits off only the chunk of the views. The `core`, `vendor`
  and `common` chunks of Dito.js 6 are gone.
- `defineAdminViteConfig()` of `@ditojs/admin/vite` builds the admin, on
  Vite 8. `build.rollupOptions` of an app's config become
  `build.rolldownOptions`.

### 10. Update the admin, the clients and the tests

**The admin.** Its `api` config is plain data, see
[ApiConfig](api/admin/admin.md#apiconfig):

- `request`, `getApiUrl`, `isApiUrl`, `normalizePath`, `denormalizePath` and
  `resources` aren't options any more. `admin.api` has `request()` and
  `getApiUrl()`.
- `normalizePaths` is gone. The admin routes views and sources under their
  hyphenated names, unless their schema sets a `path`, and uploads send their
  data paths as they are.
- `users` takes only `path`, as `users: { path: 'admins' }`.
- Requests reject with an `ApiError` of `@ditojs/admin`, which has the fields
  of the JSON body, the `status` and the `response`. Code that read
  `error.response.data`, such as the `onError()` of a button, reads the fields
  on the error, such as `error.errors`.

**The clients.** Dito.js 7 keeps the lists with `range=0,49` and
`order=name desc`, the 201 with `Location` of the default `post`, the
`{ count }` of `delete :id`, the error JSON with validation errors as 400, and
integer ids. GET actions may write. A GET action that writes sets its own
`authorize`, and `transacted: true`.

These things change. The admin of Dito.js 7 already handles them:

- Filters convert their arguments to what their schema expects, as query
  values, instead of reading their JSON types. So `filter=code:12` gives `'12'`
  to a `z.string()` filter.
- Lists, records and writes take the shapes of
  [step 6](#6-turn-scopes-into-find-shapes), such as `author: { id: 12 }`
  instead of `authorId`.
- A list returns at most 1000 rows. A larger list needs `range`, or a higher
  `maxRows` in its find, such as `defineListHandler({ maxRows: 5000 })`.
- Unknown filters, and `order` on columns that the rows don't return, respond
  with 400. So does `nulls first` or `nulls last` in `order`.
- Field errors hold a `message` and a `keyword`, without `params`, so
  `getErrors()` of the admin returns no `params`. Field errors of a 409 also show
  on the fields.
- The actions of users respond as in [Sessions and users](#sessions-and-users).

**The tests** query through a fork of the ORM's entity manager, and call the app
with Hono's `app.request()`.

#### The release

Ship these as knex migrations, in this order. They run with Dito.js 7, as
Dito.js 6 still writes `count`, and `@ditojs/storage` needs the new server:

1. Empty the `session` table with `await knex('session').del()`. Sessions sign
   their cookie with Hono's signed cookies and can't read the cookies of Koa, so
   every user logs in again once.
2. If the app stores files, run the scan of `assets.runJobs()` once, without
   `deleteUnusedAfter`. It inserts the `asset` rows
   that Dito.js 6 never wrote, such as those of files from scripts. Without
   them, writes that keep such a file respond with 400. Rows of files that no
   storage holds do no harm, as the jobs ignore files that are gone.

   ```js
   import { Kysely, PostgresDialect } from 'kysely'
   import pg from 'pg'
   import { createAssets } from '@ditojs/storage'
   import { assets } from '../server/storages.js'

   // The scan writes in its own transaction, on its own connection.
   export const config = { transaction: false }

   export async function up(knex) {
     const db = new Kysely({
       dialect: new PostgresDialect({
         pool: new pg.Pool(knex.client.connectionSettings)
       })
     })
     try {
       const { paths, storages } = assets
       const adapter = { getKysely: () => db }
       await createAssets({ adapter, paths, storages }).runJobs()
     } finally {
       await db.destroy()
     }
   }

   export async function down() {}
   ```

3. Then drop the `count` column of the `asset` table in a migration of its own,
   with `table.dropColumn('count')`.

### 11. Move the migrations to MikroORM

Replace knex's migrations with MikroORM's Migrator once every database has run
the last knex migration: in production, in staging, in CI and on each
developer's machine. A baseline migration holds the schema at that point. On
fresh databases, it creates the schema. On databases that knex migrated, it runs
nothing.

Add `@mikro-orm/migrations`, then:

1. Dump the schema of a fresh database that knex migrated. A fresh database
   leaves out changes made by hand:

   ```sh
   # `app_baseline` is a new database, migrated with `knex migrate:latest`.
   pg_dump --schema-only --no-owner --no-privileges \
     --exclude-table 'knex_migrations*' app_baseline > migrations/baseline.sql
   ```

   The migration runs the dump in its transaction. So remove the lines that only
   psql reads, such as `\restrict`, the `COMMENT ON EXTENSION` lines and the
   line that empties the `search_path`. Turn `SET` into `SET LOCAL`.

2. Move the knex migrations and their helpers to `migrations/knex/`, and set
   `migrations: { directory: './migrations/knex' }` in the knex config. MikroORM
   runs each `.js` file at the top of `migrations/`. Databases that are behind
   can still catch up with `knex migrate:latest`.

3. Add the baseline. Name in it the last knex migration that the dump includes.
   The Migrator records it as executed on all databases:

   ```js
   // migrations/Migration20261104000000_baseline.js
   import { readFile } from 'node:fs/promises'
   import { Migration } from '@mikro-orm/migrations'

   const lastKnexMigration = '20261103000000_add_index.js'

   export class Migration20261104000000_baseline extends Migration {
     async up() {
       const [{ knex }] = await this.execute(
         `select to_regclass('knex_migrations') is not null as knex`
       )
       if (knex) {
         const rows = await this.execute(
           'select 1 from knex_migrations where name = ?',
           [lastKnexMigration]
         )
         if (rows.length === 0) {
           throw new Error(`Run the knex migrations up to ${lastKnexMigration}.`)
         }
       } else {
         const file = new URL('./baseline.sql', import.meta.url)
         this.addSql(await readFile(file, 'utf8'))
       }
     }
   }
   ```

4. Register the Migrator with the ORM, with `extensions: [Migrator]` and
   `migrations: { path: './migrations', emit: 'js' }`, and run it from a script,
   or with `mikro-orm migration:up` of `@mikro-orm/cli`:

   ```js
   // scripts/migrate.js
   // Usage: node ./scripts/migrate.js up|down|create [name]
   import { orm } from '../server/orm.js'

   const [command, name] = process.argv.slice(2)
   try {
     if (command === 'create') {
       await orm.migrator.create(undefined, false, false, name)
     } else {
       await orm.migrator[command]()
     }
   } finally {
     await orm.close()
   }
   ```

5. Write new migrations as MikroORM migrations. `create` writes the difference
   between the entities and a snapshot of the schema, `.snapshot-<dbName>.json`,
   which the Migrator keeps next to the migrations. The first one may hold
   differences between knex's schema and the entities, such as the names of
   constraints. Review it, then align the entities or write it by hand.

Keep the baseline, because fresh databases need it. Once no database is behind
any more, remove `migrations/knex/`, `knexfile.js` and `knex`, and drop knex's
tables in a migration:
`this.addSql('drop table if exists knex_migrations, knex_migrations_lock')`. The
baseline can then drop its checks of knex's table, and always run the SQL.

## Known limitations

- **Single primary keys.** Entities with a composite primary key, or with no
  primary key, throw on the first request of their controller, as
  `@ditojs/mikro` reads the metadata then. Pivot entities have composite keys
  and no controller.
- **PostgreSQL only.** The checks of the body and `toHttpError()` of
  `createMikroAdapter()` know PostgreSQL's column types and error codes.
- **Date columns are strings.** `date` columns take and return `YYYY-MM-DD`
  strings, and also take a `Date` with `defineMikroConfig()`. `time` columns
  also take and return strings, not `Date`s. `timestamptz` needs an offset in
  writes.
- **No optimistic locking over HTTP.** There is no `ETag` and no `If-Match`.
  MikroORM's `OptimisticLockError` responds with 409, but only for races inside
  one request. Apps that need locking check a value such as `updatedAt` in a
  mixin.
- **New pivot rows with columns.** A handler that creates the pivot entity of a
  new pair next to the relation that links the pair gets two inserts of the same
  row. Write the pivot rows as owned rows instead, or link the pair, flush, then
  set the columns of the pivot row.
- **Replacing a partly loaded owned row.** A flush inserts before it deletes,
  unless it sees that a new row takes the unique value of a deleted row. If the
  old row was loaded without that column, the insert fails and the write
  responds with 409. Load the column, or give the new row another value first.
- **Removes and filters.** A flush loads the owned rows of a removed row without
  filters. A collection that is already loaded under a filter stays as it is, so
  the rows that the filter hides aren't deleted, and the delete rule decides.
- **Unknown query parameters** are ignored, and bodies of types other than JSON
  are left unread.
