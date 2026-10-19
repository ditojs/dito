# Select from edited items

A book has chapters, edited in a list in the book's form, and one of them is
the featured chapter shown in the shop. Editors should pick it from the
chapters in the form, including chapters that they just added and that have
no id yet.

## Solution

On the server, `featuredChapter` relates a book to one of its chapters, and
the controller saves books with their relations:

```js
export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true }
  }

  static relations = {
    chapters: {
      relation: 'hasMany',
      from: 'Book.id',
      to: 'Chapter.bookId',
      owner: true
    },
    featuredChapter: {
      relation: 'belongsTo',
      from: 'Book.featuredChapterId',
      to: 'Chapter.id',
      nullable: true
    }
  }

  static scopes = {
    withChapters: query => query.withGraph('chapters'),
    withFeaturedChapter: query => query.withGraph('featuredChapter')
  }
}

export class Books extends ModelController {
  modelClass = Book
  graph = true
  scope = ['withChapters', 'withFeaturedChapter']
  collection = { allow: ['get', 'post'] }
  member = { allow: ['get', 'patch', 'delete'] }
}
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
`#id` and the selected one as a `#ref` to it, and the graph methods that
`graph = true` enables resolve the reference when they insert the chapters.

The relation is `nullable`, as the book and its featured chapter refer to each
other, which a graph insert can only resolve with a nullable foreign key.

See also:
[The options object](../api/admin/schemas.md#the-options-object),
[Editing a graph](./edit-graph.md),
[Dito.js graph methods](../api/server/query-builder.md#ditojs-graph-methods).
