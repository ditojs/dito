# Entities and controllers

`@ditojs/mikro` builds controllers on [MikroORM](https://mikro-orm.io) entities.

- The entity declares the columns, their types and rules, and the relations.
- The controller declares what its clients see: which rows, which fields, which
  relations, and which filters they may use.

## Entities

Entities are MikroORM entities, defined with `defineEntity()` and the `p`
builders:

```js
import { defineEntity, p } from '@mikro-orm/core'

const ArticleSchema = defineEntity({
  name: 'Article',
  properties: {
    id: p.integer().primary(),
    title: p.string().length(200),
    published: p.boolean().default(false),
    internalNotes: p.text().nullable(),
    author: () => p.manyToOne(User),
    tags: () => p.manyToMany(Tag),
    sections: () =>
      p
        .oneToMany(Section)
        .mappedBy(section => section.article)
        .orphanRemoval(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date())
  }
})
export class Article extends ArticleSchema.class {}
ArticleSchema.setClass(Article)
```

Each column is declared only in the entity. The controllers check writes against
it, see [Writes](writes.md). These rules of the entity matter for Dito:

- Entities have a single primary key. Composite keys aren't supported, except on
  the pivot entities of many-to-many relations, which have no controller.
- `.hidden()` keeps a property out of every response, such as a password hash.
- Dito passes no serialization groups to MikroORM, so `.groups()` keeps no
  property out. Use `find.fields` and `find.exclude` per controller.
- A relation with `.orphanRemoval()` owns its rows. They are written and deleted
  with their parent, see [Nested rows](writes.md#nested-rows).
- A foreign key's `.deleteRule()` decides what deleting a record does to the
  rows that refer to it, see [Deletes](writes.md#deletes).
- [`plainDate()`](../../api/server/mikro.md#plaindate) declares a `date` column
  that stores a `Date` as its local day. `p.date()` stores its UTC day.

## Controllers

```js
import { defineController } from '@ditojs/mikro'
import { q } from '@ditojs/server/zod'
import { z } from 'zod'

export const articles = defineController({
  path: 'articles',
  entity: Article,
  // Anyone may read. The writes are for editors.
  authorize: ['admin', 'editor'],
  find: c => ({
    where: isEditor(c) ? {} : { published: true },
    populate: ['author', 'tags', 'sections'],
    exclude: isEditor(c) ? [] : ['internalNotes'],
    orderBy: { createdAt: 'desc' }
  }),
  filters: {
    author: q.integer(),
    tag: { schema: z.string(), where: name => ({ tags: { name } }) }
  },
  actions: {
    'get': { authorize: true },
    'get :id': { authorize: true },
    'post': true,
    'patch :id': true
  }
})
```

The controller routes the default handlers of the keys that it sets:

| Key          | Response                                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| `get`        | The list, see [Lists](#lists).                                                    |
| `post`       | Creates a record from the body, and responds with 201, the record and `Location`. |
| `get :id`    | The record.                                                                       |
| `patch :id`  | Updates the record with the fields of the body, and responds with it.             |
| `delete :id` | Deletes the record, and responds with `{ count: 1 }`.                             |

The `crud` mixin routes all five:

```js
import { crud, defineController } from '@ditojs/mikro'

defineController({
  path: 'tags',
  entity: Tag,
  authorize: 'editor',
  mixins: [crud]
})
```

There is no default `put` and no write on the whole list. Write these as custom
actions, such as `'post order'`.

An id that doesn't fit the primary key, such as `abc` for an integer key,
responds with 404. So does a record that `find` hides.

## Find

`find` decides what the controller loads and returns. It takes MikroORM's
[find options](https://mikro-orm.io/docs/entity-manager), plus `where` and
`maxRows`:

| Option     | Description                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| `where`    | The rows that the controller shows. Every query of the controller applies it.      |
| `populate` | The relations that responses include, as nested rows.                              |
| `fields`   | The columns to load and return. Paths such as `author.name` populate the relation. |
| `exclude`  | The columns to leave out.                                                          |
| `orderBy`  | The order of lists without `order=`.                                               |
| `filters`  | MikroORM's entity filters, such as `{ softDelete: false }`.                        |
| `maxRows`  | The most rows that a list returns, 1000 by default.                                |

`find` is an object, or a function of Hono's context `c` that returns one. The
function runs once per request, after `getUser`, so its result can depend on the
user:

```js
find: c => ({
  where: c.var.user ? {} : { published: true },
  exclude: c.var.user?.roles.includes('admin') ? [] : ['internalNotes']
})
```

`limit` and `offset` belong to lists, so `find` can't set them.

### Shared shapes

The admin and the website use separate controllers on the same entity, each with
its own `find`. When several controllers share a `find`, keep it as a plain
constant next to the entity:

```js
// entities/article.js
export const articleFront = {
  fields: ['id', 'title', 'author.name', 'tags.name'],
  where: { published: true }
}

// controllers/front/articles.js
defineController({
  path: 'articles',
  entity: Article,
  find: articleFront,
  actions: { 'get': true, 'get :id': true }
})
```

### What goes out

Records go out in the shape of `find`:

- Populated relations are nested rows, and so are the relations of paths in
  `fields`, such as `author` of `author.name`.
- Other relations to one row go out as `{ id }`, such as `author: { id: 12 }`,
  or `null` when they are empty. Nested rows have the relation to their parent
  too. With `fields`, the relation only goes out when `fields` names it,
  `author.id` or `*`.
- Relations to many rows that `find` doesn't populate aren't sent, even when a
  handler loaded them.
- `fields` narrows the columns. The primary key always goes out. `author.*`
  stands for the columns of the relation that aren't lazy. To load a lazy one,
  name it too, such as `author.bio`.
- `exclude: ['author']` leaves out the relation.

Entities that aren't records of the controller, such as those that a custom
action returns, go out with the relations that are loaded. Put secrets in
`.hidden()` properties, so that no response sends them.

## Lists

The `get` list takes these query parameters:

```
GET /articles?filter[author]=12&order=createdAt desc&range=0,49
```

| Parameter            | Description                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `filter[name]=value` | A filter of the controller. Repeated, it gives an array.                                                  |
| `order=name dir`     | Orders by a column or `relation.id` that the rows return, `asc` or `desc`. Repeat it to order by several. |
| `range=start,end`    | Responds with the rows from `start` to `end`, both included, as `{ results, total }`.                     |

Without `range`, the list responds with an array. A list returns at most 1000
rows, or the `maxRows` of its `find`. A larger `range` responds with 400, and so
does a list without `range` that has more rows. The primary key breaks ties in
the order, so that pages don't overlap.

`order` only takes columns that the user's rows return, as the order alone
reveals something about the values of a column.

### Filters

`filters` maps each name of `filter[name]` to two things:

- a schema, which validates the value
- a `where`, which turns the value into a MikroORM `where`

```js
filters: {
  // Short for { schema: q.integer(), where: id => ({ author: id }) }.
  author: q.integer(),
  tag: { schema: z.string(), where: name => ({ tags: { name } }) },
  status: {
    schema: z.enum(['draft', 'published', 'all']),
    where: status =>
      status === 'all' ? undefined : { published: status === 'published' }
  },
  // A filter's `where` gets Hono's context too.
  mine: {
    schema: q.boolean(),
    where: (mine, c) => (mine ? { author: c.var.user.id } : undefined)
  }
}
```

Query values are strings, so the schemas of numbers, booleans and dates parse
them, such as `q.integer()` and `q.boolean()` of `@ditojs/server/zod`. A `where`
that returns `undefined` skips the filter. Unknown filters and invalid values
respond with 400.

A filter's name may differ from the property, such as `author` for a property
`book.author`, so that clients keep their URLs. A name with a dot, such as
`author.id`, filters by that path when the filter is a schema alone.

`textFilter()` and `dateRangeFilter()` read what the `text` and `date-range`
filters of the admin send. Without properties, they apply to the property of the
filter's name:

```js
import { dateRangeFilter, textFilter } from '@ditojs/mikro'

filters: {
  title: textFilter(),
  // Matches in any of the properties.
  name: textFilter('firstName', 'lastName'),
  createdAt: dateRangeFilter(),
  published: dateRangeFilter('publishedAt')
}
```

For filters that apply to every query, such as soft deletes or tenants, use
MikroORM's [entity filters](https://mikro-orm.io/docs/filters).

### Other lists

`listHandler(find)` returns the handler of a list with its own `find`. This
`find` is merged with the controller's: both `where`s apply, and its other
options, such as `fields` and `populate`, replace the controller's. A `find`
with `fields` leaves out the controller's `populate`, so it names the relations
that it sends in its paths or its own `populate`. The list applies the
controller's filters, `order` and `range`:

```js
import { listHandler } from '@ditojs/mikro'

actions: {
  // The root pages only.
  'get': listHandler({ where: { parentPage: null } }),
  // The latest edition of each book.
  'get latest': listHandler({ where: { isLatest: true } })
}
```

For the options of a select, use `choices()`. This mixin routes `get choices`:

```js
import { choices } from '@ditojs/mikro'

mixins: [choices({ fields: ['id', 'name'], orderBy: { name: 'asc' } })]
// GET /book-categories/choices → [{ id, name }, …]
```

`maxRows: Infinity` lifts the limit of 1000 rows, for selects that list more:
`choices({ fields: ['id', 'name'], maxRows: Infinity })`.

`list(find)` of the handler's input runs the same list in a custom handler, such
as to load more data for its rows. Its `query` option replaces the list
parameters of the URL:

```js
async 'get'({ list, c }) {
  const result = await list()
  const rows = 'results' in result ? result.results : result
  await loadReviews(c, rows)
  return result
}
```

`listQuery()` of the input returns the `where`, `orderBy` and `range` of the
list with the filters and the `order` of the URL, for queries over its rows,
such as a summary or an export:

```js
async 'get summary'({ db, listQuery }) {
  const { where } = await listQuery()
  return { total: await db.count(Article, where) }
}
```

## Custom actions

Custom actions query through `find()` of their input, so that they see the same
rows as the default handlers. `find()` merges its options with the controller's
`find`, as `listHandler()` does, so its rows stay within the controller's
`where`:

```js
async 'get :id/related'({ record, find }) {
  const article = await record()
  return find({ where: { tags: { $in: article.tags.getIdentifiers() } } })
}
```

Other queries go through the request's entity manager, `db` of the input. During
a write, this is the transaction's entity manager. Middleware and other code
that has Hono's context get it with `getEntityManager(c)`:

```js
async 'post :id/publish'({ record, db }) {
  const edition = await record()
  await db.nativeUpdate(
    Edition,
    { id: { $ne: edition.id } },
    { published: false }
  )
  edition.published = true
  return edition
}
```

A handler changes the records and returns them. After the handler, the base
flushes the entity manager once, and sends the controller's records in the shape
of its `find`.

## Nested resources

A controller's `path` may hold parameters, which route nested resources:

```js
defineController({
  path: 'pages/:pageId/child-pages',
  entity: Page,
  authorize: ['admin', 'pages'],
  find: c => ({ where: { parentPage: Number(c.req.param('pageId')) } }),
  deserialize: (c, json) => ({
    ...json,
    parentPage: Number(c.req.param('pageId'))
  }),
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

Put the parent's visibility in `find.where`, so that the children of a hidden
parent respond with 404 too. Owned rows, with `orphanRemoval`, are part of their
parent's writes and need no controller of their own.
