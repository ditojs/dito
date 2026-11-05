# Validation

Dito.js validates in three places:

- the `query` and `body` schemas of actions, before the handler runs
- the filters of lists, each with its own schema
- the checks of the bodies of model controllers, which read the entity's
  metadata and run the schemas of custom column types. Postgres checks the rest.

Every schema that an app passes is a [Zod](https://zod.dev) schema. Zod is a
peer of `@ditojs/server`.

## Actions

```js
import { defineAction } from '@ditojs/server'
import { z } from 'zod'

'post :id/review': defineAction({
  query: z.object({ notify: z.boolean().optional() }),
  body: z.strictObject({
    rating: z.int().min(1).max(5),
    text: z.string().max(2000)
  }),
  handler: ({ em, body, query }) => addReview(em, body, query.notify)
})
```

The output of the schemas becomes `query` and `body` of the handler's context, and
`c.req.valid('query')` and `c.req.valid('json')`, so transforms and defaults
apply. `defineAction()` gives them their types in the handler.

Query values are strings. Dito converts them to the numbers, booleans, dates and
arrays that the schema expects, see
[Query values](../../api/server/controllers.md#query-values).

## Columns

The checks of a body know the entity's properties. They check required columns,
the JSON types of scalars, and enums, see
[The checks of a body](writes.md#the-checks-of-a-body). Postgres checks lengths,
ranges and formats, which respond with 400 without a field. Put other rules on
the column's custom type as a schema, see
[Rules on values](writes.md#rules-on-values):

```js
import { z } from 'zod'
import { defineJsonType } from '@ditojs/mikro'

properties: {
  dimensions: p.type(
    defineJsonType({
      schema: z.object({
        width: z.number().positive(),
        height: z.number().positive()
      })
    })
  )
}
```

A schema that throws responds with 400 at the property, with the `keyword`
`custom` and the message `Invalid input`, so that internal messages don't reach
clients.

## Stricter input

A `body` schema on an action checks the body before the entity's checks run,
with the messages of the schema at each field. Use it for limits that clients
should see at their fields, such as the length of a name, and for writes of the
website, where the schema is also the allowlist. It also works on the default
handlers:

```js
'post': {
  body: z.strictObject({
    name: z.string().min(1).max(100),
    weight: z.int().min(100).max(900),
    sets: z.array(z.object({ name: z.string().max(50) })).optional()
  })
}
```

## Rules in code

Write rules that span rows, or that read the database, as functions that return
issues. A mixin's middleware runs them inside the transaction, see
[Rules on rows and graphs](writes.md#rules-on-rows-and-graphs). Handlers throw
the same errors with `createValidationError()`:

```js
import { createValidationError } from '@ditojs/server'

if (!isValidIsbn(body.isbn)) {
  throw createValidationError([
    { path: ['isbn'], code: 'invalid_format', message: 'Invalid ISBN' }
  ])
}
```

## Errors

Validation errors respond with 400 and the errors of each field at the path of
its value, see
[Validation errors](../../api/server/errors.md#validation-errors). The admin
shows the errors at its fields, and opens the nested forms that they belong to.
