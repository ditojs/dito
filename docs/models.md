# Dito.js Models

Dito.js Models are an extension of
[Objection.js' Model class](http://vincit.github.io/objection.js/#models).
Objection.js is a very powerful, versatile and modern ORM for Node.js. Instead
of fully abstracting away the complexity of SQL behind object-oriented
structures as normal ORMs often do, Objection.js is built around a mighty and
elegant SQL query builder (itself based on [Knex.js](http://knexjs.org/)),
deploying OOP patterns only where they make sense, but never trying to
completely hide away the presence of SQL.

The result is an ORM that is more flexible and dynamic in its treatment of SQL
than most, making it at once powerful yet enjoyable to work with. You will often
find that Objection.js abstracts away the tricky or yucky parts of SQL while
preserving its power and potential to create and process data in complex ways.

Just like in Objection.js, a Dito.js Model class represents a database table and
instances of that class represent table rows. See [Migrations](./migrations.md)
for more information on how to create database tables to go along with the Model
classes, as well as how database table and column names are mapped to Dito.js
classes and properties.

Dito.js Models differ from Objection.js Models in a row of extensions aimed at
making declarative model configuration more streamlined and convention based.

# Model Definitions

Normally, models are created in the `src/server/models` folder. Models extend
the `Model` class provided by Dito.js Server, which in turn extends the
underlying Objection.js `Model` class:

```js
import { Model } from '@ditojs/server'

export class MyModel extends Model {
  static properties = {
  }

  static relations = {
  }

  static scopes = {
  }

  static filters = {
  }

  static someClassMethod() {
  }

  someInstanceMethod() {
  }
}
```

Models describe their `properties`, `relations`, `scopes`, and `filters` as
static class properties. Just like with any class in JS, they can also define
methods, both as static class methods, and as instance methods. Read more on
the definition of each type in these separate chapters:

- [Model Properties](./model-properties.md)
- [Model Relations](./model-relations.md)
- [Model Scopes](./model-scopes.md)
- [Model Filters](./model-filters.md)
- [Model Methods](./model-methods.md)

Note: When inheriting from other Model classes that already provide such
definitions, all the definitions from the Model classes' inheritance chain get
merged into one. While with methods, normal JS class inheritance can be used and
previous definitions can be accessed through the
[`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super)
keyword, other strategies are deployed for `properties`, `relations`, `scopes`
and `filters`:

Their processed, merged state is automatically reflected by Dito.js in the
static `Model.definition` property, which holds precomputed entries for each
definition:

```js
Model.definition = {
  properties: {},
  relations: {},
  scopes: {},
  filters: {}
}
```

## Model Queries

Dito.js inherits Objection.js' `QueryBuilder` class and extends it further with
useful additions that align well with the Dito.js way of doing things. Read more
on queries here:

- [Model Queries](./model-queries.md)

## Differences to Objection.js

Each chapter linked to above contains a sub-chapter listing the
differences to Objection.js, e.g.
[Model Properties – Differences to Objection.js](./model-properties.md#differences-to-objectionjs)
Once these differences are understood, you should be able to consult the useful
and detailed documentation of
[Objection.js](http://vincit.github.io/objection.js/) without causing confusion
between the two libraries.

On a level of model definitions, these are the differences to Objection.js:

- Objection.js doesn't inherit and merge model definitions across a model classes'
  inheritance chain, and doesn't and keep them around in a static `Model.definition` field.
