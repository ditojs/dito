# Ordering by drag

Editors decide the order of a book's chapters, and the order in which the
genres appear in the shop's menu. Both lists should be reordered by dragging,
and the order stored in a `position` column.

## Chapters inside the book

The chapters are part of the book's data and saved with it, see
[Editing a graph](./edit-graph.md). The list numbers them by their position:

```js
chapters: {
  type: 'list',
  orderKey: 'position',
  draggable: true,
  creatable: true,
  deletable: true,
  itemLabel: 'title',
  fields: {
    title: { type: 'text' }
  }
}
```

On the server, the `chapters` relation of `Book` owns the chapters and loads
them in that order:

```js
import { defineEntity, p } from '@mikro-orm/core'

const ChapterSchema = defineEntity({
  name: 'Chapter',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    position: p.integer().nullable(),
    book: () => p.manyToOne(Book).deleteRule('cascade')
  }
})
export class Chapter extends ChapterSchema.class {}
ChapterSchema.setClass(Chapter)

// In the properties of `Book`:
chapters: () =>
  p
    .oneToMany(Chapter)
    .mappedBy(chapter => chapter.book)
    .orphanRemoval()
    .orderBy({ position: 'asc' })
```

## A list with its own resource

The genres are loaded from their own resource. A button below the list sends
the new order to a custom action:

```js
export const genres = {
  type: 'view',
  field: {
    type: 'list',
    resource: 'genres',
    form: genreForm,
    columns: ['name'],
    orderKey: 'position',
    draggable: true,
    buttons: {
      saveOrder: {
        text: 'Save Order',
        resource: {
          path: 'order',
          method: 'post',
          data: ({ item: genres }) =>
            genres.map(({ id, position }) => ({ id, position }))
        },
        onSuccess({ notify }) {
          notify({ type: 'success', text: 'The order was saved.' })
        }
      }
    }
  }
}
```

On the server, the controller's `find` lists the genres in their order. A
custom action stores the order:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { action } from '@ditojs/server'
import { defineController } from '@ditojs/mikro'
import { z } from 'zod'

const GenreSchema = defineEntity({
  name: 'Genre',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    position: p.integer().nullable()
  }
})
export class Genre extends GenreSchema.class {}
GenreSchema.setClass(Genre)

export const genres = defineController({
  path: 'genres',
  entity: Genre,
  // Anyone may read. The rest is for editors.
  authorize: ['editor', 'admin'],
  find: { orderBy: { position: 'asc' } },
  actions: {
    'get': { authorize: true },
    'post': true,
    'get :id': { authorize: true },
    'patch :id': true,
    'delete :id': true,
    'post order': action({
      body: z.array(z.object({ id: z.int(), position: z.int() })),
      async handler({ body, find }) {
        const positions = new Map(body.map(({ id, position }) => [id, position]))
        const genres = await find({
          where: { id: { $in: [...positions.keys()] } }
        })
        for (const genre of genres) {
          genre.position = positions.get(genre.id)
        }
        return genres
      }
    })
  }
})
```

## Why

With `orderKey`, the list numbers its items when they're loaded, added,
removed or moved, so the order is part of the data. Inside a form, that data is
saved with the form. A list with its own `resource` doesn't save its items, so
a button submits its `resource.data` instead, relative to the list's resource:
here `POST genres/order`. In a view with a single list, the list's buttons
receive the list's data as their `item`.

The action's `body` schema checks the positions before the handler runs.
`find()` of the handler's input loads the genres through the controller's
`find`, so the action only changes genres that the controller shows. After the
handler, the controller flushes the changes in the request's transaction.

Wherever a book populates its chapters, the relation's `orderBy` loads them in
their order.

See also: [Source options](../api/admin/schemas.md#source-options),
[`button`](../api/admin/schemas.md#button-submit),
[Actions](../api/server/controllers.md#actions),
[find()](../api/server/mikro.md#find-1).
