# Entities and controllers

`@ditojs/mikro` builds controllers on [MikroORM](https://mikro-orm.io) entities.

- The entity declares the columns, their types and rules, and the relations.
- The controller declares what its clients see: which rows, which fields, which
  relations, and which filters they may use.

## Entities

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

Entities are MikroORM entities, defined with `defineEntity()` and the `p`
builders. Each column is declared only in the entity. The controllers check
writes against it, see [Writes](writes.md).

These rules of the entity matter for Dito:

- Entities have a single primary key. Composite keys aren't supported, except on
  the pivot entities of many-to-many relations, which have no controller.
- `.hidden()` keeps a property out of every response, such as a password hash.
- Dito passes no serialization groups to MikroORM. So `.groups()` keeps no
  property out. Use `find.fields` and `find.exclude` per controller.
- A relation with `.orphanRemoval()` owns its rows. They are written and deleted
  with their parent, see [Nested rows](writes.md#nested-rows).
- A foreign key's `.deleteRule()` decides what deleting a record does to the
  rows that refer to it, see [Deletes](writes.md#deletes).
- With [`defineMikroConfig()`](../../api/server/mikro.md#definemikroconfig),
  `p.date()` stores a `Date` as its local day. New rows also get the defaults of
  their `defineJsonType()` schemas, and the writes of a body store the output of
  these schemas.

## Controllers

```js
import { defineFilter, defineModelController } from '@ditojs/mikro'
import { z } from 'zod'

export const articles = defineModelController({
  path: 'articles',
  entity: Article,
  // Anyone may read. The writes are for editors.
  authorize: ['admin', 'editor'],
  find: ({ user }) => ({
    where: isEditor(user) ? {} : { published: true },
    populate: ['author', 'tags', 'sections'],
    exclude: isEditor(user) ? [] : ['internalNotes'],
    orderBy: { createdAt: 'desc' }
  }),
  filters: {
    author: z.number().int(),
    tag: defineFilter({
      schema: z.string(),
      where: ({ value }) => ({ tags: { name: value } })
    })
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
import { crud, defineModelController } from '@ditojs/mikro'

defineModelController({
  path: 'tags',
  entity: Tag,
  authorize: 'editor',
  mixins: [crud]
})
```

There is no default `put`, and no write to all records at once. Write these as
custom actions, such as `'post order'`.

An id that doesn't fit the primary key, such as `abc` for an integer key,
responds with 404. So does a record that `find` hides.

## Find

```js
find: ({ user }) => ({
  where: user ? {} : { published: true },
  exclude: user?.roles.includes('admin') ? [] : ['internalNotes']
})
```

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

`find` is an object, or a function that gets the context of the request, such
as `{ user, em, c }`, and returns one. The function runs once per request, after `getUser`. So its result can depend on
the user, as above.

`limit` and `offset` belong to lists, so `find` can't set them.

### Shared shapes

```js
// entities/article.js
export const articleFront = {
  fields: ['id', 'title', 'author.name', 'tags.name'],
  where: { published: true }
}

// controllers/front/articles.js
defineModelController({
  path: 'articles',
  entity: Article,
  authorize: true,
  find: articleFront,
  actions: { 'get': true, 'get :id': true }
})
```

The admin and the website use separate controllers on the same entity. Each one
has its own `find`. When several controllers share a `find`, keep it as a plain
constant next to the entity.

### What goes out

Records go out in the shape of `find`. Populated relations, and the relations
of the paths in `fields`, such as `author` of `author.name`, are nested rows.
Other relations to one row go out as `{ id }`, such as `author: { id: 12 }`. See
[Output](../../api/server/mikro.md#output) for all rules.

Records that aren't the controller's, such as those that a custom action
returns, go out with the relations that are loaded. Put secrets in `.hidden()`
properties, so that no response sends them.

## Lists

```
GET /articles?filter=author:12&order=createdAt desc&range=0,49
```

The `get` list takes these query parameters:

| Parameter          | Description                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `filter=name:args` | A filter of the controller, with its arguments as JSON. Several arguments give an array.                  |
| `order=name dir`   | Orders by a column or `relation.id` that the rows return, `asc` or `desc`. Repeat it to order by several. |
| `range=start,end`  | Responds with the rows from `start` to `end`, both included, as `{ results, total }`.                     |

Without `range`, the list responds with an array. A list returns at most 1000
rows, or the `maxRows` of its `find`. See [Lists](../../api/server/mikro.md#lists)
for the limits and the order.

### Filters

```js
filters: {
  // A schema alone filters by the property of the name, `author`.
  author: z.number().int(),
  tag: defineFilter({
    schema: z.string(),
    where: ({ value }) => ({ tags: { name: value } })
  }),
  status: defineFilter({
    schema: z.enum(['draft', 'published', 'all']),
    where: ({ value }) =>
      value === 'all' ? undefined : { published: value === 'published' }
  }),
  // A filter's `where` gets the context of the request too.
  mine: defineFilter({
    schema: z.boolean(),
    where: ({ value, user }) => (value ? { author: user.id } : undefined)
  })
}
```

`filters` maps each name of `filter=name:args` to two things:

- a schema, which validates the value;
- a `where`, which turns the value into a MikroORM `where`.

`defineFilter()` types the `where` by the output of the schema.

- Dito converts the strings of the arguments to the numbers, booleans and dates
  that the schema expects, see
  [Query values](../../api/server/controllers.md#query-values).
- A `where` that returns `undefined` skips the filter.
- Unknown filters and invalid values respond with 400.

A filter's name may differ from the property, such as `author` for a property
`book.author`. So clients keep their URLs. A name with a dot, such as
`author.id`, filters by that path when the filter is a schema alone.

```js
import { defineDateRangeFilter, defineTextFilter } from '@ditojs/mikro'

filters: {
  title: defineTextFilter(),
  // Matches in any of the properties.
  name: defineTextFilter(['firstName', 'lastName']),
  createdAt: defineDateRangeFilter(),
  published: defineDateRangeFilter('publishedAt')
}
```

`defineTextFilter()` and `defineDateRangeFilter()` read what the `text` and
`date-range` filters of the admin send. Without properties, they apply to the
property of the filter's name.

For filters that apply to every query, such as soft deletes or tenants, use
MikroORM's [entity filters](https://mikro-orm.io/docs/filters).

### Other lists

```js
import { defineList } from '@ditojs/mikro'

actions: {
  // The root pages only.
  'get': defineList({ where: { parentPage: null } }),
  // The latest edition of each book.
  'get latest': defineList({ where: { isLatest: true } })
}
```

`defineList(find)` returns the handler of a list with its own `find`, a
shape or a function, as on the controller. This `find` is merged with the controller's, as in
[`find()`](../../api/server/mikro.md#find-1). Both `where`s apply. Its other
options replace the controller's. The list applies the controller's filters,
`order` and `range`.

```js
import { defineChoices } from '@ditojs/mikro'

actions: {
  'get choices': defineChoices({
    fields: ['id', 'name'],
    orderBy: { name: 'asc' }
  })
}
// GET /book-categories/choices → [{ id, name }, …]
```

For the options of a select, use `defineChoices()`, a handler as `defineList()`.
A select shows all rows, so the list has no row limit, unless its `find` sets
`maxRows`. These rows aren't records, so they skip `beforeSerialize` and
`serialize`.

```js
async 'get'({ list, c }) {
  const result = await list()
  const rows = 'results' in result ? result.results : result
  await loadReviews(c, rows)
  return result
}
```

`list(find)` of the handler's context runs the same list in a custom handler,
such as to load more data for its rows.

```js
async 'get summary'({ em, getListQuery }) {
  const { where } = await getListQuery()
  return { total: await em.count(Article, where) }
}
```

`getListQuery()` of the context returns the `where`, `orderBy`, `limit` and
`offset` of the list, with the filters, the `order` and the `range` of the URL.
So `em.find(Article, where, options)` loads the rows of the list. Use it for
queries over these rows, such as a summary or an export.

## Custom actions

```js
async 'get :id/related'({ getRecord, find }) {
  const article = await getRecord()
  return find({ where: { tags: { $in: article.tags.getIdentifiers() } } })
}
```

Custom actions query through `find()` of their context. So they see the same
rows as the default handlers. `find()` merges its options with the controller's
`find`, as `defineList()` does. So its rows stay within the controller's
`where`.

```js
async 'post :id/publish'({ getRecord, em }) {
  const edition = await getRecord()
  await em.nativeUpdate(
    Edition,
    { id: { $ne: edition.id } },
    { published: false }
  )
  edition.published = true
  return edition
}
```

Other queries go through the request's entity manager, `em` of the context.
During a write, this is the transaction's entity manager. Middleware and other
code that has `c` read it as `c.var.em`. Other functions that a handler calls
get it from [`useEm()`](../../api/server/mikro.md#useem).

A handler changes the records and returns them. After the handler, the base
flushes the entity manager once. Then it sends the controller's records in the
shape of its `find`.

## Nested resources

```js
defineModelController({
  path: 'pages/:pageId/child-pages',
  entity: Page,
  authorize: ['admin', 'pages'],
  find: ({ c }) => ({ where: { parentPage: Number(c.req.param('pageId')) } }),
  deserialize: ({ json, c }) => ({
    ...json,
    parentPage: Number(c.req.param('pageId'))
  }),
  actions: { 'get': true, 'post': true, 'get :id': true, 'patch :id': true }
})
```

A controller's `path` may hold parameters, which route nested resources. Put
the parent's visibility in `find.where`. Then the children of a hidden parent
respond with 404 too. Owned rows, with `orphanRemoval`, are part of their
parent's writes. They need no controller of their own.
