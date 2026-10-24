# Storages and assets

Dito.js stores uploaded files, e.g. book covers or sample pages, in
storages, and keeps track of them in the models that use them:

- A **storage** keeps files, on disk or in Amazon S3.
- An **asset property** of a model holds file objects that describe stored
  files.
- **Upload routes** of controllers receive files and store them.
- An **asset model** records every file, counts its references, and removes
  files that are no longer used.

## Storages

Storages are configured in `config.storages`, keyed by name:

```js
// config/index.js
export default {
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
  }
}
```

`url` is the absolute URL at which the files are public, ending in `/`;
file objects get a `url` built from it. Without it, disk files have no URL,
and S3 files the URL that S3 returns. `path` is the folder of a disk storage,
relative to the app's `basePath`. The
[`StorageConfig`](../../api/server/storage.md#storageconfig) lists all
options.

To keep the sample pages in Amazon S3 instead, give the storage the bucket,
and the configuration of the S3 client in `s3`. S3 storages need
[optional peer dependencies](../../api/server/storage.md):

```js
samplePages: {
  type: 's3',
  bucket: 'bookshop-sample-pages',
  acl: 'public-read',
  url: 'https://bookshop.example.com/sample-pages/',
  s3: {
    region: 'eu-central-1',
    credentials: {
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET
    }
  }
}
```

Dito.js doesn't serve the files of disk storages. Serve them with Koa
middleware at the storage's `url`, e.g. with `koa-mount` and `koa-static`
(`pnpm add koa-mount koa-static`) in the application's `middleware` option:

```js
import mount from 'koa-mount'
import serve from 'koa-static'

const app = new Application({
  config,
  models,
  controllers,
  middleware: mount('/covers', serve('storage/covers'))
})
```

`app.getStorage(name)` returns a storage. The
[`Storage` API](../../api/server/storage.md) lists its methods, e.g.
`readFile()` and `listKeys()`.

## File objects

Files are described by plain objects, stored as JSON in the models:

```json
{
  "key": "3f2a9c1e-6d0b-4c47-9b51-0a8d5e3c7f21.jpg",
  "name": "emma-cover.jpg",
  "type": "image/jpeg",
  "size": 48213,
  "url": "https://bookshop.example.com/covers/3/f/3f2a9c1e-….jpg",
  "width": 800,
  "height": 1200
}
```

`key` is the file's unique name in the storage, `name` its original name.
`width` and `height` are only there for images and videos uploaded with
`readDimensions`.

## Asset properties

The static `assets` field of a model names the properties that hold files, and
the storage of each. The built-in `asset` type validates file objects:

```js
import { Model } from '@ditojs/server'

export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true },
    cover: { type: 'asset', nullable: true },
    samplePages: { type: 'array', items: { type: 'asset' }, default: [] }
  }

  static assets = {
    cover: { storage: 'covers', readDimensions: true },
    samplePages: { storage: 'samplePages' }
  }
}
```

The keys are data paths, so files can also sit deeper in JSON properties, with
`*` for any key or index and `**` for any number of levels:
`'extras/*/file'`, `'**/image'`. Files in related models belong in the
`assets` of the related model.

When a model is saved, Dito.js compares its files with the stored ones: it
adds the new files, counts their references, and releases the files that were
replaced or removed.

## Uploads

Controllers set up upload routes with their `assets` setting. Model
controllers can use `assets = true` for the asset properties of their model:

```js
import { ModelController } from '@ditojs/server'

export class Books extends ModelController {
  modelClass = Book
  assets = true

  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch'] }
}
```

This adds `POST /api/books/upload/cover` and
`POST /api/books/upload/sample-pages` (with `app.normalizePaths`). They take
multipart form data, with the files in fields named like the data path, and
respond with an array of file objects. The client puts these into the model's
data and saves it. The admin's `upload` type does all of this, see the
[admin guide](../admin/fields.md).

An `assets` object configures the routes itself, by data path, with the
`storage` and [multer](https://github.com/expressjs/multer#multeropts)
options such as `limits`, and `allow` and `authorize` like actions objects.
Any controller can have one; in model controllers, its entries replace those
of the model's `assets`:

```js
assets = {
  authorize: 'editor',
  cover: {
    storage: 'covers',
    readDimensions: true,
    limits: { fileSize: 5 * 1024 * 1024 }
  }
}
```

### Signatures

Upload responses and the file objects that models send to clients carry a
`signature`, made with the first of `config.app.keys`. When files come back in
the data of a request, the signature proves that they came from this server
with their key and metadata unchanged; files without a valid signature are
rejected with an [`AssetError`](errors.md). The signature isn't stored.

Configure `app.keys`: without them, a random key is used, and signatures
don't survive restarts of the server.

## The asset model

The asset model records every stored file: its `key`, its `file` object, its
`storage`, and `count`, the number of references to it. It is the model named
`Asset`, made with `AssetMixin`:

```js
import { AssetMixin, Model } from '@ditojs/server'

export class Asset extends AssetMixin(Model) {}
```

Register it with the other models, and create its table with a
[migration](database.md#creating-migrations-from-models):

```sh
pnpm db:create_migration create_assets Asset
```

Without an asset model, files are still stored and verified, but not counted
or removed, and files can't be added from code or imported.

### Cleanup

Files that no model references anymore are removed, along with their records,
once they haven't changed for `config.assets.deleteUnusedAfter`. Files that
were uploaded but never saved in a model are removed after
`config.assets.deleteUnsavedAfter`. Both default to 24 hours, and `false` keeps
the files.

These are minimum ages: the application checks for such files with
[`app.deleteExpiredRecords()`](../../api/server/application.md#deleteexpiredrecords),
every `config.app.deleteExpiredRecordsEvery` (one hour by default), and removes
them at the first run after them. Before removing a file, it checks that no
data references it anymore, as writes that skip the model hooks, e.g. of
scripts and seeds, don't count the references they add. To remove unused
files right away, e.g. from an admin action, call
`app.releaseUnusedAssets({ olderThan: 0 })`. `pnpm db:recount_assets` sets the
counts to the references in the data again.

## Adding files in code

`AssetFile.create()` creates a file from data, which is stored when the model
is saved:

```js
import { AssetFile } from '@ditojs/server'

const cover = AssetFile.create({
  name: 'emma-cover.jpg',
  data: await fs.readFile('covers/emma.jpg')
})
await book.$patch({ cover })
```

`data` can be a `Buffer`, a string or a data URI. This needs the asset model.

When a transaction rolls back with an error, the files that were stored or
imported in it are removed again. Rollbacks without an error keep them in the
storage. Failed writes outside of transactions keep them too, with counts that
`pnpm db:recount_assets` corrects.

### Importing files

File objects with a `url` and a key that has no asset record yet, e.g. files
copied from another server, are imported: Dito.js downloads them from their
`url` and stores them. As such files carry no valid signature, only URLs that
match the storage's `allowedImports` are accepted, and only keys in the format
that Dito.js generates: letters, digits, `_` and `-`, with an optional file
extension, like the UUIDs that Dito.js uses:

```js
covers: {
  type: 'disk',
  path: 'storage/covers',
  url: 'https://bookshop.example.com/covers/',
  allowedImports: ['https://staging.bookshop.example.com/covers/**']
}
```

`file://` URLs import local files, e.g. `'file:///data/covers/**'`.
Importing needs the asset model.

Files of the same app that are stored in another storage than the one of their
field, e.g. pasted from another upload field in the admin, are copied to the
field's storage under a new key.

## Custom storages

Storages for other backends extend `Storage` and register themselves for a
`type`. The [`Storage` API](../../api/server/storage.md#custom-storages)
describes the methods to implement.
