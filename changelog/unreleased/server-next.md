### New

- **server-next:** A new server package on Hono, for Dito 7. Controllers are plain objects from `defineController()`, with `collection` and `member` actions, features in `use`, `around` middleware, `next()` to wrap verbs, and `serialize()`. It has no ORM, no logging and no config: apps compose middleware, `onError()` with `problemResponse()`, and the `transaction` and `connect` of an ORM package themselves.
  - Errors are RFC 9457 Problem Details, or Dito 6's shape with `errors: 'dito'`.
  - Requests get `c.var.user`, `c.var.memberId`, `c.var.load()`, `c.var.body()` and `c.var.db`.
- **objection:** `defineController()` for Objection models, with Dito 6's model controller settings (`scope`, `allowScope`, `allowFilter`, `graph`, `relations`), `objectionTransaction()`, `objectionConnect()`, `requestStorage()`, `objectionKysely()` and `toProblem()`.
- **mikro:** `defineController()` for MikroORM entities: one `find` shape per controller, unit of work without refetching, write schemas from the entity metadata, and filters on the controller.
- **storage:** Disk and S3 storages, `uploadHandler()`, and asset tracking by scanning the data: `scanAssets()`, `releaseAssets()`, `findAssetUsage()`, `insertAsset()` and the `assets()` feature. See `docs/plans/asset-scan.md`.
- **auth:** Sessions, logins, confirmed access, password reset, passkeys and TOTP for the new server, on Dito 6's `session` and `credential` tables and cookies, so existing sessions stay valid.
- **admin-server:** `serveAdmin()` serves the admin from a Hono app, with Vite in development, and `defineAdminViteConfig()` for `admin.vite.config.js`.
- **server:** `ParameterValidator` is exported.

### Behaviour changes

- **admin:** Sources in forms show the permission error for 403 answers as for 401. Error notifications read `detail` and `title` when a response has no `message`.
- **admin:** Responses of any JSON type, such as `application/problem+json`, are parsed.
- **admin:** Resource paths are joined without a trailing slash when a resource's path is empty.
