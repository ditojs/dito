# Uploads with thumbnails

Each book has a cover image and a few sample pages. Editors upload them in
the book form and see thumbnails; the server stores the files and removes
them again when no book uses them anymore.

## Solution

Configure the storages in the application's config:

```js
// config/index.js
export default {
  storages: {
    covers: {
      type: 'disk',
      path: 'storage/covers',
      // The absolute URL where your web server serves the folder:
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

Declare the asset properties on the model, register an asset model, and let
the controller accept uploads for them:

```js
import { Model, AssetMixin, ModelController } from '@ditojs/server'

// Add it to the application's `models` under the name `Asset`:
export class Asset extends AssetMixin(Model) {}

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

export class Books extends ModelController {
  modelClass = Book
  assets = true
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
}
```

In the admin, upload fields edit the properties:

```js
export const bookForm = {
  type: 'form',
  components: {
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

Upload fields send each file to the controller's upload route for their data
path, e.g. `POST books/upload/cover`, which `assets = true` creates from the
model's `assets`. The storage keeps the file and responds with a file object
(`key`, `name`, `type`, `size`, `url`, …) that the field holds as its value.
Saving the book stores the file objects, and the `Asset` model counts their
references, so files that were uploaded but never saved, or that are no
longer used, are removed after `config.assets` thresholds. Saving waits for
uploads that are still running.

`thumbnails` shows images by their `url`; `thumbnailUrl` can point to a
resized version instead.

See also: [Storages](../guide/server/storages.md),
[`static assets`](../api/server/model.md#static-assets),
[Controller assets](../api/server/controllers.md#assets),
[`upload`](../api/admin/schemas.md#upload).
