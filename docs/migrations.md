# Dito.js Migrations

TODO: Write about naming conventions model > table and property > column

The database tables to represent the models and their relations in the database
are created with migrations. Migration files are located in the *migrations*
folder of the project. Migrations are js files exporting an *up* and *down*
function. The *up* function is used to set up tables. The *down* function is
used to undo the migration in case of a rollback. Both function take the knex
instance as an input. An example looks like this:

```js
export async function up(knex) {
  return knex.schema
    .createTable('test', table => {
      table.increments('id').primary()
      table.string('username').notNullable()
      table.string('email')
    })
}

export async function down(knex) {
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


