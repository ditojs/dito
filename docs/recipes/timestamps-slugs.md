# Timestamps and slugs

Books should record when they were created and last changed, and get a URL
slug from their title when they're created, without the admin or other
clients having to send these values.

## Solution

```js
import { defineEntity, p } from '@mikro-orm/core'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    slug: p
      .string()
      .unique()
      .onCreate(book => toSlug(book.title)),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date())
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

## Why

MikroORM calls `onCreate` with the entity when it inserts a row, and
`onUpdate` when it updates one. Both run for every write through MikroORM,
whether it comes from a controller, a script or a seed.

The checks of a body drop scalars with `onCreate` and columns with `onUpdate`.
So clients can't set these values, and the admin can send back what it loaded. A
slug that already exists responds with 409.

Some values depend on the request, such as the user who changed a book. Add them
to the body in the controller's `deserialize`, which runs before these checks:

```js
deserialize: ({ json, c }) => ({ ...json, changedBy: c.var.user.id })
```

See also:
[The checks of a body](../guide/server/writes.md#the-checks-of-a-body),
[Serialize and deserialize](../guide/server/controllers.md#serialize-and-deserialize),
[Entities](../guide/server/mikro.md#entities).
