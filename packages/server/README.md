# Dito.js Server

Dito.js is a minimal and modern web framework, based on Koa2 and Objection.js

More documentation to come soon.

Released in 2018 under the MIT license, with support by https://lineto.com/


# Creating Models

Models are created in the `src/models` folder. They can be
further structured into subfolders. Models extend the Model class provided
by Dito Server which in turn extends the underlying Objection.js Model.

Models describe their properties, relations, methods, scopes and more. An empty
model can be created like this:

```js
import BaseModel from '@/models/BaseModel'

export class Dummy extends BaseModel {
}
```

## TODO: Write about naming conventions model > table and property > column
## Properties

The properties of the model are given in a dictionary where the key is the
name of the property. The value is another dictionary describing the property.
The following options are available:

| Keywords  | Description |
| ------------- | ------------- |
| `type`  | The type of the property, for example `'string'`, `number`, `integer`, `array`, `date`, `datetime`, `timestamp` or `boolean` |
| `required`  | If the property is required  |
| `default`  | The default value of the property  |
| `computed`  | If the property is computed. If it is, a getter has to be defined on the model  |
| `foreign`  | If the property is a foreign key. Adds a reference to the related model table in migrations. |
| `hidden`  | Property does not show in data converted to JSON. Use for sensitive data. |
| `index`  | Adds an index to the table. |
| `instanceof`  | For internal use. |
| `nullable`  | Column is nullable in the database. |
| `primary`  | Column is primary in the database. |
| `range`  | e.g. `[2,5]`. Validates a number or integer to be in a range. |
| `unique`  | Adds a unique index to the table over the property column. |
| `unsigned`  | Specifies an integer to be unsigned. |

The properties are used for migrations and also to create a JSON schema which
is passed to Objection and used for data validation. To take a look at the
generated schema turn it on in the config file.

Here is an example class with some properties. Notice the validations in the
email and age property. *fullName* is a computed property and therefore has
a getter defined at the end.

```js
import BaseModel from '@/models/BaseModel'

export class Example extends BaseModel {
  static properties = {
    firstName: {
      type: 'string',
      required: true
    },
    lastName: {
      type: 'string',
      required: true
    },
    fullName: {
      type: 'string',
      computed: true
    },
    email: {
      type: 'string',
      format: 'email',
      nullable: true
    },
    age: {
      type: 'integer',
      range: [0, 100],
      required: true
    }
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}
```

In addition to all the declared properties, Dito automatically adds an *id* to
every model as a primary integer if *id* is not explicitly defined. The same
is the case if foreign keys of relations are not explicity defined in the
properties. The key is unsigned, foreign and index (and nullable if set).

## Relations

Models can be related with eachother through relations. The available relations
are *belongsTo*, *hasMany*, *hasOne*, *hasOneThrough* and *manyToMany*. Just
like properties, relations are given in a dictionary where the key is the
name of the relationship.

### Examples
#### *belongsTo*, *hasMany* and *hasOne*

Here is an example of model A which belongs to model B. The relation is given
its type as well as the properties it is linking. It is important to make sure
the referenced property in model B exists. Naturally it is convenient to take
the id which is auto-generated but one could use other properties. In this case
the id of the B it belongs to is stored in the table of A.

```js
static relations = {
  b: {
    relation: 'belongsTo',
    from: 'A.bId',
    to: 'B.id'
  }
}
```

One can then also define the inverse relationship from B to A although it is
not required in this case. This generally is a *hasMany* relation, since many
A can belong to the same B. In some cases it can also be a *hasOne* relation,
if we are looking at a one-to-one relationship.

```js
static relations = {
  a: {
    relation: 'hasMany',
    from: 'B.id',
    to: 'A.bid'
  }
}
```

#### *hasOneThrough*

The *hasOneThrough* relation allows you to use a through table with relations
that normally do not require one. This can be useful to store additional data
associated with the relation in the table.

TODO: Was passiert hier???

#### *manyToMany*

The *manyToMany* relation allows relating many models of one class with many
models of another class. This relation requires a through table and Dito can
automatically create it for you if desired. This is achieved by setting
*through* to `true`. The *inverse* argument is used for the creation of the
migrations to determine the through table name and creating it only once.

```js
static relations = {
  b: {
    relation: 'manyToMany',
    from: 'A.id',
    through: true,
    inverse: true,
    to: 'B.id'
  }
}
```

You can control the through table and add additional columns to it by
describing the through table explicitly. This property then appears on the
related model.

```js
through: {
  from: 'a_b.aId',
  to: 'a_b.bId',
  extra : ['extraProperty']
}
```

## Model Queries

Dito offers a query language based on Objection.js queries which as Dito uses
Knex for acessing the database. Knex then translates the query into SQL
commands.

Knex offers a query builder which is the further extended by Objection.
In particular, Objection offers eager statements which alloes you to easily
load related models, apply scopes to them etc.

Dito adds some addtional simplifications to queries, for example
`modelClass.query().first()` is equivalent to `modelClass.first()` and
`model.$relatedQuery('relationName').first()` is equivalent to
`model.$relationName.first()`.

Any Objection query is also a valid Dito query so it makes sense to
look at Objections documentation. An easy way to play around with queries is to
start the Dito console.


```sh
yarn console
```

You can use `.debug()` on any query to log sql statement to console.

## Scopes

Scopes can be used define query templates on models. The scopes can then be
accessed on the model and through routes via the controllers if desired. Scopes
can be defined on the model like this:

```js
static scopes = {
    all : query => query,
    published: query => query
      .where('published', true)
      .mergeEager('relationName(published)')
  }
```

The dictionary keys are the name of the scope and the values are function taking
a Knex query object and returns a modified query.  Note that
mergeEager merges existing eager statements whereas eager overwrites existing
eager statements. The full documentation on eager statements is in the Objection
documentation. Scopes are called namedFilters in Objection.

## Seeds

Seeds allow you to quickly seed the database for example for the purpose of
testing. Seeds are put in the *seeds* folder within the project folder.
There are three ways to create a seed:

1. Create a JSON file with the same name as the model file. The contained JSON
   is added to the database with the upsertGraph method.
```js
[
  {
    "username": "me",
    "email": "me@example.com",
    "password": "secret"
  },
  {
    "username": "jill",
    "email": "jill@example.net",
    "password": "secret"
  }
]
```
2. Create a js file with the same name as the model file. The function exported
   by this file is executed with the models as argument.

```js
export function(models){
  { Model1 } = models

  // Do whatever

  return jsonResult
}
```

3. Create an arbitrarily named js file in the seeds folder and seed the model
   manually.

```js
export function(models){
  { Model1, Model2 } = models

  // Do whatever

  Model1.insertGraph(model1Data)
  return Model2.insertGraph(model2Data)
}
```


To execute all the seeds use the commandline.

```sh
yarn db:seed
```

## Migrations

The tables to represent the models and their relations in the database are
created with migrations. Migration files are located in the *migrations* folder
of the project. Migrations are js files exporting an *up* and *down* function.
The *up* function is used to set up tables. The *down* function is used to undo
the migration in case of a rollback. Both function take the knex instance as an
input. An example looks like this:

```js
export function up(knex) {
  return knex.schema
    .createTable('test', table => {
      table.increments('id').primary()
      table.string('username').notNullable()
      table.string('email')
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('test')
}
```

The entire documentation can be found in the Knex documentation in the section
schema builder. Knex keeps track of migrations in the database therefore
deleting or renaming migration files might leed to you having to reset the
databse in case of further migrations.

All migration files are executed with this command (uses Knex *latest* method):

```sh
yarn db:migrate
```

In order to undo all migrations, use the rollback command. This will undo the
last batch of migrations applied:

```sh
yarn db:rollback
```

Resets can be done with this command, which rolls back all migrations and
migrates from scratch:

```sh
yarn db:reset
```

### Creating Migrations Automatically

Dito can create migrations for you automatically. Use the following command:

```sh
yarn db:create_migration fileName modelName1 modelName2 ...
```

The migration is based on the properties and relations in the model definitions.
In particular the type is converted to a knex type. These are further
property keywords that are considered for migrations: *description*, *type*,
*required*, *unsigned*, *nullable*, *index*, *primary*, *default*, *foreign*.



### HERE

## Controllers

## API Queries

## Default
