# Queries

Models are read and written through queries. `Model.query()` starts one with
Dito.js' query builder, which extends
[Objection.js' query builder](https://vincit.github.io/objection.js/api/query-builder/),
which in turn builds on [Knex.js](https://knexjs.org/guide/query-builder.html).
Everything in their documentation works in Dito.js too.

```js
const books = await Book.query()
  .where('price', '<', 20)
  .withGraph('author')
  .orderBy('title')
```

The [`QueryBuilder` API](../../api/server/query-builder.md) lists what Dito.js
adds and changes.

To try out queries, start the [console](index.md#command-line-tool), and call
`.debug()` on a query to log its SQL.

## Short-cuts

Common query methods can be called on the model class directly, without
`query()`:

```js
const book = await Book.findById(1)
const cheapBooks = await Book.where('price', '<', 10)
const emma = await Book.findOne({ title: 'Emma' })
await Book.insert({ title: 'Persuasion', authorId: 2 })
```

The [`Model` API](../../api/server/model.md#query-short-cuts) lists them.
Methods that aren't among them, e.g. `orderBy()` or `limit()`, need `query()`
first, or follow one of the short-cuts.

## Property names

Use property names in queries; with `knex.normalizeDbNames`, Knex converts
them to column names. In `where…()`, `select()`, `orderBy()` and similar
methods, Dito.js also qualifies property names with the table, so that they
stay unambiguous in joins: `where('title', …)` queries `Book.title`.

## Reading

`findById()` and `findOne()` resolve to `undefined` when nothing is found. Add
`throwIfNotFound()` to respond with a 404 error instead:

```js
const book = await Book.findById(id).throwIfNotFound()
```

`Book.count()` counts the rows. `withGraph()` loads relations, see
[Relations](relations.md#loading-relations).

### Query parameters

`find()` applies query parameters as they arrive in a request's query string,
and is what [model controllers](controllers.md#model-controllers) use for
their `GET` requests: `scope` and `filter` (see [Scopes](#scopes) and
[Filters](#filters)), `order`, `range`, `limit` and `offset`:

```js
const page = await Book.query().find({
  scope: 'published',
  filter: 'title:"contains","garden"',
  order: ['publishedAt desc', 'title'],
  range: [0, 19]
})
// { total: 42, results: [Book, …] }
```

The second argument restricts the parameters that may be used, e.g.
`find(params, ['order', 'range'])`. See
[`find()`](../../api/server/query-builder.md#find) for the format of each
parameter; more can be registered through
[`QueryParameters`](../../api/server/query-builder.md#queryparameters).

## Writing

```js
const book = await Book.insertAndFetch({ title: 'Emma', authorId: 2 })
await Book.query().patch({ isAvailable: false }).where('stock', 0)
const updated = await Book.patchAndFetchById(book.id, { price: 9.5 })
await Book.deleteById(book.id)
```

- `insert()` and `insertAndFetch()` take one model or an array.
- `patch…()` changes only the given properties, `update…()` replaces the
  model.
- `patchAndFetch()` and `updateAndFetch()` also take an array of models with
  ids, and save each of them by its id. Models without ids throw.
- On a model instance, `book.$patch(data)` and `book.$update(data)` save and
  set the changes.

Writes validate the data, see [Validation](validation.md). Writes of arrays run
in one transaction.

`upsert()` and `upsertAndFetch()` save models by their ids: they patch the
models that exist, and insert the models without ids or with ids that don't
exist yet:

```js
const books = await Book.upsertAndFetch([
  { id: 1, price: 8 },   // Patched
  { title: 'Emma' }      // Inserted
])
```

Models are found by their ids only, so don't combine `upsert()` with
`where()` or `findById()`.

All these methods leave the relations of the models untouched. To save
relations too, use the graph methods.

## Graphs

A graph is a model with its related models, nested in the data:

```js
const book = await Book.upsertDitoGraphAndFetch({
  id: 1,
  title: 'Emma',
  author: { id: 2 },
  chapters: [
    { id: 7, title: 'Volume I' },
    { title: 'Volume II' }
  ]
})
```

Dito.js' graph methods save graphs through Objection.js' `insertGraph()` and
`upsertGraph()`, with defaults suited to data that comes from clients:

- `insertDitoGraph…()` inserts the graph. Related models that hold only an id
  are related, not inserted.
- `upsertDitoGraph…()` saves the graph: it inserts new models, patches
  existing ones, and unrelates or deletes related models that are missing
  from the graph.
- `patchDitoGraph…()` is like upsert, but doesn't insert models with ids that
  don't exist; `updateDitoGraph…()` is like patch, but replaces the models.

Each comes as `…Graph()`, `…GraphAndFetch()` and, except for insert,
`…GraphAndFetchById(id, data)`. Whether related models are inserted and
deleted, or related and unrelated, depends on the relation's
[`owner`](relations.md#owners) setting. Options passed as second argument, or
the relation's `graphOptions`, change this; see the
[graph methods in the API](../../api/server/query-builder.md#ditojs-graph-methods).

In the graph above, the book is related to the existing author 2, chapter 7
is patched, and the second chapter is inserted. As `chapters` is an owner
relation, its chapters that are missing from the graph are deleted.

Graphs can reference models created in the same graph with Objection.js'
`#id` and `#ref`:

```js
await Book.insertDitoGraph([
  { title: 'Emma', genres: [{ '#id': 'classic', name: 'Classic' }] },
  { title: 'Persuasion', genres: [{ '#ref': 'classic' }] }
])
```

As graphs often come from clients, the control properties `#dbRef`,
`#unrelate` and `#delete` are rejected with a
[`GraphError`](errors.md). Code that needs them can call Objection.js'
`insertGraph()` and `upsertGraph()` directly.

## Transactions

`Model.transaction()` runs a function in a transaction. Pass the transaction
to every query that should be part of it:

```js
await Order.transaction(async trx => {
  const order = await Order.query(trx).insertGraphAndFetch(data)
  for (const { bookId, quantity } of order.lines) {
    await Book.query(trx).findById(bookId).decrement('stock', quantity)
  }
  return order
})
```

The short-cuts on the model class don't take a transaction and always run
outside of it, also inside transacted actions: use `Model.query(trx)` for
queries in a transaction. Instance methods take it as last argument, e.g.
`book.$patch(data, trx)`.

Actions of controllers can run in a transaction of their own with
`transacted: true`, and receive it as `ctx.transaction`, see
[Controllers](controllers.md#transactions). Code that runs deeper in a
request reaches it as `app.requestLocals.transaction`.

## Raw SQL

Objection's `raw()` and Knex's `whereRaw()` and similar methods work as
usual. Dito.js adds `selectRaw()`:

```js
const counts = await Book.query()
  .ignoreScope('default')
  .select('authorId')
  .selectRaw('count(*) as count')
  .groupBy('authorId')
```

The [default scope](#the-default-scope) applies to queries that select
properties, so turn it off when it would break a grouped query, e.g. with its
`orderBy('title')`.

## Scopes

Scopes are named query conditions. The static `scopes` field holds them, each
a function that receives the query and changes it:

```js
export class Book extends Model {
  static scopes = {
    default: query => query.orderBy('title'),

    published: query => query
      .whereNotNull('publishedAt')
      .where('isArchived', false),

    inStock: query => query
      .withScope('published')
      .where('stock', '>', 0),

    withChapters: query => query
      .withGraph('chapters')
      .modifyGraph('chapters', query => query.orderBy('position'))
  }
}
```

Scopes are applied when the query runs:

```js
const books = await Book.query().withScope('inStock')
```

They can be applied in several places:

- On queries, with `withScope()` or `applyScope()`.
- Through the `scope` [query parameter](#query-parameters), e.g.
  `GET /api/books?scope=published`.
- In the `scope` setting of [relations](relations.md#loading-relations),
  applied whenever the relation is loaded.
- In the `scope` setting of [controllers](controllers.md#model-controllers),
  applied to all their queries.
- In relation expressions, where scopes work as modifiers:
  `withGraph('author.books(published)')`.

A scope can also be an object of [query parameters](#query-parameters),
applied through `find()`:

```js
static scopes = {
  newest: { order: 'publishedAt desc', limit: 10 }
}
```

Scopes that a model doesn't define are skipped, so a scope name can be applied
to models that don't all know it.

A subclass replaces a scope of the same name. To build on the scope of the
base class, call the second argument, `applyParentScope`:

```js
class Product extends Model {
  static scopes = {
    available: query => query.where('stock', '>', 0)
  }
}

export class Book extends Product {
  static scopes = {
    available: (query, applyParentScope) => applyParentScope(query)
      .whereNotNull('publishedAt')
  }
}
```

### The default scope

The scope named `default` is applied to every normal query that reads models
of the class, including relations loaded with `withGraph()`. It isn't applied
to writes, or to special selects such as `count()` or `distinct()`. It's the
place for a default order, or for conditions that always apply.

`ignoreScope('default')` turns it off for one query, and `ignoreScope()`
turns off all scopes:

```js
const allBooks = await Book.query().ignoreScope('default')
```

### Graph scopes

A scope name that starts with `^` is a graph scope: it applies to the query
and to every relation loaded through it, on all levels, in the models that
define the scope:

```js
const authors = await Author.query()
  .withGraph('books')
  .withScope('^published')
```

Here `published` applies to the books, and to the authors too if `Author`
had a `published` scope. This is useful when a whole graph should follow one
rule, e.g. a model controller of a public API that only shows published
content in all its data: `scope = '^published'`. The default scope is always a
graph scope.

### Allowing scopes

Scopes that come from requests can be restricted. `allowScope()` lists the
scopes that `withScope()` and the `scope` query parameter may use; others
throw a [`QueryBuilderError`](errors.md). The `default` scope is always
allowed:

```js
Book.query().allowScope('published', 'inStock').find(ctx.query)
```

Model controllers do this with their `allowScope` setting, see
[Controllers](controllers.md#model-controllers).

## Modifiers

`static modifiers` defines Objection.js
[modifiers](https://vincit.github.io/objection.js/recipes/modifiers.html):
functions that change a query when they are asked for, with `modify()` or in
relation expressions. Unlike scopes, they can take arguments:

```js
export class Book extends Model {
  static modifiers = {
    cheaperThan: (query, price) => query.where('price', '<', price),
    summary: query => query.select('id', 'title')
  }
}

const cheapBooks = await Book.query().modify('cheaperThan', 10)
const authors = await Author.query().withGraph('books(summary)')
```

Scopes work as modifiers too, and so do the prefixes `^name` (graph scope),
`!name` (ignore the scope), `@name` (select the property), `~name` (leave the
property out of the JSON data) and `*` (select all columns):

```js
const books = await Book.query()
  .withGraph('[author(@id, @name), reviews(!default)]')
```

The [`QueryBuilder` API](../../api/server/query-builder.md#scopes) describes
all scope methods.

## Filters

Filters are named query conditions that take arguments, e.g. a search text or
a date range. The static `filters` field holds them:

```js
export class Book extends Model {
  static filters = {
    // Built-in filter types, applied to the property of the same name:
    title: { filter: 'text' },
    publishedAt: { filter: 'date-range' },

    // A built-in type applied to several properties, combined with OR:
    search: { filter: 'text', properties: ['title', 'summary'] },

    // A filter with its own handler and validated parameters:
    price: {
      parameters: {
        min: { type: 'number' },
        max: { type: 'number' }
      },
      handler(query, { min, max }) {
        if (min != null) query.where('price', '>=', min)
        if (max != null) query.where('price', '<=', max)
      }
    },

    // A plain function:
    inStock: query => query.where('stock', '>', 0)
  }
}
```

The built-in types are `'text'` (with an operator: `'contains'`, `'equals'`,
`'starts-with'` or `'ends-with'`, and `'contains'` when the operator is left
out or empty) and `'date-range'` (`from` and `to`, either `null` for an open
range), see [`filters`](../../api/server/model.md#static-filters).

In code, `applyFilter()` takes the name and the arguments:

```js
const books = await Book.query()
  .applyFilter('title', 'starts-with', 'The')
  .applyFilter('inStock')
```

Requests apply filters through the `filter` query parameter of model
controllers, as `name:arguments`, with the arguments as JSON values separated
by commas. Several filters are combined with AND:

```text
GET /api/books?filter=title:"contains","garden"&filter=price:5,20
```

Filters are applied immediately, unlike scopes, which are applied when the
query runs. Applying a filter that isn't defined throws a
[`QueryBuilderError`](errors.md). The admin uses filters for the filter panels
of its lists, see the [admin guide](../admin/lists.md).

Model controllers accept all filters of their model by default; their
`allowFilter` setting restricts them, and so does `allowFilter()` on queries.

### Parameters

`parameters` describes the filter's arguments as schemas, like the parameters
of [controller actions](controllers.md#parameters). The arguments are coerced
to the schemas' types and validated; invalid arguments respond with a
[`ValidationError`](errors.md#validation-errors).

- An **object** of schemas passes the arguments to the handler as one object,
  keyed by the parameter names, as in `price` above.
- An **array** of schemas with `name` passes them as separate arguments.
  Set it on a function, as an object definition reads an array as
  `[parameters, options]`. A filter of `Review`:

  ```js
  minRating: Object.assign(
    (query, rating) => query.where('rating', '>=', rating),
    { parameters: [{ name: 'rating', type: 'integer', range: [1, 5] }] }
  )
  ```

### Filter types

More filter types can be registered with
[`QueryFilters`](../../api/server/query-builder.md#queryfilters):

```js
import { QueryFilters } from '@ditojs/server'

QueryFilters.register('prefix', {
  parameters: {
    text: { type: 'string' }
  },
  handler(query, property, { text }) {
    query.where(property, 'like', `${text}%`)
  }
})
```
