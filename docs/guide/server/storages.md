# Storages and files

`@ditojs/storage` keeps files on disk or in S3. Rows store the files as JSON
file objects, `{ key, name, type, size, url, width?, height? }`. The `asset`
table holds a row for each stored file. A write accepts a file when the table
holds its key, and takes its properties from there, so clients can't make up
files or change their URLs.

The package reads and writes its own tables through
[Kysely](https://kysely.dev). In a request, that's the Kysely of `c.var.em`,
outside of requests the one that `getKysely()` of the adapter returns, such as
`createMikroAdapter(orm)` of `@ditojs/mikro`.

## Storages

`createStorages()` builds the app's storages from plain definitions, keyed by
name:

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

Disk paths resolve against `basePath`. `params` of S3 storages go to each
`PutObject` request. S3 storages need the optional peers `@aws-lite/client` and
`@aws-lite/s3`, which load when a storage first needs them.

`serveStorage()` of `@ditojs/storage/node` serves a public disk storage at the
path of its `url`, through `serveStatic()` of `@hono/node-server`:

```js
import { serveStorage } from '@ditojs/storage/node'

app.use('/assets/public/*', serveStorage(storages.get('public')))
```

## Asset paths

Entities say which columns hold files, with the `assets` of `defineJsonType()`,
also next to a `schema`:

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

`getAssetPaths(entities)` collects them as asset paths, a list of `table`,
`column`, `path` and `storage`, which the uploads, the writes and the jobs below
read. `path` is the data path of the files inside the column's JSON value:

- `''` stands for the column itself.
- `*` matches one segment.
- `**` matches any number of segments.

The value at a path is one file or an array of files.

## The assets of an app

`createAssets()` binds the adapter, the asset paths and the storages once, and
returns the methods that the sections below use:

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

The mixins use the Kysely of `c.var.em`, so that the `asset` rows of imported
files commit with the write's transaction. Uploads run without a transaction and
commit their rows at once. The other methods use `adapter.getKysely()`, outside
of the requests' transactions.

## Uploads

The admin's upload component sends each file as `multipart/form-data` to the
upload action, under the data path of its field, such as
`POST books/upload/chapters/3/images`, and keeps the file object of the
response. `assets.defineUploads(table)` adds the upload action of a table, and
`assets.defineWrites(table)` the handling of its writes. The action picks the
storage of the first asset path that matches the data path:

```js
defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['admin', 'editor'],
  mixins: [assets.defineWrites('book'), assets.defineUploads('book')],
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

Controllers that write a table without uploads only use `defineWrites()`.

For upload fields that no asset path describes, `uploads` adds globs of its own,
also without a table for controllers without asset paths:

```js
const uploads = [{ path: 'notes', storage: 'public' }]
assets.defineUploads('book', { uploads })
assets.defineUploads({ uploads: [{ path: 'avatar', storage: 'public' }] })
```

An upload without a type from the client gets the type detected from its data,
else `application/octet-stream`. `hostMiddleware()` sets no limit on multipart
bodies: the reverse proxy limits the size of uploads, such as with
`client_max_body_size` in nginx. The server reads each upload whole into memory,
and S3 storages send it in one `PutObject`, so keep that limit within the
server's memory.

## Writes

The mixin handles the files in the body of a controller's writes:

- A file whose key the `asset` table holds in its storage gets the properties of
  the stored file, whatever the client sent.
- A file of another storage is copied under a new key.
- A file without an `asset` row is imported from its `url` under a new key, when
  the URL matches the storage's `allowedImports`. Otherwise, the write responds
  with 400. The patterns match the origin and path of the URL. URLs with
  credentials and redirects respond with 400 as well.
- Any other value at an asset path, such as an object without a string `key`,
  responds with 400.

Responses send the file objects as the rows hold them.

## Tracking files

Each `asset` row has `unreferenced_since`, the time since no row references the
file. Files that no row references for a while are deleted. Writes don't track
the references. A job scans the data at the asset paths:

```js
setInterval(async () => {
  const { scan, released } = await assets.runJobs()
  logger.info({ scan, released }, 'Asset jobs')
}, 60 * 60 * 1000)
```

The scan sets and clears `unreferenced_since`. The release deletes the files and
rows of assets that no row referenced for longer than `deleteUnusedAfter`, in
milliseconds. Without `deleteUnusedAfter`, nothing is deleted. A scan runs
before each release, so files that rows reference again stay. An upload counts
as unreferenced until its form is saved, so keep `deleteUnusedAfter` longer than
a form stays open.

- Files that the server creates, such as generated PDFs, go through
  `assets.store('documents', { name, data })`, which stores them and inserts
  their rows.
- Seeds that insert rows directly call `assets.import(table, data)` first.
  It stores the files that the rows reference by URL, such as `file://` URLs of
  seed data.
- `assets.findReferences({ tables, storage, keys })` lists where rows reference
  files, such as for an admin view of the assets.
