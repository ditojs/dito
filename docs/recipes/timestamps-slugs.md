# Timestamps and slugs

Books should record when they were created and last changed, and get a URL
slug from their title when they're created, without the admin or other
clients having to send these values.

## Solution

```js
import { Model, TimestampedMixin } from '@ditojs/server'

export class Book extends TimestampedMixin(Model) {
  static properties = {
    title: { type: 'string', required: true },
    slug: { type: 'string', unique: true }
  }

  static hooks = {
    'before:insert'({ inputItems }) {
      for (const book of inputItems) {
        book.slug ??= toSlug(book.title)
      }
    }
  }
}

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

## Why

`TimestampedMixin` adds the `createdAt` and `updatedAt` properties and sets
them in its own `before:insert` and `before:update` hooks. The hooks of a model
run after the ones of its base classes, so the book's hook adds to them
instead of replacing them. `inputItems` are the models that the query writes.

Hooks run for all writes through the model, from controllers, services or
seeds alike. For values that depend on the request, e.g. the user who changed
a book, use controller hooks such as `'before:member:patch'` instead.

See also: [`static hooks`](../api/server/model.md#static-hooks),
[`TimestampedMixin`](../api/server/model.md#timestampedmixin),
[Models](../guide/server/models.md).
