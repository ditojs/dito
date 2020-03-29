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
yarn console
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
### `upsertAndFetch(data)`

## Find Methods

### `find(query, options)`

## Dito Graph Methods

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

### `upsertCyclicDitoGraph(data, options)`
### `upsertCyclicDitoGraphAndFetch(data, options)`
### `upsertCyclicDitoGraphAndFetchById(data, options)`

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
