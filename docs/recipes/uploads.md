# Uploads with thumbnails

Each book has a cover image and a few sample pages. Editors upload them in
the book form and see thumbnails; the server stores the files and removes
them again when no book uses them anymore.

## Solution

Create the storages and the assets:

```js
// storages.js
import { getAssetPaths } from '@ditojs/mikro'
import { createAssets, createStorages } from '@ditojs/storage'
import * as entities from './entities/index.js'

export const storages = createStorages({
  covers: { type: 'disk', path: 'storage/covers', url: '/covers/' },
  samplePages: {
    type: 'disk',
    path: 'storage/sample-pages',
    url: '/sample-pages/'
  }
})

export const assets = createAssets({
  paths: getAssetPaths(entities),
  storages,
  deleteUnusedAfter: 24 * 60 * 60 * 1000
})
```

Declare the file columns on the entity. Give the controller the upload
actions and the file handling:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { assetsJson, defineModelController } from '@ditojs/mikro'
import { assets } from './storages.js'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    // JSON columns of files, in these storages:
    cover: assetsJson('covers').nullable(),
    samplePages: assetsJson('samplePages').onCreate(() => [])
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

export const books = defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['editor', 'admin'],
  mixins: [assets.mixin('book')],
  actions: {
    'get': true,
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': true
  }
})
```

The host serves the folders at the storages' URLs, with `serveStorage()`. A
timer deletes the files that no book uses:

```js
import { serveStorage } from '@ditojs/storage/node'
import { assets, storages } from './storages.js'

app.use('/covers/*', serveStorage(storages.get('covers')))
app.use('/sample-pages/*', serveStorage(storages.get('samplePages')))

setInterval(
  () => assets.runJobs(getRootKysely(orm)),
  60 * 60 * 1000
)
```

In the admin, upload fields edit the properties:

```js
export const bookForm = {
  type: 'form',
  fields: {
    title: { type: 'text', required: true },
    cover: {
      type: 'upload',
      accept: 'image/*',
      maxSize: '5MB',
      thumbnails: 'large',
      deletable: true
    },
    samplePages: {
      type: 'upload',
      multiple: true,
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxSize: '10MB',
      thumbnails: true,
      draggable: true,
      deletable: true
    }
  }
}
```

## Why

Upload fields send each file to the controller's upload action under their
data path, here `POST books/upload/cover` and `POST books/upload/samplePages`.
The action takes hyphenated paths such as `sample-pages` too. `assets.mixin()`
adds the action, which picks the storage of the asset path that matches. It
stores the file, inserts its `asset` row and responds with its file object
(`key`, `name`, `type`, `size`, `url`, and `width` and `height` of images). The
field holds this object as its value.

Saving the book stores the file objects in plain JSON columns. The mixin
accepts the files that the `asset` table holds, and takes their properties
from there, so clients can't make up files. Saving waits for uploads that are
still running.

`assets.runJobs()` finds the files that no book references, and deletes those
that no book used for a day, such as uploads that were never saved.

`thumbnails` shows images by their `url`; `thumbnailUrl` can point to a
resized version instead.

See also: [Storages and files](../guide/server/storages.md),
[Asset paths](../api/server/storage.md#asset-paths),
[createAssets()](../api/server/storage.md#createassets),
[`upload`](../api/admin/schemas.md#upload).
