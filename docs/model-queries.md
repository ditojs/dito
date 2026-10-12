# Dito.js Model Queries

Dito.js offers a query builder interface to SQL queries based on
[Objection.js' `QueryBuilder`](http://vincit.github.io/objection.js/#querybuilder),
which in turn is an extension of
[Knex.js' `Query Builder`](http://knexjs.org/#Builder).

Any Objection.js query statement is also a valid Dito.js query, so Objection.js'
documentation is a valuable source of information.

Dito.js offers a row of query builder extensions as well as short-cuts to them
from other classes. This means that Dito.js queries don't always translate back
to Objection.js one to one. Please keep that in mind when posting questions on
the Objection.js Gitter chat. See
[Differences to Objection.js](#differences-to-objectionjs) for a list of
differences between the two.

Listed below are only the Ditos.js extensions to its `QueryBuilder`, everything
else remains the same as in the documentation linked to above.

An easy way to play around with and familiarize yourself with queries is to
start the Dito.js console:

```sh
pnpm run console
```

You can use `.debug()` on any query to directly log SQL statement to console.

## Scope Methods

### `withScope(name, …)`
### `applyScope(name, …)`
### `allowScope(name, …)`
### `clearWithScope()`
### `clearAllowScope()`
### `ignoreScope()`

## Filter Methods

### `applyFilter(name, ...args)`
### `allowFilter(name, …)`

## Mutation Methods

In addition to Objection.js' many database methods, ...:

### `truncate()`
### `insert(data)`
### `upsert(data)`

Inserts the models, or updates the ones whose ids exist already, atomically
through `insert(data).onConflict(idColumns).merge()`. The ids come from the
data, and the models are validated as full models, like in `insert()`.

### `upsertAndFetch(data)`

Upserts the models like `upsert()`, and fetches them like `insertAndFetch()`.
Their relations are left untouched.

### `patchAndFetch(data)`
### `updateAndFetch(data)`

Also accept arrays of models, each patched or updated by its id in one
transaction. Models without ids are rejected: insert them with
`insertAndFetch()`. Their relations are left untouched, as with single models.

## Find Methods

### `find(query, options)`

## Dito.js Graph Methods

### `insertDitoGraph(data, options)`
### `insertDitoGraphAndFetch(data, options)`
### `upsertDitoGraph(data, options)`
### `upsertDitoGraphAndFetch(data, options)`
### `upsertDitoGraphAndFetchById(id, data, options)`
### `updateDitoGraph(data, options)`
### `updateDitoGraphAndFetch(data, options)`
### `updateDitoGraphAndFetchById(id, data, options)`
### `patchDitoGraph(data, options)`
### `patchDitoGraphAndFetch(data, options)`
### `patchDitoGraphAndFetchById(id, data, options)`

Graphs can use `#id` / `#ref` references, including references that create
cycles, e.g. a `belongsTo` relation that refers to a model created in a
`hasMany` relation of the same graph. Objection.js resolves such cycles by
inserting the owner without the foreign key and patching it in afterwards,
which requires the foreign key column to be nullable (or its constraint to be
deferrable). Cycles that can't be resolved this way are rejected with an error.

Objection.js' other graph control properties are rejected with a
`GraphError` (400), as graphs often come from clients: `'#dbRef'` would relate
existing models by id, even where relating is disabled, and `'#unrelate'` /
`'#delete'` would override the `noUnrelate` / `noDelete` options. This also
applies to `upsertAndFetch()` and to the arrays that `patchAndFetch()` and
`updateAndFetch()` accept. Code that needs them can use Objection.js' own
`insertGraph()` and `upsertGraph()`.

## Raw Methods

### `raw(…)`
### `selectRaw(…)`

## Short-Cuts to Query Methods

## Differences to Objection.js

- Dito.js models have versions of all common `QueryBuilder` methods as short-
  cuts that can be called directly on the model class, without having to call
  `Model.query()` first: `Model.query().where(…)` simply becomes
  `Model.where(…)`, and everything else carries on normally from there.

- Dito.js models give access to their relations and their queries through
  special relation accessors. See
  [Model Relations – Relation Accessors](./model-relations#relation-accessors)
  for more information about these accessors.
