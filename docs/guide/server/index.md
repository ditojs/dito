# Dito.js Server

Dito.js Server builds a REST API out of declarations. You describe your data as
model classes, and controllers turn them into routes. The models check the data
that comes in and save it to the database.

It builds on three libraries:

- [Koa](https://koajs.com/) handles HTTP. The application is a Koa
  application, so any Koa middleware works with it.
- [Objection.js](https://vincit.github.io/objection.js/) is the ORM, and
  [Knex.js](https://knexjs.org/) builds its SQL queries. Dito.js models are
  Objection.js models, with declarative definitions on top.
- [Ajv](https://ajv.js.org/) validates the data against JSON schemas that
  Dito.js builds from the model definitions.

A small bookshop server looks like this:

```js
import { Application, Model, ModelController } from '@ditojs/server'

class Book extends Model {
  static properties = {
    title: { type: 'string', required: true },
    price: { type: 'number', minimum: 0 }
  }
}

class Books extends ModelController {
  modelClass = Book
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
}

const app = new Application({
  config: {
    server: { port: 8080 },
    app: { normalizePaths: true },
    knex: { client: 'postgresql', connection: { database: 'bookshop' } }
  },
  models: { Book },
  controllers: { api: { Books } }
})

await app.execute()
```

This serves `GET` and `POST /api/books` and `GET`, `PATCH` and
`DELETE /api/books/:id`, and validates every book before it reaches the
database.

## Guide

- [Configuration](configuration.md): the configuration object.
- [Application](application.md): creating, starting and extending the app.
- [Models](models.md): properties, mixins, methods and hooks.
- [Relations](relations.md): how models relate to each other.
- [Queries](queries.md): reading and writing data, scopes and filters.
- [Controllers](controllers.md): routes, actions, authorization and users.
- [Validation](validation.md): validating data, custom keywords and formats.
- [Errors](errors.md): errors and how they are sent to clients.
- [Storages and assets](storages.md): file uploads and storage.
- [Services](services.md): app-wide functionality with a lifecycle.
- [Database](database.md): migrations and seeds.

The [API reference](../../api/server/index.md) lists every class, method and
option. To build an admin interface for the API, see the
[admin guide](../admin/index.md). Upgrading from Dito.js 3.x is described in
[Upgrading to Dito.js 4.x](../../upgrading-to-4.x.md).

## Installation

Dito.js Server needs Node.js 24 or newer. It is published as an ES module
only, so your project needs `"type": "module"` in its `package.json`, or `.mjs`
files.

Install the server with its peer dependencies, Knex.js and Objection.js, and
the database driver that Knex uses for your database:

```sh
pnpm add @ditojs/server knex objection pg
```

Knex supports PostgreSQL (`pg`), MySQL (`mysql2`), SQLite (`sqlite3` or
`better-sqlite3`) and others, see
[the Knex installation guide](https://knexjs.org/guide/#node-js). Dito.js is
developed against PostgreSQL; a few features are PostgreSQL only, e.g.
`knex.typeParsers` in the [configuration](configuration.md).

`@aws-sdk/client-s3` is an optional peer dependency. Install it if you store
files in S3, see [Storages and assets](storages.md).

`@ditojs/build`, `vite` and `@vitejs/plugin-vue` are optional peer
dependencies too, needed only to build the admin or serve it in development.
Install them as dev dependencies, so production installs leave them out:

```sh
pnpm add -D @ditojs/build vite @vitejs/plugin-vue
```

The admin interface comes with the server, as `@ditojs/admin` is one of its
dependencies. Setting it up is described in the
[admin guide](../admin/index.md).

`@ditojs/server` has a single entry point. Import everything from it:

```js
import { Application, Model, ModelController } from '@ditojs/server'
```

## Project layout

Dito.js doesn't require a layout, but `db:seed` and `db:create_migration`
look for the `seeds` and `migrations` folders in the application's
`basePath`, which is the current working directory by default. A typical
project looks like this:

```text
config/
  index.js          the configuration
src/
  server/
    app.js          creates and exports the application
    index.js        starts it
    models/
      index.js      exports all models
    controllers/
      index.js      exports all controllers
    services/
      index.js      exports all services
  admin/            the admin views, see the admin guide
migrations/         database migrations
seeds/              database seeds
```

The `index.js` files re-export the classes of their folder, so the application
can receive all of them at once:

```js
// src/server/models/index.js
export * from './Author.js'
export * from './Book.js'
export * from './Chapter.js'
```

## A first application

The configuration is a plain object. Read secrets and environment-specific
values from environment variables:

```js
// config/index.js
const { env } = process

export default {
  env: env.NODE_ENV || 'development',
  server: {
    host: env.HOST || '0.0.0.0',
    port: env.PORT || 8080
  },
  app: {
    normalizePaths: true,
    keys: [env.APP_KEY]
  },
  knex: {
    client: 'postgresql',
    connection: { database: 'bookshop' },
    normalizeDbNames: true
  }
}
```

The application receives the configuration and the models and controllers:

```js
// src/server/app.js
import { Application } from '@ditojs/server'
import config from '../../config/index.js'
import * as models from './models/index.js'
import * as controllers from './controllers/index.js'

const app = new Application({ config, models, controllers })

export default app
```

A separate file starts it, so that the command line tool can import the
application without starting a server:

```js
// src/server/index.js
import app from './app.js'

await app.execute()
```

Start it with `node src/server/index.js`. [Application](application.md)
describes the lifecycle.

## Command line tool

`@ditojs/server` installs a `dito` command. Its first argument is the command,
its second the file to import: the migration commands import the
configuration, the others the application. Add them to the scripts of your
`package.json`:

```json
{
  "scripts": {
    "start": "node src/server/index.js",
    "console": "dito console src/server/app.js",
    "db:migrate": "dito db:migrate config/index.js",
    "db:rollback": "dito db:rollback config/index.js",
    "db:reset": "dito db:reset config/index.js",
    "db:unlock": "dito db:unlock config/index.js",
    "db:seed": "dito db:seed src/server/app.js",
    "db:create_migration": "dito db:create_migration src/server/app.js",
    "db:list_asset_config": "dito db:list_asset_config src/server/app.js"
  }
}
```

Further arguments follow the script name, e.g.
`pnpm db:create_migration create_books Author Book`. The
[CLI reference](../../api/server/application.md#cli) describes each command;
[Database](database.md) shows how to use them.

`pnpm console` starts the application and a REPL with `app` and all models as
globals, and awaits promises. It is useful to try out queries:

```text
dito > Book.where('price', '<', 10).withGraph('author')
```

## Logging in

The admin, and any route that checks [authorization](controllers.md#authorization),
needs users who log in. In the bookshop, only staff log in: a `User` model
with `UserMixin`, a `Session` model with `SessionMixin`, a users controller
and the session settings in the configuration.
[Controllers: users and sessions](controllers.md#users-and-sessions) shows
them.

Create the tables of both models with a migration, and run it:

```sh
pnpm db:create_migration create_users User Session
pnpm db:migrate
```

Then create the first user. Set `password`: `UserMixin` stores only its hash.
Either in the console:

```text
dito > User.insert({ username: 'admin', password: 'secret', roles: ['admin'] })
```

Or with a seed, which `pnpm db:seed` runs (see [Seeds](database.md#seeds)).
Seeds that are functions don't empty the table, so run this one once:

```js
// seeds/users.js
export default async function ({ User }) {
  return User.insert([
    {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD,
      roles: ['admin']
    }
  ])
}
```
