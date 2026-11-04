# MikroORM

```js
import {
  defineController,
  listHandler,
  choices,
  crud,
  textFilter,
  dateRangeFilter,
  setRecord,
  parseListQuery,
  createRecord,
  assignRecord,
  schemaJson,
  SchemaJson,
  assetsJson,
  getAssetPaths,
  mikroOptions,
  mikroDb,
  getEntityManager,
  getKysely,
  entityUserSource
} from '@ditojs/mikro'
```

Model controllers on [MikroORM](https://mikro-orm.io) 7 entities, for
PostgreSQL. Peer dependencies: `@mikro-orm/core` and `@mikro-orm/sql` 7.2 or
later, `kysely`, `hono`, `zod` and `@ditojs/server`. See
[Entities and controllers](../../guide/server/entities.md) and
[Writes](../../guide/server/writes.md) in the guide.

Entities need a single primary key. For an entity with a composite key or none,
the controller throws on its first request.

## defineController()

```ts
defineController<T>(definition: MikroControllerDefinition<T>): ControllerDefinition
```

Returns a [controller](controllers.md#controllerdefinition) of an entity. It
puts a base layer before the definition and its mixins. The base holds the
default handlers of the keys that the definition or its mixins set, such as
`'get': true`, and the middleware that sets `record()`, `find()`, `list()` and
`listQuery()`. After the handlers of each key, the controller flushes and
serializes, inside the transaction and the middleware. `authorize`,
`transaction`, the schemas and the middleware come from the definition and its
mixins.

### MikroControllerDefinition

The keys of [`ControllerDefinition`](controllers.md#controllerdefinition), and:

| Key       | Type                                         | Description                                                                                                                                                                                             |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`  | `EntityClass`                                | The entity of the controller.                                                                                                                                                                           |
| `find`    | [`Find`](#find)                              | What the controller loads and returns, or a function of Hono's context `c` that returns it.                                                                                                             |
| `filters` | `Record<string, Filter>`                     | What `filter[name]=value` may narrow in lists, see [Filters](#filters).                                                                                                                                 |
| `load`    | `(c, id) => Promise<T \| null \| undefined>` | Loads the record of a member action in place of the default, which loads it through `find`. `null` or `undefined` responds with 404. It gets the id as sent, also one that isn't a key, such as `self`. |

### Default handlers

| Key          | Handler                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get`        | [`listHandler()`](#listhandler): the list, see [Lists](#lists).                                                                                                                                |
| `post`       | Runs `deserialize`, then [`createRecord()`](#createrecord). The new record becomes `record()`. Answers 201 with `Location`, even when a layer replaces the handler and returns the new entity. |
| `get :id`    | Returns `record()`.                                                                                                                                                                            |
| `patch :id`  | Runs `deserialize` with the record, then [`assignRecord()`](#assignrecord).                                                                                                                    |
| `delete :id` | Removes the record with `em.remove()`, flushes, and responds with `{ count: 1 }`.                                                                                                              |

There is no default `put`, and no default write on the whole list. Custom
actions handle these, such as `'post order'`. The [`crud`](#crud) mixin routes
all five.

### Variables

The base sets these variables in the handler's input and in `c.var`, for the
handlers and the middleware of the layers. `authorize` runs before them.

| Variable      | Description                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | The id of a member action, converted by the primary key: a number for integer keys. An id that doesn't fit the key responds with 404. With `load`, it stays a string, such as `self`. `params.id` is always the string of the path.          |
| `record()`    | Loads the record of the id once per request, through `load` or `find`. A missing record responds with 404. On other actions, it returns the record that a handler set with [`setRecord()`](#setrecord), such as the one that `post` creates. |
| `find()`      | Queries the records of the controller, see [find()](#find-1).                                                                                                                                                                                |
| `list()`      | Runs the list of the controller, see [list()](#list).                                                                                                                                                                                        |
| `listQuery()` | Returns the `where`, `orderBy` and `range` of the list, see [listQuery()](#listquery).                                                                                                                                                       |

### Serialize and deserialize

`defineController()` adds these keys to controllers and mixins:

```ts
beforeSerialize?: (c: DitoContext, records: any[]) => unknown
serialize?: (c: DitoContext, record: any, json: any) => unknown
deserialize?: (c: DitoContext, json: unknown, record?: any) => unknown
```

`beforeSerialize` runs once per response, in layer order, before `serialize`. It
gets the outgoing records of the controller as an array, also for a single
record, and doesn't run without records. It can load what `serialize` needs in
one query. `serialize` shapes each outgoing record of the controller, in layer
order. `deserialize` shapes the body of the default `post` and `patch :id`, in
the reverse order. See
[Serialize and deserialize](../../guide/server/controllers.md#serialize-and-deserialize)
in the guide.

### What the base does

- Without `load`, `record()` loads the record with `em.findOne()` through the
  controller's `find`, so rows that `find.where` hides respond with 404. An id
  fits the primary key if it is an integer within the range of the column, or a
  UUID, which the base converts to lower case.
- After the handler of a write, the base flushes the entity manager once. Then
  it loads the controller's records in the result again in one query, in the
  shape of `find`, with the values that formulas and triggers set.
- The controller's records in a result go through `beforeSerialize` and
  `serialize`, see [Output](#output). Other entities go out through MikroORM's
  `serialize()`, with the relations that are loaded. Nothing goes out through
  `toJSON()`.

## Find

```ts
interface FindShape<T> extends FindOptions<T> {
  where?: FilterQuery<T>
  maxRows?: number
}
type Find<T> = FindShape<T> | ((c: DitoContext) => FindShape<T> | Promise<FindShape<T>>)
```

`find` decides what a controller loads and returns. It holds MikroORM's
[find options](https://mikro-orm.io/docs/entity-manager), such as `populate`,
`fields`, `exclude`, `orderBy` and `filters`, the entity filters, plus two keys.
Every query of the controller applies `where`, and `maxRows` limits the rows of
a list, see [Lists](#lists).

- `limit`, `offset`, `ctx`, `disableIdentityMap` and `lockMode` throw, because
  the base controls them. An object throws when the controller is defined, a
  function on the request.
- A function runs once per request, on the first query, after `getUser`, so it
  can read `c.var.user`. Middleware that runs before Dito sets the user can't
  query through it.
- `fields` and `exclude` both work. MikroORM can't take both, so the query gets
  `fields`, and the output leaves out what `exclude` names.
- Dito passes no serialization groups to MikroORM's `serialize()`, so properties
  with groups go out like other properties. Use `fields`, `exclude` and `hidden`
  instead.

### Output

Records go out in the shape of `find`:

- `fields` and `exclude` go to MikroORM's `serialize()`. Each row keeps its
  primary key.
- The relations of `populate` and of the paths in `fields`, such as `author` of
  `author.name`, go out as nested rows. MikroORM populates the latter itself, so
  `find` doesn't repeat them in `populate`.
- Any other relation to one row that holds the foreign key goes out as `{ id }`,
  or `null` when it is empty, such as `author: { id: 3 }`, even when a handler
  loaded the row. Nested rows have it too, such as `book` in the rows of
  `chapters`. With `fields`, it goes out where they name the relation,
  `relation.id` or `*`. `relation.id` joins the table of the relation, and
  `relation` doesn't. `exclude: ['<name>']` leaves it out. Hidden relations stay
  out unless `populate` names them.
- Other relations don't go out, even when a handler loaded them: relations to
  many rows and the inverse side of a one-to-one relation.
- `relation.*` in `fields` stands for the columns of the relation that aren't
  lazy, and lazy formulas stay out. To load a lazy property, name it too.
- A relation that `populate` adds without paths in `fields` goes out with all
  its columns.

### find()

```ts
find<T>(options?: FindShape<T>): Promise<T[]>
```

`find()` of the handler's input, and `c.var.find()`. Queries the controller's
entity through its `find`, merged with `options`. Use it in custom actions, so
that they see the same rows as the default handlers. It has no row limit. The
rows go out in the controller's shape. The merge:

- joins the `where`s with `$and`, so the rows stay within the controller's;
- merges `filters` by name. `true`, `false` and lists of names replace;
- replaces the other options, such as `populate`, `fields` and `exclude`;
- leaves out the controller's `populate` when `options` sets `fields` without a
  `populate` of its own, so that a narrow list loads no more than it sends. The
  paths in `fields` still populate their relations.

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

## Lists

Lists take these query parameters:

| Parameter            | Example               | Description                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter[name]=value` | `filter[author.id]=3` | A [filter](#filters) of the controller. A repeated filter gives an array. Unknown filters respond with 400.                                                                                                                                                                  |
| `order=name dir`     | `order=name desc`     | Orders by a column of the entity, or by `relation.id`, the foreign key of a relation to one row, which needs no join. The rows must return the column, so that the order reveals nothing about hidden values. Repeat it for several columns. Other columns respond with 400. |
| `range=start,end`    | `range=0,49`          | Responds with `{ results, total }` instead of an array, with the rows from `start` to `end`, both included. `total` counts the rows after the filters.                                                                                                                       |

The list applies `find.where`, the filters and MikroORM's entity filters to the
rows and to the total. Without `order`, the order of `find.orderBy` applies. The
primary key breaks ties. `order` takes the columns that the list's rows return,
or those of the controller's own list.

A list returns at most 1000 rows, or the `maxRows` of its find, such as
`listHandler({ maxRows: 50 })`. `Infinity` lifts the limit. A larger `range`
responds with 400. So does a list without `range` that has more rows.

## listHandler()

```ts
listHandler(find?: FindShape): Handler
```

Returns the handler of a list, `({ list }) => list(find)`. The default `get` is
`listHandler()`.

```js
actions: {
  // The root pages only.
  'get': listHandler({ where: { parentPage: null } })
}
```

## choices()

```ts
choices(find: FindShape): MixinDefinition
```

Returns a mixin that routes `get choices`, a list for the options of a select.
It is `'get choices': listHandler(find)`, so it shows the same rows as the list
and takes the same filters. A `find` with `fields` names the relations that it
sends in its paths or its own `populate`.

```js
mixins: [choices({ fields: ['id', 'name'], orderBy: { name: 'asc' } })]
// GET /book-categories/choices → [{ id, name }, …]
```

## list()

```ts
list<T>(find?: FindShape<T> & { query?: URLSearchParams | Record<string, string | string[]> }): Promise<T[] | { results: T[]; total: number }>
```

`list()` of the handler's input, and `c.var.list()`. Runs the list of the
controller: its `find` merged with `find`, as in [`find()`](#find-1), with the
controller's filters, `order`, `range` and the row limit. The rows go out in the
merged shape. `query` replaces the list parameters of the URL.

```js
// The filtered, ordered ids of the list, such as for an export.
'get ids': async ({ list }) => {
  const rows = await list({ fields: ['id'], maxRows: Infinity })
  return rows.map(({ id }) => id)
}
```

## listQuery()

```ts
listQuery(find?: FindShape & { query?: URLSearchParams | Record<string, string | string[]> }): Promise<{ where: object; orderBy: object[]; range: [number, number] | null }>
```

`listQuery()` of the handler's input, and `c.var.listQuery()`. Returns the
`where`, `orderBy` and `range` that [`list()`](#list) uses for the same
arguments: `find.where` with the filters, `order` or else `find.orderBy`, with
the primary key last, and the `range` of the request. It fails with 400 as the
list does. Use it for queries over the rows of the list, such as summaries and
exports. MikroORM's default entity filters apply to these queries, but the
`filters` of `find` don't.

```js
async 'get export'({ db, listQuery, c }) {
  const { where, orderBy } = await listQuery()
  const rows = await db.find(Order, where, { orderBy })
  return sendFile(c, toCsv(rows), { filename: 'orders.csv' })
}
```

## crud

```ts
crud: MixinDefinition
```

A mixin that routes the five [default handlers](#default-handlers). Writes still
need `authorize`.

```js
defineController({
  path: 'tags',
  entity: Tag,
  authorize: 'editor',
  mixins: [crud]
})
```

## setRecord()

```ts
setRecord(c: Context, record: unknown): void
```

Sets the record that `record()` returns, such as the one that a custom `post`
creates.

## parseListQuery()

```ts
parseListQuery(
  c: Context,
  params?: URLSearchParams | Record<string, string | string[]>
): ListQuery
interface ListQuery {
  filter: Record<string, string | string[]>
  order: { property: string; direction: 'asc' | 'desc' }[]
  range: [number, number] | null
}
```

Parses `filter[name]=`, `order=` and `range=` of the URL, or of `params`.
Invalid values respond with 400.

## Filters

```ts
type Filter =
  | z.ZodType
  | {
      schema: z.ZodType
      where: (
        value: any,
        c: DitoContext,
        name: string
      ) => object | undefined | Promise<object | undefined>
    }
```

Each filter validates its value with a Zod schema. Query values are
strings, so schemas of numbers, booleans and dates need to parse them, as the
[`q` schemas](controllers.md#ditojsserverzod) do. A repeated filter gives an
array, which only an array schema accepts. Invalid values respond with 400, with
`errors` keyed by the filter's name. A schema that throws gives the code
`custom` and the message `Invalid input`.

`where` gets the output of the schema, Hono's context `c` and the filter's name.
It returns a MikroORM `where`, or `undefined` to skip the filter. A schema alone
is short for a filter whose `where` returns `{ [name]: value }`. The list joins
`find.where` and the filters with `$and`.

```js
filters: {
  author: q.integer(),
  tag: { schema: z.string(), where: name => ({ tags: { name } }) },
  status: {
    schema: z.enum(['draft', 'published', 'all']),
    where: status =>
      status === 'all' ? undefined : { published: status === 'published' }
  }
}
```

Filters that apply to every query, such as soft deletes or tenants, are
MikroORM's [entity filters](https://mikro-orm.io/docs/filters) with
`default: true`.

### textFilter()

```ts
textFilter(...properties: string[]): Filter
```

Reads what the admin's `text` filter sends: `filter[name]=text`, or
`filter[name]=operator&filter[name]=text`. It matches rows where one of
`properties`, by default the property of the filter's name, holds the text,
ignoring case. The operators are `contains`, the default, `equals`,
`starts-with` and `ends-with`. `%` and `_` in the text match themselves. An
empty text skips the filter.

### dateRangeFilter()

```ts
dateRangeFilter(property?: string): Filter
```

Reads what the admin's `date-range` filter sends:
`filter[name]=from&filter[name]=to`, as ISO date-times with a time zone. It
matches rows whose `property`, by default the one of the filter's name, lies
between the two, including them. Either one may be empty, and two empty values
skip the filter.

```js
filters: {
  name: textFilter('firstName', 'lastName'),
  createdAt: dateRangeFilter()
}
```

## createRecord()

```ts
createRecord<T>(em: EntityManager, entity: EntityName<T>, data: unknown): Promise<T>
```

Creates a record from a body, as `post` does after `deserialize`, and returns
it. It runs the
[checks of the body](../../guide/server/writes.md#the-checks-of-a-body), checks
the ids of relations, creates the new rows of `#id` and `#ref`, and calls
`em.create()`. It doesn't flush.

## assignRecord()

```ts
assignRecord<T>(em: EntityManager, record: T, data: unknown): Promise<T>
```

Assigns a body to a record, as `patch :id` does after `deserialize`, and returns
the record. Only the fields that `data` sends change. Its arrays of owned rows
are the full set, and relations link by id. In order, it:

1. runs the checks of the body;
2. loads the owned rows and the many-to-many collections that `data` writes, in
   one `em.populate()`;
3. checks that the ids of owned rows belong to the record;
4. checks the ids of relations that the record doesn't link yet;
5. creates the new rows of `#id` and `#ref`;
6. calls `em.assign()`.

It doesn't flush.

## schemaJson()

```ts
schemaJson<S extends z.ZodType>(
  schema: S,
  options?: { assets?: { path: string; storage: string }[] }
): PropertyBuilder
class SchemaJson<S> extends JsonType {
  constructor(schema?: S, options?: { assets?: ColumnAsset[] })
  get schema(): S | undefined
  readonly assets: ColumnAsset[]
}
```

`schemaJson(schema)` is `p.json<Output>().type(new SchemaJson(schema))`. It
declares a JSON column whose value the
[checks of a body](../../guide/server/writes.md#the-checks-of-a-body) validate
with `schema`. The column's type follows the schema's output. A schema that
throws responds with 400 at the property, with the code `custom`. Any custom
type can carry a schema in a `schema` getter, see
[Rules on values](../../guide/server/writes.md#rules-on-values).

## assetsJson() and getAssetPaths()

```ts
assetsJson(storage: string, path = ''): PropertyBuilder
getAssetPaths(entities: object): AssetPath[]
```

`assetsJson()` declares a JSON column that holds files. `path` is the data path
inside the value, with `*` and `**` wildcards, and `storage` the name of the
storage. A column with a schema names its files in the `assets` option of
`schemaJson()`, as it can have several.

`getAssetPaths()` returns the asset paths of these columns
for `@ditojs/storage`. It takes an array of entities or a module of them, and
reads their definitions, so it needs no ORM. Table and column names follow
MikroORM's default naming strategy unless a property sets its own.

```js
images: assetsJson('public').nullable(),
items: schemaJson(itemsSchema, {
  assets: [{ path: '**/file', storage: 'public' }]
})

const assets = createAssets({ paths: getAssetPaths(entities), storages, db })
```

## mikroOptions()

```ts
mikroOptions<T>(options: T): T
```

Adds what Dito's entities need to the options of `new MikroORM()`:

- `p.date()` columns hold the local day. MikroORM's own type sends a `Date` as a
  UTC time, which Postgres cuts to the UTC day, and does the same with a string
  with a time. These columns store both as the day of the server's time zone, in
  writes, in `em.create()` and in queries. They take and return `YYYY-MM-DD`
  strings as they are.
- New rows get the defaults of their `schemaJson()` schemas, also with
  `em.create()`. Updates write the value as sent.
- `em.remove()` deletes what the schema says. A flush loads the rows that go
  with a removed row, through `orphanRemoval` or a cascade of removes, so they
  needn't be loaded. The rows that refer to a removed row keep their foreign
  keys, unless the rule is `set null`, so the database applies its delete rules.
  A customer with orders stays when the rule refuses the delete, also when the
  orders are loaded.
- A pivot entity with an id of its own logs a warning, see
  [Known limitations](../../upgrading-to-7.x.md#known-limitations).

It keeps the app's own `subscribers` and `discovery` hooks.

```js
const orm = new MikroORM(mikroOptions({ dbName, entities }))
```

## mikroDb()

```ts
mikroDb(orm: MikroORM): DbAdapter
```

Returns the `db` of [`createApi()`](api.md#dbadapter).

- `connect()` forks the entity manager for each request. The fork becomes `db`
  of the handler's input, and `c.var.db`.
- `transaction` runs the action in a transaction of the request's entity
  manager. While it runs, `db` is the transaction's entity manager. When the
  action throws, the transaction rolls back.
- `toHttpError()` maps MikroORM's errors, see
  [Database errors](#database-errors).

```js
const orm = new MikroORM(mikroOptions({ entities }))
app.route('/api', createApi({ controllers, db: mikroDb(orm) }))
```

## getEntityManager()

```ts
getEntityManager(c: Context): EntityManager
```

Returns the request's entity manager, `c.var.db`, typed, for middleware and
filters. Handlers read `db` of their input.

## getKysely()

```ts
getKysely(c: Context): Kysely<any>
```

Returns the Kysely instance of the request's entity manager, which runs in its
transaction, for queries that MikroORM doesn't build.

## entityUserSource()

```ts
entityUserSource<U>(entity: EntityClass<U>, options: {
  em?: EntityManager | (() => EntityManager)
  username?: string
  where?: object
  toJSON: string[] | ((c, user: U) => unknown)
  computed?: Record<string, (user: U) => unknown>
}): UserSource<U>
```

Returns the [`UserSource`](auth.md#usersource) of `@ditojs/auth` for an entity.
It queries with the request's entity manager, else with a fork of `em`, such as
in session middleware outside of the API.

- `username` is the property of the username, `username` by default.
- `where` is a condition that users also need to meet, such as
  `{ isActive: true }`.
- `toJSON` lists the properties that clients get, plus `computed`, or is a
  function that returns the JSON.

`findById()` finds no user for an id that doesn't fit the primary key. `patch()`
writes the values with `nativeUpdate()` and sets them on the user, without
flushing the request's other changes.

## Database errors

`mikroDb()` maps the errors of MikroORM and Postgres to these responses:

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
the property, such as `name`. All other errors respond with the status only,
such as those on the tables of nested rows, and those of an entity that owns
rows of its own table.
