# Storages and files

`@ditojs/storage` keeps files on disk or in S3. Rows store the files as JSON
file objects, `{ key, name, type, size, url, width?, height? }`. The `asset`
table holds a row for each stored file. A write accepts a file when the table
holds its key, and takes its properties from there, so clients can't make up
files or change their URLs.

The package reads and writes its own tables through
[Kysely](https://kysely.dev). `getKysely(c)` of `@ditojs/mikro` returns the
Kysely of the request.

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

Entities say which columns hold files. `assetsJson()` declares a JSON column of
files, and `schemaJson()` takes the same with its `assets` option:

```js
import { assetsJson, schemaJson } from '@ditojs/mikro'

// In the properties of entities:
cover: assetsJson('public').nullable(),
chapters: assetsJson('public', '*/images').nullable(),
content: schemaJson(contentSchema, {
  assets: [{ path: '**/file', storage: 'public' }]
})
```

`getAssetPaths(entities)` collects them as asset paths, a list of `table`,
`column`, `path` and `storage`, which the uploads, the writes and the jobs below
read. `path` is the data path of the files inside the column's JSON value:

- `''` stands for the column itself.
- `*` matches one segment.
- `**` matches any number of segments.

The value at a path is one file or an array of files.

## The assets of an app

`createAssets()` binds the asset paths and storages once, and returns the
functions that the sections below use:

```js
import { getAssetPaths, getKysely } from '@ditojs/mikro'
import { createAssets } from '@ditojs/storage'
import * as entities from './entities/index.js'

export const assets = createAssets({
  paths: getAssetPaths(entities),
  storages,
  db: getKysely,
  deleteUnusedAfter: 24 * 60 * 60 * 1000
})
```

`db` returns the request's Kysely, so that the `asset` rows of imported files
commit with the write's transaction. Uploads run without a transaction and
commit their rows at once. Each method calls a function that the package also
exports, such as `assets()`, `assetUploads()` or `runAssetJobs()`.

## Uploads

The admin's upload component sends each file as `multipart/form-data` to the
upload action, under the data path of its field, such as
`POST books/upload/chapters/3/images`, and keeps the file object of the
response. `assets.mixin(table)` adds the upload action of a table and the
handling of its writes. The action picks the storage of the first asset path
that matches the data path:

```js
defineController({
  path: 'books',
  entity: Book,
  authorize: ['admin', 'editor'],
  mixins: [assets.mixin('book')],
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

Controllers that write a table without uploads use
`assets.mixin('book', { uploads: false })`.

For upload fields that no asset path describes, `uploadRoutes()` adds the upload
action with its own list of globs:

```js
uploadRoutes({
  uploads: [{ path: 'avatar', storage: 'public' }],
  storages,
  db: getKysely
})
```

An upload without a type from the client gets the type detected from its data,
else `application/octet-stream`. `hostMiddleware()` sets no limit on multipart
bodies: the reverse proxy limits the size of uploads, such as with
`client_max_body_size` in nginx.

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
  const { scan, released } = await assets.runJobs(orm.em.getKysely())
  logger.info({ scan, released }, 'Asset jobs')
}, 60 * 60 * 1000)
```

`scanAssets()` sets and clears `unreferenced_since`. `releaseAssets()` deletes
the files and rows of assets that no row referenced for longer than
`deleteUnusedAfter`, in milliseconds. Without `deleteUnusedAfter`, nothing is
deleted. A scan runs before each release, so files that rows reference again
stay.

- Files that the server creates, such as generated PDFs, go through
  `assets.store(db, 'documents', { name, data })`, which stores them and inserts
  their rows.
- Seeds that insert rows directly call `assets.import(db, table, data)` first.
  It stores the files that the rows reference by URL, such as `file://` URLs of
  seed data.
- `assets.references(db, { tables, storage, keys })` lists where rows reference
  files, such as for an admin view of the assets.
