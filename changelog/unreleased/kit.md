### New

- **kit:** `@ditojs/kit` sets up an app in one call. `createApp({ entities, database, server, logger, secrets, storages, assets, jobs })` creates the ORM, the adapter, the logger, the storages, the assets and the Hono app. `app.createUsers(entity, options)` sets up users on the app's database and secrets, `app.routeApi(path, { controllers, users })` routes an API, and `app.start({ services })` runs the services around the server. The kit is optional. See [The kit](docs/guide/server/kit.md).
- **kit:** `jobs: { sessions, assets }` of `createApp()` says how often to delete the expired sessions and to run `assets.runJobs()`. The jobs run between `app.start()` and `app.close()`. `afterAssets` gets the result of each run, for the logs.
- **kit:** `assets: { deleteUnusedAfter, maxSize }` of `createApp()` holds the options of `createAssets()`, with `maxSize` as the default limit of all uploads.
- **kit:** `runPlayground()` runs piped code with the entities, the `orm` and an `em` in scope.
- **server:** `createHono()` returns the Hono app that routes the APIs, with Hono's `secureHeaders()`, `csrf()` for requests with `Origin` and `bodyLimit()`, optionally `cors()` and `etag()`, the `proxy` handling of reverse proxies, and Dito's JSON errors, in the order that they need. It routes paths with a trailing slash like those without one.
- **server:** Errors log with `console.error()` by default, and no longer through `c.var.logger`. Apps with a logger pass `onError` to `createApi()` and `createHono()`. The logger of the kit does this for its apps.
- **server:** `createApi()` and `createAdmin()` take `users`, the `{ middleware, getUser }` of `createUsers()`. They run `contextStorage()`, so `useEm()` and `useSession()` work in their requests.
- **server:** `serve()` takes `services`, objects with `start()` and `stop()`, which run around the server.

### Behaviour changes

- **server:** The `middleware` of `createApi()` runs only on the API's own actions. APIs at `/api` and `/api/admin` don't run each other's middleware, in any order of their routes.
