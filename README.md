# Dito.js

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Dito.js consists of two main components: **Dito.js Server**, a set of packages
that turn entities and controllers into a REST API, and **Dito.js Admin**, a
Vue.js library that builds the views and forms for the administration of that
data.

Both components share the key philosophy of the Dito.js framework: The use of
declarative descriptions not only of the data structures themselves (the
entities), but also of the way they are remotely interacted with (the
controllers), as well as the way they are edited (the admin views and forms).

This is then also the reason for the name _Dito.js_ itself:

> _Ditto_ originally comes from the Latin word _dictus_, "having been said," the
> past participle of the verb _dīcere_, "to say."
> https://www.thefreedictionary.com/ditto

Dito.js was developed at [Lineto](https://lineto.com/) by [Jürg
Lehni](http://juerglehni.com), and was made available by Lineto in 2018 under
the MIT license.

## Packages

| Package                               | Description                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`@ditojs/server`](packages/server)   | The core on Hono: `createApi()`, controllers, mixins, authorization, errors, and a server on Node. |
| [`@ditojs/mikro`](packages/mikro)     | Model controllers on MikroORM entities.                                                            |
| [`@ditojs/storage`](packages/storage) | File storages, uploads and the tracking of stored files.                                           |
| [`@ditojs/auth`](packages/auth)       | Sessions, logins, passkeys, TOTP and password reset.                                               |
| [`@ditojs/admin`](packages/admin)     | The admin interface, and its server and Vite config.                                               |
| [`@ditojs/ui`](packages/ui)           | The Vue components that the admin is built with.                                                   |
| [`@ditojs/utils`](packages/utils)     | Helpers for Node.js and browsers.                                                                  |

## Documentation

The [documentation](docs/index.md) covers the guides, recipes and the API
reference:

- [Server guide](docs/guide/server/index.md)
- [Admin guide](docs/guide/admin/index.md)
- [API reference](docs/api/index.md)
- [Upgrading to 7.x](docs/upgrading-to-7.x.md), which is also the release
  notes of Dito.js 7
- Upgrade guides of older versions: [4.x](docs/upgrading-to-4.x.md),
  [5.x](docs/upgrading-to-5.x.md), [6.x](docs/upgrading-to-6.x.md)

Dito.js has no rules for folder structures and file names, and reads nothing
from them. A common layout is:

- `server/`: the entities, controllers and mixins of the server
- `admin/`: the views and forms of the admin
- `config/`: the configuration

## Releasing Dito.js

Releases are versioned locally and published to npm by GitHub Actions:

```sh
pnpm release patch # or minor, major
```

This runs `lerna version`, which bumps the versions of all packages, commits
them as `vX.Y.Z`, tags the commit and pushes both. The pushed tag starts the
[Publish workflow](.github/workflows/publish.yml), which builds the packages and
publishes them through npm's trusted publishing, without npm tokens or
logins. Only repository admins can create `v*` tags. It publishes only the
versions that aren't on npm yet, so a release that failed partway is finished by
rerunning it, or with `gh workflow run publish.yml -f tag=vX.Y.Z`. It then
creates the GitHub release of the tag, with the version's section of
`CHANGELOG.md` as its notes, so the section needs to be named after the version
before releasing.

All packages are always released together, also the ones that didn't change
(`forcePublish` in `lerna.json`), so their versions stay in sync and each
package's trusted publisher on npm is used with every release: npm lets
trusted publisher configurations that are never used expire.
