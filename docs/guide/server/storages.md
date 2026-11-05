# Storages and files

`@ditojs/storage` keeps files on disk or in S3.

- Rows store the files as JSON file objects,
  `{ key, name, type, size, url, width?, height? }`.
- The `asset` table holds a row for each stored file.
- A write accepts a file when the table holds its key. It takes the file's
  properties from the table. So clients can't make up files or change their
  URLs.

The package reads and writes its own tables through
[Kysely](https://kysely.dev). In a request, it uses the Kysely of `c.var.em`.
Outside of requests, it uses the Kysely that the adapter's `getKysely()`
returns, such as that of `createMikroAdapter(orm)` of `@ditojs/mikro`.

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

`getAssetPaths(entities)` collects them as asset paths. An asset path has a
`table`, a `column`, a `path` and a `storage`. The uploads, the writes and the
jobs below read them. `path` is the data path of the files inside the column's
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
  deleteUnusedAfter: 24 * 60 * 60 * 1000
})
```

`createAssets()` binds the adapter, the asset paths and the storages once. It
returns the methods that the sections below use.

- The mixins use the Kysely of `c.var.em`. So the `asset` rows of imported files
  commit with the write's transaction.
- Uploads run without a transaction, and commit their rows at once.
- The other methods use `adapter.getKysely()`, outside of the requests'
  transactions.

## Uploads

```js
defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['admin', 'editor'],
  mixins: [assets.defineWrites('book'), assets.defineUploads('book')],
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

The admin's upload component sends each file as `multipart/form-data` to the
upload action. It sends it under the data path of its field, such as
`POST books/upload/chapters/3/images`. It keeps the file object of the
response.

- `assets.defineUploads(table)` adds the upload action of a table.
- `assets.defineWrites(table)` adds the handling of its writes.
- The action picks the storage of the first asset path that matches the data
  path.

Controllers that write a table without uploads only use `defineWrites()`.

```js
const uploads = [{ path: 'notes', storage: 'public' }]
assets.defineUploads('book', { uploads })
assets.defineUploads({ uploads: [{ path: 'avatar', storage: 'public' }] })
```

For upload fields that no asset path describes, `uploads` adds globs of its own.
Controllers without asset paths pass `uploads` without a table.

An upload without a type from the client gets the type detected from its data.
Without one, its type is `application/octet-stream`.

`hostMiddleware()` sets no limit on multipart bodies. The reverse proxy limits
the size of uploads, such as with `client_max_body_size` in nginx. The server
reads each upload whole into memory. S3 storages send it in one `PutObject`. So
keep that limit within the server's memory.

## Writes

The mixin handles the files in the body of a controller's writes:

- A file whose key the `asset` table holds in its storage gets the properties of
  the stored file, whatever the client sent.
- A file of another storage is copied under a new key.
- A file without an `asset` row is imported from its `url` under a new key. This
  needs the URL to match the storage's `allowedImports`. Otherwise, the write
  responds with 400.
- The patterns of `allowedImports` match the origin and path of the URL. URLs
  with credentials and redirects respond with 400 as well.
- Any other value at an asset path, such as an object without a string `key`,
  responds with 400.

Responses send the file objects as the rows hold them.

## Tracking files

```js
setInterval(async () => {
  const { scan, released } = await assets.runJobs()
  logger.info({ scan, released }, 'Asset jobs')
}, 60 * 60 * 1000)
```

Each `asset` row has `unreferenced_since`, the time since no row references the
file. Files that no row references for a while are deleted. Writes don't track
the references. A job scans the data at the asset paths instead.

- The scan sets and clears `unreferenced_since`.
- The release deletes the files and rows of assets that no row referenced for
  longer than `deleteUnusedAfter`, in milliseconds.
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
