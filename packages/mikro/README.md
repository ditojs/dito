# Dito.js MikroORM

Dito.js is a declarative web framework with a focus on API driven development,
built on web standards, MikroORM and Vue.js.

Released in 2018 under the MIT license, with support by https://lineto.com/

`@ditojs/mikro` builds Dito.js controllers on [MikroORM](https://mikro-orm.io) 7
entities. A controller's `find` decides what it loads and returns, and its
`filters` decide what lists may narrow. Writes are checked against the entity's
metadata.

`mikroDb(orm)` connects the app to the ORM. It forks an entity manager per
request, runs transactions and maps MikroORM's errors.

```js
import { createApi } from '@ditojs/server'
import { defineController, mikroDb } from '@ditojs/mikro'
import { q } from '@ditojs/server/zod'

export const books = defineController({
  path: 'books',
  entity: Book,
  authorize: 'editor',
  find: { populate: ['author'], orderBy: { title: 'asc' } },
  filters: { author: q.integer() },
  actions: {
    'get': { authorize: true },
    'post': true,
    'get :id': { authorize: true },
    'patch :id': true
  }
})

app.route('/api', createApi({ controllers: [books], db: mikroDb(orm) }))
```

See
[Entities and controllers](https://github.com/ditojs/dito/blob/main/docs/guide/server/entities.md),
[Writes](https://github.com/ditojs/dito/blob/main/docs/guide/server/writes.md)
and the
[API reference](https://github.com/ditojs/dito/blob/main/docs/api/server/mikro.md).
