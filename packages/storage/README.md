# Dito.js Storage

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/storage` keeps files on disk or in S3 for Dito.js apps.

- It has upload actions for the admin.
- It tracks stored files in an `asset` table, by scanning the data, for all
  model controllers of the entities.
- It reads its tables through Kysely.

```js
import { createMikroAdapter, getAssetPaths } from '@ditojs/mikro'
import { createAssets, createStorages } from '@ditojs/storage'
import * as entities from './entities/index.js'

const storages = createStorages({
  public: { type: 'disk', path: 'storage/public', url: '/assets/' }
})
// The API takes the same adapter.
const adapter = createMikroAdapter(orm)
const assets = createAssets({
  adapter,
  paths: getAssetPaths(entities),
  storages
})
```

See
[Storages and files](https://github.com/ditojs/dito/blob/main/docs/guide/server/storage.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/storage.md).
