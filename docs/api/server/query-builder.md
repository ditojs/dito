# `class` QueryBuilder

```js
import { QueryBuilder } from '@ditojs/server'
```

Dito.js' `QueryBuilder` extends [Objection.js'
`QueryBuilder`](https://vincit.github.io/objection.js/api/query-builder/),
and is what [`Model.query()`](model.md#static-query) returns. This page lists
what Dito.js adds or changes; all other methods are Objection.js' and Knex's.
[Queries](../../guide/server/queries.md) shows how to use them.

Differences to Objection.js that apply to all queries:

- Model property names in `where…`, `having…`, `select`, `column(s)`,
  `first`, `groupBy` and `orderBy` are expanded to table-qualified references
  (`title` → `Book.title`, `*` → `Book.*`), also with aliases
  (`title AS name`), so that they stay unambiguous in joins.
- `findById()`, `patchAndFetchById()`, `updateAndFetchById()`,
  `deleteById()` and the `…ById()` graph methods report the id in their
  [`NotFoundError`](errors.md).
- Graph writes (`upsert()`, `patchAndFetch()` / `updateAndFetch()` with arrays,
  inserts of several models outside PostgreSQL, and the [graph
  methods](#graph-methods)) reject Objection.js' graph control
  properties `#dbRef`, `#unrelate` and `#delete` with a
  [`GraphError`](errors.md), thrown when the method is called, as such graphs
  often come from clients.

## Scopes

Scopes are defined in [`Model.scopes`](model.md#static-scopes). Names starting
with `^` are graph scopes: they also apply to all relations loaded in the
query's graph. Scopes are applied when the query executes, except with
`applyScope()`. The `default` scope is applied to normal find queries only:
not to writes, counts or other special selects.

### withScope()

```js
query.withScope(...scopes, checkAllowedScopes?)
```

Adds scopes to apply when the query executes. Falsy names are skipped.

#### Parameters

| Name                 | Type       | Description                                                                                            |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `scopes`             | `string[]` | Scope names, `^name` for graph scopes.                                                                 |
| `checkAllowedScopes` | `boolean`  | A trailing boolean: whether to check the scopes against [`allowScope()`](#allowscope). Default `true`. |

Returns `this`. Throws a [`QueryBuilderError`](errors.md) for scopes that aren't
allowed.

```js
const books = await Book.query().withScope('published', 'withChapters')
```

### applyScope()

```js
query.applyScope(...scopes, checkAllowedScopes?)
```

Like [`withScope()`](#withscope), but applies the scopes right away, so that
they can override earlier statements. Returns `this`.

### clearWithScope()

```js
query.clearWithScope()
```

Removes the scopes added through `withScope()`, keeping the `default` scope.
Returns `this`.

### ignoreScope()

```js
query.ignoreScope(...scopes)
```

Ignores the given scopes, or all scopes, the `default` scope included, when
called without arguments. Returns `this`.

```js
const all = await Book.query().ignoreScope('default')
```

A scope can ignore other scopes too, e.g. to load all books in the admin. As
the `default` scope is applied when the query executes, such a scope has to be
applied with `applyScope()` (or the `scope` query parameter) to take effect;
through `withScope()` it comes too late.

```js
static scopes = {
  default: query => query.whereNotNull('publishedAt'),
  unfiltered: query => query.ignoreScope('default')
}

const all = await Book.query().applyScope('unfiltered')
```

### allowScope()

```js
query.allowScope(...scopes)
```

Restricts the scopes that can be requested to the given ones, plus `default`.
Controllers use this for the `scope` query parameter. Returns `this`.

### clearAllowScope()

```js
query.clearAllowScope()
```

Allows all scopes again. Returns `this`.

## Filters

### applyFilter()

```js
query.applyFilter(name, ...args)
query.applyFilter({ [name]: args })
```

Applies filters of [`Model.filters`](model.md#static-filters), combined with
`AND`. The arguments are passed to the filter in the order of its
`parameters`, which validate and coerce them when the query executes; invalid
arguments reject the query with a [`ValidationError`](errors.md).

#### Parameters

| Name   | Type                          | Description                                               |
| ------ | ----------------------------- | --------------------------------------------------------- |
| `name` | `string \| { [name]: any[] }` | The filter name, or several filters with their arguments. |
| `args` | `any[]`                       | The filter's arguments.                                   |

Returns `this`. Throws a [`QueryBuilderError`](errors.md) for unknown filters
and filters that aren't allowed.

```js
const books = await Book.query()
  .applyFilter('title', 'contains', 'dune')
  .applyFilter({ publishedAt: ['2020-01-01', null] })
```

### allowFilter()

```js
query.allowFilter(...filters)
```

Restricts the filters that can be applied to the given ones. Returns `this`.

## Query parameters

### find()

```js
query.find(params, allowParam?)
```

Applies query parameters, e.g. those of a request's query string. Keys ending
in `[]` are handled like their name without it. Each parameter is handled by
the handler registered under its name in [`QueryParameters`](#queryparameters).
Does nothing without `params`.

| Parameter | Value                     | Effect                                                                                                        |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `scope`   | `string \| string[]`      | [`applyScope()`](#applyscope).                                                                                |
| `filter`  | `string \| string[]`      | [`applyFilter()`](#applyfilter), each as `name:args`, with the arguments as JSON (`title:"contains","dune"`). |
| `range`   | `[from, to] \| 'from,to'` | Objection.js' `range(from, to)`, resolving to `{ total, results }`.                                           |
| `limit`   | `number`                  | `limit()`.                                                                                                    |
| `offset`  | `number`                  | `offset()`.                                                                                                   |
| `order`   | `string \| string[]`      | `orderBy()`, each as `'property [asc\|desc] [first\|last]'`.                                                  |

`order` takes properties of the queried model only; ordering by columns of
joined relations isn't supported.

#### Parameters

| Name         | Type                              | Description                                            |
| ------------ | --------------------------------- | ------------------------------------------------------ |
| `params`     | `object \| null`                  | The parameters.                                        |
| `allowParam` | `string[] \| { [name]: boolean }` | The parameters to allow. Default: all registered ones. |

Returns `this`. Throws a [`QueryBuilderError`](errors.md) for parameters that
aren't allowed or registered, and for invalid values.

```js
const page = await Book.query().find({
  scope: 'published',
  order: ['publishedAt desc', 'title'],
  range: '0,19'
})
```

## Selects

### omit()

```js
query.omit(...properties)
```

Omits properties from the JSON of the resulting models. Returns `this`.

### pluck()

```js
query.pluck(property)
```

Resolves to the values of one property instead of the models, or to one value
after `first()`.

```js
const titles = await Book.query().pluck('title')
```

Returns `this`.

### loadDataPath()

```js
query.loadDataPath(dataPath, options?)
```

Loads what a data path needs: selects a root property, or adds the relations
along the path to the graph. Throws a [`QueryBuilderError`](errors.md) if the
path goes beyond a property that isn't of type `object` or `array`.

#### Parameters

| Name       | Type                 | Description                               |
| ---------- | -------------------- | ----------------------------------------- |
| `dataPath` | `string \| string[]` | The data path, e.g. `'chapters/*/title'`. |
| `options`  | `WithGraphOptions`   | Options for [`withGraph()`](#withgraph).  |

Returns `this`.

### hasNormalSelects()

```js
query.hasNormalSelects()
```

Returns `boolean`: whether the query has `select()`, `column()` or `columns()`.

### hasSpecialSelects()

```js
query.hasSpecialSelects()
```

Returns `boolean`: whether the query only has special selects, such as
`count()`, `distinct()`, `min()`, `max()`, `sum()` or `avg()`.

### selectRaw()

```js
query.selectRaw(sql, bindings?)
```

Short-cut for `select(raw(sql, bindings))`.

```js
const [{ total }] = await Book.query().selectRaw('count(*) as ??', ['total'])
```

Returns `this`.

### raw()

```js
query.raw(sql, bindings?)
```

Creates a Knex raw expression bound to the query.

```js
const query = Book.query()
const books = await query.where('price', '>', query.raw('?', [10]))
```

Returns `Knex.Raw`.

### toSQL()

```js
query.toSQL()
```

Compiles the query without executing it.

```js
const { sql, bindings } = Book.query().where('id', 1).toSQL()
// 'select "Book".* from "Book" where "Book"."id" = ?', [1]
```

Returns `{ sql: string, bindings: unknown[] }`.

## Graphs

### withGraph()

```js
query.withGraph(expr, options?)
```

Objection.js' `withGraph()`. Relations that are already loaded keep their
algorithm; new ones use the last one used (`'fetch'` by default). Only `'fetch'`
and `'join'` are supported, other algorithms throw a
[`QueryBuilderError`](errors.md). Scopes don't load graphs on queries that
aren't normal finds, e.g. counts. Returns `this`.

### withGraphFetched() / withGraphJoined()

```js
query.withGraphFetched(expr, options?)
query.withGraphJoined(expr, options?)
```

`withGraph()` with `algorithm: 'fetch'` / `'join'`. Returns `this`.

## Writes

### insert() / insertAndFetch()

```js
query.insert(data)
query.insertAndFetch(data)
```

Objection.js' methods, which insert arrays of models without their relations,
in one transaction. MySQL inserts them only with their ids: insert them with
`insertGraph()` otherwise.

```js
const books = await Book.query().insert([{ title: 'Dune' }, { title: 'Emma' }])
```

Returns `QueryBuilder` resolving to the inserted model(s).

### upsert() / upsertAndFetch()

```js
query.upsert(data)
query.upsertAndFetch(data)
```

```js
const book = await Book.query().upsert({ id: 1, title: 'Dune' })
const books = await Book.query().upsertAndFetch([
  { id: 1, title: 'Dune' },
  { title: 'Emma' }
])
```

Saves models by their ids: patches the ones that exist and inserts those
without ids or with ids that don't exist yet, in one transaction. Like
`patch()`, they leave relations untouched; use
[`upsertGraph()`](#graph-methods) for graphs. `upsert()` resolves
to the models as passed, `upsertAndFetch()` refetches them; like other finds,
the refetch applies the `default` scope, so models outside it are missing from
the result. Models are found by their ids only: the query rejects when it also
has `where()` conditions.

#### Parameters

| Name   | Type                 | Description   |
| ------ | -------------------- | ------------- |
| `data` | `object \| object[]` | The model(s). |

Returns `QueryBuilder` resolving to the model(s).

### patchAndFetch() / updateAndFetch()

```js
query.patchAndFetch(data)
query.updateAndFetch(data)
```

```js
const books = await Book.query().patchAndFetch([
  { id: 1, title: 'Dune' },
  { id: 2, title: 'Emma' }
])
```

Objection.js' methods, also accepting arrays of models, each patched or updated
by its id, in one transaction, without their relations. Models without ids throw
a [`QueryBuilderError`](errors.md) (status 400), ids that don't exist reject
with a [`NotFoundError`](errors.md). As with `upsertAndFetch()`, the refetch
applies the `default` scope. Returns `QueryBuilder` resolving to the model(s).

### truncate()

```js
query.truncate({ restart?, cascade? })
```

Empties the table. On PostgreSQL, `restart` (default `true`) restarts the
identity sequences and `cascade` (default `false`) truncates referencing tables
too. Other databases ignore the options.

```js
await Review.query().truncate() // The next review gets id 1 again.
```

Returns `QueryBuilder`.

## Graph methods

```js
query.insertGraph(data, options?)
query.insertGraphAndFetch(data, options?)
query.upsertGraph(data, options?)
query.upsertGraphAndFetch(data, options?)
query.upsertGraphAndFetchById(id, data, options?)
query.patchGraph(data, options?)
query.patchGraphAndFetch(data, options?)
query.patchGraphAndFetchById(id, data, options?)
query.updateGraph(data, options?)
query.updateGraphAndFetch(data, options?)
query.updateGraphAndFetchById(id, data, options?)
```

Objection.js' `insertGraph()` and `upsertGraph()`, with defaults suited to
data from clients, and `patchGraph()` and `updateGraph()`, which write through
`upsertGraph()` with their own defaults. All write graphs in Objection.js'
[strict mode](https://ditojs.github.io/objection/guide/query-examples.html#strict-mode),
which throws for graphs that it can't write as they say, and run in a
transaction of their own, unless the query already is in one:

- Related models with an id or a `#ref` are related as references: only
  their ids are written, plus the `extra` properties of join tables, the rest
  of their data is left out. Models without ids are inserted. `#id` / `#ref`
  references are allowed.
- Relations with [`owner: true`](model.md#static-relations) insert and delete
  their models instead of relating and unrelating them.
- Relations can override the settings through
  [`graphOptions`](model.md#static-relations), and calls through `options`.
- `…ById()` methods take the id separately and report it in a
  [`NotFoundError`](errors.md).
- `…AndFetch…()` methods refetch the graph.

| Method    | Root models                        | `owner` relations                                       | Other relations                          |
| --------- | ---------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| `insert…` |                                    | `added: 'insert'`                                       | `added: 'relate'`                        |
| `upsert…` | `added: 'insert'`                  | `removed: 'delete'`, `added: 'insert'`                  | `removed: 'unrelate'`, `added: 'relate'` |
| `patch…`  | `added: 'throw'`                   | `removed: 'delete'`, `added: 'throw'`                   | `removed: 'unrelate'`, `added: 'relate'` |
| `update…` | `added: 'throw'`, `kept: 'update'` | `removed: 'delete'`, `added: 'throw'`, `kept: 'update'` | `removed: 'unrelate'`, `added: 'relate'` |

The other settings are `kept: 'patch'` and `created: 'insert'`. All methods
pass `allowRefs: true`, and all but `insert…` pass
`fetchStrategy: 'OnlyNeeded'`.

#### Parameters

| Name      | Type                 | Description                                                       |
| --------- | -------------------- | ----------------------------------------------------------------- |
| `id`      | `Id \| Id[]`         | The root model's id, an array for composite ids (`…ById()` only). |
| `data`    | `object \| object[]` | The graph(s).                                                     |
| `options` | `GraphWriteOptions`  | Overrides of the defaults, see below.                             |

`GraphWriteOptions`, the options of strict `upsertGraph()` calls. `insert…`
takes the options of strict `insertGraph()` calls, without `fetchStrategy` and
with only the `added` and `created` settings:

| Key             | Type                                                | Description                                                                                                                                    |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`          | `GraphRootSettings`                                 | Settings of the root models, merged into the defaults.                                                                                         |
| `relations`     | `{ [expression]: GraphRelationSettings }`           | Settings by relation expression, e.g. `'*'` or `'chapters'`, applied in their order after the defaults and `graphOptions`, setting by setting. |
| `fetchStrategy` | `'OnlyNeeded' \| 'OnlyIdentifiers' \| 'Everything'` | What upserts fetch to find the changes.                                                                                                        |
| `allowRefs`     | `boolean`                                           | Allow `#ref` references.                                                                                                                       |

The settings are `removed`, `added`, `kept` and `created`, see Objection.js'
[strict mode](https://ditojs.github.io/objection/guide/query-examples.html#strict-mode).
The options of non-strict graphs, like `relate` or `noDelete`, throw.

Returns `QueryBuilder` resolving to the model(s).

```js
// `chapters` is a relation with `owner: true`, `author` a normal one:
const book = await Book.query().patchGraphAndFetchById(1, {
  title: 'Dune',
  author: { id: 3 }, // Related by its id, its other data isn't written
  chapters: [
    { id: 7, title: 'Prologue' }, // Patched
    { title: 'Epilogue' } // Inserted
  ] // The book's other chapters are deleted
})

// Keep the chapters that the graph leaves out:
await Book.query().patchGraph(data, {
  relations: { chapters: { removed: 'preserve' } }
})

// Insert related models with their ids, instead of relating them:
await Book.query().insertGraph(data, {
  relations: { '*': { added: 'insert' } }
})
```

Hooks of the models that run queries need to run them in
`context.transaction`, see
[strict mode](https://ditojs.github.io/objection/guide/query-examples.html#strict-mode).

## Overrides

These Objection.js methods are overridden to carry Dito.js' scope, filter and
graph state: `clone()` copies all of it; `childQueryOf()` makes child queries
inherit the graph scopes (internal queries inherit none).

## Dialect

### getDialect()

```js
query.getDialect()
```

Returns `string | null`: the dialect of the query's Knex client, e.g.
`'postgresql'`.

### isPostgreSQL() / isMySQL() / isSQLite() / isMsSQL()

```js
query.isPostgreSQL()
```

Returns `boolean`: whether the dialect is `'postgresql'`, `'mysql'`, `'sqlite3'`
or `'mssql'`.

## Static methods

### `static` mixin()

```js
QueryBuilder.mixin(target)
```

Defines the [query short-cuts](model.md#query-short-cuts) on `target`, each
calling `this.query()[method](…)`. Applied to `Model`; methods that `target`
already has are skipped with a warning.

## QueryParameters

```js
import { QueryParameters } from '@ditojs/server'
```

The registry of the parameter handlers of [`find()`](#find).

| Method                          | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `register(name, handler)`       | Registers a handler `(query, key, value) => void`. |
| `register({ [name]: handler })` | Registers several.                                 |
| `get(name)`                     | The handler, or `undefined`.                       |
| `has(name)`                     | Whether a handler is registered.                   |
| `getAllowed()`                  | `{ [name]: true }` for all registered parameters.  |

```js
QueryParameters.register('author', (query, key, value) => {
  query.where('authorId', value)
})
```

## QueryFilters

```js
import { QueryFilters } from '@ditojs/server'
```

The registry of filter types for `{ filter: name }` in
[`Model.filters`](model.md#static-filters), with the same methods as
`QueryParameters`. A definition is `{ parameters?, handler(query, property,
...args) }`, or the handler function itself with an optional `parameters`
property. The handler receives the filter's property name, then the arguments,
validated against `parameters`: as one object when `parameters` is an object
of schemas, as separate arguments when it is an array. Declare custom types in
the `QueryFilterTypes` interface for TypeScript.

Built-in filter types:

| Type           | Arguments           | Effect                                                                                                                                                                     |
| -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'text'`       | `(operator?, text)` | Case-insensitive match: `'contains'`, `'equals'`, `'starts-with'` or `'ends-with'`. A missing, `null` or empty operator matches like `'contains'`. Empty text matches all. |
| `'date-range'` | `(from, to)`        | Dates between `from` and `to`, either of them `null` for an open range.                                                                                                    |

```js
QueryFilters.register('prefix', {
  parameters: { text: { type: 'string' } },
  handler(query, property, { text }) {
    query.where(property, 'like', `${text}%`)
  }
})
```
