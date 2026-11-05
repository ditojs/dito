# Server packages

Dito.js Server is a set of packages. The core builds APIs as
[Hono](https://hono.dev) apps, and the other packages add MikroORM, files, users
and the admin. These pages list their exports. The
[server guide](../../guide/server/index.md) explains how they work together.

| Package           | Pages                                                                                       | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@ditojs/server`  | [API](api.md), [Controllers](controllers.md), [Errors](errors.md), [Hono and Node](hono.md) | `createApi()`, controllers, mixins, host middleware, authorization, errors, and a server on Node.      |
| `@ditojs/mikro`   | [MikroORM](mikro.md)                                                                        | Model controllers on MikroORM entities: `find`, filters, lists and writes, and `createMikroAdapter()`. |
| `@ditojs/storage` | [Storage](storage.md)                                                                       | Disk and S3 storages, uploads, and the tracking of stored files.                                       |
| `@ditojs/auth`    | [Auth](auth.md)                                                                             | Sessions, logins, passkeys, TOTP, password reset and confirmed access.                                 |

All packages are ES modules written in TypeScript. Anything not documented here
is internal. The admin's [`@ditojs/admin/server`](../admin/server.md) serves the
admin.
