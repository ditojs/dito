# Dito.js Model Relations

Just like Objection.js Models, Dito.js Models can be related to one-another
through relations. The definition of such relations is done differently than in
Objection.js though:

Instead of providing them in a static field called `relationMappings`, they are
defined in a simplified and extended format in the static `relations` field.

Just like with [Model Properties](./model-properties.md), the `relations` field
is an object where the key is the name of the relation, and the value is an
object holding its definition. Within this relation object, the following
settings are available:

| Keywords                             | Description
| ------------------------------------ | ---------------------------------------
| `relation`: `string`                 | The type of relation. Supported types are:<br>`'belongsTo'`, `'hasMany'`, `'hasOne'`, `'manyToMany'` and `'hasOneThrough'`.
| `from`: `string`                     | The model and property name from which the relation is to be built, as a string with both identifiers separated by `'.'`, e.g.: `'FromModelClass.fromPropertyName'`
| `to`: `string`                       | The model and property name to which the relation is to be built, as a string with both identifiers separated by `'.'`, e.g.: `'ToModelClass.toPropertyName'`
| `through`: `boolean` &#124; `Object` | Controls whether a join model class and table is to be built automatically, or allows to specify one manually:<ul><li>Setting it to `true` tells Dito.js to create the join table and model class automatically.</li><li>Providing an object allows for more fain-grained configuration of the join table and model class. See [Join Models and Tables](#join-models-and-tables) for details.</li></ul>
| `inverse`: `boolean`                 | Controls whether the relation is the inverse of another relation. This information is only required when working with `through` relations. Without it, Dito.js wouldn't be able to tell which side of the relation is on the left-hand side, and which is on the right-hand side when automatically creating the join model class and table.
| `scope`: `string`                    | Optionally, a scope can be defined to be applied when loading the relation's models. The scope needs to be defined in the related model class' `scopes` definitions. See [Model Scopes](./model-scopes.md) for more information on working with scopes.
| `nullable`: `boolean`                | Controls whether the auto-inserted foreign key property should be marked as nullable. This only makes sense on a `'belongsTo'` relation, where the model class holds the foreign key, and only when the foreign key isn't already explicitly defined in the [Model Properties](./model-properties.md). 
| `owner`: `boolean`                   | Controls whether the relation *owns* the models that it holds, or whether it is simply *relating* to them, and a relation elsewhere is considered to be their owner.<br>This controls behavior in different parts of Dito.js<ul><li>In migrations, the definition of the foreign key that refer to the model that owns the data calls `.onDelete('CASCADE')` in order to delete the owned data when their owner is deleted.</li><li>In graph [inserts](./model-queries.md#insertgraphdata-options) and [upserts](./model-queries.md#upsertgraphdata-options), the inset/upsert options and their correct [relation expressions](http://vincit.github.io/objection.js/#relationexpression) are automatically determined so that the operation creates/deletes or relates/unrelates in any given relation, reflecting the intent of the relation's `owner` setting.</li></ul> 

## Relation Types

Dito.js provides the same types of relations as Objection.js, but references
them with a simplified string representation of each type instead of their
actual class:

`'belongsTo'`, `'hasMany'`, `'hasOne'`, `'manyToMany'` and `'hasOneThrough'`.

These relation types can be divided into three groups:

### `'belongsTo'`

The `'belongsTo'` relation is used for relations where the model class on which
it is defined holds the foreign key. The reverse of a `'belongsTo'` relation is
either a `'hasMany'` or `'hasOne'` relation.

Below is an example of model `Book` which belongs to a model `Author`:

```js
class Book extends Model {
  static relations = {
    author: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Author.id'
    }
  }
}
```

Note: The `from` property is a foreign key defined on the own model, while the
`to` property is the primary key on the related model. While it is most common
to take the model's primary key ('id' in this case), one could relate to other
properties as well.

### `'hasMany'` and `'hasOne'`

The opposite of a `'belongsTo'` relation can either be a `'hasMany'` or a
`'hasOne'` relation, depending on whether multiple `'belongsTo'` relations to it
are envisioned, or only a maximum of one, in which case it is a one-to-one
relation.

One can then also define the inverse relationship from B to A although it is
not required in this case. This generally is a *hasMany* relation, since many
A can belong to the same B. In some cases it can also be a *hasOne* relation,
if we are looking at a one-to-one relationship.

In the case of the above example of `Author` and `Book`, an author may have
written multiple books, so a `'hasMany'` relation is probably what we want to
declare:

```js
class Author extends Model {
  static relations = {
    books: {
      relation: 'hasMany',
      from: 'Author.id',
      to: 'Book.authorId'
    }
  }
}
```

Note: The `from` property is the primary key defined on the own model, while the
`to` property is a foreign key on the related model. Again, one could relate
from other properties than primary keys as well.

The difference between a `'hasMany'` and a `'hasOne'` relation is simply that
when using queries, the `'hasOne'` relation is limited to returning the first
result as an object, while the `'hasMany'` relation returns an array of all
models.

### `'manyToMany'` and `'hasOneThrough'`

The `'manyToMany'` relation allows relating many models of one class with many
models of another class. This relation requires a join model and table, and
Dito.js can automatically create them if desired. This is achieved by setting
`through` to `true`. The `inverse` setting is used during the creation of the
migrations, to tell which side of the relation is on the left-hand side, and
which is on the right-hand side when determining the name of the generated join
model class and table.

Going back to our example above, we can imagine a new `Category` class that can
be associated with the `Book` model through two `'manyToMany'` relations that go
both ways:

```js
class Book extends Model {
  static relations = {
    categories: {
      relation: 'manyToMany',
      from: 'Book.id',
      to: 'Category.id',
      through: true,
      inverse: false
    }
  }
}

class Category extends Model {
  static relations = {
    books: {
      relation: 'manyToMany',
      from: 'Category.id',
      to: 'Book.id',
      through: true,
      inverse: true
    }
  }
}
```

Note: Setting `through: true` and using opposite settings of `from` and `to` as
well as `inverse` in either relation automatically negotiates the naming of the
created join table for us. Because the inverse is on `Category`, the resulting
join model class will be called `BookCategory` while the join table will be
named `book_category` (assuming `config.knex.normalizeDbNames` is `true`).

The `'hasOneThrough'` relation is a special case of a `'manyToMany'` relation,
with the same difference as `'hasOne'` has from `'hasMany'`: It only returns
one result in queries, instead of an array of all related models. It is rare to
require join tables for such relations though, as usually a foreign key would
suffice.

## Join Models and Tables

For the cases where the automatically generated join table and model doesn't
offer enough control, Dito.js allows more fine-graned configuration of the join
table and model class by providing an object for the `trough` setting:

| Keywords                             | Description
| ------------------------------------ | ---------------------------------------
| `through.from`: `string`             | The model and property name or table and column name of an existing join model class or join table from which the through relation is to be built, as a string with both identifiers separated by `'.'`, e.g.: `'FromModelClass.fromPropertyName'`
| `through.to`: `string`               | The model and property name or table and column name of an existing join model class or join table to which the through relation is to be built, as a string with both identifiers separated by `'.'`, e.g.: `'toModelClass.toPropertyName'`
| `through.extra`: `Array`             | List additional columns to be added to the related model. See [Extra Properties](#extra-jproperties) for more details.

- To work with an existing join model class, provide both the `through.from` and
`through.to` reference just as with the main relation definition:

    ```js
    through: {
      from: 'joinModelClass.fromPropertyName',
      to: 'joinModelClass.toPropertyName'
    }
    ```

- To work with a join table directly without a model class, use the table/column
  references instead:

    ```js
    through: {
      from: 'join_table_name.from_column_name',
      to: 'join_table_name.to_column_name'
    }
    ```

Note: Dito.js has no reliable way to distinguish the two formats. The approach
currently is to check if the specified table/model reference is indeed a model,
in which case the first scenario is assumed. If th model isn't known, no error
is thrown, and direct database references are assumed.

### Extra Properties

When working with a join model class or table, extra columns from it can be
added to the related model, as if it was define on its own table. The then
appear as additional properties on the related model:

```js
through: {
  extra : ['extraProperty']
}
```

## Relation Accessors

Dito.js models give access to their relations through special accessors for
each relation, accessible through `modelClass.$relationName` as well as
`modelInstance.$relationName`. These accessors offer easier access to related
queries and join model classes.

Just like Dito.js model classes, relation accessors also offer `QueryBuilder`
short-cuts. Read more on these short-cuts in
[Model Queries – Short-Cuts to Query Methods](./model-queries#short-cuts-to-query-methods).

### `RelationAccessor.query()`

When called on a model instance's relation accessor, this is a short-cut to
`modelInstance.$relatedQuery('relationName')`. When called on model class'
relation accessor, it is a short-cut to the static
`modelClass.relatedQuery('relationName')`.

### `RelationAccessor.joinModelClass`

Returns a reference to the `joinModelClass` if the relation uses a `through`
definition.

### Relation Accessor Example

The following example of an Objection.js' style related query can be simplified
using Dito.js' relation accessors.

So this:

```js
model.$relatedQuery('relationName').where(…)
```

becomes:

```js
model.$relationName.query().where(…)
```

and because relation accessors also offer `QueryBuilder` short-cuts, this can
be further shortened to:

```js
model.$relationName.where(…)
```

## Differences to Objection.js

- Objection.js doesn't inherit and merge relation definitions.

- In Dito.js, model and property references are used in the definition of
  relations, while Objection.js uses table and column references in its
  `relationMappings` format, and requires references to the actual `modelClass`
  along with them, which can cause issues with circular references. Dito.js
  translates its `relations` automatically to Objection.js' `relationMappings`
  format, and is able to create `modelClass` references for them automatically
  from the application's list of registered models.

- Dito.js models give access to their relations through special relation
  accessors. See [Relation Accessors](#relation-accessors) for more information
  about these accessors.
