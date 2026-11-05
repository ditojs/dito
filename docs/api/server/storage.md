# Storage

```js
import {
  createStorages,
  createAssets,
  Storage,
  StorageRegistry,
  DiskStorage,
  S3Storage,
  getUniqueKey
} from '@ditojs/storage'
import { serveStorage } from '@ditojs/storage/node'
```

Storages keep files on disk or in S3, and handle uploads.

- The `asset` table tracks the stored files.
- A write accepts the files that the table holds.
- Jobs scan the data to find the files that no row references.
- The package reads its tables through [Kysely](https://kysely.dev).

The peer dependencies are `kysely`, `@ditojs/server` and `hono`. S3 storages
also need `@aws-lite/client` and `@aws-lite/s3`, and `serveStorage()` needs
`@hono/node-server`. See [Storages and files](../../guide/server/storage.md) in
the guide.

## createStorages()

```ts
createStorages(
  definitions: Record<string, StorageDefinition>,
  options?: { basePath?: string }
): StorageRegistry
```

```js
const storages = createStorages({
  public: { type: 'disk', path: 'storage/public', url: '/assets/public/' },
  files: { type: 's3', bucket: 'files', s3: { region, credentials } }
})
```

Builds the storages from plain definitions keyed by name, such as those of an
app's config. It returns them in a registry.

- The `path` of disk storages resolves against `basePath`, which defaults to the
  working directory.
- S3 storages load the aws-lite client when they first need it.

### StorageRegistry

A `Map` of the storages by name. Its `get(name)` throws for unknown names.
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

| Key      | Type     | Description                                                                                                                                                                                                         |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bucket` | `string` | The bucket.                                                                                                                                                                                                         |
| `s3`     | `object` | The aws-lite options `{ region, credentials: { accessKeyId, secretAccessKey, sessionToken? }, endpoint? }`. Nothing is read from the environment.                                                                   |
| `params` | `object` | The S3 params of stored objects, passed to `PutObject`, or to `CreateMultipartUpload` for files over 8 MB, which are uploaded in parts of 8 MB, such as `{ ACL: 'public-read', CacheControl: 'max-age=31536000' }`. |

## Storage

The base class of `DiskStorage` and `S3Storage`. The constructor of each takes
the options of its definition, plus `name`.

| Member                         | Description                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `url`                  | The name and base URL.                                                                                                                                                                                                                                                                                                                                                                                            |
| `store({ name, type?, data })` | Stores `data`, a buffer or a stream such as a Node `Readable` or a `ReadableStream`, under a new key, and returns its file object. Images and videos get their width and height. Without `type`, or with `application/octet-stream`, it detects the type from the data. The type and the dimensions are read from the first 8 MB, so videos larger than that with their index at the end get no width and height. |
| `addFile(file, data)`          | Writes `data`, a buffer or a stream, under the key of a file object.                                                                                                                                                                                                                                                                                                                                              |
| `removeFile(file)`             | Removes the file.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `readFile(file)`               | Reads the file's data as a buffer.                                                                                                                                                                                                                                                                                                                                                                                |
| `listKeys()`                   | Returns the keys of all stored files.                                                                                                                                                                                                                                                                                                                                                                             |
| `getFileUrl(file)`             | Returns the URL of the file.                                                                                                                                                                                                                                                                                                                                                                                      |
| `isImportSourceAllowed(url)`   | Returns whether `allowedImports` matches the origin and path of the URL. URLs with credentials never match.                                                                                                                                                                                                                                                                                                       |

`DiskStorage` also has `getFilePath(file)`, which returns the path of the file
on disk. Keys that lead outside the storage folder throw an error.

`store()` doesn't insert an `asset` row, see [Stored files](#stored-files).

## serveStorage()

```ts
serveStorage(storage: Storage): MiddlewareHandler
```

```js
app.use('/assets/public/*', serveStorage(storages.get('public')))
```

From `@ditojs/storage/node`. Returns Hono middleware that serves the folder of a
disk storage, with `serveStatic()` of `@hono/node-server`.

- The host routes it at the path of the storage's `url`.
- The path of the route is cut from the request's path.
- Missing files go on to the next handler.
- Storages other than disk storages throw.

## File objects

Rows hold stored files as plain JSON objects:

```ts
interface AssetFile {
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
  // The size limit of each uploaded file, see Uploads.
  maxSize?: number | string
}
```

An asset path says where a table stores files.

- `path` takes `*` for one segment, and `**` for any number of segments.
- A value at the path is one file, or an array of files.
- In request bodies, the column appears as its camelCase property, such as
  `cover_image` as `coverImage`.

`createAssets()` takes the app's list of asset paths. With MikroORM, declare
them on the columns, see [`getAssetPaths()`](mikro.md#getassetpaths).

## createAssets()

```ts
createAssets(options: {
  adapter: { getKysely(): Kysely<any> }
  paths: AssetPath[]
  storages: StorageRegistry
  deleteUnusedAfter?: number | string | false
  maxSize?: number | string
}): Assets
```

```js
const assets = createAssets({
  adapter,
  paths: getAssetPaths(entities),
  storages,
  deleteUnusedAfter: '24h'
})

defineModelController({
  path: 'books',
  mixins: [assets.defineWrites('book'), assets.defineUploads('book')],
  ...
})

const file = await assets.store('documents', { name: 'notice.pdf', data: pdf })
await assets.runJobs({ dryRun: true })
```

Returns the asset handling of an app. It is bound to the app's adapter, asset
paths and storages.

- `adapter` is the adapter of `createApi()`, such as
  [`createMikroAdapter(orm)`](mikro.md#createmikroadapter).
- `deleteUnusedAfter` is in milliseconds, or a duration string such as `'24h'`,
  see [`parseDuration()`](../utils.md#parseduration). By default, it is `false`,
  which skips the release.
- `maxSize` is the size limit of the uploads that don't set their own.
- `createAssets()` throws for asset paths whose storage `storages` doesn't have.
  `defineUploads()` does the same for `uploads`.

The `asset` rows go through two Kyselys:

- The mixins use the Kysely of the request's entity manager,
  `c.var.em.getKysely()`. So the `asset` rows of a write commit with its
  transaction.
- `findReferences({ c })` reads in the request's transaction too. So it sees the
  request's own changes.
- The other methods use `adapter.getKysely()`, outside of the requests'
  transactions. So the rows of `store()` and `import()` commit at once. Their
  files stay when a request rolls back, and the release deletes them.

| Member                                              | Description                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `defineWrites(table)`                               | A mixin that handles the files in the bodies of the table's writes, see [Writes](#writes).           |
| `defineUploads(table?, { uploads? }?)`              | A mixin with the upload action of the table's asset paths and of `uploads`, see [Uploads](#uploads). |
| `store(storage, { name, type?, data })`             | Stores a file that the server creates, see [Stored files](#stored-files).                            |
| `import(table, data)`                               | Imports the files of a row's data, see [Asset jobs](#asset-jobs). Returns `data`.                    |
| `findReferences({ tables?, storage?, keys?, c? }?)` | Lists the files that rows reference, see [Asset jobs](#asset-jobs).                                  |
| `runJobs({ dryRun?, now?, deleteUnusedAfter? }?)`   | Runs the scan and the release, see [Asset jobs](#asset-jobs).                                        |
| `paths`, `storages`                                 | The options.                                                                                         |

### Writes

`defineWrites(table)` handles the files in the JSON body of a controller's
writes, `c.var.body`. These are the files at the table's asset paths. For each
file, it looks up the `asset` row of its key:

- If the row is in the storage of the asset path, the file gets the properties
  of the stored file, from the row's `file`. So clients can't change them.
- If the row is in another storage, the file is copied under a new key.
- If there is no row, the file is imported from its `url` under a new key. This
  needs the storage's `allowedImports` to match the URL. Otherwise, the write
  responds with 400.
- Imports don't follow redirects. A redirect responds with 400.
- An import gives up after 30 seconds.
- Other values at an asset path, such as an object without a string `key`,
  respond with 400 and `BodyValidation` errors.

It changes the files in place, so the handler reads the stored files in its
`body`. It marks the files as used. When the write fails, it removes the
imported files again. Responses send the file objects as the rows hold them.

### Uploads

```js
assets.defineUploads({ uploads: [{ path: 'avatar', storage: 'public' }] })
```

`defineUploads(table, { uploads })` returns a mixin with the upload action
`post upload/:path{.+}`, such as `POST upload/cover-image` or
`POST upload/chapters/3/images`.

- The action camelizes each segment of the path.
- It stores the files in the storage of the first upload that matches the path.
- It looks at the table's asset paths first, as the camelCase column followed by
  the path, such as `chapters/*/images`. Then it looks at `uploads`.
- Other paths respond with 404.
- A table without asset paths and without `uploads` throws.
- `defineUploads({ uploads })` takes only `uploads`, for controllers without
  asset paths.

The action takes a `multipart/form-data` body and stores all its files.

- Other bodies respond with 415.
- The files stream from the body into the storage as they arrive.
- Files over the upload's `maxSize` respond with 413, and none of the body's
  files are stored.
- [`hostMiddleware()`](hono.md#hostmiddleware) sets no limit on multipart bodies.
- It inserts the `asset` rows of the files. They stay unreferenced until a scan
  finds them.
- It responds with the file objects.
- It runs without a transaction, so the rows commit at once. A release removes
  the files that no write references.
- It needs `authorize` on the controller or on a layer.

| Upload    | Type               | Description                                                                                                                                                                |
| --------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`    | `string`           | A glob of camelCase data paths, with `*` for one segment and `**` for several segments, such as `avatar`.                                                                  |
| `storage` | `string`           | The name of the storage of the files.                                                                                                                                      |
| `maxSize` | `number \| string` | Optional, the size limit of each file: a number of bytes, or a string with a unit, such as `'500mb'`, as in the admin, see [`parseFileSize()`](../utils.md#parsefilesize). |

### Stored files

`store()` of a storage doesn't insert an `asset` row. Files that the server
creates, such as generated PDFs, need one, so that the jobs track them.
`assets.store(storage, { name, type?, data })` does three things:

1. it stores the file in the storage, given by its name or as the storage
   itself;
2. it inserts the file's row, which stays unreferenced until a scan finds it;
3. it removes the file again when the insert fails.

## Asset jobs

The `asset` table holds one row for each stored file. `unreferenced_since` is
the time when a scan first found no row that references the file. It is null
otherwise.

```sql
create table asset (
  id serial primary key,
  key text not null unique,
  file jsonb,
  storage text not null,
  unreferenced_since timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

`assets.runJobs({ dryRun?, now?, deleteUnusedAfter? })` runs the scan, then the
release, and returns `{ scan, released }`.

- The `deleteUnusedAfter` of the call overrides the one of `createAssets()`.
- `false` only scans.
- `0` releases all unreferenced files now.

The scan:

- finds the files that rows reference at the asset paths;
- sets `unreferenced_since` of the unreferenced files, and clears it for the
  referenced ones;
- inserts the rows of referenced files that have none.

Its report has these keys:

- `referenced`, the files that rows reference again;
- `unreferenced`, all unreferenced files with their `since`;
- `missing`, the inserted rows;
- `rowCount`.

The release deletes the files and rows of assets that have been unreferenced for
longer than `deleteUnusedAfter`. A dry run writes and deletes nothing. It
returns as `released` the unreferenced files that the release would delete.

`assets.findReferences({ tables?, storage?, keys? })` lists the files that rows
reference, with their table, id, column and data path. With `keys`, it only
lists the references of these files.

`assets.import(table, data)` imports the files that a row's data references but
no `asset` row holds, such as the `file://` files of seed data. It does this as
`defineWrites()` does. It skips files from other sources.
