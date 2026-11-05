# Controllers

A controller is a plain object with a `path` and a map of `actions`. Each key of
`actions` is a route, with the verb and the path below the controller's path:

```js
import { defineAction, defineController } from '@ditojs/server'
import { z } from 'zod'

export const newsletters = defineController({
  path: 'newsletters',
  authorize: true,
  actions: {
    'put subscribe': defineAction({
      body: z.object({ email: z.email() }),
      handler: ({ body: { email } }) => subscribe(email)
    })
  }
})
```

This routes `PUT /newsletters/subscribe` below the path of the API. The
controllers of [entities](entities.md) come from `defineModelController()` of
`@ditojs/mikro`, and also take `entity`, `find` and `filters`.

## Actions

The key is `'verb'` or `'verb path'`. The verbs are `get`, `post`, `put`,
`patch` and `delete`. `HEAD` runs the `get` action without sending the body.

```js
actions: {
  'get': ({ em }) => listBooks(em),
  'get by-isbn/:isbn': ({ em, params }) => findByIsbn(em, params.isbn),
  'get files/:path{.+}': ({ params }) => readFile(params.path),
  'post import': ({ em, body }) => importBooks(em, body)
}
```

- Paths use Hono's syntax. `:name` matches one segment, and `:name{.+}` matches
  one or more. Both end up in `params`.
- Static segments match before parameters, whatever the order of the keys and
  of the API's `controllers`.
- Two actions on the same method and path make `createApi()` throw, also across
  controllers.

A controller's `path` may hold parameters too, such as
`pages/:pageId/child-pages`. Its handlers read them in `params`.

### Member actions

A path that starts with `:id` is a member action. Its handlers read the id in
`params.id`, and middleware with `c.req.param('id')`. In a model controller,
`id` of the context is the id converted to the type of the primary key, a number
for integer keys. An id that doesn't fit responds with 404. `getRecord()` loads
the record through the controller's `find`, once per request. If there is no
such record, it responds with 404:

```js
actions: {
  'get :id': true,
  async 'post :id/publish'({ getRecord }) {
    const book = await getRecord()
    book.publishedAt = new Date()
    return book
  }
}
```

`:id` is reserved for member actions and can't be part of a controller's `path`.

### `true` and objects

A model controller's base has default handlers for `get`, `post`, `get :id`,
`patch :id` and `delete :id`. It routes those whose keys the controller or its
mixins set. Each layer sets a key of `actions` to one of these values:

| Value                    | Meaning                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| a function               | The handler, which routes the key. `next()` runs the handler it replaces.                     |
| `true`                   | Routes the handler beneath: a mixin's, or the base's default handler.                         |
| an object with `handler` | The handler, with settings and schemas of its own.                                            |
| an object without it     | Routes the handler beneath and adds settings, such as `'patch :id': { authorize: 'editor' }`. |

A route without a key doesn't exist, so a forgotten key hides a route and never
publishes one.

### Handlers

A handler gets one object, its context:

| Key              | Description                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `query`, `body`  | The query and the JSON body, validated by the action's schemas.                                               |
| `params`         | The parameters of the path.                                                                                   |
| `user`           | `{ id, roles }` of the signed-in user, or `null`.                                                             |
| `action`         | The key of the action, such as `'post :id/publish'`.                                                          |
| `id`             | In model controllers, the id of a member action.                                                              |
| `entity`         | In model controllers, the entity class. `em.getMetadata(entity)` has its metadata.                            |
| `getRecord()`    | In model controllers, the record of a member action.                                                          |
| `find(options?)` | The controller's records, through its `find`, see [find()](entities.md#custom-actions).                       |
| `list(options?)` | The controller's list, see [Lists](entities.md#lists).                                                        |
| `getListQuery()` | The `where`, `orderBy` and `range` of the list, see [getListQuery()](../../api/server/mikro.md#getlistquery). |
| `em`             | The request's database handle, or the transaction's.                                                          |
| `c`              | Hono's context.                                                                                               |
| `next()`         | Runs the handler beneath, and returns its result.                                                             |

It also holds the variables that the app's middleware sets with `c.set()`, such
as a session. Handlers destructure what they need.

A handler returns data, which Dito sends as JSON, or a `Response`, which Dito
sends as it is. Hono's context makes responses of other types:

```js
'get :id/pdf': async ({ getRecord, c }) => {
  c.header('Content-Type', 'application/pdf')
  return c.body(await renderPdf(await getRecord()))
}
```

Data responds with 200, and `undefined` with 204, also for `post`. The default
`post` of `@ditojs/mikro` sets 201 itself. `c.status()` and `c.header()` set the
status and headers of the response:

```js
'post import': async ({ c }) => {
  c.status(202)
  c.header('Retry-After', '10')
  return { queued: true }
}
```

To run code around a default handler, call `next()`. It runs the handler that
this one replaces, and returns its result:

```js
actions: {
  // Stores a PDF of the book after the default handler assigned the body.
  'patch :id': async ({ em, next }) => storePdf(em, await next()),
  async 'delete :id'({ getRecord, next }) {
    const book = await getRecord()
    if (book.published) {
      throw new HttpError(409, { message: 'Published books stay.' })
    }
    return next()
  }
}
```

A handler that sets `context.body` before it calls `next()` changes the body for
the handlers beneath it, but not for the handlers above it.

### Query and body schemas

An action's `query` and `body` are [Zod schemas](validation.md). Dito
validates the request with them before the handler runs, and invalid input
responds with 400 and the issues. Their output becomes `query` and `body` of the
input. `defineAction()` gives them their types in the handler:

```js
'get search': defineAction({
  query: z.object({ term: z.string(), limit: z.number().int().default(20) }),
  handler: ({ em, query: { term, limit } }) => search(em, term, limit)
})
```

Dito converts the strings of query values to the numbers, booleans, dates and
arrays that the schema expects, see [Query
values](../../api/server/controllers.md#query-values). Without a `query` schema,
`query` holds the first value of each parameter. `c.req.queries()` holds all of
them.

Without a `body` schema, the `body` of writes is the JSON body. An empty body is
`{}`, and so is a JSON body without `Content-Type`, which is dropped: a `PATCH`
then changes nothing. Invalid JSON responds with 400. Dito doesn't read bodies
of other types, and `body` is `undefined`. Handlers read them from `c.req`, such
as uploads with `c.req.formData()`.

## Mixins

A mixin is a reusable part of a controller, a controller without `path`. It adds
its actions, settings, middleware and hooks to every controller that lists it in
`mixins`:

```js
import { defineMixin } from '@ditojs/server'

// Routes the default handlers that read.
export const readable = defineMixin({
  actions: { 'get': true, 'get :id': true }
})

// The authorization and transaction of the admin's controllers.
export const admin = defineMixin({
  authorize: ['superuser', 'admin'],
  transacted: true
})
```

A controller's layers are the base of `@ditojs/mikro`, the mixins and the
controller, in this order. Mixins list the mixins they need in their own
`mixins`. A mixin that several layers list counts as one layer.

- In `actions`, each layer builds on the layers beneath it, by the rules of
  [`true` and objects](#true-and-objects). When two layers set a handler for the
  same key, the later one wraps the earlier one through `next()`.
- `middleware` lists are joined in layer order.
- A setting comes from the last action definition that sets it, else from the
  last layer that sets it. See
  [ActionSettings](../../api/server/controllers.md#actionsettings).

For presets, write a function that returns a controller:

```js
import { crud, defineModelController } from '@ditojs/mikro'

export function defineAdminController(definition) {
  return defineModelController({
    ...definition,
    mixins: [admin, crud, audit(definition.entity), ...(definition.mixins ?? [])]
  })
}

export const bookCategories = defineAdminController({
  path: 'book-categories',
  entity: BookCategory,
  authorize: ['superuser', 'book-categories']
})
```

## Authorization

`authorize` decides who may run an action. It can be set on actions, controllers
and mixins:

| Value                      | Lets in                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `true`                     | Anyone.                                                                                                                      |
| `'editor'`, `['a', 'b']`   | Users with any of the roles.                                                                                                 |
| `({ c, user }) => boolean` | Whom the function lets in: only a returned `true` grants access. It may be async, and reads the id with `c.req.param('id')`. |

```js
defineModelController({
  path: 'loans',
  entity: Loan,
  authorize: 'admin',
  actions: {
    'get': { authorize: ['admin', 'desk'] },
    'get :id': { authorize: ['admin', 'desk'] },
    'patch :id': true,
    'post :id/extend': { authorize: 'superuser', handler: extend },
    'get :id/notice': {
      async authorize({ c, user }) {
        const loan = await c.var.em.findOne(Loan, Number(c.req.param('id')))
        return loan?.member.id === user?.id
      },
      handler: sendNotice
    }
  }
})
```

`authorize` functions get Hono's context, and read Dito's variables from
`c.var`. They run before the middleware of the layers, which sets `getRecord()`,
so they load what they check themselves. A denied request responds with 401
without a user, and with 403 with one. An action's own `authorize` replaces the
one of its layers.

Every write needs `authorize`. A `post`, `put`, `patch` or `delete` action
without it, on the action or on a layer, makes `createApi()` throw. Use
`authorize: true` to open a write to anyone. A GET action without `authorize`
lets anyone in.

The controller's [`find`](entities.md#find) leaves out the rows that a user may
not see, so `getRecord()` and the default handlers respond with 404 for them.

## Middleware

Middleware is Hono middleware, which runs before the handler. It can be set on
the API, the controller, a mixin or an action. It gets Hono's context `c` and
`next`, and reads Dito's variables from `c.var`, such as `c.var.user`, and in
the layers of a model controller `await c.var.getRecord()`. Any Hono middleware
works:

```js
import { timing } from 'hono/timing'

defineController({ path: 'reports', middleware: timing(), actions })
```

For behaviour that applies to many routes, use a mixin's middleware:

```js
import { createValidationError, defineMixin } from '@ditojs/server'

// Runs a rule on the record after a write.
export function validated(check) {
  return defineMixin({
    async middleware(c, next) {
      await next()
      if (c.req.method !== 'GET' && !c.error) {
        const issues = await check(c, await c.var.getRecord())
        if (issues.length) throw createValidationError(issues)
      }
    }
  })
}
```

The middleware of controllers, mixins and actions runs inside the transaction,
so throwing after `next()` rolls the write back. Hono handles an error where it
is thrown, so `await next()` returns, and `c.error` holds the error. After
`next()`, middleware sees the response in `c.res`, not the data. It reads the
body of a write from `c.var.body`, the same object that the handler gets.

## Transactions

Writes run in the API's `transaction`, and reads don't. An action, a controller
or a mixin can change this with `transacted`:

```js
// The admin has GET actions that write, so its reads run in one too.
export const admin = defineMixin({ transacted: true })

// An action that runs its own transactions.
actions: {
  'post import': { transacted: false, handler: importInBatches }
}
```

## Serialize and deserialize

Model controllers and their mixins take `serialize` and `deserialize`, see
[`defineModelController()`](../../api/server/mikro.md#serialize-and-deserialize)
of `@ditojs/mikro`. `serialize({ record, json, c })` shapes each outgoing record of
the controller, also records in arrays and plain objects such as
`{ results, total }`, and records from custom actions. Use it for computed
values that the entity's `find` can't express:

```js
async serialize({ record, json, c }) {
  return { ...json, reviews: await countReviews(c.var.em, record.id) }
}
```

`deserialize({ json, record, c })` shapes the body of the default `post` and
`patch :id` before the [checks of the body](writes.md#the-checks-of-a-body). On
updates, it also gets the current record. A handler that wraps the default one
with `next()` gets it too. Custom handlers don't run it. It decides what this
user may write: it removes or adds fields, or throws. Fields that it removes are
dropped without an error:

```js
deserialize({ json, c }) {
  return c.var.user?.roles.includes('admin')
    ? json
    : omit(json, ['internalNotes'])
}
```

`beforeSerialize({ records, c })` runs once per response, before `serialize`, with
all outgoing records as an array, also for a single record. It can load what the
records need with one query, which `serialize` then reads:

```js
const counts = new WeakMap()

defineMixin({
  async beforeSerialize({ records: books, c }) {
    const reviews = await c.var.em.find(Review, { book: { $in: books } })
    for (const book of books) {
      counts.set(book, reviews.filter(review => review.book === book).length)
    }
  },

  serialize: ({ record, json }) => ({ ...json, reviews: counts.get(record) })
})
```

Each `serialize` gets the result of the one before. They run in layer order, the
mixins first, and the first gets the record's JSON in the shape of `find`, see
[What goes out](entities.md#what-goes-out). `deserialize` runs in the reverse
order:

1. the controller, which sees the body as the client sent it
2. the mixins, from the last

## The context

Handlers read Hono's context as `c` of their context. It is the first argument of
middleware, and `c` of every other callback's context, such as that of
`authorize`, `serialize` and `deserialize`. They read the
[variables](api.md#variables) from `c.var`, and the parameters of the path with
`c.req.param()`, such as `c.req.param('id')`. See
[DitoContext](../../api/server/controllers.md#ditocontext) and
[the handler's context](../../api/server/api.md#the-handlers-context).
