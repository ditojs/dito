# Dito.js Server

Dito.js Server builds a REST API out of declarations.

- Entities describe the data.
- Controllers describe how clients reach the data: which routes exist, who may
  use them, and which rows and fields clients see and write.

Dito.js checks what comes in against the entities, and sends all errors in one
format.

The core builds each API as a [Hono](https://hono.dev) app, which the app routes
in its own Hono app. Handlers get Hono's context, and middleware is Hono
middleware. The core has no configuration of its own. The app adds data access,
files and users from packages:

| Package                | Role                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@ditojs/server`       | `createApi()` turns a list of controllers into a Hono app. Controllers, mixins, authorization, errors, and a server on Node. |
| `@ditojs/mikro`        | Model controllers on [MikroORM](https://mikro-orm.io) entities: lists, records, writes and filters.                          |
| `@ditojs/storage`      | File storages on disk and in S3, uploads, and the tracking of stored files.                                                  |
| `@ditojs/auth`         | Sessions, logins, passkeys, TOTP and password reset.                                                                         |
| `@ditojs/admin-server` | Serves the [Dito.js Admin](../admin/index.md).                                                                               |

Schemas of queries, bodies, filters and column types are
[Zod](https://zod.dev) schemas.

## Installation

```sh
pnpm add @ditojs/server @ditojs/mikro @mikro-orm/core @mikro-orm/postgresql hono @hono/node-server zod
```

The other packages are optional: `@ditojs/auth` for users and sessions,
`@ditojs/storage` for files, and `@ditojs/admin` with `@ditojs/admin-server` for
the admin. `@ditojs/utils` holds their shared helpers, such as `html`.

The packages are ES modules and need Node.js 24 or later. They are written in
TypeScript and ship their types.

## A first app

A bookshop with books, served at `/api/books`:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { MikroORM } from '@mikro-orm/postgresql'
import { Hono } from 'hono'
import { createApi, errorHandler, notFound } from '@ditojs/server'
import { serve } from '@ditojs/server/node'
import { defineController, mikroDb } from '@ditojs/mikro'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string().length(200),
    price: p.decimal('number').precision(8).scale(2).nullable()
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const books = defineController({
  path: 'books',
  entity: Book,
  authorize: 'editor',
  find: { orderBy: { title: 'asc' } },
  actions: {
    'get': { authorize: true },
    'post': true,
    'get :id': { authorize: true },
    'patch :id': true,
    'delete :id': true
  }
})

const orm = await MikroORM.init({
  entities: [Book],
  dbName: 'bookshop',
  user: 'bookshop'
})
// Creates the tables of the entities. Apps with data use migrations.
await orm.schema.update()

const api = createApi({
  controllers: [books],
  db: mikroDb(orm)
})

const app = new Hono()
app.route('/api', api)
// JSON errors outside of the API too, such as for unknown paths.
app.notFound(notFound)
app.onError(errorHandler())
await serve(app, { port: 8080, onClose: () => orm.close() })
```

This serves `GET` and `POST /api/books`, and `GET`, `PATCH` and
`DELETE /api/books/:id`. Anyone may read. Writes need a user with the role
`editor`. Dito.js checks every body against the entity before it reaches the
database. Invalid data responds with 400 and an error for each field.

## How a request runs

1. Hono's router finds the action of the method and path. Paths that no action
   matches go to the app's `notFound()`.
2. The API's `middleware` runs, such as sessions. Then Dito sets `c.var.db`
   through the `db` adapter and `c.var.user` with `getUser`.
3. The action's `authorize` lets the user in, or responds with 401 or 403.
4. The action's schemas check the query and the JSON body.
5. Writes open a transaction.
6. The middleware of the controller, its mixins and the action runs. A model
   controller's base sets `record()` and `find()` first.
7. The handler runs with its input, such as `{ query, body, params, user, db }`.
   Dito saves its result, serializes it and sends it as JSON.

Errors in any step respond with [JSON](../../api/server/errors.md). Errors with
a status of 500 or above also go to the API's `onError`, which logs them by
default.

## Next steps

- [API](api.md): `createApi()`, hosting, the database, users and errors.
- [Controllers](controllers.md): actions, handlers, mixins, authorization and
  middleware.
- [Entities and controllers](entities.md): MikroORM controllers, `find`, lists
  and filters.
- [Writes](writes.md): the checks of a body, nested rows, relations and deletes.
- [Validation](validation.md): schemas of queries, bodies and columns.
- [Storages and files](storages.md), [Users and sessions](auth.md),
  [Serving the admin](admin.md).
