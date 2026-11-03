# Editing a graph

A book is edited together with its chapters, and related to its author. The
form should load all of it with one request, and saving should update the
book, insert, update and delete its chapters, and relate the selected author.

## Solution

On the server, the `chapters` relation owns the book's chapters, and the
controller's `find` loads them with the author:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { defineController, listHandler } from '@ditojs/mikro'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    author: () => p.manyToOne(Author).nullable(),
    // `Chapter` is the entity of "Ordering by drag".
    chapters: () =>
      p
        .oneToMany(Chapter)
        .mappedBy(chapter => chapter.book)
        .orphanRemoval()
        .orderBy({ position: 'asc' })
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

export const books = defineController({
  path: 'books',
  entity: Book,
  authorize: ['editor', 'admin'],
  find: { populate: ['author', 'chapters'] },
  actions: {
    // The list loads the author only.
    'get': listHandler({ populate: ['author'] }),
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': true
  }
})
```

In the admin, the form edits the chapters in an inlined list and selects the
author:

```js
export const bookForm = {
  type: 'form',
  fields: {
    title: { type: 'text', required: true },
    author: {
      type: 'select',
      relate: true,
      clearable: true,
      options: {
        data: ({ request }) =>
          request({ resource: '/authors', cache: 'local' }),
        label: 'name'
      }
    },
    chapters: {
      type: 'list',
      orderKey: 'position',
      draggable: true,
      creatable: true,
      deletable: true,
      collapsible: true,
      itemLabel: 'title',
      fields: {
        title: { type: 'text', required: true },
        text: { type: 'markup', marks: { bold: true, italic: true } }
      }
    }
  }
}
```

## Why

The controller's `find` populates the author and the chapters. So a loaded book
includes both, and so does the response to saving it.

With `orphanRemoval`, the book owns its chapters. `post` and `patch :id` write
them nested: they insert chapters without an id, update chapters with an id, and
delete chapters that the array leaves out.

The author is a row of its own, so the select sends `{ id }` to link it. One
flush in the request's transaction writes it all. The inlined list has no
`resource`, so its chapters are part of the book's data and are saved with it.

`find` applies to the list of books too. The list's `listHandler()` replaces
its `populate`, so that the list leaves out the chapters and stays small.

See also: [Writes](../guide/server/writes.md),
[Nested rows](../guide/server/writes.md#nested-rows),
[Nested forms](../guide/admin/nested-forms.md),
[Ordering by drag](./drag-ordering.md).
