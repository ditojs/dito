# Configuration

The application receives its configuration as one plain object, the `config`
option of `new Application()`. Dito.js reads the keys described here; you can
add your own keys for your app, and read them through `app.config`.

[`ApplicationConfig`](../../api/server/application.md#applicationconfig) in
the API reference lists every key with its type and default. This page
explains what the keys are for.

## Example

```js
// config/index.js
const { env } = process

export default {
  env: env.NODE_ENV || 'development',

  server: {
    host: env.HOST || '0.0.0.0',
    port: env.PORT || 8080
  },

  log: {
    requests: true,
    sql: false,
    errors: { stack: true }
  },

  logger: {
    level: 'info'
  },

  app: {
    normalizePaths: true,
    proxy: true,
    session: { modelClass: 'Session' },
    keys: [env.APP_KEY]
  },

  admin: {
    root: './src/admin',
    dist: './dist/admin'
  },

  knex: {
    client: 'postgresql',
    connection: {
      host: env.DB_HOST || 'localhost',
      database: 'bookshop',
      user: env.DB_USER,
      password: env.DB_PASSWORD
    },
    normalizeDbNames: true
  },

  storages: {
    covers: {
      type: 'disk',
      path: 'storage/covers',
      url: 'https://bookshop.example.com/covers/'
    },
    samplePages: {
      type: 'disk',
      path: 'storage/sample-pages',
      url: 'https://bookshop.example.com/sample-pages/'
    }
  },

  services: {
    mail: { from: 'orders@bookshop.example.com' }
  },

  assets: {
    deleteUnusedAfter: '24h'
  }
}
```

## Keys

- `env`: the environment. Dito.js only reads it to choose the mode of the
  admin: in `'development'`, the admin is served from its sources with hot
  reloading.
- `server`: passed to Node's `server.listen()`, e.g. `host` and `port`.
- `log`: turns on development logging: requests, routes, SQL, and the JSON
  schemas and relation mappings that Dito.js builds from the model
  definitions. `log.errors` controls how errors are logged, see
  [Errors](errors.md#logging). See
  [`config.log`](../../api/server/application.md#configlog).
- `logger`: [Pino](https://getpino.io/) options for the application logger.
  Pretty printing is on by default; set `prettyPrint: false` to log JSON lines,
  e.g. in production.
- `app`: options of the Koa application and its middleware, see
  [`config.app`](../../api/server/application.md#configapp). Most apps set:
  - `normalizePaths`: hyphenates route paths, so that the controller `Books`
    serves `/books` and the relation `orderLines` serves `/order-lines`.
    Without it, paths keep the case of the names (`/Books`).
  - `keys`: the secret keys for signed cookies. They also sign uploaded
    files, see [Storages](storages.md#signatures). Dito.js removes them from
    `app.config`.
  - `session`: needed for users who log in, see
    [Controllers: users and sessions](controllers.md#users-and-sessions).

  The middleware that is on by default (`helmet`, `cors`, `compress`, `etag`,
  `responseTime`) is turned off with `false`, or configured with an object.

- `admin`: the settings of the [admin controller](controllers.md#admin): the
  folders of the admin's sources and build, and `api` and `settings`, which
  the admin receives in the browser. See
  [`config.admin`](../../api/server/application.md#configadmin) and the
  [admin guide](../admin/index.md).
- `knex`: the [Knex configuration](https://knexjs.org/guide/#configuration-options).
  Without `knex.client`, the application has no database. Dito.js adds:
  - `normalizeDbNames`: maps camelCase property names to snake_case table and
    column names: the property `publishedAt` is stored in the column
    `published_at`.
  - `typeParsers`: PostgreSQL type parsers by type id, e.g.
    `{ 1700: value => parseFloat(value) }` to read `numeric` columns as
    numbers.
- `storages`: file storages by name, see [Storages and assets](storages.md).
- `services`: the configuration of each service by name, see
  [Services](services.md#configuration). Every service the application has
  needs an entry; `false` turns the service off.
- `assets`: when unused uploaded files are deleted, see
  [Storages and assets](storages.md#cleanup). Durations are milliseconds or
  strings like `'2h'` or `'1 day'`.

## Environments

Dito.js has no configuration files per environment: the configuration is
whatever object your module exports. Build it from environment variables, or
merge a local file that isn't committed over shared defaults. Keep secrets,
such as `app.keys` and database passwords, out of the repository.
