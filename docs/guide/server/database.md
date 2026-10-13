# Database

Migrations create and change the tables of the models; seeds fill them with
data. Both run through the [command line tool](index.md#command-line-tool).

## Migrations

Dito.js uses [Knex migrations](https://knexjs.org/guide/migrations.html):
files in the `migrations` folder that export an `up()` function, which
applies a change, and a `down()` function, which reverts it.

```js
// migrations/20261013120000_create_books.js

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema
    .createTable('author', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
    })
    .createTable('book', table => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.double('price')
      table.date('published_at').nullable()
      table.integer('author_id').unsigned().index()
        .references('id').inTable('author').onDelete('CASCADE')
    })
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema
    .dropTableIfExists('book')
    .dropTableIfExists('author')
}
```

Knex records the migrations it has run in the database, and runs each one
once, in the order of their file names. Don't rename or delete migrations that
have run; write a new migration for every change instead.

### Table and column names

Tables are named after the model classes, columns after the properties. With
`knex.normalizeDbNames` in the [configuration](configuration.md#keys), Dito.js
converts them to snake_case when it queries: the model `OrderLine` uses the
table `order_line`, the property `publishedAt` the column `published_at`.

Migrations run on a plain Knex instance, without this conversion, so they use
the database names, as above.

The join tables of [`manyToMany` relations](relations.md#manytomany)
without a `through` setting are named after both models, e.g. `book_genre`
with the columns `book_id` and `genre_id`.

### Running migrations

With the [scripts](index.md#command-line-tool) set up:

```sh
pnpm db:migrate     # Runs all pending migrations
pnpm db:rollback    # Reverts the last batch of migrations
pnpm db:reset       # Reverts all migrations and runs them again
pnpm db:unlock      # Frees the migration lock after a crashed migration
```

These commands import the configuration and run Knex' migrator with its
`knex` settings. Knex reads the migrations from `./migrations` in the current
directory, or from `knex.migrations.directory`. Keep the default:
`db:create_migration` always writes to the `migrations` folder of the app's
`basePath`, and ignores `knex.migrations.directory`.

### Creating migrations from models

`db:create_migration` writes a migration that creates the tables of the given
models, from their [properties](models.md#properties) and
[relations](relations.md):

```sh
pnpm db:create_migration create_books Author Book Genre
```

This writes `migrations/<timestamp>_create_books.js` with a table for each
model and the join tables of their `manyToMany` relations. The generated code
is a starting point: read it, and adjust it where needed.

The columns are built from these keywords:

| Keyword        | Column
| -------------- | ----------------------------------------------------------
| `type`         | `string`, `text`, `integer`, `boolean`, `date`, `datetime` and `timestamp` use the Knex method of the same name; `number` becomes `double`, `object`, `array`, `asset` and model types like `'Author'` become `json`; `color` becomes `string`.
| `$ref`         | Without `type`, the type of the referenced [definition](models.md#reusable-schemas), following its own `$ref`; definitions without a `type` become `json`.
| `specificType` | The column type, instead of the one derived from `type`.
| `primary`      | The primary key. Integer keys auto-increment (`increments()`), others use their type, e.g. `string('id').primary()`.
| `required`     | `notNullable()`.
| `nullable`     | `nullable()`.
| `default`      | `defaultTo()`; `'now()'` becomes `CURRENT_TIMESTAMP`.
| `unique`       | `unique()`, or one unique constraint for all properties with the same string.
| `index`        | `index()`.
| `unsigned`     | `unsigned()`.
| `foreign`      | A reference to the related table of the `belongsTo` relation that uses the property, with `onDelete('CASCADE')` unless the relation is an `owner`.
| `description`  | A comment above the column.

Computed properties get no column. The command only creates tables. Changes
to existing tables, e.g. new columns, are written by hand with Knex' schema
builder:

```js
export async function up(knex) {
  await knex.schema.alterTable('book', table => {
    table.string('isbn').unique()
  })
}

export async function down(knex) {
  await knex.schema.alterTable('book', table => {
    table.dropColumn('isbn')
  })
}
```

`db:list_asset_config` prints the
[asset properties](storages.md#asset-properties) of the models by table and
column, in snake_case, for migrations that work with the files in asset
columns.

## Seeds

Seeds fill the database with data, e.g. for development or tests. They are
`.json` and `.js` files in the `seeds` folder of the application's `basePath`,
and run with `pnpm db:seed`, which imports the application.

### Data files

A file named after a model holds the model's data. The model's table is
emptied first (on PostgreSQL, with the tables that reference it), then the
data is inserted as a graph, with `insertGraph()`, so it can contain related
models. `seeds/authors.json`:

```json
[
  {
    "name": "Jane Austen",
    "books": [
      { "title": "Emma", "price": 9.5 },
      { "title": "Persuasion", "price": 8.9 }
    ]
  },
  {
    "name": "Mary Shelley",
    "books": [{ "title": "Frankenstein", "price": 7.5 }]
  }
]
```

The file name is the model's name, in singular or plural, in any case:
`Author.json`, `authors.json` and `order-lines.json` all work, see
[`db:seed`](../../api/server/application.md#dbseed). A `.js` file can export the same
data.

### Seed functions

A `.js` file can also export a function that inserts the data itself. It
receives the models of the application, and returns the models it created so
that the command can report their number. A function doesn't empty any table,
and seeds that don't belong to one model work the same way:

```js
// seeds/demo-orders.js
export default async function ({ Customer, Order }) {
  const customer = await Customer.query().insertAndFetch({
    firstName: 'Ada',
    lastName: 'Byron',
    email: 'ada@example.com'
  })
  return Order.query().insertGraph([
    {
      number: '2026-0042',
      customerId: customer.id,
      lines: [{ bookId: 1, quantity: 2, price: 9.5 }]
    }
  ])
}
```

### Order

Seeds named after models run in the order of the models in the application,
i.e. the order of the `models` option; the other seeds run after them. List
models before the models that depend on them, e.g. `Author` before `Book`.
A module namespace, as in `import * as models`, lists its exports in
alphabetical order, whatever the order of the `export` statements. To choose
another order, pass an object with the models in that order.

An error in one seed is logged, and the other seeds still run. The command
then exits with a non-zero code.
