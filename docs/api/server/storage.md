# Storage

```js
import {
  createStorages,
  createAssets,
  DiskStorage,
  S3Storage,
  assetUploads,
  assets,
  runAssetJobs
} from '@ditojs/storage'
import { serveStorage } from '@ditojs/storage/node'
```

Storages keep files on disk or in S3, and handle uploads. The `asset` table
tracks the stored files. A write accepts the files that the table holds, and
jobs scan the data to find the files that no row references. The package reads
its tables through [Kysely](https://kysely.dev).

Peer dependencies: `kysely`, `@ditojs/server`, `hono`, `@aws-lite/client` and
`@aws-lite/s3` for S3 storages, and `@hono/node-server` for `serveStorage()`.
See [Storages and files](../../guide/server/storages.md) in the guide.

## createStorages()

```ts
createStorages(
  definitions: Record<string, StorageDefinition>,
  options?: { basePath?: string }
): StorageRegistry
```

Builds the storages from plain definitions keyed by name, such as those of an
app's config, and returns them in a registry. The `path` of disk storages
resolves against `basePath`, which defaults to the working directory. S3
storages load the aws-lite client when they first need it.

```js
const storages = createStorages(
  {
    public: { type: 'disk', path: 'storage/public', url: '/assets/public/' },
    files: { type: 's3', bucket: 'files', s3: { region, credentials } }
  }
)
```

### StorageRegistry

A `Map` of the storages by name, whose `get(name)` throws for unknown names.
`new StorageRegistry(storages)` takes a list of storages. The functions of this
package that look up storages by name take a registry.

### StorageDefinition

All storages:

| Key              | Type             | Description                                                                                          |
| ---------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `type`           | `'disk' \| 's3'` | The kind of storage.                                                                                 |
| `url`            | `string`         | The base URL of the stored files, ending in `/`.                                                     |
| `allowedImports` | `string[]`       | Glob patterns of URLs from which files may be imported, such as `['https://images.example.com/**']`. |

Disk storages:

| Key             | Type      | Description                                                                                           |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `path`          | `string`  | The folder of the files.                                                                              |
| `nestedFolders` | `boolean` | Puts each file in two levels of folders named after the first characters of its key. Default: `true`. |

S3 storages:

| Key      | Type     | Description                                                                                                                                       |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bucket` | `string` | The bucket.                                                                                                                                       |
| `s3`     | `object` | The aws-lite options `{ region, credentials: { accessKeyId, secretAccessKey, sessionToken? }, endpoint? }`. Nothing is read from the environment. |
| `params` | `object` | The S3 params of stored objects, passed to `PutObject`, such as `{ ACL: 'public-read', CacheControl: 'max-age=31536000' }`.                       |

## Storage

The base class of `DiskStorage` and `S3Storage`. The constructor of each takes
the options of its definition, plus `name`.

| Member                         | Description                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `url`                  | The name and base URL.                                                                                                                                                                                       |
| `store({ name, type?, data })` | Stores the `data` buffer under a new key and returns its file object, with the width and height of images and videos. Without `type`, or with `application/octet-stream`, it detects the type from the data. |
| `addFile(file, data)`          | Writes `data` under the key of a file object.                                                                                                                                                                |
| `removeFile(file)`             | Removes the file.                                                                                                                                                                                            |
| `readFile(file)`               | Reads the file's data as a buffer.                                                                                                                                                                           |
| `listKeys()`                   | Returns the keys of all stored files.                                                                                                                                                                        |
| `getFileUrl(file)`             | Returns the URL of the file.                                                                                                                                                                                 |
| `isImportSourceAllowed(url)`   | Returns whether `allowedImports` matches the origin and path of the URL. URLs with credentials never match.                                                                                                  |

`DiskStorage` also has `getFilePath(file)`, the path of the file on disk. Keys
that lead outside the storage folder throw an error.

`store()` doesn't insert an `asset` row. Files that the server creates, such as
generated PDFs, need one, so that the jobs track them. `storeAsset()` stores the
file and inserts its row, and removes the file again when the insert fails:

```js
const file = await storeAsset(db, storages.get('documents'), {
  name: 'invoice.pdf',
  type: 'application/pdf',
  data: pdf
})
```

## serveStorage()

```ts
serveStorage(storage: DiskStorage): MiddlewareHandler
```

From `@ditojs/storage/node`. Returns Hono middleware that serves the folder of a
disk storage with `serveStatic()` of `@hono/node-server`. The host routes it at
the path of the storage's `url`. The path of the route is cut from the request's
path, and missing files go on to the next handler:

```js
app.use('/assets/public/*', serveStorage(storages.get('public')))
```

## File objects

Rows hold stored files as plain JSON objects:

```ts
interface AssetFileObject {
  key: string
  name?: string
  type?: string
  size?: number
  url?: string
  width?: number
  height?: number
}
```

`getUniqueKey(name)` returns a new key: a random UUID with the lower-cased
extension of `name`.

## Asset paths

```ts
interface AssetPath {
  table: string
  column: string
  // The data path of the files in the column's JSON value, '' for the column.
  path: string
  storage: string
}
```

An asset path says where a table stores files. `path` takes `*` for one segment
and `**` for any number of segments. A value at the path is one file or an array
of files. In request bodies, the column appears as its camelCase property, such
as `cover_image` as `coverImage`. The functions below take the app's list of
asset paths.

`assets()`, `assetUploads()` and `importAssets()` take the same options:

| Option     | Type              | Description                                                                                                                                                                                                 |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table`    | `string`          | The table whose asset paths are used.                                                                                                                                                                       |
| `paths`    | `AssetPath[]`     | The app's asset paths.                                                                                                                                                                                      |
| `storages` | `StorageRegistry` | The storages.                                                                                                                                                                                               |
| `db`       | `AssetDb`         | A function of Hono's `c` that returns the request's Kysely, such as `getKysely` of `@ditojs/mikro`, so that the `asset` rows of a write commit with its transaction. `importAssets()` takes a plain Kysely. |

## createAssets()

```ts
createAssets(options: {
  paths: AssetPath[]
  storages: StorageRegistry
  db: AssetDb
  deleteUnusedAfter?: number | false
}): Assets
```

Returns an object that binds the options that the functions below share. Its
methods call these functions, which apps can call instead. Except for `mixin()`,
they take a Kysely as `db`, since they also run outside of requests.
`deleteUnusedAfter` is in milliseconds. By default, `false` skips the release.

| Member                                          | Description                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `mixin(table, { uploads = true }?)`             | A mixin of [`assets()`](#assets) and, with `uploads`, [`assetUploads()`](#assetuploads). |
| `store(db, storage, { name, type?, data })`     | [`storeAsset()`](#asset-jobs), with the storage's name or the storage.                   |
| `import(db, table, data)`                       | [`importAssets()`](#asset-jobs) of a row's data. Returns `data`.                         |
| `references(db, { tables?, storage?, keys? }?)` | [`findAssetReferences()`](#asset-jobs).                                                  |
| `runJobs(db, { dryRun?, now? }?)`               | [`runAssetJobs()`](#asset-jobs) with `deleteUnusedAfter`.                                |
| `paths`, `storages`                             | The options.                                                                             |

```js
const assets = createAssets({
  paths: assetPaths,
  storages,
  db: getKysely,
  deleteUnusedAfter: 24 * 60 * 60 * 1000
})

defineController({ path: 'books', mixins: [assets.mixin('book')], ... })

const file = await assets.store(db, 'documents', {
  name: 'invoice.pdf',
  data: pdf
})
await assets.runJobs(db, { dryRun: true })
```

## assetUploads()

```ts
assetUploads(options: AssetOptions): MixinDefinition
```

Returns a mixin with the upload action of the asset paths of `table`:
`post upload/:path{.+}`, such as `POST upload/cover-image` or
`POST upload/chapters/3/images`. The action camelizes each segment of the path
and stores the files in the storage of the first asset path whose camelCase
column, followed by its path, matches it, such as `chapters/*/images`. Other
paths respond with 404. The action inserts the `asset` rows of the files,
unreferenced until a scan finds them, and responds with the file objects. It
runs without a transaction, so the rows commit at once, and a release removes
the files that no write references. It needs `authorize` on the controller or a
layer.

## uploadRoutes()

```ts
uploadRoutes(options: {
  uploads: AssetUpload[]
  storages: StorageRegistry
  db: AssetDb
}): MixinDefinition
```

Returns the same action as `assetUploads()` from a list of uploads, for upload
fields that no asset path describes. The action takes a `multipart/form-data`
body and stores all its files. Other bodies respond with 415.
[`hostMiddleware()`](hono.md#hostmiddleware) sets no limit on multipart bodies.

| Option    | Type     | Description                                                                                               |
| --------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `path`    | `string` | A glob of camelCase data paths, with `*` for one segment and `**` for several segments, such as `avatar`. |
| `storage` | `string` | The name of the storage of the files.                                                                     |

```js
uploadRoutes({
  uploads: [{ path: 'avatar', storage: 'public' }],
  storages,
  db: getKysely
})
```

## assets()

```ts
assets(options: AssetOptions): MixinDefinition
```

Returns a mixin that handles the files at the asset paths in the JSON body of a
controller's writes, `c.var.body`. For each file, it looks up the `asset` row of
its key:

- A row in the storage of the asset path: the file gets the properties of the
  stored file, from the row's `file`, so clients can't change them.
- A row in another storage: the file is copied under a new key.
- No row: the file is imported from its `url` under a new key, when the
  storage's `allowedImports` match it. Otherwise, the write responds with 400.

It changes the files in place, so the handler reads the stored files in its
`body`. It marks the files as used. When the write fails, it removes the
imported files again.

## Asset jobs

The `asset` table holds one row for each stored file, with `key`, `file` as
JSON, `storage` and `unreferenced_since`: the time a scan first found no row
that references the file, or null.

| Function                                                                  | Description                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scanAssets({ db, paths, dryRun?, now? })`                                | Finds the files that rows reference at the asset paths, sets `unreferenced_since` of the unreferenced files, clears it for the referenced ones, and inserts the rows of referenced files that have none. Returns a report: `referenced`, the files that rows reference again, `unreferenced`, all unreferenced files with their `since`, and `missing`, the inserted rows. |
| `releaseAssets({ db, storages, after, now? })`                            | Deletes the files and rows of assets that have been unreferenced for longer than `after`, in milliseconds.                                                                                                                                                                                                                                                                 |
| `runAssetJobs({ db, paths, storages, deleteUnusedAfter, dryRun?, now? })` | Runs the scan, then the release unless `deleteUnusedAfter` is `false`. `deleteUnusedAfter` is in milliseconds. Returns `{ scan, released }`. A dry run writes and deletes nothing, and returns the unreferenced files of the scan that the release would delete as `released`.                                                                                             |
| `findAssetReferences({ db, paths, tables?, storage?, keys? })`            | Lists the files that rows reference, with their table, id, column and data path. With `keys`, only the references of these files.                                                                                                                                                                                                                                          |
| `storeAsset(db, storage, { name, type?, data })`                          | Stores a file that the server creates and inserts its `asset` row, unreferenced until a scan finds it.                                                                                                                                                                                                                                                                     |
| `importAssets(data, { table, paths, storages, db })`                      | Imports the files that a row's data references but no `asset` row holds, such as the `file://` files of seed data, as `assets()` does. Skips files from other sources.                                                                                                                                                                                                     |
