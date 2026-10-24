# Relations

The static `relations` field describes how a model relates to other models.
Each key is a relation name, each value describes the relation:

```js
import { Model } from '@ditojs/server'

export class Book extends Model {
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
}
```

Dito.js converts these definitions to Objection.js'
[relation mappings](https://vincit.github.io/objection.js/guide/relations.html).
Unlike there, relations reference models and properties instead of tables and
columns, and the related model classes don't need to be imported: Dito.js
finds them among the models of the application.

The [`Model` API](../../api/server/model.md#static-relations) lists all
options. In TypeScript, [`FromModel`](models.md#deriving-types) types the
relations of instances from these definitions.

## Relation types

| Type              | The model…                                        | Loads      |
| ----------------- | ------------------------------------------------- | ---------- |
| `'belongsTo'`     | holds the foreign key of one related model.       | One model. |
| `'hasOne'`        | is referenced by the foreign key of one model.    | One model. |
| `'hasMany'`       | is referenced by the foreign keys of many models. | An array.  |
| `'manyToMany'`    | is related to many models through a join table.   | An array.  |
| `'hasOneThrough'` | is related to one model through a join table.     | One model. |

`from` always names the property on the own model, `to` the property on the
related model.

### belongsTo and hasMany

A book belongs to its author: the `book` table holds the foreign key
`author_id`. In the other direction, an author has many books:

```js
export class Book extends Model {
  static relations = {
    author: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Author.id'
    }
  }
}

export class Author extends Model {
  static relations = {
    books: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Book.authorId'
    }
  }
}
```

`Book.authorId` doesn't need to be defined in the properties: Dito.js adds
foreign keys automatically, see
[Models](models.md#automatic-properties). A book without an author needs a
nullable foreign key, which the relation can declare with `nullable: true`.

`hasOne` works like `hasMany`, but loads only one model.

### manyToMany

A book has many genres, and a genre has many books. The relation goes through
a join table that holds both foreign keys. Without a `through` setting, Dito.js
names the join table and its columns after the models: `BookGenre`, with
`bookId` and `genreId` (`book_genre` with `book_id` and `genre_id` under
`knex.normalizeDbNames`). `inverse: true` marks the other side, so that both
sides use the same join table:

```js
export class Book extends Model {
  static relations = {
    genres: {
      relation: 'manyToMany',
      from: 'Book.id',
      to: 'Genre.id'
    }
  }
}

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

`dito db:create_migration` creates the join table for the side without
`inverse`, see [Database](database.md#creating-migrations-from-models).

`hasOneThrough` works like `manyToMany`, but loads only one model.

### Join models and tables

To use a join table of your own, e.g. one with extra columns, describe it in
`through`. `from` and `to` reference the join table's columns, or the
properties of a join model. An order has its `lines`, and can reach the
ordered books through the same `OrderLine` model:

```js
export class Order extends Model {
  static relations = {
    lines: {
      relation: 'hasMany',
      from: 'Order.id',
      to: 'OrderLine.orderId',
      owner: true
    },
    books: {
      relation: 'manyToMany',
      from: 'Order.id',
      through: {
        from: 'OrderLine.orderId',
        to: 'OrderLine.bookId',
        extra: ['quantity']
      },
      to: 'Book.id'
    }
  }
}
```

When `OrderLine` is a registered model, the relation uses it as join model;
otherwise `OrderLine` is taken as a table name. `extra` adds the join table's
`quantity` column to the books loaded through the relation.

`through` needs both `from` and `to`; for the default join table, leave it
out. `through` on relations other than `manyToMany` and `hasOneThrough`
throws a `RelationError`.

## Owners

`owner: true` marks a relation that owns its models: the chapters of a book
belong to the book and are gone when it is gone, while the author of a book
exists by itself.

The [graph methods](queries.md#graphs) and the
[relation routes](controllers.md#relations) follow this:

- For owner relations, models missing from the graph are deleted, and new
  models are inserted.
- For other relations, models missing from the graph are only unrelated, and
  models with ids are related.

## Loading relations

Relations are loaded with Objection's `withGraph()`, and the other methods of
[relation expressions](https://vincit.github.io/objection.js/api/types/#type-relationexpression):

```js
const books = await Book.query().withGraph('[author, chapters, genres]')
```

A relation can narrow down or order what it loads, with `scope` and `filter`
(the [scopes and filters](queries.md#scopes) of the related model), or
`modify`, a function that receives the query or an object of
[query parameters](queries.md#query-parameters):

```js
chapters: {
  relation: 'hasMany',
  from: 'Book.id',
  to: 'Chapter.bookId',
  owner: true,
  modify: query => query.orderBy('position')
},
goodReviews: {
  relation: 'hasMany',
  from: 'Book.id',
  to: 'Review.bookId',
  modify: query => query.where('rating', '>=', 4)
}
```

Several relations can point to the same model, as `goodReviews` does next to
`reviews`.

## Relation accessors

Every relation adds an accessor named `$` plus the relation name to the model
class and its instances. On an instance, it works with the models related to
that instance:

```js
const book = await Book.findById(1)

// Query the related models:
const chapters = await book.$chapters.query().where('position', '<=', 3)

// Common query methods are available directly:
const firstChapter = await book.$chapters.findOne({ position: 1 })

// Load the relation into `book.chapters`:
await book.$chapters.load()
```

On the class, `Book.$chapters.query()` is Objection's `Book.relatedQuery()`,
e.g. for subqueries. `Book.$genres.joinModelClass` is the join model of a
`manyToMany` relation.

## Objection.js relations

For cases that Dito.js' format doesn't cover, a relation can use Objection.js'
own format: a relation class as `relation`, with `modelClass` and `join`. Such
relations are passed on to Objection.js unchanged:

```js
import { Model } from '@ditojs/server'
import { Review } from './Review.js'

export class Book extends Model {
  static relations = {
    reviews: {
      relation: Model.HasManyRelation,
      modelClass: Review,
      join: { from: 'book.id', to: 'review.book_id' }
    }
  }
}
```
