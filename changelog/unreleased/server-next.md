### New

- **server-next:** A new server package for Dito 7, on `Request` and `Response` and no HTTP framework. `createApp()` returns a `fetch(request, locals?)` that apps mount in the host of their choice. Controllers are plain objects from `defineController()`, with `collection` and `member` actions keyed `'verb path'`, `features`, `middleware`, `next()` to wrap verbs, and chained `serialize()`. It has no ORM, no logging and no config: apps pass the `prefix`, `middleware`, `transaction`, `connect`, `getUser` and `onError` they compose themselves.
  - Handlers get `ctx`: `req`, `url`, `params` (typed from the action key), `query`, `body`, `res`, `user`, `id`, `member()`, `db`, `action` and `locals`, which apps type by augmenting `DitoLocals`. They return data, which is sent as JSON, or a `Response`.
  - Errors are `HttpError`, answered by `errorResponse()` as RFC 9457 Problem Details, with field errors keyed by JSON Pointer.
  - Lists read `filter[name]=`, `order=`, `range=` and `fields=`. The Zod helpers for query values are in `@ditojs/server-next/zod`.
- **objection:** `defineController()` for Objection models, with Dito 6's model controller settings (`scope`, `allowScope`, `allowFilter`, `graph`, `relations`), `objectionTransaction()`, `objectionConnect()`, `requestStorage()`, `objectionKysely()` and `toHttpError()`, which maps Dito 6's, Objection's and the database's errors.
- **mikro:** `defineController()` for MikroORM entities: one `find` shape per controller, unit of work without refetching, write schemas from the entity metadata, filters on the controller, and `toHttpError()`.
- **storage:** Disk and S3 storages, `uploadHandler()`, and asset tracking by scanning the data: `scanAssets()`, `releaseAssets()`, `findAssetUsage()`, `insertAsset()` and the `assets()` feature. See `docs/plans/asset-scan.md`.
  - `createStorages()` builds named storages from plain definitions, `assetUploads()` adds a controller's upload actions from its asset paths, and `runAssetJobs()`, `addAssetFile()`, `findAssetReferences()` and `importAssets()` cover the asset jobs, server-created files, the asset admin and seeds.
  - `AssetError` is an `HttpError` with status 400.
- **auth:** Sessions as middleware for `createApp({ middleware })`, with the session on `ctx.locals.session`, and logins, confirmed access, password reset, passkeys and TOTP as a controller from `usersRoutes()`. They use Dito 6's `session` and `credential` tables and cookies, so existing sessions stay valid.
- **admin-server:** `serveAdmin()` returns `{ fetch, close }` and serves the admin, with Vite's own dev server in development, and `defineAdminViteConfig()` for `admin.vite.config.js`.
- **server:** `ParameterValidator` is exported.

### Behaviour changes

- **admin:** Sources in forms show the permission error for 403 answers as for 401.
- **admin:** Errors are read as Problem Details, with field errors keyed by JSON Pointer.
- **admin:** Lists send their filters as `filter[name]=value`.
- **admin:** Responses of any JSON type, such as `application/problem+json`, are parsed.
- **admin:** Resource paths are joined without a trailing slash when a resource's path is empty.
