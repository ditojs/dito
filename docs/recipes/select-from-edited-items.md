# Select from edited items

A book has chapters, edited in a list in the book's form, and one of them is
the featured chapter shown in the catalog. Editors should pick it from the
chapters in the form, including chapters that they just added and that have
no id yet.

## Solution

On the server, `featuredChapter` relates a book to one of its chapters, and
the controller loads both relations:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { defineModelController } from '@ditojs/mikro'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    chapters: () =>
      p
        .oneToMany(Chapter)
        .mappedBy(chapter => chapter.book)
        .orphanRemoval(),
    featuredChapter: () => p.manyToOne(Chapter).nullable()
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

export const books = defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['editor', 'admin'],
  find: { populate: ['chapters', 'featuredChapter'] },
  actions: {
    'get': true,
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': true
  }
})
```

In the admin, the select takes its options from the edited chapters:

```js
export const bookForm = {
  type: 'form',
  fields: {
    title: { type: 'text', required: true },
    chapters: {
      type: 'list',
      creatable: true,
      deletable: true,
      fields: {
        title: { type: 'text' }
      }
    },
    featuredChapter: {
      type: 'select',
      relate: true,
      clearable: true,
      options: {
        dataPath: 'chapters',
        label: 'title'
      }
    }
  }
}
```

## Why

`options.dataPath` reads the options from the edited data, relative to the
item that the select sits in, here the book; a leading `/` would make it
absolute. With `relate: true`, the admin sends new chapters with a temporary
`#id`, and the selected one as `{ '#ref': key }` that points to it. The write
links the reference to the new chapter. One flush inserts the chapters and sets
the book's `featuredChapter`.

The book and its featured chapter refer to each other. One flush can only write
this with a nullable foreign key, so the relation is nullable.

See also:
[The options object](../api/admin/schemas.md#the-options-object),
[Editing a graph](./edit-graph.md),
[New rows and references](../guide/server/writes.md#new-rows-and-references).
