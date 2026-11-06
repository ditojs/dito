# MikroORM

```js
import {
  defineModelController,
  defineListHandler,
  defineChoices,
  crud,
  defineFilter,
  defineTextFilter,
  defineDateRangeFilter,
  setRecord,
  createRecord,
  assignRecord,
  defineJsonType,
  getAssetPaths,
  defineMikroConfig,
  createMikroAdapter,
  useEm,
  createEntityUserSource
} from '@ditojs/mikro'
import '@ditojs/mikro/types'
```

`@ditojs/mikro` builds model controllers on [MikroORM](https://mikro-orm.io) 7
entities. It supports PostgreSQL only. Its peer dependencies are
`@mikro-orm/core` and `@mikro-orm/sql` 7.2 or later, `kysely`, `hono`, `zod` and
`@ditojs/server`. See [Entities and controllers](../../guide/server/mikro.md)
and [Writes](../../guide/server/writes.md) in the guide.

Entities need a single primary key. If an entity has a composite key or none,
its controller throws on its first request.

## defineModelController()

```ts
defineModelController<T>(
  definition: ModelControllerDefinition<T>
): ControllerDefinition
```

Returns a [controller](controllers.md#controllerdefinition) of an entity. The
controller has a base layer beneath the definition and its mixins. The base
holds two things:

- the default handlers of the keys that the definition or its mixins set, such
  as `'get': true`;
- the middleware that sets `getRecord()`, `find()`, `list()` and
  `getListQuery()`.

After the handlers of an action have run, the controller flushes and serializes.
This happens inside the transaction and inside the middleware. `authorize`,
`transacted`, the schemas and the middleware come from the definition and its
mixins.

### ModelControllerDefinition

The keys of [`ControllerDefinition`](controllers.md#controllerdefinition), and:

| Key       | Type                                             | Description                                                                                                                                                                                              |
| --------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`  | `EntityClass`                                    | The entity of the controller.                                                                                                                                                                            |
| `find`    | [`Find`](#find)                                  | What the controller loads and returns. It can also be a function that returns it.                                                                                                                        |
| `filters` | `Record<string, Filter>`                         | The filters that lists take in `filter=name:args`, see [Filters](#filters).                                                                                                                              |
| `load`    | `({ c, id }) => Promise<T \| null \| undefined>` | Loads the record of a record action, in place of the default, which loads it through `find`. It gets the id as sent, also one that isn't a key, such as `self`. `null` or `undefined` responds with 404. |

### Default handlers

| Key          | Handler                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get`        | [`defineListHandler()`](#definelisthandler), which returns the list, see [Lists](#lists).                                                                                                              |
| `post`       | Runs `deserialize`, then [`createRecord()`](#createrecord). The new record becomes `getRecord()`. Responds with 201 and `Location`, also when a layer replaces the handler and returns the new record. |
| `get :id`    | Returns `getRecord()`.                                                                                                                                                                                 |
| `patch :id`  | Runs `deserialize` with the record, then [`assignRecord()`](#assignrecord).                                                                                                                            |
| `delete :id` | Removes the record with `em.remove()` and flushes. Responds with `{ count: 1 }`.                                                                                                                       |

There is no default `put`. There is also no default write to all records at
once. Custom actions handle these, such as `'post order'`. The [`crud`](#crud)
mixin routes all five default handlers.

### Variables

The base sets these variables in the handler's context and in `c.var`. The
handlers and the middleware of all layers read them. `authorize` runs before the
base sets them.

| Variable         | Description                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | The id of a record action, converted to the type of the primary key: a number for integer keys. An id that doesn't fit the key responds with 404. With `load`, the id stays a string, such as `self`. `params.id` is always the string of the path. |
| `entity`         | The entity of the controller. `em.getMetadata(entity)` returns its metadata, such as its `tableName`.                                                                                                                                               |
| `getRecord()`    | Loads the record of the id through `load` or `find`, once per request. A missing record responds with 404. In other actions, it returns the record that a handler set with [`setRecord()`](#setrecord), such as the one that `post` creates.        |
| `find()`         | Queries the records of the controller, see [find()](#find-1).                                                                                                                                                                                       |
| `list()`         | Runs the list of the controller, see [list()](#list).                                                                                                                                                                                               |
| `getListQuery()` | Returns the `where`, `orderBy` and `range` of the list, see [getListQuery()](#getlistquery).                                                                                                                                                        |

### Serialize and deserialize

`defineModelController()` adds these keys to controllers and mixins:

```ts
beforeSerialize?: ({ records, c }) => unknown
serialize?: ({ record, json, c }) => unknown
deserialize?: ({ json, record, c }) => unknown
```

- `beforeSerialize` runs once per response, before `serialize`. The layers run
  it in layer order. It gets the controller's outgoing records as an array, also
  for a single record. It doesn't run when there are no records. It can load
  what `serialize` needs in one query.
- `serialize` shapes each outgoing record of the controller. The layers run it
  in layer order.
- `deserialize` shapes the body of the default `post` and `patch :id`. The
  layers run it in the reverse order.

See
[Serialize and deserialize](../../guide/server/controllers.md#serialize-and-deserialize)
in the guide.

### What the base does

- Without `load`, `getRecord()` loads the record with `em.findOne()` through the
  controller's `find`. So a record that `find.where` hides responds with 404.
- An id fits the primary key if it is an integer within the range of the column,
  or a UUID. The base converts UUIDs to lower case.
- After the handler of a write, the base flushes the entity manager once. Then
  it loads the controller's records in the result again, in one query and in the
  shape of `find`. They then hold the values that formulas and triggers set.
- The controller's records in a result go through `beforeSerialize` and
  `serialize`, see [Output](#output).
- Records of other entities go out through MikroORM's `serialize()`, with the
  relations that are loaded.
- Nothing goes out through `toJSON()`.

## Find

```ts
interface FindShape<T> extends FindOptions<T> {
  where?: object
  maxRows?: number
}
type Find<T> = FindShape<T> | (({ c, user }) => FindShape<T> | Promise<FindShape<T>>)
```

`find` decides what a controller loads and returns. It holds MikroORM's
[find options](https://mikro-orm.io/docs/entity-manager), such as `populate`,
`fields`, `exclude`, `orderBy` and `filters`, MikroORM's entity filters. It
also holds two keys of its own:

- `where` applies to every query of the controller.
- `maxRows` limits the rows of a list, see [Lists](#lists).

The rules of `find`:

- `limit`, `offset`, `ctx`, `disableIdentityMap` and `lockMode` throw, because
  the base controls them. In an object, they throw when the controller is
  defined. In a function, they throw on the request.
- A function gets `{ c, user }`. It runs once per request, on the first query,
  after `getUser`. So middleware that runs before Dito sets the user can't query
  through it.
- `fields` and `exclude` both work. MikroORM can't take both, so the query gets
  `fields`, and the output leaves out what `exclude` names.
- Dito passes no serialization groups to MikroORM's `serialize()`. So properties
  with groups go out like other properties. Use `fields`, `exclude` and `hidden`
  instead.

### Output

Records go out in the shape of `find`:

- `fields` and `exclude` go to MikroORM's `serialize()`. Each row keeps its
  primary key.
- Two kinds of relations go out as nested rows: those of `populate`, and those
  of the paths in `fields`, such as `author` of `author.name`. MikroORM
  populates the relations of the paths itself, so `find` doesn't repeat them in
  `populate`.
- Any other relation to one row that holds the foreign key goes out as `{ id }`,
  such as `author: { id: 3 }`. An empty one goes out as `null`. This also
  applies when a handler loaded the row, and to nested rows, such as `book` in
  the rows of `chapters`.
- With `fields`, such a relation only goes out where `fields` names it, as
  `relation.id` or `*`. `relation.id` joins the table of the relation, and
  `relation` doesn't.
- `exclude: ['<name>']` leaves the relation out.
- Hidden relations stay out unless `populate` names them.
- Other relations don't go out, even when a handler loaded them. These are the
  relations to many rows, and the inverse side of a one-to-one relation.
- `relation.*` in `fields` stands for the columns of the relation that aren't
  lazy. Lazy formulas stay out. To load a lazy property, name it too.
- A relation that `populate` adds without paths in `fields` goes out with all
  its columns.

### find()

```ts
find<T>(options?: FindShape<T>): Promise<T[]>
```

```js
'post order': {
  body: z.array(z.object({ id: z.int(), order: z.int() })),
  async handler({ body, find }) {
    const records = await find({
      where: { id: { $in: body.map(({ id }) => id) } }
    })
    // …
  }
}
```

`find()` is a variable of the handler's context and of `c.var`. It queries the
records of the controller through the controller's `find`, merged with
`options`. Custom actions use it to see the same records as the default
handlers. It has no row limit. The records go out in the controller's shape.

The merge:

- joins the `where`s with `$and`, so the records stay within the controller's;
- merges `filters` by name, where `true`, `false` and lists of names replace;
- replaces the other options, such as `populate`, `fields` and `exclude`;
- leaves out the controller's `populate` when `options` sets `fields` without a
  `populate` of its own. So a narrow list loads no more than it sends. The paths
  in `fields` still populate their relations.

## Lists

Lists take these query parameters:

| Parameter          | Example              | Description                                                                                                                                                                                                                                                                                 |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter=name:args` | `filter=author.id:3` | A [filter](#filters) of the controller, with its arguments as JSON. Several arguments give an array. Unknown filters respond with 400.                                                                                                                                                      |
| `order=name dir`   | `order=name desc`    | Orders by a column of the entity, or by `relation.id`. `relation.id` is the foreign key of a relation to one row, and needs no join. The rows must return the column, so that the order reveals nothing about hidden values. Repeat it for several columns. Other columns respond with 400. |
| `range=start,end`  | `range=0,49`         | Responds with `{ results, total }` instead of an array. `results` holds the rows from `start` to `end`, both included. `total` counts the rows after the filters.                                                                                                                           |

The list applies `find.where`, the filters and MikroORM's entity filters. They
apply to the rows and to the total. Without `order`, the order of `find.orderBy`
applies. The primary key breaks ties, so that pages don't overlap. `order` takes the columns that the list's
rows return, or those of the controller's own list.

A list returns at most 1000 rows. The `maxRows` of its `find` changes the
limit, such as `defineListHandler({ maxRows: 50 })`. `Infinity` lifts it. A
larger `range` responds with 400. A list without `range` that has more rows
responds with 400 too.

## defineListHandler()

```ts
defineListHandler(find?: FindShape): Handler
```

```js
actions: {
  // The root pages only.
  'get': defineListHandler({ where: { parentPage: null } })
}
```

Returns the handler of a list, `({ list }) => list(find)`. The default `get` is
`defineListHandler()`.

## defineChoices()

```ts
defineChoices(find: FindShape): MixinDefinition
```

```js
mixins: [defineChoices({ fields: ['id', 'name'], orderBy: { name: 'asc' } })]
// GET /book-categories/choices → [{ id, name }, …]
```

Returns a mixin that routes `get choices`, a list for the options of a select.
The action is `'get choices': defineListHandler({ maxRows: Infinity, ...find })`.
So it returns all rows of the list, as a select needs, and takes the same
filters. A `find` with `fields` names the relations that it sends, in its paths
or in its own `populate`.

## list()

```ts
list<T>(find?: FindShape<T> & { query?: URLSearchParams | Record<string, string | string[]> }): Promise<T[] | { results: T[]; total: number }>
```

```js
// The filtered, ordered ids of the list, such as for an export.
'get ids': async ({ list }) => {
  const rows = await list({ fields: ['id'], maxRows: Infinity })
  return rows.map(({ id }) => id)
}
```

`list()` is a variable of the handler's context and of `c.var`. It runs the list
of the controller:

- the controller's `find`, merged with `find` as in [`find()`](#find-1);
- the controller's filters, and `order` and `range`;
- the row limit.

The rows go out in the merged shape. `query` replaces the list parameters of
the URL. When the request has `range`, `list()` returns `{ results, total }`
instead of the rows.

## getListQuery()

```ts
getListQuery(find?: FindShape & { query?: URLSearchParams | Record<string, string | string[]> }): Promise<{ where: object; orderBy: object[]; range: [number, number] | null }>
```

```js
async 'get export'({ em, getListQuery, c }) {
  const { where, orderBy } = await getListQuery()
  const rows = await em.find(Loan, where, { orderBy })
  return sendFile(c, toCsv(rows), { filename: 'loans.csv' })
}
```

`getListQuery()` is a variable of the handler's context and of `c.var`. It
returns the `where`, `orderBy` and `range` that [`list()`](#list) uses for the
same arguments:

- `where` is `find.where` joined with the filters;
- `orderBy` is the `order` of the request, else `find.orderBy`, with the primary
  key last;
- `range` is the `range` of the request.

It fails with 400 where the list does. Use it for queries over the rows of the
list, such as summaries and exports. MikroORM's default entity filters apply to
these queries. The `filters` of `find` don't.

## crud

```ts
crud: MixinDefinition
```

```js
defineModelController({
  path: 'tags',
  entity: Tag,
  authorize: 'editor',
  mixins: [crud]
})
```

A mixin that routes the five [default handlers](#default-handlers). Writes
still need `authorize`.

## setRecord()

```ts
setRecord(c: Context, record: unknown): void
```

Sets the record that `getRecord()` returns, such as the one that a custom `post`
creates.

## ListQuery

```ts
interface ListQuery {
  filter: { name: string; value: string | string[] }[]
  order: { property: string; direction: 'asc' | 'desc' }[]
  range: [number, number] | null
}
```

The parsed `filter=`, `order=` and `range=` parameters of a list's URL. Invalid
values respond with 400.

## Filters

```ts
type Filter =
  | z.ZodType
  | {
      schema: z.ZodType
      where: ({
        value,
        name,
        c,
        em
      }) => object | undefined | Promise<object | undefined>
    }
```

```js
filters: {
  author: z.number().int(),
  tag: defineFilter({
    schema: z.string(),
    where: ({ value }) => ({ tags: { name: value } })
  }),
  status: defineFilter({
    schema: z.enum(['draft', 'published', 'all']),
    where: ({ value }) =>
      value === 'all' ? undefined : { published: value === 'published' }
  })
}
```

Each filter validates its value with a Zod schema:

- Dito converts the strings of the arguments to what the schema expects, as for
  [query values](controllers.md#query-values).
- Several arguments give an array, which only an array schema accepts.
- Invalid values respond with 400, with `errors` keyed by the filter's name.
- A schema that throws gives the code `custom` and the message `Invalid input`.

`where` gets one object, with these keys:

- `value`, the output of the schema;
- `name`, the filter's name;
- `c`;
- `em`.

It returns a MikroORM `where`, or `undefined` to skip the filter. A schema alone
is short for a filter whose `where` returns `{ [name]: value }`. The list joins
`find.where` and the filters with `$and`. This also applies to a filter that the
URL repeats, such as one from a scope and one from the filter panel.

Filters that apply to every query, such as soft deletes or tenants, are
MikroORM's [entity filters](https://mikro-orm.io/docs/filters) with
`default: true`.

### defineFilter()

```ts
defineFilter<S extends z.ZodType>(filter: {
  schema: S
  where: (context: {
    value: z.output<S>
    name: string
    c: DitoContext
    em: EntityManager
  }) => object | undefined | Promise<object | undefined>
}): Filter
```

Returns the filter as it is. It only types the `value` of `where` by the output
of the schema.

### defineTextFilter()

```ts
defineTextFilter(properties?: string[]): Filter
```

```js
filters: {
  name: defineTextFilter(['firstName', 'lastName']),
  createdAt: defineDateRangeFilter()
}
```

Reads what the admin's `text` filter sends: `filter=name:"text"`, or
`filter=name:"operator","text"`.

- It matches rows where one of `properties` holds the text, ignoring case.
- `properties` defaults to the property of the filter's name.
- The operators are `contains`, the default, `equals`, `starts-with` and
  `ends-with`.
- `%` and `_` in the text match themselves.
- An empty text skips the filter.

### defineDateRangeFilter()

```ts
defineDateRangeFilter(property?: string): Filter
```

Reads what the admin's `date-range` filter sends: `filter=name:"from","to"`, as
ISO date-times with a time zone.

- It matches rows whose `property` lies between the two, including them.
- `property` defaults to the property of the filter's name.
- Either value may be empty. Two empty values skip the filter.

## createRecord()

```ts
createRecord<T>(em: EntityManager, entity: EntityName<T>, data: unknown): Promise<T>
```

Creates a record from a body and returns it, as `post` does after
`deserialize`. It:

1. runs the
   [checks of the body](../../guide/server/writes.md#the-checks-of-a-body);
2. checks the ids of relations;
3. creates the new rows of `#id` and `#ref`;
4. calls `em.create()`.

It doesn't flush.

## assignRecord()

```ts
assignRecord<T>(em: EntityManager, record: T, data: unknown): Promise<T>
```

Assigns a body to a record and returns the record, as `patch :id` does after
`deserialize`. Only the fields that `data` sends change. Its arrays of owned
rows are the full set. Relations link by id. In this order, it:

1. runs the checks of the body;
2. loads the owned rows and the many-to-many collections that `data` writes, in
   one `em.populate()`;
3. checks that the ids of owned rows belong to the record;
4. checks the ids of relations that the record doesn't link yet;
5. creates the new rows of `#id` and `#ref`;
6. calls `em.assign()`.

It doesn't flush.

## defineJsonType()

```ts
defineJsonType<S extends z.ZodType>(options: {
  schema?: S
  assets?: { path: string; storage: string; maxSize?: number | string }[]
}): Type<z.output<S>>
```

```js
specs: p.type(defineJsonType({ schema: specsSchema })).nullable(),
images: p
  .type(defineJsonType({ assets: [{ path: '', storage: 'public' }] }))
  .nullable(),
items: p.type(
  defineJsonType({
    schema: itemsSchema,
    assets: [{ path: '**/file', storage: 'public' }]
  })
)
```

Returns the custom type of a JSON column, for `p.type()`.

- The column's type follows the output of `schema`. Without a schema, it is
  `any`.
- The [checks of a body](../../guide/server/writes.md#the-checks-of-a-body)
  validate the column's value with `schema`.
- A schema that throws responds with 400 at the property, with the code
  `custom`.
- Any custom type can carry a schema in a `schema` getter, see
  [Rules on values](../../guide/server/writes.md#rules-on-values).

`assets` says where the column holds files. A column can hold several:

- `path` is the data path inside the value. It takes `*` and `**` wildcards, and
  `''` for the value itself.
- `storage` is the name of the storage.
- `maxSize` is the size limit of its uploads, imports and copies: a number of
  bytes, or a string with a unit, such as `'500mb'`, as in the admin, see
  [Uploads](storage.md#uploads).

## getAssetPaths()

```ts
getAssetPaths(entities: object): AssetPath[]
```

```js
const paths = getAssetPaths(entities)
const assets = createAssets({ adapter, paths, storages })
```

Returns the asset paths that the `assets` of
[`defineJsonType()`](#definejsontype) declare, for `@ditojs/storage`.

- It takes an array of entities, or a module of them.
- It reads their definitions, so it needs no ORM.
- Table and column names follow MikroORM's default naming strategy, unless a
  property sets its own.

## defineMikroConfig()

```ts
defineMikroConfig<T>(options: T): T
```

```js
const orm = new MikroORM(defineMikroConfig({ dbName, entities }))
```

Adds what Dito's entities need to the options of `new MikroORM()`.
[`createMikroAdapter()`](#createmikroadapter) requires it. `entities` can also
be a module of entities. `defineMikroConfig()` leaves out the module's other
exports. It keeps the app's own `subscribers` and `discovery` hooks.

It changes these things:

- `p.date()` columns hold the local day. MikroORM's own type sends a `Date` as a
  UTC time, and Postgres cuts it to the UTC day. It does the same with a string
  with a time. These columns store both as the day in the server's time zone.
  This applies to writes, to `em.create()` and to queries. They take and return
  `YYYY-MM-DD` strings as they are.
- New rows get the defaults of their `defineJsonType()` schemas, also with
  `em.create()`. Updates write the value as sent.
- `em.remove()` deletes what the schema says. A flush loads the rows that go
  with a removed row, through `orphanRemoval` or a cascade of removes. So these
  rows needn't be loaded.
- The rows that refer to a removed row keep their foreign keys, unless the rule
  is `set null`. So the database applies its delete rules. A member with loans
  stays when the rule refuses the delete, also when the loans are loaded.
- A pivot entity with an id of its own logs a warning, see
  [Known limitations](../../upgrading-to-7.x.md#known-limitations).

## createMikroAdapter()

```ts
createMikroAdapter(orm: MikroORM): Adapter & { getKysely(): Kysely<any> }
```

```js
const orm = new MikroORM(defineMikroConfig({ entities }))
app.route('/api', createApi({ controllers, adapter: createMikroAdapter(orm) }))
```

Returns the `adapter` of [`createApi()`](api.md#adapter):

- `connect()` forks the entity manager for each request. The fork becomes `em`
  of the handler's context, and `c.var.em`.
- `transaction` runs the action in a transaction of the request's entity
  manager. While it runs, `em` is the transaction's entity manager. When the
  action throws, the transaction rolls back.
- `toHttpError()` maps MikroORM's errors, see
  [Database errors](#database-errors).
- `getKysely()` returns a Kysely on the ORM's pool, outside of any transaction.
  Sessions, credentials and jobs use it. `orm.em.getKysely()` joins the current
  transaction instead.

## guardEntity()

```ts
guardEntity(entity: EntityClass, actions: Actions): void
```

Runs `actions` around the default actions of every model controller of `entity`,
such as `{ 'patch :id': handler }`. They add no routes, and `next()` runs the
default action.

## useEm()

```ts
useEm(): EntityManager
```

```js
import { useEm } from '@ditojs/mikro'

function countBooks() {
  return useEm().count(Book)
}
```

Returns the entity manager of the running request. During a transaction, this is
the transaction's entity manager. It is the same as `em` of the handler's
context, and `c.var.em`.

It throws outside of a request, and in the `middleware` of `createApi()`, which
runs before the API sets `c.var.em`. Jobs and scripts have no request, and use a
fork of `orm.em`.

`createApi()` and `createAdmin()` run Hono's `contextStorage()`, which `useEm()`
needs.

## @ditojs/mikro/types

```js
import '@ditojs/mikro/types'
```

Types `em` of the handlers and `c.var.em` as MikroORM's `EntityManager` of
`@mikro-orm/sql`, for apps written in TypeScript. One import anywhere in the app
types them everywhere. `em.getKysely()` returns the Kysely of the request's
entity manager, which runs in its transaction. Use it for queries that MikroORM
doesn't build.

## createEntityUserSource()

```ts
createEntityUserSource<U>(entity: EntityClass<U>, options: {
  orm: { em: EntityManager }
  usernameProperty?: string
  where?: object
  serialize: string[] | (({ user }) => unknown)
  computed?: Record<string, ({ user }) => unknown>
  password?: ZodType<string>
})
```

Returns the methods that find, change and serialize the users of an entity.
[`createUsers()`](auth.md#createusers) of `@ditojs/auth` calls it, and adds them
to its result. Apps use `createUsers()`.

It queries with the request's entity manager. Outside of a request, such as in
session middleware outside of the API, it queries with a fork of `orm.em`.

| Option             | Description                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `usernameProperty` | The property of the username. Default: `username`.                                                 |
| `where`            | A condition that users also need to meet, such as `{ isActive: true }`.                            |
| `serialize`        | The properties that clients get, plus `computed`. It can also be a function that returns the JSON. |
| `password`         | The schema of new passwords. Default: a string of at least 8 characters.                           |

The entity hides `hash` with `.hidden()`, so that no response sends it. The
source throws when it loads users of an entity that doesn't.

`findById()` finds no user for an id that doesn't fit the primary key.
`patch()` writes the values with `nativeUpdate()` and sets them on the user. It
doesn't flush the request's other changes.

## Database errors

`createMikroAdapter()` maps the errors of MikroORM and Postgres to these
responses:

| Error                           | Response                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `NotFoundError`                 | 404                                                                           |
| `OptimisticLockError`           | 409                                                                           |
| Postgres `23502`, not null      | 400 at the column                                                             |
| Postgres `23505`, unique        | 409 at the key columns                                                        |
| Postgres `23503`, foreign key   | 400 at the relation; 409 on a delete, or on a table the request doesn't write |
| Postgres `23514`, check         | 400 at the column named by the constraint, such as `article_title_check`      |
| Postgres `22…`, data exceptions | 400 without a field                                                           |
| other constraint violations     | 409                                                                           |
| other driver errors             | 500                                                                           |

In requests of a model controller, errors on the table of its entity point at
the property, such as `name`. All other errors respond with the status only.
This includes errors on the tables of nested rows, and errors of an entity that
owns rows of its own table.
