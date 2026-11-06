# Storages and files

`@ditojs/storage` keeps files on disk or in S3.

- Rows store the files as JSON file objects,
  `{ key, name, type, size, url, width?, height? }`.
- The `asset` table holds a row for each stored file.
- A write accepts a file when the table holds its key. It takes the file's
  properties from the table. So clients can't make up files or change their
  URLs.

## Storages

```js
import { createStorages } from '@ditojs/storage'

export const storages = createStorages(
  {
    public: {
      type: 'disk',
      path: 'storage/public',
      url: '/assets/public/'
    },
    downloads: {
      type: 's3',
      bucket: 'downloads',
      url: 'https://downloads.example.com/',
      // `credentials` holds the app's keys, such as `{ accessKeyId, … }`.
      s3: { region: 'eu-central-1', credentials },
      params: { ACL: 'public-read' }
    }
  },
  { basePath: import.meta.dirname }
)
```

`createStorages()` builds the app's storages from plain definitions, keyed by
name.

- Disk paths resolve against `basePath`.
- The `params` of S3 storages go to each `PutObject` request.
- S3 storages need the optional peers `@aws-lite/client` and `@aws-lite/s3`.
  They load when a storage first needs them.

```js
import { serveStorage } from '@ditojs/storage/node'

app.use('/assets/public/*', serveStorage(storages.get('public')))
```

`serveStorage()` of `@ditojs/storage/node` serves a public disk storage at the
path of its `url`. It uses `serveStatic()` of `@hono/node-server`.

## Asset paths

```js
import { defineJsonType } from '@ditojs/mikro'

// In the properties of entities:
cover: p
  .type(defineJsonType({ assets: [{ path: '', storage: 'public' }] }))
  .nullable(),
chapters: p
  .type(defineJsonType({ assets: [{ path: '*/images', storage: 'public' }] }))
  .nullable(),
content: p.type(
  defineJsonType({
    schema: contentSchema,
    assets: [{ path: '**/file', storage: 'public' }]
  })
)
```

Entities say which columns hold files, with the `assets` of `defineJsonType()`.
A column can have `assets` next to a `schema`.

`getAssetPaths(entities)` collects them as asset paths. An asset path has an
`entity`, a `table`, a `column`, a `path` and a `storage`. The uploads, the
writes and the jobs below read them. `path` is the data path of the files inside the column's
JSON value:

- `''` stands for the column itself.
- `*` matches one segment.
- `**` matches any number of segments.

The value at a path is one file, or an array of files.

## The assets of an app

```js
import { getAssetPaths } from '@ditojs/mikro'
import { createAssets } from '@ditojs/storage'
import * as entities from './entities/index.js'

export const assets = createAssets({
  adapter,
  paths: getAssetPaths(entities),
  storages,
  deleteUnusedAfter: '24h'
})
```

`createAssets()` binds the adapter, the asset paths and the storages once. It
returns the methods that the sections below use.

The package reads and writes its tables through [Kysely](https://kysely.dev).
The `asset` rows of a write commit with the write's transaction. All other rows
commit at once. See [`createAssets()`](../../api/server/storage.md#createassets)
for the Kysely that each method uses.

## Uploads

```js
defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['admin', 'editor'],
  mixins: [assets.defineUploads('book')],
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

The admin's upload component sends each file as `multipart/form-data` to the
upload action. It sends it under the data path of its field, such as
`POST books/upload/chapters/3/images`. It keeps the file object of the
response.

- `assets.defineUploads(table)` adds the upload action of a table. It throws
  for tables without asset paths.
- The action picks the storage of the first asset path that matches the data
  path.

```js
const uploads = [{ path: 'notes', storage: 'public' }]
assets.defineUploads('book', { uploads })
assets.defineUploads({ uploads: [{ path: 'avatar', storage: 'public' }] })
```

For upload fields that no asset path describes, `uploads` adds globs of its own.
Controllers without asset paths pass `uploads` without a table.

An upload without a type from the client gets the type detected from its data.
Without one, its type is `application/octet-stream`.

The server streams each upload into its storage, and S3 storages upload files
over 8 MB in parts. `maxSize` limits the size of each file, see
[Uploads](../../api/server/storage.md#uploads). The reverse proxy can limit all
of them too, see [`createHono()`](../../api/server/hono.md#createhono).

## Writes

Every model controller of an entity with asset paths handles the files in the
bodies of its writes, with no mixin. This adds no routes. A file that the `asset`
table holds gets the properties of the stored file, whatever
the client sent. Other files are imported from their `url`, when the storage's
`allowedImports` match it. See [Writes](../../api/server/storage.md#writes) for
all cases.

## Tracking files

```js
// In `createApp()`:
jobs: {
  assets: {
    every: '1h',
    after: ({ scan, released }) =>
      app.logger.info({ scan, released }, 'Asset jobs')
  }
}
```

Each `asset` row has `unreferenced_since`, the time since no row references the
file. Files that no row references for a while are deleted. Writes don't track
the references. A job scans the data at the asset paths instead. The
[kit](kit.md#jobs) runs it. Without the kit, the app calls `assets.runJobs()` in
its own schedule.

- The scan sets and clears `unreferenced_since`.
- The release deletes the files and rows of assets that no row referenced for
  longer than `deleteUnusedAfter`.
- Without `deleteUnusedAfter`, nothing is deleted.
- A scan runs before each release. So files that rows reference again stay.
- An upload counts as unreferenced until its form is saved. So keep
  `deleteUnusedAfter` longer than a form stays open.

Three more methods:

- Files that the server creates, such as generated PDFs, go through
  `assets.store('documents', { name, data })`. It stores them and inserts their
  rows. The rows commit at once, also in a request that rolls back. So the
  release deletes the files that no row references.
- Seeds that insert rows directly call `assets.import(table, data)` first. It
  stores the files that the rows reference by URL, such as the `file://` URLs of
  seed data.
- `assets.findReferences({ tables, storage, keys })` lists where rows reference
  files, such as for an admin view of the assets.

## Notes

- Storages that serve their files from the app's origin, such as with
  `serveStorage()`, also serve uploaded HTML and SVG files there, whose scripts
  then run as the app. Serve storages of uploads from another origin.
- A write copies a file of another storage without checking that the client
  may read that storage. Its key is enough.
