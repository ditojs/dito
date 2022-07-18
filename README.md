# Dito.js

Dito.js is a declarative and modern web framework with a focus on API driven
development, based on Koa.js, Objection.js and Vue.js

Dito.js consists of two main components: **Dito.js Server**, providing all
classes and methods to build the server architecture, and **Dito.js Admin**, a
Vue.js library that can be used to build views and forms for administration of
the Dito.js models in a very efficient fashion.

Both components share the key philosophy of the Dito.js framework: The use of
declarative descriptions not only of the data structures themselves (the
models), but also of the way they are remotely interacted with (the
controllers), as well as the way they are edited (the admin views and forms).

This is then also the reason for the name *Dito.js* itself:

> *Ditto* originally comes from the Latin word *dictus*, "having been said," the
> past participle of the verb *dīcere*, "to say."
> https://www.thefreedictionary.com/ditto

Dito.js was developed at [Lineto](https://lineto.com/) by [Jürg
Lehni](http://juerglehni.com), and was made available by Lineto in 2018 under
the MIT license.

## Structuring a Dito.js Application

Unlike other frameworks, Dito.js is not opinionated about its folder structures
and file naming, and does not deduce any information from such structures. With
the exception of the creation of migration files, there aren't any generators
that automatically create files for you.

There is however a recommended way to structure a Dito.js application, by
dividing it into the following folder structure:

- `src/server`: This folder contains the admin Dito.js Server app, along with all
  models and controllers in sub-folders:
    - `src/server/models`: The place where for the model classes.
    - `src/server/controllers`: The place for the controller classes.
- `src/admin`: This folder contains a declarations of all admin views and forms
- `src/config`: The application configuration files.
- `migrations`: The folder holding all migration files.
- `seeds`: The folder holding all seeds files.

This structure will be explained in more detail in the documentation of each
these aspects separately:

- [Configuration](docs/configuration.md)
- [Application](docs/application.md)
- [Models](docs/models.md)
- [Controllers](docs/controllers.md)
- [Migrations](docs/migrations.md)
- [Seeds](docs/seeds.md)
- [Admin](docs/admin.md)

## Setting up `package.json` for a Dito.js Application

Dito.js server comes with its own CLI program, but it is rare to call it
directly: Normally you simply set up a set of `package.json` scripts through
which a selection of predefined tasks are executed:

```json
"scripts": {
  "console": "dito console src/server/app",
  "db:seed": "dito db:seed src/server/app",
  "db:create_migration": "dito db:create_migration src/server/app",
  "db:migrate": "dito db:migrate src/config/index.js",
  "db:rollback": "dito db:rollback src/config/index.js",
  "db:reset": "dito db:reset src/config/index.js"
}
```

Note that in order to work, each of these scripts require either the path to the
application, or the path to the application's configuration, as specified above.
Here a brief description of each script's purpose:

- `yarn console`: Starts an interactive Read-Eval-Print-Loop console in which
  all Dito.js models can be directly used.
- `yarn db:seed`: Seeds the configured database with the data provided in
  `seeds`. See [Seeds](docs/seeds.md) for more information.
- `yarn db:create_migration`: Creates migration files for the specified models.
   See [Migrations](docs/migrations.md) for more information.
- `yarn db:migrate`: Migrates to the latest state of migrations.
   See [Migrations](docs/migrations.md) for more information.
- `yarn db:rollback`: Rolls back the last batch of applied migrations.
   See [Migrations](docs/migrations.md) for more information.
- `yarn db:reset`: Resets the database by rolling back all applied migrations,
   and then reapplying all available migrations.
   See [Migrations](docs/migrations.md) for more information.
