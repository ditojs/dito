# `class` Model

```js
import { Model } from '@ditojs/server'
```

`Model` extends [Objection.js' `Model`](https://vincit.github.io/objection.js/api/model/)
and replaces its `tableName`, `jsonSchema` and `relationMappings` with
declarative definitions: [`properties`](#static-properties),
[`relations`](#static-relations), [`scopes`](#static-scopes),
[`filters`](#static-filters), [`modifiers`](#static-modifiers),
[`schema`](#static-schema), [`hooks`](#static-hooks),
[`assets`](#static-assets) and [`options`](#static-options). Definitions are
inherited: each one is merged from the base class to the subclass, see
[`definition`](#static-definition).

Queries use Dito.js' [`QueryBuilder`](query-builder.md). Everything not listed
here is inherited from Objection.js. [Models](../../guide/server/models.md)
explains how to define them.

## Definitions

### `static` properties

```js
static properties = {
  [name]: ModelProperty
}
```

The model's properties as JSON schemas, extended by these keywords. The `id`
property (`type: 'integer', primary: true`), the foreign keys of relations, and
Objection's `#id` / `#ref` properties are added automatically.

| Key        | Type                | Description                                                                                                                       |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | `SchemaType`        | `'string'`, `'text'`, `'number'`, `'integer'`, `'boolean'`, `'object'`, `'array'`, `'null'`, `'date'`, `'datetime'`, `'timestamp'`, `'color'` (hex colors: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `'asset'` (an [asset file](storage.md#assetfileobject)), another [registered type](validator.md#types), or the name of a model, validated as that model's data. |
| `required` | `boolean`           | Requires a non-empty value: neither `null`, `undefined` nor `''`.                                                                 |
| `default`  | `any`               | The default value. `'now()'` is only used by migrations, not by validation.                                                       |
| `nullable` | `boolean`           | Allows `null`, and makes the column nullable in migrations.                                                                       |
| `primary`  | `boolean`           | Marks the primary key. Several primary properties form a composite key.                                                           |
| `foreign`  | `boolean`           | Marks a foreign key; migrations add a reference to the related table.                                                             |
| `index`    | `boolean`           | Adds an index in migrations.                                                                                                      |
| `unique`   | `boolean \| string` | Adds a unique constraint in migrations. Properties with the same string share one constraint.                                    |
| `unsigned` | `boolean`           | Makes an integer column unsigned in migrations.                                                                                   |
| `computed` | `boolean`           | A value that has no column, set by a getter or a `select … as`. Removed before writing to the database.                          |
| `hidden`   | `boolean`           | Removed when converting to JSON, e.g. for secrets.                                                                                |
| `specificType` | `string`        | A database-specific column type for migrations.                                                                                   |

The keywords of the [validator](validator.md), e.g. `validate`,
`validateAsync`, `instanceof`, `range` and `relate`, are available as well.

```js
static properties = {
  title: { type: 'string', required: true },
  isbn: { type: 'string', unique: true },
  summary: { type: 'text' },
  price: { type: 'number', minimum: 0 },
  stock: { type: 'integer', unsigned: true, default: 0 },
  isAvailable: { type: 'boolean', default: false },
  publishedAt: { type: 'date', nullable: true }
}
```

### `static` relations

```js
static relations = {
  [name]: ModelRelation
}
```

The model's relations to other models, see
[Relations](../../guide/server/relations.md).

| Key          | Type                                                                        | Description                                                                                                         |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `relation`   | `'belongsTo' \| 'hasOne' \| 'hasMany' \| 'manyToMany' \| 'hasOneThrough'`   | The relation type.                                                                                                  |
| `from`       | `string`                                                                    | `'Model.property'` on this side.                                                                                    |
| `to`         | `string`                                                                    | `'Model.property'` on the related side.                                                                             |
| `through`    | `{ from, to, extra? }`                                                      | The join of `manyToMany` / `hasOneThrough`: `from` / `to` name the columns of a join table (`'BookGenre.bookId'`), or the properties of a join model, which is then used for the join. `extra` lists join columns to add to the related models. Omitted: a join table named after both models, `BookGenre` with `bookId` and `genreId` for `Book.id` → `Genre.id` (`book_genre` with `normalizeDbNames`); it needs no model of its own. See [Join models and tables](../../guide/server/relations.md#join-models-and-tables). |
| `inverse`    | `boolean`                                                                   | Marks the inverse side of a relation without `through`, so that it uses the same join table as the other side: `Genre.books` with `inverse: true` also uses `BookGenre`. |
| `modelClass` | `string \| Class<Model>`                                                    | Overrides the related model taken from `to`.                                                                        |
| `scope`      | `string \| string[]`                                                        | Scopes of the related model applied when loading the relation.                                                      |
| `filter`     | `string \| { [name]: args[] } \| Function`                                  | Filters of the related model applied when loading. A function is an alias of `modify`.                              |
| `modify`     | `(query) => void \| object`                                                 | Modifies the relation's query. An object is applied through [`find()`](query-builder.md#find).                     |
| `nullable`   | `boolean`                                                                   | Makes the automatically added foreign key of a `belongsTo` relation nullable.                                       |
| `owner`      | `boolean`                                                                   | The relation owns its models: Dito.js graph methods insert and delete them instead of relating and unrelating.     |
| `graphOptions` | `DitoGraphOptions`                                                        | Overrides the options of the Dito.js graph methods for this relation. Without it, `owner: true` implies `{ relate: false, unrelate: false }`. |

A relation whose `relation` is an Objection.js relation class and that has a
`join` is passed to Objection.js unchanged. Other keys are passed on to
Objection.js' relation mapping.

```js
static relations = {
  author: {
    relation: 'belongsTo',
    from: 'Book.authorId',
    to: 'Author.id'
  },
  chapters: {
    relation: 'hasMany',
    from: 'Book.id',
    to: 'Chapter.bookId',
    owner: true,
    modify: query => query.orderBy('position')
  },
  genres: {
    relation: 'manyToMany',
    from: 'Book.id',
    to: 'Genre.id'
  }
}
```

```js
export class Genre extends Model {
  static relations = {
    books: {
      relation: 'manyToMany',
      from: 'Genre.id',
      to: 'Book.id',
      inverse: true
    }
  }
}
```

### `static` scopes

```js
static scopes = {
  [name]: (query, applyParentScope) => void
}
```

Named query modifications (see [Scopes](../../guide/server/queries.md#scopes)),
applied with [`withScope()`](query-builder.md#withscope) or
[`applyScope()`](query-builder.md#applyscope), through the `scope` query
parameter, or as defaults of controllers. The `default` scope applies to all
normal find queries. A scope can call `applyParentScope(query)` to apply the
scope of the same name of the base class. Instead of a function, a scope can be
an object of query parameters, applied through
[`find()`](query-builder.md#find).

```js
static scopes = {
  default: query => query.orderBy('title'),
  published: query =>
    query.whereNotNull('publishedAt').where('isArchived', false),
  withChapters: query => query.withGraph('chapters')
}
```

### `static` filters

```js
static filters = {
  [name]: ModelFilter
}
```

Named, parametrized query conditions (see
[Filters](../../guide/server/queries.md#filters)), applied with
[`applyFilter()`](query-builder.md#applyfilter) or the `filter` query parameter
(`?filter=name:arg1,arg2`, with JSON arguments). Several filters combine with
`AND`. A filter is one of:

- A function `(query, ...args) => void`, optionally with a `parameters`
  property.
- `{ handler, parameters? }`: `parameters` are validated and coerced first,
  invalid ones throw a `ValidationError`. An object of parameter schemas passes
  one object to the handler, an array of named schemas separate arguments. As
  with [controller actions](controllers.md#action-options), an array here is
  read as `[schema, options]`, so wrap an array of schemas, or use the function
  form. `response` is not validated.
- `{ filter, properties? }`: a registered filter type, see
  [`QueryFilters`](query-builder.md#queryfilters), applied to the property of
  the filter's name, or to each of `properties`, combined with `OR`. Built in:
  `'text'` (`operator`: `'contains'`, `'equals'`, `'starts-with'`,
  `'ends-with'`, or none for `'contains'`; `text`) and `'date-range'` (`from`,
  `to`).

```js
static filters = {
  title: { filter: 'text' },
  search: { filter: 'text', properties: ['title', 'summary'] },
  publishedAt: { filter: 'date-range' },
  minPrice: {
    parameters: { price: { type: 'number' } },
    handler(query, { price }) {
      query.where('price', '>=', price)
    }
  }
}
```

### `static` modifiers

```js
static modifiers = {
  [name]: (query, ...args) => void
}
```

Objection.js modifiers, applied with `query.modify(name)` and in relation
expressions. Names of scopes work as modifiers too, and so do these prefixes:
`^scope` (graph scope), `!scope` (ignore scope), `@column` (select),
`~property` (omit), `*` (select all).

```js
static modifiers = {
  summary: query => query.select('id', 'title')
}

await Book.query().withGraph('chapters(summary)')
```

### `static` schema

```js
static schema = { /* JSON schema */ }
```

Additions to the model's JSON schema, deep-merged into the schema built from
`properties`, e.g. a `validate` function across fields.

```js
static schema = {
  validate({ data }) {
    return !data.isAvailable || data.stock > 0
  }
}
```

### `static` hooks

```js
static hooks = {
  'before:find' | 'after:find' |
  'before:insert' | 'after:insert' |
  'before:update' | 'after:update' |
  'before:delete' | 'after:delete': (args) => any
}
```

Handlers of Objection.js' [static query
hooks](https://vincit.github.io/objection.js/api/model/static-methods.html#static-beforefind),
called with the model class as `this` and Objection's `StaticHookArguments`
(`items`, `inputItems`, `asFindQuery()`, `cancelQuery()`, `transaction`,
`context`, `relation`, `result`) plus `type`, the event name. Several
comma-separated events can share one key. The hooks of base classes run first;
a value returned by a handler replaces `result` for the following ones and the
query. `before:update` and `after:update` also run for patches.

```js
static hooks = {
  'before:insert, before:update'({ inputItems }) {
    for (const item of inputItems) {
      item.slug = item.title?.toLowerCase().replace(/\W+/g, '-')
    }
  }
}
```

### `static` assets

```js
static assets = {
  [dataPath]: { storage, readDimensions? }
}
```

Properties that hold uploaded files (`AssetFile` objects, `type: 'asset'`), by
data path, `*` and `**` wildcards included. Each names the
[storage](storage.md) that keeps the files; `readDimensions` reads the width
and height of images and videos uploaded through
[controller assets](controllers.md#assets). With an asset model registered
(see [`AssetMixin`](#assetmixin)), files are imported,
reference-counted and released automatically, see
[Application assets](application.md#assets).

```js
static properties = {
  cover: { type: 'asset', nullable: true },
  samplePages: { type: 'array', items: { type: 'asset' }, default: [] }
}

static assets = {
  cover: { storage: 'covers', readDimensions: true },
  samplePages: { storage: 'samplePages' }
}
```

### `static` options

```js
static options = { [name]: any }
```

Options that mixins read, merged like the other definitions. Only
[`UserMixin`](#usermixin) uses them, e.g. `usernameProperty`.

### `static` definition

```js
const { properties, relations, scopes } = Book.definition
```

The merged definitions (`options`, `properties`, `relations`, `schema`,
`scopes`, `filters`, `modifiers`, `assets`, `hooks`) of the class and its base
classes, each computed on first access. Definitions can be static getters, which
are called with the subclass as `this`, e.g. for abstract base classes whose
relations name the subclass. A subclass that sets a definition to `null` keeps
the inherited one.

## Static properties

| Name                       | Type                     | Description                                                                                  |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `app`                      | `Application`            | The application the model is added to.                                                       |
| `isInitialized`            | `boolean`                | Whether the application has initialized the model.                                           |
| `QueryBuilder`             | `Class<QueryBuilder>`    | Dito.js' [`QueryBuilder`](query-builder.md), used by all queries of the model.              |
| `tableName`                | `string`                 | The class name without a `Model` suffix (`BookModel` → `Book`).                              |
| `idColumn`                 | `string \| string[]`     | The `primary` properties, else `'id'`.                                                       |
| `jsonSchema`               | `object`                 | The JSON schema built from the definitions, with `$id` set to the class name.               |
| `relationMappings`         | `object`                 | The Objection.js relation mappings built from `relations`.                                   |
| `jsonAttributes`           | `string[]`               | Properties of type `object` / `array` that aren't computed and have no `specificType`.       |
| `booleanAttributes`        | `string[]`               | Boolean properties, converted from and to integers on SQLite.                                |
| `dateAttributes`           | `string[]`               | `date` properties, stored and returned as plain dates (`'2026-05-14'`), parsed as local midnight. |
| `datetimeAttributes`       | `string[]`               | `datetime` and `timestamp` properties.                                                       |
| `computedAttributes`       | `string[]`               | Computed properties. `virtualAttributes` returns the same.                                    |
| `hiddenAttributes`         | `string[]`               | Hidden properties.                                                                           |
| `cloneObjectAttributes`    | `boolean`                | Objection.js option, `false`.                                                                |
| `pickJsonSchemaProperties` | `boolean`                | Objection.js option, `true`: only schema properties are written to the database.             |
| `useLimitInFirst`          | `boolean`                | Objection.js option, `true`.                                                                 |

## Constructor

```js
const book = new Book({ title: 'Dune' })
```

A short-cut for `Book.fromJson(json, { skipValidation: true })`: sets the data
without validating it.

## Static methods

### `static` query()

```js
const query = Book.query(trx?)
```

Creates a [`QueryBuilder`](query-builder.md). Errors are converted to
[`ResponseError`](errors.md)s, database errors through
[`app.createDatabaseError()`](application.md#createdatabaseerror). Returns
[`QueryBuilder`](query-builder.md).

### `static` relatedQuery()

```js
const query = Book.relatedQuery('chapters', trx?)
```

Objection.js' `relatedQuery()`, aliased to the relation's name. Name the owners
with `for()`, or use it as a subquery. Returns
[`QueryBuilder`](query-builder.md).

### Query short-cuts

```js
const books = await Book.where('authorId', 1).withScope('published')
const book = await Book.findById(1)
```

These query builder methods are available on the class as short-cuts for
`Model.query().method()`: `first`, `find`, `findOne`, `findById`,
`withGraph`, `withGraphFetched`, `withGraphJoined`, `clearWithGraph`,
`withScope`, `applyScope`, `clearWithScope`, `clear`, `select`, `insert`,
`upsert`, `update`, `patch`, `delete`, `updateById`, `patchById`,
`deleteById`, `truncate`, `insertAndFetch`, `upsertAndFetch`,
`updateAndFetch`, `patchAndFetch`, `updateAndFetchById`,
`patchAndFetchById`, `insertGraph`, `upsertGraph`, `insertGraphAndFetch`,
`upsertGraphAndFetch`, all [Dito.js graph
methods](query-builder.md#ditojs-graph-methods), the `where…` methods
(`where`, `whereNot`, `whereRaw`, `whereWrapped`, `whereExists`,
`whereNotExists`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull`,
`whereBetween`, `whereNotBetween`, `whereColumn`, `whereNotColumn`,
`whereComposite`, `whereInComposite`, `whereNotInComposite`, `whereJson…`)
and the `having…` methods.

### `static` count()

```js
const count = await Book.count()
```

Counts the rows, with the arguments of
[`count()`](https://vincit.github.io/objection.js/api/query-builder/other-methods.html#count).
Returns `Promise<number>`.

### `static` fromJson()

```js
const book = Book.fromJson(json, options?)
const book = await Book.fromJson(json, { async: true })
```

Objection.js' `fromJson()`. With `async: true`, asynchronous validation
(`validateAsync`) is supported and a promise is returned.

#### Parameters

| Name      | Type           | Description                                                                 |
| --------- | -------------- | --------------------------------------------------------------------------- |
| `json`    | `object`       | The data.                                                                   |
| `options` | `ModelOptions` | Objection.js' model options, plus `async`, `graph` (validate relations too) and `mutable`. |

Returns `Model | Promise<Model>`.

### `static` transaction()

```js
const trx = await Book.transaction()
const result = await Book.transaction(async trx => { … })
const result = await Book.transaction(trx, async trx => { … })
```

Without arguments, starts a transaction. With a handler, runs it in a new
transaction, or in `trx` if given (`null` creates a new one). Returns
`Promise<Transaction>`, or `Promise` of the handler's result.

### `static` getReference()

```js
const ref = Book.getReference(1)
const ref = Book.getReference(book, ['title'])
```

Creates an instance holding only the identifiers of a model, or of id values (an
array for composite keys), plus `includeProperties`. Throws if the number of ids
doesn't match the id properties. Returns `Model`.

### `static` isReference()

```js
Book.isReference({ id: 1 }) // true
Book.isReference({ id: 1, title: 'Dune' }) // false
```

Returns whether the data holds nothing but the id properties, or only a `#ref`.

### `static` getProperty()

```js
const property = Book.getProperty('title')
```

Returns a property's definition, with a `$ref` to a definition resolved, and a
`type` inferred for `discriminator` (`'object'`) and uniform `oneOf` / `anyOf` /
`allOf` schemas. Returns `ModelProperty | null`.

### `static` getAttributes()

```js
const names = Book.getAttributes(property => property.type === 'string')
```

Returns `string[]`: the names of the properties the callback returns truthy for.

### `static` getScope()

```js
const scope = Book.getScope('published')
```

Returns `Function | undefined`: the merged scope function.

### `static` hasScope()

```js
Book.hasScope('published') // true
```

Returns `boolean`.

### `static` getModifiers()

```js
const modifiers = Book.getModifiers()
```

Returns `Record<string, Function>`: the merged modifiers.

### `static` getRelatedRelations()

```js
const relations = Author.getRelatedRelations()
```

Returns `Relation[]`: the relations of other models that point to this model.

### `static` getPropertyOrRelationAtDataPath()

```js
const { property, relation, dataPath, nestedDataPath, expression } =
  Book.getPropertyOrRelationAtDataPath('chapters/*/title')
```

Resolves a data path (a string or an array of tokens) through the model's
relations to the first property, relation or root wildcard it reaches. Array
wildcards (`*`) are allowed after many-relations; `**` after a relation throws
a `ModelError`.

#### Return value

| Key              | Type                     | Description                                                  |
| ---------------- | ------------------------ | ------------------------------------------------------------ |
| `property`       | `ModelProperty \| null`  | The property reached.                                        |
| `relation`       | `Relation \| null`       | The last relation passed.                                    |
| `wildcard`       | `'*' \| '**' \| null`    | A root wildcard.                                             |
| `dataPath`       | `string \| null`         | The matched part of the path.                                |
| `nestedDataPath` | `string \| null`         | The rest, inside the property's JSON.                        |
| `name`           | `string`                 | The property or relation name, `'*'` for wildcards.          |
| `expression`     | `string \| null`         | A relation expression that loads the data path.              |

### `static` filterGraph()

```js
const filtered = Book.filterGraph(graph, '[author, chapters]')
```

Removes the relations from a model graph that the relation expression doesn't
include. Returns `Model | Model[]`.

### `static` populateGraph()

```js
const book = await Book.populateGraph(graph, '[author, genres]', trx?)
```

Replaces the references in a model graph (models holding only ids) along the
relation expression with the models loaded from the database. Returns
`Promise<Model | Model[] | null>`.

### `static` on() / off() / once() / emit()

```js
Book.on('after:insert', ({ result }) => { … })
```

The model class is an asynchronous event emitter, see the
[event methods](application.md#event-methods) of the application;
[`hooks`](#static-hooks) are its listeners. `emit()` resolves to the listeners'
results.

### `static` getDialect() / isPostgreSQL() / isMySQL() / isSQLite() / isMsSQL()

```js
if (Book.isPostgreSQL()) { … }
```

The dialect of the model's Knex client. Returns `string | null` / `boolean`.

## Lifecycle hooks

### `static` configure()

```js
static configure(app)
```

Called by [`app.addModels()`](application.md#addmodels): binds the model to
the app and its Knex instance, registers the hooks and asset handling, and the
relation accessors.

### `static` setup()

```js
static setup()
```

Called once by [`app.setupModels()`](application.md#setupmodels), before
`initialize()`. Internal: dito's mixins override it, e.g.
[`UserMixin`](#usermixin) defines its password property here, and call
`super.setup()`. Apps override [`initialize()`](#static-initialize)
instead, which needs no `super`.

### `static` initialize()

```js
static async initialize()
```

Called once by [`app.setupModels()`](application.md#setupmodels), after
`setup()`, and awaited. For asynchronous setup; no need to call
`super.initialize()`. *Hook.*

```js
export class Genre extends Model {
  static async initialize() {
    this.names = (await this.query().select('name')).map(it => it.name)
  }
}
```

### `static` before…() / after…()

```js
static async beforeInsert(args)
```

`beforeFind()`, `afterFind()`, `beforeInsert()`, `afterInsert()`,
`beforeUpdate()`, `afterUpdate()`, `beforeDelete()` and `afterDelete()` are
Objection.js' static hooks, which emit the [`hooks`](#static-hooks) of the same
name. Prefer `hooks`; when overriding these, call `super` to keep them. *Hook.*

### `static` createNotFoundError()

```js
static createNotFoundError(ctx, error?)
```

Creates the [`NotFoundError`](errors.md) of `findById()`, `…ById()` and
`throwIfNotFound()`, reporting the id when known. *Hook.*

### `static` createValidationError()

```js
static createValidationError({ type, message, errors, options, json })
```

Creates the errors of validation (`ValidationError`, through
[`app.createValidationError()`](application.md#createvalidationerror)), relation
expressions (`RelationError`) and invalid graphs (`GraphError`). *Hook.*

### `static` createValidator()

```js
static createValidator()
```

Returns `app.validator`, shared by all models so that their schemas can
reference each other.

### `static` modifierNotFound()

```js
static modifierNotFound(query, modifier)
```

Resolves modifiers that aren't defined: scopes and the prefixes listed under
[`modifiers`](#static-modifiers).

### `static` propertyNameToColumnName() / columnNameToPropertyName()

```js
static propertyNameToColumnName(propertyName)
static columnNameToPropertyName(columnName)
```

Return their argument: name conversion happens in Knex, see
`knex.normalizeDbNames` in the
[configuration](application.md#applicationconfig).

## Instance properties

| Name     | Type          | Description                       |
| -------- | ------------- | --------------------------------- |
| `$app`   | `Application` | The model class's application.    |

### Relation accessors

```js
const chapters = await book.$chapters.query().where('position', '<', 3)
const first = await book.$chapters.where('position', 1) // Query short-cut
await book.$author.load() // Sets `book.author`
// On the class, `for()` names the owners, like Objection's `relatedQuery()`:
const all = await Book.$chapters.query().for([1, 2])
```

Each relation `name` adds a `$name` accessor to the class and its instances,
with:

| Member             | Description                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `query(trx?)`      | `Model.relatedQuery(name)` on the class, `model.$relatedQuery(name)` on instances.            |
| `load(…)`          | `Model.fetchGraph(models, name, …)` on the class, `model.$fetchGraph(name, …)` on instances.  |
| `joinModelClass`   | The join model class of `through` relations, with the query short-cuts.                      |
| query short-cuts   | The methods of [Query short-cuts](#query-short-cuts), on the related query.                   |

Defining a property `$name` that clashes with an accessor throws a
`RelationError`.

## Instance methods

### $initialize()

```js
$initialize()
```

Called by `$setJson()`, e.g. through `fromJson()`, after the data is set and
before it's validated, e.g. to derive values. Not called for patches and
references. *Hook.*

```js
export class Book extends Model {
  $initialize() {
    this.slug ??= this.title?.toLowerCase().replace(/\W+/g, '-')
  }
}
```

### $is()

```js
book.$is(otherBook)
```

Returns `boolean`: whether `model` is of the same class and has the same id.

### $has()

```js
book.$has('title', 'isbn')
```

Returns `boolean`: whether all properties are present (`in`) on the instance.

### $update() / $patch()

```js
await book.$patch({ title: 'Dune Messiah' }, trx?)
```

Updates or patches the instance in the database, sets the new values on it and
resolves to it. Returns `QueryBuilder` resolving to the instance.

### $transaction()

```js
const trx = await book.$transaction()
await book.$transaction(async trx => { … })
await book.$transaction(trx, async trx => { … })
```

Same as [`Model.transaction()`](#static-transaction).

### $validate()

```js
book.$validate(json?, options?)
await book.$validate(json, { async: true })
```

Validates `json` (default: the instance) against the model's schema; with
`graph: true` including relations, else without them. Asynchronous keywords
(`validateAsync`) only run with `async: true`, which returns a promise.
`skipValidation: true` returns `json` unvalidated. Returns The validated data,
or a promise of it.

### $validateGraph()

```js
await book.$validateGraph(options?)
```

Validates the instance with its relations, asynchronously. Returns
`Promise<Model>`: the instance.

### $emit()

```js
await book.$emit('event', ...args)
```

Emits an event on the model class with the instance as first argument. Returns
`Promise<any[]>`.

### $filterGraph() / $populateGraph()

```js
const filtered = book.$filterGraph(graph, expr)
const populated = await book.$populateGraph(graph, expr, trx?)
```

Same as [`filterGraph()`](#static-filtergraph) and
[`populateGraph()`](#static-populategraph), for the instance's class.

### $formatDatabaseJson()

```js
$formatDatabaseJson(json)
```

Converts data for the database: datetimes to ISO strings, dates to plain dates,
booleans to integers on SQLite; removes computed properties. *Hook, call
`super`.*

### $parseDatabaseJson()

```js
$parseDatabaseJson(json)
```

Converts data from the database: booleans on SQLite, then `$parseJson()`. *Hook,
call `super`.*

### $parseJson()

```js
$parseJson(json, { trusted = false } = {})
```

Converts date strings to `Date` objects (plain dates as local midnight), and
asset files to `AssetFile` objects. Unless `trusted`, asset files need a valid
signature or an allowed import source, else an `AssetError` is thrown, see
[`convertAssetFile()`](storage.md#convertassetfile). *Hook, call `super`.*

### $formatJson()

```js
$formatJson(json)
```

Converts data for JSON: removes hidden properties, returns dates as plain dates,
and signs asset files. *Hook, call `super`.*

## Relation helpers

```js
import {
  convertRelations,
  convertRelation,
  getRelationClass,
  isThroughRelationClass,
  addRelationSchemas
} from '@ditojs/server'
```

The functions that turn [`relations`](#static-relations) into Objection.js
relation mappings and schemas. Models call them; they're exported for tools
that work with relation definitions directly.

| Function                                               | Description                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `convertRelations(ownerModelClass, relations, models)` | Converts all relation definitions of a model to relation mappings, keyed by name. Errors are thrown as `RelationError`s naming the relation. |
| `convertRelation(relation, models)`                    | Converts one relation definition. `models` maps model names to classes, to resolve `from`, `to`, `through` and `modelClass`. |
| `getRelationClass(relation)`                           | The Objection.js relation class of a relation type name (`'hasMany'`) or class name (`'HasManyRelation'`), or the relation class itself. `undefined` for unknown names, `null` for other values. |
| `isThroughRelationClass(relationClass)`                | Whether the class is `ManyToManyRelation` or `HasOneThroughRelation` (returns the class, or `undefined`).   |
| `addRelationSchemas(modelClass, properties)`           | Adds a schema property for each relation of the model to `properties` and returns it: an array for many-relations, `null` allowed for one-relations, references allowed unless the relation is `owner`. |

```js
const mapping = convertRelation(
  { relation: 'belongsTo', from: 'Book.authorId', to: 'Author.id' },
  { Book, Author }
)
// { relation: BelongsToOneRelation, modelClass: Author,
//   join: { from: 'Book.authorId', to: 'Author.id' } }
```

## Mixins

```js
import {
  Model,
  TimestampedMixin,
  UserMixin,
  SessionMixin,
  CredentialMixin,
  AssetMixin
} from '@ditojs/server'
```

Mixins are functions that take a model class and return a subclass of it with
added properties, hooks and methods, e.g.
`class Book extends TimestampedMixin(Model) {}`. Each mixin is also exported
already applied to [`Model`](#class-model), as a ready-made base class:

| Mixin              | Model              |
| ------------------ | ------------------ |
| `TimestampedMixin` | `TimestampedModel` |
| `UserMixin`        | `UserModel`        |
| `SessionMixin`     | `SessionModel`     |
| `CredentialMixin`  | `CredentialModel`  |
| `AssetMixin`       | `AssetModel`       |

The properties a mixin adds merge with the model's own
[`static properties`](#static-properties), like those of any base
class. Mixins also apply to your own base classes, e.g.
`class User extends UserMixin(BaseModel)`.

### TimestampedMixin

```js
import { TimestampedModel } from '@ditojs/server'

export class Book extends TimestampedModel {
  static properties = {
    title: { type: 'string', required: true }
  }
}
```

Adds two properties, both `type: 'timestamp'` with `default: 'now()'`:

| Property    | Set                                       |
| ----------- | ----------------------------------------- |
| `createdAt` | On insert.                                |
| `updatedAt` | On insert, update and patch.              |

The values are set by `before:insert` and `before:update`
[hooks](#static-hooks). The mixin also adds the scope `timestamped`,
which selects both columns:

```js
const books = await Book.query().withScope('timestamped')
```

### UserMixin

```js
import { Model, UserMixin } from '@ditojs/server'

export class User extends UserMixin(Model) {
  static properties = {
    roles: {
      type: 'array',
      items: { type: 'string', enum: ['editor', 'sales', 'admin'] },
      default: []
    }
  }
}
```

Users that log in with a username and password. Enable `app.session` in the
[configuration](application.md#configapp), and serve the model through a
[`UsersController`](controllers.md#userscontroller) for the `login`,
`logout`, `session` and `self` actions.

#### Options

Set as `static options` on the model:

| Option             | Type                 | Default      | Description                                            |
| ------------------ | -------------------- | ------------ | ------------------------------------------------------ |
| `usernameProperty` | `string`             | `'username'` | The property users log in with.                        |
| `passwordProperty` | `string`             | `'password'` | The property that receives the password.               |
| `sessionScope`     | `string \| string[]` |              | Scopes applied when loading the user of a session or a login. A scope that narrows the selected columns has to include `hash`, or passwords can't be verified. |

#### Properties

| Property             | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| `[usernameProperty]` | `string`, required.                                                                 |
| `[passwordProperty]` | `string`, computed: not stored. Once the application is set up, setting it stores its bcrypt hash in `hash`; reading it returns `undefined`. |
| `hash`               | `string`, hidden: never sent to clients.                                            |
| `lastLogin`          | `timestamp`, nullable. `UsersController` sets it on each login.                     |

#### `static` login()

```js
const user = await User.login(ctx, options?)
```

Authenticates the credentials in the request body, under `usernameProperty` and
`passwordProperty`, and logs the user in with `ctx.login(user, options)`.
Resolves to the user. Rejects with an
[`AuthenticationError`](errors.md#authenticationerror): status 400 with "Missing
credentials", or 401 with "Password or username is incorrect".

#### `static` setup()

```js
static setup()
```

Defines the accessor of the password property. Call `super.setup()` when
overriding it.

#### $verifyPassword()

```js
const isValid = await user.$verifyPassword(password)
```

Returns `Promise<boolean>`: whether `password` matches the stored hash.

#### $hasRole()

```js
user.$hasRole('admin', 'editor') // 'editor'
```

String values of [`authorize`](controllers.md#authorize) other than `$self` and
`$owner` call it, so override it to store roles differently. *Hook.* Returns
`string | false`: the first entry of the user's `roles` array that is one of
`roles`, or `false`.

#### $hasOwner()

```js
user.$hasOwner(owner)
```

`authorize: '$owner'` calls `$hasOwner(user)` on the requested member. Models
owned by users implement their own `$hasOwner()`:

```js
export class Note extends Model {
  $hasOwner(user) {
    return this.userId === user.id
  }
}
```

Returns `boolean`: whether `owner` is this user.

#### $isLoggedIn()

```js
user.$isLoggedIn(ctx)
```

Returns `boolean`: whether this user is the logged in user of the request,
`ctx.state.user`.

#### Sessions

Logged in users are stored in the session as `<ModelName>-<id>`, so several
user model classes can be used side by side. When a session is loaded, the
user is fetched with the `sessionScope` and set as `ctx.state.user`; users that
no longer exist, or that the session scope excludes, end the session.
`ctx.login(user, { session: false })` logs a user in for the request only, and
`ctx.isAuthenticated()` tells whether the request has a user.

#### Login events

`ctx.login()` and `ctx.logout()`, which `UsersController` and
[`login()`](#static-login) call, emit `'before:login'`, `'after:login'`,
`'before:logout'` and `'after:logout'` on the user's model class, with the user
and the options of the call as arguments:

```js
User.on('after:login', async (user, options) => {
  user.$app.logger.info(`${user.username} logged in`)
})
```

### SessionMixin

```js
import { SessionModel } from '@ditojs/server'

export class Session extends SessionModel {}
```

A model to store [koa-session](https://github.com/koajs/session) sessions in
the database. Adds `id` (`string`, primary) and `value` (`object`). Use it with
`app.session.modelClass`, the model's name or class:

```js
const app = new Application({
  config: {
    app: {
      keys: ['…'],
      session: { modelClass: 'Session' }
    }
  },
  models: { User, Session }
})
```

Sessions are read and written in the transaction of the request, if there is
one.

### CredentialMixin

```js
import { CredentialModel } from '@ditojs/server'

export class Credential extends CredentialModel {}
```

A model to store the credentials of users beyond their password, for now
their [passkeys](controllers.md#userscontroller). One table holds the
credentials of all user models. Use it with `app.auth.credentials.modelClass`,
the model's name or class, see [`config.app`](application.md#configapp).

| Property     | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `type`       | `string`, required: `'passkey'`.                                            |
| `userModel`  | `string`, required: the name of the user's model class.                     |
| `userId`     | `string`, required: the id of the user, also of integer ids.                |
| `key`        | `string`, nullable, unique per `userModel`: the credential id of passkeys.  |
| `name`       | `string`, nullable: the label that the user gave the credential.            |
| `data`       | `object`, hidden: the public key, signature counter and transports of passkeys. |
| `createdAt`  | `timestamp`, set on insert.                                                 |
| `lastUsedAt` | `timestamp`, nullable: the time of the last login with the credential.     |

Credentials refer to their users without foreign keys, so deleting users
through their model deletes their credentials too.

### AssetMixin

```js
import { AssetModel } from '@ditojs/server'

export class Asset extends AssetModel {}
```

The model that keeps a record of each file stored for the
[`static assets`](#static-assets) of models, so that files are kept as
long as they're referenced and released when they aren't. Register it under
the name `Asset` (or `AssetModel`): the application looks it up by that name,
and leaves asset records out when there's no such model.

It includes `TimestampedMixin` and adds:

| Property  | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `key`     | `string`, required, unique, indexed: the file's key in its storage.         |
| `file`    | `object`: the file's data, an [`AssetFile`](storage.md#assetfile) after parsing. |
| `storage` | `string`, required: the name of the storage.                                |
| `count`   | `integer`, unsigned, default `0`: the number of references to the file.     |

See [`app.releaseUnusedAssets()`](application.md#releaseunusedassets) for how
unused files are removed.
