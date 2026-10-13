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
  components: {
    title: { type: 'text' }
  }
}
```

On the server, the relation loads them in that order:

```js
export class Chapter extends Model {
  static properties = {
    title: { type: 'string' },
    position: { type: 'integer', nullable: true }
  }

  static scopes = {
    ordered: query => query.orderBy('position')
  }
}

// In `Book.relations`:
chapters: {
  relation: 'hasMany',
  from: 'Book.id',
  to: 'Chapter.bookId',
  owner: true,
  scope: 'ordered'
}
```

## A list with its own resource

The genres are loaded from their own resource. A button below the list sends
the new order to a custom action:

```js
export const genres = {
  type: 'view',
  component: {
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

On the server, the `default` scope of `Genre` loads the genres in their order,
and a collection action stores it:

```js
export class Genre extends Model {
  static properties = {
    name: { type: 'string', required: true },
    position: { type: 'integer', nullable: true }
  }

  static scopes = {
    default: query => query.orderBy('position')
  }
}

export class Genres extends ModelController {
  modelClass = Genre

  collection = {
    allow: ['get', 'post'],
    'post order': {
      parameters: {
        genres: {
          from: 'root',
          type: 'array',
          required: true,
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', required: true },
              position: { type: 'integer', required: true }
            }
          }
        }
      },
      handler(ctx, { genres }) {
        return this.query().patchDitoGraph(genres)
      }
    }
  }

  member = { allow: ['get', 'patch', 'delete'] }
}
```

## Why

With `orderKey`, the list numbers its items when they're loaded, added,
removed or moved, so the order is part of the data. Inside a form, that data is
saved with the form. A list with its own `resource` doesn't save its items, so
a button submits its `resource.data` instead, relative to the list's resource:
here `POST genres/order`, which patches the positions. In a view with a
single list, the list's buttons receive the list's data as their `item`.

See also: [Source options](../api/admin/schemas.md#source-options),
[`button`](../api/admin/schemas.md#button-submit),
[Actions](../api/server/controllers.md#actions).
