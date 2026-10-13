# Dependent selects

Genres form a tree: fiction has subgenres like crime and fantasy. Editors want
to filter the list of books by genre, and then narrow it to one of the
subgenres. The subgenre select should only offer the subgenres of the selected
genre, loaded from the API, and be cleared when the genre changes.

## Solution

On the server, the `Genres` controller exposes the subgenres of each genre
through the `children` relation of `Genre`:

```js
import { ModelController } from '@ditojs/server'
import { Genre } from '../models/index.js'

export class Genres extends ModelController {
  modelClass = Genre
  collection = { allow: ['get'] }
  member = { allow: ['get'] }
  relations = {
    children: { relation: { allow: ['get'] } }
  }
}
```

The `Book` model filters by a genre, or by one of its subgenres, through its
`genres` relation:

```js
export class Book extends Model {
  static filters = {
    // Books of the genre or of one of its subgenres:
    genre(query, genreId, subgenreId) {
      const id = subgenreId ?? genreId
      if (id) {
        query.whereExists(
          Book.relatedQuery('genres').where(genres =>
            genres.where('genres.id', id).orWhere('genres.parentId', id)
          )
        )
      }
    }
  }
}
```

In the admin, the list's filter of the same name has two selects, and the
subgenre's options depend on the selected genre:

```js
export const books = {
  type: 'view',
  component: {
    type: 'list',
    resource: 'books',
    form: bookForm,
    columns: ['title', 'publishedAt'],
    filters: {
      genre: {
        components: {
          genre: {
            type: 'select',
            clearable: true,
            options: {
              data: async ({ request }) => {
                const genres = await request({
                  resource: '/genres',
                  cache: 'global'
                })
                return genres.filter(genre => !genre.parentId)
              },
              label: 'name',
              value: 'id'
            },
            onChange({ item }) {
              item.subgenre = null
            }
          },
          subgenre: {
            type: 'select',
            clearable: true,
            disabled: ({ item }) => !item.genre,
            options: {
              data: ({ item }) => {
                const genreId = item.genre
                return genreId
                  ? ({ request }) =>
                      request({ resource: `/genres/${genreId}/children` })
                  : []
              },
              label: 'name',
              value: 'id'
            }
          }
        }
      }
    }
  }
}
```

## Why

The `data` callback of `options` is evaluated again when the data that it reads
changes. The subgenre's callback only reads `item.genre`, here the filter's
values, and returns a loader function that sends the request: the request
itself doesn't add dependencies, so the options load again only when the genre
changes. Selects keep values that their options lack and show them as
unavailable, which is why `onChange()` of the genre clears the subgenre.

A filter with `components` sends their values in their order as arguments to
the model filter of its name, `null` for empty ones, e.g.
`filter=genre:3,null`.

See also:
[The options object](../api/admin/schemas.md#the-options-object),
[Filters](../api/admin/schemas.md#filters),
[`static filters`](../api/server/model.md#static-filters),
[RelationController](../api/server/controllers.md#relationcontroller).
