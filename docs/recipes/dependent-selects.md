# Dependent selects

Genres form a tree: fiction has subgenres like crime and fantasy. Editors want
to filter the list of books by genre, and then narrow it to one of the
subgenres. The subgenre select should only offer the subgenres of the selected
genre, loaded from the API, and be cleared when the genre changes.

## Solution

On the server, a genre belongs to its parent genre, and the genres controller
lists the subgenres of a genre through a filter:

```js
import { defineEntity, p } from '@mikro-orm/core'
import { defineModelController } from '@ditojs/mikro'
import { z } from 'zod'

const GenreSchema = defineEntity({
  name: 'Genre',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    parent: () => p.manyToOne(Genre).nullable()
  }
})
export class Genre extends GenreSchema.class {}
GenreSchema.setClass(Genre)

export const genres = defineModelController({
  path: 'genres',
  entity: Genre,
  find: { orderBy: { name: 'asc' } },
  // `GET /genres?filter=parent:3` lists the subgenres of genre 3.
  filters: { parent: z.number().int() },
  actions: { 'get': true, 'get :id': true }
})
```

The books controller filters books by a genre or one of its subgenres. It uses
the `genres` relation of `Book`:

```js
import { z } from 'zod'

// In the books controller:
filters: {
  genre: {
    // The ids of the genre and the subgenre, which may be empty. Tuples get
    // the strings of the arguments, so they coerce them.
    schema: z.tuple([
      z.coerce.number().int(),
      z.literal('').or(z.coerce.number().int())
    ]),
    where: ({ value: [genre, subgenre] }) => {
      // The subgenre if it is set, else the genre:
      const id = subgenre || genre
      return { genres: { $or: [{ id }, { parent: id }] } }
    }
  }
}
```

In the admin, the list's filter of the same name has two selects, and the
subgenre's options depend on the selected genre:

```js
export const books = {
  type: 'view',
  field: {
    type: 'list',
    resource: 'books',
    form: bookForm,
    columns: ['title', 'publishedAt'],
    filters: {
      genre: {
        fields: {
          genre: {
            type: 'select',
            clearable: true,
            options: {
              data: async ({ request }) => {
                const genres = await request({
                  resource: '/genres',
                  cache: 'global'
                })
                return genres.filter(genre => !genre.parent)
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
                      request({
                        resource: '/genres',
                        query: { filter: `parent:${genreId}` }
                      })
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

A filter with `fields` sends their values in order, as JSON arguments, with
`null` for an empty value. So the query is `filter=genre:3,null`, or
`filter=genre:3,5` with a subgenre. The server's filter gets an array of
strings, with `''` for `null`.

Responses send `parent` as `{ id }`, or `null` for the top genres, which the
genre select keeps.

See also:
[The options object](../api/admin/schemas.md#the-options-object),
[Filters](../api/admin/schemas.md#filters),
[Server filters](../api/server/mikro.md#filters),
[Lists](../guide/server/entities.md#lists).
