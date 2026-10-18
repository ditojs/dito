# Models

A model class represents a database table, and its instances represent rows.
Dito.js models extend
[Objection.js models](https://vincit.github.io/objection.js/guide/models.html),
and Objection.js' documentation applies to them. What Dito.js adds are
declarative definitions: instead of `tableName`, `jsonSchema` and
`relationMappings`, a model describes its properties, relations, scopes and
filters as static class fields, and Dito.js derives the rest from them.

```js
// src/server/models/Book.js
import { Model } from '@ditojs/server'

export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true },
    isbn: { type: 'string', unique: true },
    price: { type: 'number', minimum: 0 },
    publishedAt: { type: 'date', nullable: true },
    isArchived: { type: 'boolean', default: false }
  }

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
      owner: true
    }
  }

  static scopes = {
    default: query => query.orderBy('title'),
    published: query => query
      .whereNotNull('publishedAt')
      .where('isArchived', false)
  }

  static filters = {
    title: { filter: 'text' }
  }

  get isPublished() {
    return !!this.publishedAt && !this.isArchived
  }
}
```

From these definitions, Dito.js builds:

- The JSON schema that validates the data of the model, see
  [Properties](#properties) and [Validation](validation.md).
- The Objection.js relation mappings, see [Relations](relations.md).
- The columns and foreign keys of migrations, see
  [Database](database.md#migrations).
- The routes of [model controllers](controllers.md#model-controllers), and the
  [scopes and filters](queries.md#scopes) they accept.

The other definitions are `modifiers` (see
[Queries](queries.md#modifiers)), `schema` (see
[Validation](validation.md#validating-a-whole-model)), `hooks` (see
[Hooks](#hooks)), `assets` (see
[Storages and assets](storages.md#asset-properties)) and `options`, which
mixins read. The [`Model` API](../../api/server/model.md#definitions)
describes each of them.

The model's table is named after the class (`Book`), without a `Model` suffix
(`BookModel` is stored in `Book` too). With `knex.normalizeDbNames` in the
[configuration](configuration.md#keys), the table is `book` and the property
`publishedAt` the column `published_at`.

Models are registered with the application through its `models` option, see
[Application](application.md). They receive the application as `Model.app`.

Models are queried through their static methods, and related models through
the [relation accessors](relations.md#relation-accessors):

```js
const books = await Book.where('price', '<', 20).withScope('published')
const book = await Book.findById(1).withGraph('[author, chapters]')
await book.$patch({ price: 12.5 })
const chapters = await book.$chapters.query().orderBy('position')
```

See [Queries](queries.md) for everything about reading and writing.

## Properties

The static `properties` field describes the columns of a model. Each key is a
property name, each value a schema describing the property:

```js
export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true },
    isbn: { type: 'string', unique: true, index: true },
    summary: { type: 'text' },
    price: { type: 'number', minimum: 0 },
    stock: { type: 'integer', unsigned: true, default: 0 },
    isAvailable: { type: 'boolean', default: true },
    publishedAt: { type: 'date', nullable: true },
    cover: { type: 'asset', nullable: true }
  }
}
```

The definitions serve two purposes:

- **Validation**: Dito.js builds the model's JSON schema from them. Data is
  validated against it when it is inserted or updated, see
  [Validation](validation.md).
- **Migrations**: `dito db:create_migration` builds the table's columns from
  them, see [Database](database.md#creating-migrations-from-models). Some
  keywords, e.g. `index` and `unsigned`, are only read there.

The schemas are
[JSON schemas](https://json-schema.org/understanding-json-schema/) with a few
additions that make them shorter. All JSON schema keywords work,
e.g. `minLength`, `pattern`, `enum` or `maximum`. Besides the JSON types,
`type` takes `'text'`, `'date'`, `'datetime'`, `'timestamp'`, `'color'`,
`'asset'` (a [file object](storages.md#file-objects)), and the name of a model
for that model's JSON data. Dito.js' own keywords include `required`,
`nullable`, `primary`, `unique`, `hidden` and `computed`. The
[`Model` API](../../api/server/model.md#static-properties) lists every type
and keyword; [Database](database.md#creating-migrations-from-models) lists the
column each type gets.

A few things to know about types:

- Dates are read from the database as `Date` objects. Properties of type
  `'date'` are written as plain dates (`'2026-05-14'`), are returned to
  clients the same way, and are read as local midnight.
- `'object'` and `'array'` properties are stored as JSON, and read back as
  objects and arrays.
- On SQLite, booleans are converted from and to integers, and dates are
  stored as strings. Queries on `'date'` properties compare with plain dates
  (`'2026-05-14'`), not `Date` objects. Use the `better-sqlite3` client: with
  `sqlite3`, `Date` objects in queries are bound as numbers and don't match.
- `required: true` rejects missing values, `null` and `''`.
- `default: 'now()'` is a database default only: migrations use the current
  time, validation ignores it.

[Validation](validation.md#types-formats-and-keywords) explains how to register
your own types.

### Automatic properties

Dito.js adds some properties by itself:

- `id`, `{ type: 'integer', primary: true }`, unless a property is marked
  `primary`.
- The foreign keys of relations, `{ type: 'integer', unsigned: true,
  foreign: true, index: true }`, unless they are defined. A `belongsTo`
  relation with `nullable: true` makes its foreign key nullable, see
  [Relations](relations.md#belongsto-and-hasmany).

Define these properties yourself to change them, e.g. for a string id:

```js
static properties = {
  id: { type: 'string', primary: true }
}
```

### Unknown properties

Objects with `properties` don't accept other properties: inserting a book with
a property that isn't defined fails validation. The same goes for objects
combined from parts with `allOf`, `anyOf` or `oneOf`, and for references to
[definitions](#reusable-schemas). Set `unevaluatedProperties: true` on an
object schema to allow them. The
[schema extensions](../../api/server/validator.md#schema-extensions) list
where Dito.js closes schemas.

Data stored earlier can still hold properties that were removed from a schema
since. Saving it fails validation, so declare the properties that code writes.
The admin only sends the values that its forms show, so saving an item in the
admin drops the values of removed fields.

### Computed properties

A computed property has no column. Its value comes from a getter, or from a
query that selects it under the property's name (`… as name`). It is included
in the JSON data sent to clients, and removed before data is written to the
database:

```js
export class Customer extends Model {
  static properties = {
    firstName: { type: 'string', required: true },
    lastName: { type: 'string', required: true },
    fullName: { type: 'string', computed: true }
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}
```

### Nested data

`'object'` and `'array'` properties can describe their content with nested
schemas, in the same format:

```js
export class Customer extends Model {
  static properties = {
    shippingAddress: {
      type: 'object',
      nullable: true,
      properties: {
        street: { type: 'string', required: true },
        city: { type: 'string', required: true },
        country: { type: 'string', minLength: 2, maxLength: 2 }
      }
    }
  }
}
```

### Reusable schemas

Schemas are plain objects, so pieces that several properties or models share
can live in a module of their own and be imported. To have a piece appear
once in the JSON schema, or to let it refer to itself, name it in
`definitions` and reference it with `$ref`. Names start with `#`; Dito.js
collects the definitions of all properties at the root of the model's schema,
so any property of the model can reference them:

```js
// src/server/models/schemas.js
export const addressProperties = {
  street: { type: 'string', required: true },
  city: { type: 'string', required: true },
  country: { type: 'string', minLength: 2, maxLength: 2 }
}
```

```js
import { addressProperties } from './schemas.js'

export class Customer extends Model {
  static properties = {
    shippingAddress: {
      $ref: '#Address',
      nullable: true,
      definitions: {
        '#Address': { type: 'object', properties: addressProperties }
      }
    },
    billingAddress: {
      type: 'object',
      nullable: true,
      allOf: [
        { $ref: '#Address' },
        { properties: { vatNumber: { type: 'string' } } }
      ]
    }
  }
}
```

- A definition of the same name with a different schema throws.
- Definitions are closed where they're used: `shippingAddress` rejects unknown
  properties, while `#Address` itself stays open, so it can serve as the base
  of other schemas. An object definition without properties, e.g.
  `'#Meta': { type: 'object' }`, accepts any properties wherever it's used.
- `allOf` combines pieces, and the combining schema rejects unknown
  properties when it has `type: 'object'`. A `$ref` that is a part of `allOf`
  isn't closed on its own.
  Leave `type` out of the other pieces, as an object schema with `properties`
  rejects all other properties, including those of the other pieces.
- Data of several shapes, e.g. print and audio editions, is described with
  [variants](validation.md#variants).

### Inspecting the schema

To see the JSON schema that Dito.js builds, set `log.schema` in the
configuration to `true`, or to the names of models, and start the app:

```js
log: { schema: ['Book'] }
```

## Inheritance

Models can extend other models, and inherit their definitions: Dito.js merges
the definitions of the whole class chain, from the base class to the subclass.
A subclass adds properties, relations and scopes, or replaces those of the same
name:

```js
import { Model } from '@ditojs/server'

class Product extends Model {
  static properties = {
    title: { type: 'string', required: true },
    price: { type: 'number', minimum: 0 }
  }
}

export class Book extends Product {
  static properties = {
    isbn: { type: 'string' }
  }
}

// Book has `id`, `title`, `price` and `isbn`.
```

The merged definitions are available as `Model.definition`, e.g.
`Book.definition.properties`. Methods are inherited like in any class, and
reach their base versions through `super`. A subclass builds on a scope of the
base class through [`applyParentScope`](queries.md#scopes).

Definitions can also be static getters, which are called with the subclass as
`this`. That's how definitions can depend on options of the subclass.

## Mixins

Dito.js comes with mixins for common kinds of models. A mixin is a function
that extends a model class:

```js
import { Model, TimestampedMixin } from '@ditojs/server'

export class Order extends TimestampedMixin(Model) {
  static properties = {
    status: { type: 'string', default: 'open' }
  }
}
```

- `TimestampedMixin` adds `createdAt` and `updatedAt`, set when models are
  inserted and updated.
- `UserMixin` and `SessionMixin` are for users who log in, see
  [Controllers: users and sessions](controllers.md#users-and-sessions), and
  `CredentialMixin` for their passkeys and TOTP, see
  [Passkeys](controllers.md#passkeys).
- `AssetMixin` is for the records of uploaded files, see
  [Storages and assets](storages.md#the-asset-model).

Each mixin is also exported applied to `Model`: `TimestampedModel`,
`UserModel`, `SessionModel`, `CredentialModel` and `AssetModel`. These classes
have no name of their own, so always extend them, which also names the table:
`class Order extends TimestampedModel {}`. The
[Mixins API](../../api/server/model.md#mixins) describes each.

## Deriving types

In TypeScript, `FromModel` derives the type of a model's instances from its
`properties` and `relations`. Declare them `as const`, and add the derived
fields to the class with an interface of the same name:

```ts
import { FromModel, Model } from '@ditojs/server'
import type * as models from './index.js'

export class Book extends Model {
  static override properties = {
    title: { type: 'string', required: true },
    publishedAt: { type: 'datetime', nullable: true },
    authorId: { type: 'integer', foreign: true }
  } as const

  static override relations = {
    author: { relation: 'belongsTo', from: 'Book.authorId', to: 'Author.id' }
  } as const
}

export interface Book extends FromModel<typeof Book, typeof models> {}
```

`book.title` is a `string`, `book.publishedAt` a `Date | null | undefined` and
`book.author` an `Author | null | undefined`. The second parameter is the
module that exports the models, through which the models named in relations
and in `type` are found. Without it, relations are left out.

- `required: true` makes a property required, others are optional.
  `nullable: true` adds `null`.
- `'string'`, `'text'` and `'color'` are strings, `'number'` and `'integer'`
  numbers, `'boolean'` booleans.
- `'date'`, `'datetime'` and `'timestamp'` are `Date` objects, as models read
  them. Computed ones and those nested in objects and arrays are strings.
- Objects with `properties` and arrays with `items` or `prefixItems` are typed
  by them. Objects without `properties` are `Record<string, unknown>`.
- `enum` and `const` give their values, a model name that model, `$ref` its
  definition, `anyOf` and `oneOf` a union and `allOf` an intersection.
- Computed properties are `readonly`. Hidden properties are left out of
  `SerializedModel`, the type of their JSON data.
- Other types, e.g. `'asset'`, are `unknown`: declare them in the interface,
  e.g. `cover?: AssetFile`.
- `belongsTo`, `hasOne` and `hasOneThrough` relations are `M | null`,
  `hasMany` and `manyToMany` relations `M[]`. Relations are optional, as they
  are only present when loaded.
- The [automatic properties](#automatic-properties) that aren't defined are
  numbers: the id, named by `idColumn` if it returns a literal, and the
  properties in `from` of the model's relations. Those that relations of other
  models add, e.g. `bookId` of `Book`'s `hasMany` relation to `Chapter`, need
  to be defined in `properties`.

Each model derives its own definitions, and inherits the fields of its base
class, e.g. `createdAt` of `TimestampedModel`. Definitions declared `as const`
can only be extended, so subclasses spread those of their base class into
theirs: `{ ...Book.properties, isbn: { type: 'string' } }`.

In JavaScript, `/** @type {const} */` replaces `as const`, and a `.d.ts` file
adds the interfaces to the modules of the models:

```js
// src/server/models/Book.js
export class Book extends Model {
  static properties = /** @type {const} */ ({
    title: { type: 'string', required: true }
  })
}
```

```ts
// src/server/models/types.d.ts
import type { FromModel } from '@ditojs/server'
import type * as models from './index.js'

declare module './Book.js' {
  interface Book extends FromModel<typeof Book, typeof models> {}
}
```

Without `/** @type {const} */`, the types of the definitions are widened to
`string` and `boolean`, so that the properties are `unknown` and optional, and
the relations are left out.

A model uses either `FromModel`, or fields declared by hand
(`declare title: string`) with `ModelProperties<Book>` and
`ModelRelations<Book>` as the types of its definitions, which check them
against the fields. Combined, the check would read its own result.

## Methods

Models are classes, so they can define methods like any class: static methods
for work on the table, instance methods for work on one row.

```js
import { Model, ResponseError } from '@ditojs/server'

export class Book extends Model {
  static findCheaperThan(price) {
    return this.query().where('price', '<', price).orderBy('price')
  }

  get isInStock() {
    return this.stock > 0
  }

  async sell(quantity, trx) {
    if (quantity > this.stock) {
      throw new ResponseError({
        message: 'Not enough copies in stock',
        status: 409
      })
    }
    return this.$patch({ stock: this.stock - quantity }, trx)
  }
}
```

Avoid method and property names that start with `$`: Objection.js and Dito.js
use them for their own members, e.g. `$patch()`, `$app` and the
[relation accessors](relations.md#relation-accessors).

### Initializing instances

`$initialize()` is called whenever data is set on a new instance, before it is
validated, e.g. when data arrives from a request. Use it to derive values:

```js
export class Order extends Model {
  $initialize() {
    this.number ??= createOrderNumber()
  }
}
```

It isn't called for patches, or for references that only hold an id.

### Setting up the class

`static async initialize()` is called once when the application is set up,
after the database is configured and before the server starts. It is the place
for asynchronous setup that the model needs, e.g. loading data it caches. It
doesn't need to call `super.initialize()`:

```js
export class Genre extends Model {
  static async initialize() {
    this.names = (await this.query().select('name')).map(genre => genre.name)
  }
}
```

`static setup()` runs right before it and is used by mixins, e.g. `UserMixin`
defines its password property there. Subclasses that override it need
to call `super.setup()`.

### Converting data

Objection.js converts data with `$parseJson()` (data from clients and code
into the model), `$formatJson()` (the model to the JSON sent to clients),
`$parseDatabaseJson()` and `$formatDatabaseJson()` (rows from and to the
database). Dito.js overrides them, e.g. to leave out hidden and computed
properties. Models can override them too, and need to call `super`:

```js
export class Book extends Model {
  $formatJson(json) {
    json = super.$formatJson(json)
    json.price &&= Math.round(json.price * 100) / 100
    return json
  }
}
```

The [`Model` API](../../api/server/model.md#instance-methods) lists all
methods.

## Hooks

The static `hooks` field registers handlers that run before and after queries
of the model:

```js
export class Book extends Model {
  static hooks = {
    'before:insert, before:update'({ inputItems }) {
      for (const item of inputItems) {
        item.isbn &&= item.isbn.replaceAll('-', '')
      }
    },

    async 'before:delete'({ asFindQuery }) {
      const books = await asFindQuery().select('id')
      await this.app.getService('search').removeBooks(books)
    }
  }
}
```

The events are `before:` and `after:` of `find`, `insert`, `update` (also for
patches) and `delete`. Handlers receive Objection.js'
[static hook arguments](https://vincit.github.io/objection.js/api/types/#type-statichookarguments):
`inputItems` (the data of inserts and updates), `items` (the models the query
started from, for related queries), `result` (in `after:` hooks),
`asFindQuery()` (a query that finds the affected rows), `cancelQuery()`,
`transaction` and `context`. `this` is the model class.

- Several events separated by commas share one handler, and a key can hold an
  array of handlers.
- Handlers may be async; they run in sequence, those of base classes first.
- A value returned by an `after:` handler replaces the result.

Hooks run for every query, also for queries that touch many rows at once, so
they work on the data of the query, not on model instances. Objection.js'
instance hooks, e.g. `$beforeInsert()`, work as well, but only for queries
that have model instances, see the
[Objection.js documentation](https://vincit.github.io/objection.js/api/model/instance-methods.html#beforeinsert).

The model class is an event emitter, and the hooks are its listeners. Other
code can listen to the same events with `on()`, e.g. a service:

```js
Book.on('after:insert', async ({ result }) => {
  await notifySubscribers(result)
})
```

Models with `UserMixin` also emit `before:login`, `after:login`,
`before:logout` and `after:logout`, with the user as argument.

## Differences to Objection.js

Once you know these differences, Objection.js' documentation applies to
Dito.js models:

- Definitions replace `tableName`, `jsonSchema`, `relationMappings` and
  `modifiers`, and are inherited and merged along the class chain.
- Relations reference models and properties (`'Book.authorId'`), not tables
  and columns, and don't need the related model classes to be imported.
- Validation uses one Ajv instance shared by all models, with Dito.js'
  keywords, formats and types.
- The query builder adds scopes, filters, `find()` and graph methods, and
  common query methods are available directly on the model class.
- Relations are reachable through `$name` accessors.
- Errors are converted to Dito.js errors, which the server sends as JSON, see
  [Errors](errors.md).
