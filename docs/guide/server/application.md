# Application

`Application` is the root of a Dito.js server. It extends the
[Koa application](https://koajs.com/#application), holds the configuration and
the Knex instance, and keeps the storages, services, models and controllers of
the app. A server normally creates one application and exports it:

```js
// src/server/app.js
import { Application } from '@ditojs/server'
import config from '../../config/index.js'
import * as models from './models/index.js'
import * as controllers from './controllers/index.js'
import * as services from './services/index.js'

const app = new Application({ config, models, controllers, services })

export default app
```

Besides the [configuration](configuration.md), the
[models](models.md), [controllers](controllers.md) and
[services](services.md), the constructor takes a `validator` with your own
keywords and formats (see [Validation](validation.md#types-formats-and-keywords)),
`middleware`, `events`, and `basePath`, the folder that relative paths start
from, e.g. of `migrations/`, `seeds/` and disk storages. The
[`Application` API](../../api/server/application.md#constructor) lists all
options. Storages aren't an option: the application creates them from
`config.storages`.

## Namespaces

Controllers in nested objects are mounted under the object's keys:

```js
const app = new Application({
  config,
  models,
  controllers: {
    api: { Books, Authors, Orders }, // /api/books, /api/authors, …
    Admin                            // /admin
  }
})
```

The same structure comes from re-exporting folders as namespaces:

```js
// src/server/controllers/index.js
export * as api from './api/index.js'
export { Admin } from './Admin.js'
```

The key of a controller itself doesn't matter: a controller is named after its
class. A namespace adds to its path, so the admin controller belongs at the
top level: inside `api`, it would be served at `/api/admin`. See
[Controllers](controllers.md#paths).

## Lifecycle

Creating the application sets up the logger, Knex and the middleware, and adds
the storages, services, models and controllers. Nothing is initialized yet, and
nothing connects to the database.

`await app.start()` then:

1. Calls `app.setup()`, which initializes the storages, then the services,
   models and controllers, in this order. Controllers set up their routes here.
2. Emits `'before:start'`, which also starts the services.
3. Listens on `config.server`.
4. Emits `'after:start'`.

`await app.stop()` emits `'before:stop'`, closes the server, and emits
`'after:stop'`, which also stops the services. `stop(timeout)` rejects when
stopping takes longer than `timeout` milliseconds.

`await app.execute()` calls `start()`, and on failure logs the error and exits
the process. It is what a server's main file calls.

Scripts that need the models without a server, e.g. imports or reports, call
`await app.setup()` instead of `start()`, and destroy the Knex instance when
they are done:

```js
import app from '../src/server/app.js'

await app.setup()
const Book = app.getModel('Book')
console.log(await Book.count())
await app.knex.destroy()
```

## Events

The application is an asynchronous event emitter: `await app.emit()` waits for
all listeners, which may be async. Besides the four lifecycle events above, it
emits `'error'` for errors of requests and of background work, e.g. failed
file removals, with `(error, ctx)`. The
[API reference](../../api/server/application.md#events) lists the events.

Listen through the `events` option, where comma-separated names share one
listener, or through `app.on()`:

```js
const app = new Application({
  config,
  models,
  controllers,
  events: {
    'after:start'() {
      this.logger.info('The bookshop is open')
    },
    'before:stop, after:stop'() {
      // One listener for both events
    }
  }
})

app.on('error', (error, ctx) => {
  reportToErrorTracker(error, ctx?.url)
})
```

## Middleware

The application installs its middleware in the constructor: logging, error
handling, security headers, CORS, compression and ETags, then the route lookup,
the body parser, transactions, sessions and authentication, and finally the
route handlers of the controllers.

The `middleware` option is installed after the route lookup and before the
body parser. Use it for your own processing of requests, or to serve files.
It takes one middleware function; combine several with `koa-compose`:

```js
import compose from 'koa-compose'
import mount from 'koa-mount'
import serve from 'koa-static'

const app = new Application({
  config,
  models,
  controllers,
  middleware: compose([
    mount('/covers', serve('storage/covers')),
    async (ctx, next) => {
      await next()
      ctx.set('X-Bookshop', 'open')
    }
  ])
})
```

For requests that match a route, `ctx.controller` and `ctx.action` hold the
controller and the action. Middleware can read custom options of actions from
`ctx.action`, see [Controllers](controllers.md#action-options).

## Accessing the application

Every model has the application as `Model.app` and `model.$app`, every
controller and service as `this.app`. Inside a request, `ctx.app` is the
application too.

- `app.getModel(name)`, `app.getService(name)`, `app.getStorage(name)` and
  `app.getController(url)` return what was registered, or `null`.
- `app.models`, `app.services`, `app.storages` and `app.controllers` hold all
  of them.
- `app.knex` is the Knex instance, `app.validator` the validator.
- `app.logger` is a [Pino](https://getpino.io/) logger. Inside a request, it
  is the request's logger, which logs the request id with every message.
- `app.requestLocals` holds the locals of the current request: its
  `transaction` on transacted routes, and its `logger`. Code deep inside a
  service can use the request's transaction without passing it around:

  ```js
  const { transaction } = this.app.requestLocals
  await Book.query(transaction).patch({ isAvailable: false }).findById(id)
  ```

## Extending the application

The application can be subclassed to change how it handles errors, logs or
sets up its parts. Methods meant to be overridden are marked as hooks in the
[API reference](../../api/server/application.md), e.g. `logError()`:

```js
import { Application } from '@ditojs/server'

class BookshopApplication extends Application {
  logError(error, ctx) {
    reportToErrorTracker(error)
    super.logError(error, ctx)
  }
}

const app = new BookshopApplication({ config, models, controllers })
```

## The admin's Vite configuration

When the app has an [admin controller](controllers.md#admin), it builds the
admin's Vite configuration. Building the admin for production needs a Vite
configuration file that imports the application:

```js
// admin.vite.config.js
import app from './src/server/app.js'

export default app.defineAdminViteConfig({
  // Your additions to the Vite configuration
})
```

```sh
vite build --config admin.vite.config.js
```

In development, the admin controller loads this file from the app's
`basePath` too. See the [admin guide](../admin/index.md).
