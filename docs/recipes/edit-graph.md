# Editing a graph

A book is edited together with its chapters, and related to its author. The
form should load all of it with one request, and saving should update the
book, insert, update and delete its chapters, and relate the selected author.

## Solution

On the server, the relations say which models the book owns, scopes load
them, and the controller saves graphs:

```js
import { Model, ModelController } from '@ditojs/server'

export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true }
  }

  static relations = {
    author: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Author.id',
      nullable: true
    },
    chapters: {
      relation: 'hasMany',
      from: 'Book.id',
      to: 'Chapter.bookId',
      owner: true,
      scope: 'ordered' // A scope of `Chapter`, see "Ordering by drag"
    }
  }

  static scopes = {
    withAuthor: query => query.withGraph('author'),
    withChapters: query => query.withGraph('chapters')
  }
}

export class Books extends ModelController {
  modelClass = Book
  graph = true
  scope = ['withAuthor', 'withChapters']
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
}
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

The controller's scopes apply to all of its queries, so loading a book and
the response of saving it include the author and the chapters. With
`graph = true`, `POST` and `PATCH` save through the graph methods:
related models with an id, here the author, are only related, while the
models of `owner: true` relations, here the chapters, are inserted, updated or
deleted to match the data. The inlined list has no `resource`, so its chapters
are part of the book's data and saved with it.

The scopes also apply to the list of books, which then loads the authors and
chapters as well: keep what it loads small.

See also: [Relations](../guide/server/relations.md),
[graph methods](../api/server/query-builder.md#graph-methods),
[Nested forms](../guide/admin/nested-forms.md),
[Ordering by drag](./drag-ordering.md).
