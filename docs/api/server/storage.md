# `class` Storage

```js
import { Storage, AssetFile } from '@ditojs/server'
```

Storages keep the files of asset properties and controller uploads. They are
configured in [`config.storages`](application.md#applicationconfig), keyed by
name, referenced by that name from model [`assets`](model.md#static-assets) and
controller [`assets`](controllers.md#assets), and available as
`app.getStorage(name)`. See [Storages and
assets](../../guide/server/storages.md).

The disk and S3 storages are built in. `@aws-sdk/client-s3` and
`@aws-sdk/lib-storage` are optional peer dependencies, imported when an S3
storage uses them.

## StorageConfig

Common options:

| Key              | Type       | Description                                                                                                                                                       |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`           | `string`   | `'disk'`, `'s3'` or the type of a [registered](#static-register) storage class.                                                                                   |
| `url`            | `string`   | Absolute base URL of the stored files, ending in `/`: file URLs are resolved against it, so `…/covers` without the slash drops `covers`.                          |
| `concurrency`    | `number`   | Concurrency of storage operations, e.g. importing assets. Default `8`.                                                                                            |
| `allowedImports` | `string[]` | Glob patterns of URLs from which unsigned asset files may be imported, e.g. `['https://images.example.com/**']`; `file://` URLs are resolved to absolute paths. |

### DiskStorageConfig

| Key             | Type      | Description                                                                                                                      |
| --------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | `'disk'`  |                                                                                                                                  |
| `path`          | `string`  | Directory of the files, relative to the app's `basePath`. Required.                                                              |
| `nestedFolders` | `boolean` | Stores files in two levels of folders named after the first two characters of their key, e.g. `3/f/3f2a….png`. Default `true`. |

### S3StorageConfig

| Key       | Type             | Description                                                                  |
| --------- | ---------------- | ---------------------------------------------------------------------------- |
| `type`    | `'s3'`           |                                                                              |
| `bucket`  | `string`         | The bucket. Required.                                                        |
| `acl`     | `string`         | Canned ACL of uploaded objects, e.g. `'public-read'`.                        |
| `s3`      | `S3ClientConfig` | Configuration of the `S3` client.                                            |
| *other*   |                  | Passed on to `multer-s3`, except `s3`, `key`, `contentType` and `metadata`. |

The content type of uploads is taken from the request, else detected from the
data. With `readDimensions`, the image and video dimensions are stored as
object metadata too.

```js
covers: {
  type: 's3',
  bucket: 'bookshop-covers',
  acl: 'public-read',
  s3: { region: 'eu-central-1' },
  url: 'https://bookshop-covers.s3.eu-central-1.amazonaws.com/'
}
```

## Constructor

```js
const storage = new StorageClass(app, name, config)
```

The built-in storage classes aren't exported; [`Storage.get()`](#static-get)
returns them by type. Usually the application creates storages from
`config.storages`, see [`app.addStorage()`](application.md#addstorage), and
initializes them in [`app.setupStorages()`](application.md#setupstorages).

#### Parameters

| Name     | Type                              | Description                    |
| -------- | --------------------------------- | ------------------------------ |
| `app`    | [`Application`](application.md)   | The application.               |
| `name`   | `string`                          | The key in `config.storages`. |
| `config` | [`StorageConfig`](#storageconfig) | The configuration.             |

#### Example

```js
const DiskStorage = Storage.get('disk')
const storage = new DiskStorage(app, 'covers', {
  type: 'disk',
  path: 'storage/covers'
})
```

## Properties

| Name            | Type                              | Description                                                         |
| --------------- | --------------------------------- | ------------------------------------------------------------------- |
| `app`           | [`Application`](application.md)   | The application.                                                    |
| `name`          | `string`                          | The storage name.                                                   |
| `config`        | `StorageConfig`                   | The configuration.                                                  |
| `url`           | `string \| undefined`             | `config.url`.                                                       |
| `path`          | `string \| undefined`             | `config.path`.                                                      |
| `concurrency`   | `number`                          | `config.concurrency`, default `8`.                                  |
| `isInitialized` | `boolean`                         | Set to `true` by `app.setupStorages()`.                             |
| `storage`       | `multer.StorageEngine \| null`    | The multer storage engine for uploads, created by `setup()`.      |

## Methods

The methods that take a `file` need only its `key`, so stored file objects
can be passed as they are.

### setup()

```js
await storage.setup()
```

Sets up the storage backend: the disk storage checks `path` and creates its
multer disk storage, the S3 storage imports the AWS SDK and creates its client.
A disk storage without `path` throws here. Internal, called by
[`app.setupStorages()`](application.md#setupstorages) before `initialize()`.
Storage implementations, like the custom storages below, set themselves up
here; their subclasses override [`initialize()`](#initialize), which needs no
`super`. Returns `Promise<void>`.

### initialize()

```js
await storage.initialize()
```

Asynchronous initialization, after `setup()`. Does nothing by default, so
overrides need no `super` call. *Hook.* Returns `Promise<void>`.

### addFile()

```js
const file = await storage.addFile(file, data)
```

Writes `data` to the storage under `file.key`, sets `file.size` and
`file.url`, and turns `file` into an [`AssetFile`](#assetfile) of this
storage, in place.

#### Parameters

| Name   | Type                                         | Description          |
| ------ | -------------------------------------------- | -------------------- |
| `file` | [`AssetFile`](#assetfile) `\| { key, type }` | The file to store.   |
| `data` | `Buffer`                                     | The contents.        |

Returns `Promise<AssetFile>`: the file.

#### Example

```js
const file = AssetFile.create({ name: 'cover.png', data: buffer })
await app.getStorage('covers').addFile(file, file.data)

// A file with a key of your own:
await app.getStorage('covers').addFile(
  { key: `book-${book.id}.png`, type: 'image/png' },
  png
)
```

### removeFile()

```js
await storage.removeFile(file)
```

Removes the file. The disk storage also removes nested folders that become
empty. Returns `Promise<void>`.

### readFile()

```js
const buffer = await storage.readFile(file)
```

Reads the file's contents. Returns `Promise<Buffer>`.

### listKeys()

```js
const keys = await storage.listKeys()
```

Lists the keys of all files in the storage, e.g. to find orphaned files. Returns
`Promise<string[]>`.

### getFilePath()

```js
const filePath = storage.getFilePath(file)
```

Returns the absolute path of a file in a disk storage. Throws an
[`AssetError`](errors.md#asseterror) for keys that address files outside the
storage folder. Returns `string | undefined`: `undefined` for S3.

### getFileUrl()

```js
const url = storage.getFileUrl(file)
```

Returns the public URL of the file, resolved against `config.url`. Returns
`string | undefined`: without `config.url`, `undefined` for disk storages, and
for S3 the file's own `url`, else the S3 `location` that `multer-s3` sets on
uploaded files.

### getUniqueKey()

```js
const key = storage.getUniqueKey('Cover.PNG') // '<uuid>.png'
```

Returns a unique key: a UUID v4 with the name's lowercase extension. Returns
`string`.

### signAssetFile()

```js
storage.signAssetFile(file)
```

Sets `file.signature` to an HMAC of its `key`, `name`, `type`, `size`, `url`,
`width` and `height`, made with the first of `config.app.keys`. Without keys, a
random secret is used, and signatures don't survive restarts.

### verifyAssetFile()

```js
const isValid = storage.verifyAssetFile(file)
```

Returns `boolean`: whether `file.signature` is valid for the file's key and
metadata.

### convertAssetFile()

```js
storage.convertAssetFile(file, { trusted })
```

Turns a file object from request data into an [`AssetFile`](#assetfile) of
this storage, in place, and removes its signature. Unless `trusted` is `true`
(default `false`), throws an [`AssetError`](errors.md#asseterror) unless the
file is already an `AssetFile`, carries a valid signature, or comes from an
`allowedImports` URL with a key in the format of `getUniqueKey()`.

### isImportSourceAllowed()

```js
const isAllowed = storage.isImportSourceAllowed(url)
```

Returns `boolean`: whether `url` matches one of `config.allowedImports`.

### convertStorageFile()

```js
const object = storage.convertStorageFile(storageFile)
```

Converts a multer upload file to an [`AssetFileObject`](#assetfileobject), with
`url` and `signature`. `convertStorageFiles(storageFiles)` converts an array.
Returns [`AssetFileObject`](#assetfileobject).

### getUploadHandler()

```js
const middleware = storage.getUploadHandler(config)
```

Returns Koa middleware that receives multipart uploads into the storage, with
the multer options in `config` (plus `readDimensions`). Used by controller asset
routes. `getUploadStorage(config)` returns the multer storage engine it uses.
Returns `Koa.Middleware | null`: `null` before `setup()`.

## Custom storages

```js
import { Storage } from '@ditojs/server'

class MemoryStorage extends Storage {
  static type = 'memory'
  files = new Map()

  async _addFile(file, data) { this.files.set(file.key, data) }
  async _removeFile(file) { this.files.delete(file.key) }
  async _readFile(file) { return this.files.get(file.key) }
  async _listKeys() { return [...this.files.keys()] }
  _getFileUrl(file) { return this._getUrl(file.key) }
  _getFilePath(file) {}
}

Storage.register(MemoryStorage)
```

### `static` register()

```js
Storage.register(storageClass)
```

Registers a storage class for its static `type`, default: the hyphenated
class name without a `Storage` suffix. Register before creating the
application.

### `static` get()

```js
const storageClass = Storage.get('disk')
```

Returns `Class<Storage> | null`: the class registered for the type.

### Backend hooks

*Hooks.* The public methods delegate to these:

| Hook                   | Called by                              |
| ---------------------- | -------------------------------------- |
| `_addFile(file, data)` | `addFile()`                            |
| `_removeFile(file)`    | `removeFile()`                         |
| `_readFile(file)`      | `readFile()`                           |
| `_listKeys()`          | `listKeys()`                           |
| `_getFilePath(file)`   | `getFilePath()`                        |
| `_getFileUrl(file)`    | `getFileUrl()`, `addFile()`, uploads   |

Uploads need a multer storage engine in `this.storage`, created in
`initialize()`. `_getUrl(...parts)` and `_getPath(...parts)` resolve parts
against `url` and `path`.

## AssetFile

A file of a storage, as stored in asset properties.

```js
import { AssetFile } from '@ditojs/server'

const file = AssetFile.create({ name: 'notes.txt', data: 'Chapter one' })
```

### `static` create()

```js
AssetFile.create({ name, data, type?, width?, height? })
```

Creates a file with a new unique `key`. `data` is a `Buffer`, a string or a data
URI, and required. `type` defaults to the data URI's type or the MIME type of
`name`, else `'text/plain'` for strings and `'application/octet-stream'` for
buffers. Same as `new AssetFile(options)`. Returns `AssetFile`.

### Properties

| Name              | Type                  | Description                                                     |
| ----------------- | --------------------- | --------------------------------------------------------------- |
| `key`             | `string`              | Unique key, see `AssetFile.getUniqueKey(name)`.                 |
| `name`            | `string`              | The original file name.                                         |
| `type`            | `string`              | The MIME type.                                                  |
| `size`            | `number`              | Size in bytes.                                                  |
| `url`             | `string`              | Public URL, once stored.                                        |
| `width`, `height` | `number`              | Media dimensions, if read.                                      |
| `data`            | `Buffer \| null`      | The data of a created file (not enumerable).                    |
| `storage`         | `Storage \| null`     | The storage of a converted file (not enumerable).               |
| `path`            | `string \| undefined` | `storage.getFilePath(file)`.                                    |

### read()

```js
const buffer = await file.read()
```

Reads the contents from the file's storage. Returns `Promise<Buffer | null>`:
`null` without a storage.

### `static` convert()

```js
AssetFile.convert(object, storage)
```

Turns a plain file object into an `AssetFile` of `storage`, in place.

### `static` getUniqueKey()

```js
const key = AssetFile.getUniqueKey('Cover.PNG') // '<uuid>.png'
```

Returns `string`: a UUID v4 with the name's lowercase extension.

## AssetFileObject

The JSON form of asset files, as returned by uploads and stored in asset
properties: `{ key, name, type, size, url, width?, height?, signature? }`.
`signature` is set in upload responses and in the JSON of models
([`$formatJson()`](model.md#formatjson) signs their asset files), so that
clients can send the files back; it is removed before storing, see
[`convertAssetFile()`](#convertassetfile).

## Typed storages

```ts
declare module '@ditojs/server' {
  interface ApplicationStorages {
    covers: Storage
  }
}
```
