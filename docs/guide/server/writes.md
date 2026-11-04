# Writes

A write of a model controller takes these steps:

1. the action's `body` schema, if it has one, on the request's body;
2. the `deserialize` chain, which decides what this user may write;
3. the checks of the body, from the entity's metadata;
4. the checks of the ids that the body names, and the links of `#id` and `#ref`;
5. `em.create()` or `em.assign()`;
6. the handler's own code and the middleware, such as rules on the whole graph;
7. one flush, and the database's constraints;
8. one query that loads the written records again, with the values that formulas
   and triggers set.

All steps run in the request's transaction, so an error in any step rolls the
write back.

## PATCH

`patch :id` changes the fields that the body sends and leaves the others as they
are.

- An array of owned rows is the full set. Rows missing from the array are
  deleted.
- Relations to other rows link by id.

`null` sets a column to null, and nested objects are rows, not partial updates.

A client can send back what it loaded, as `get :id` and `patch :id` use the same
shape. The checks of the body drop fields such as `id` or `createdAt`.

## The checks of a body

The checks read the entity's MikroORM metadata, so each column is declared once.
They keep what a client may write, and check what Postgres can't check well:

- They drop properties that clients can't write: the primary key, hidden
  properties, formulas, versions, generated columns, `persist(false)`
  properties, blobs, columns with `onUpdate`, and scalars and relations with
  `onCreate`, such as `createdAt`. JSON and array columns with `onCreate` stay
  writable, because `onCreate(() => [])` is their default.
- They check required columns on create, `null` in columns that aren't nullable,
  and the JSON types of scalars, integers, dates and enums. `em.create()` would
  turn a string such as `"false"` into `true` for a boolean, and `em.assign()`
  throws at the first wrong value, without its path in the body.
- They run the schemas of custom types, see [Rules on values](#rules-on-values).
- They collect every error, each at its path in the body, such as
  `sections/2/title`, with the `keyword` `invalid_type` or `invalid_value`, and
  respond with 400, see
  [Validation errors](../../api/server/errors.md#validation-errors).

Postgres checks lengths, ranges and formats when the base flushes, see
[Database errors](../../api/server/mikro.md#database-errors). These errors name
the field where Postgres names the column. A value that is too long or out of
range responds with 400 without a field. For limits that clients see at their
fields, give the action a `body` schema, see
[Stricter input](validation.md#stricter-input).

### Rules on values

Put the rules of a value on its column's custom type, as a
[Zod schema](validation.md). `schemaJson()` declares a JSON column with a
schema:

```js
import { z } from 'zod'
import { schemaJson } from '@ditojs/mikro'

properties: {
  specs: schemaJson(
    z.object({ weight: z.number().positive(), unit: z.enum(['g', 'kg']) })
  ).nullable(),
  articles: schemaJson(z.array(articleSchema)).onCreate(() => [])
}
```

Any custom type can carry a schema in a `schema` getter. For example, an email
column:

```js
import { StringType } from '@mikro-orm/core'

const emailSchema = z.email()

export class EmailType extends StringType {
  get schema() {
    return emailSchema
  }
}

// In the entity's properties:
email: p.string().type(new EmailType())
```

It is a getter because MikroORM deep-copies custom types with the metadata. The
checks run the schema at the property's path, wherever the property appears in a
body. The schema only validates. The value is written as sent, without the
schema's transforms and defaults.

### Rules on rows and graphs

Write rules that span several fields or rows as plain functions next to the
entity. They return issues:

```js
export function checkShares(book) {
  const total = book.shares.reduce((sum, { percent }) => sum + percent, 0)
  return total === 100
    ? []
    : [{ path: ['shares'], code: 'custom', message: 'must add up to 100' }]
}
```

A mixin's middleware runs them inside the transaction, after the data is
assigned, and throws `createValidationError(issues)`, see the
[`validated` mixin](controllers.md#middleware). Scripts call the same functions.
Rules that depend on the user stay in `deserialize` and `authorize`.

### Writes of the website

The admin's writes rely on the entity, the checks of the body and the database.
Writes of the website and of members also get a strict `body` schema on their
action, also on default handlers. The schema is the allowlist, reports every
error and sets size limits:

```js
'patch :id': {
  authorize: c => isOwnAccount(c),
  body: z.strictObject({
    name: z.string().max(100),
    acceptsNewsletter: z.boolean()
  })
}
```

## Relations

A relation to one row takes `{ id }`, the target's id, or `null` if the relation
is nullable. Responses send it as `{ id }` or as a nested row. A write reads
only its id, so a client can send back what it loaded:

```json
{ "title": "Emma", "author": { "id": 12 } }
{ "title": "Emma", "author": 12 }
```

Each id must name a row that MikroORM's default filters let through. Missing or
soft-deleted rows respond with 400 and `invalid_value` at the field, such as
`tags/1`. The check runs one query per target entity. It doesn't apply the
`find` of another controller, so a client can link a row that it can't list. A
controller that needs more checks does them in `deserialize`. On a PATCH, ids
that the record already links pass.

### Many-to-many relations

A many-to-many relation takes an array of ids, on either side. MikroORM writes
only the pairs that change. Kept pairs keep their pivot rows, and dropped pairs
lose them.

```json
{ "tags": [3, 7, { "id": 9 }] }
```

A pivot entity can have columns of its own, such as the price of a book in an
loan. Use MikroORM's many-to-many relation on a pivot entity whose primary key
is its two foreign keys:

```js
const LoanBookSchema = defineEntity({
  name: 'LoanBook',
  properties: {
    order: () => p.manyToOne(Order).primary().deleteRule('cascade'),
    book: () => p.manyToOne(Book).primary().deleteRule('cascade'),
    dueDate: p.date().nullable()
  }
})

// In Loan, the owning side:
books: () => p.manyToMany(Book).pivotEntity(() => LoanBook),

// In Book, the inverse side, and the pivot rows for their columns:
loans: () => p.manyToMany(Loan).mappedBy(loan => loan.books),
loanLinks: () => p.oneToMany(LoanBook).mappedBy(link => link.book)
```

The body writes the relation as ids. The handler sets the other columns after a
first flush, in the same transaction, and the base flushes them at the end:

```js
await assignRecord(em, order, data)
await em.flush()
const books = loan.books.getItems()
await em.populate(books, ['loanLinks'], { refresh: true })
for (const book of books) {
  for (const link of book.loanLinks) {
    link.price = getPrice(book, link.order)
  }
}
```

A pivot entity with a primary key of its own doesn't work. MikroORM orders the
relation by that key, and writes kept pairs again without their columns.

## Nested rows

A one-to-many relation with `orphanRemoval` owns its rows, and so does the
inverse side of a one-to-one relation with `orphanRemoval`. A body writes these
rows nested:

```json
{
  "title": "Emma",
  "sections": [
    { "id": 4, "title": "Intro" },
    { "title": "New section" }
  ]
}
```

- A row with an id updates that row, and a row without an id is new. An id that
  belongs to another record responds with 400.
- On a PATCH, the array is the full set. Owned rows missing from it are deleted.
- The nested rows of a new row are new too, so they can't carry an id.
- `null` removes the owned row of a one-to-one relation.
- One-to-many relations without `orphanRemoval` aren't written. Their rows are
  written through their own controller.

### New rows and references

A body can link rows that don't exist yet. A new row carries `#id`, a key that
the client chooses. Other places in the body link to it with `{ '#ref': key }`:

```json
{
  "chapters": [{ "#id": "c1", "title": "Intro" }],
  "featuredChapter": { "#ref": "c1" }
}
```

- A ref can stand for a relation to one row, or for an item of a to-many
  relation of any kind. It may point to a row before or after it in the body.
- Only new nested rows carry `#id`. A link to a row that the database already
  holds is its id.
- An unknown key, a duplicate `#id`, `#id` on a row with an id, or a ref to a
  row of another entity responds with 400, before anything is created.
- Markers inside JSON columns are part of the JSON value.
- The database assigns the ids. Clients don't generate them.

The write first creates the new rows that carry `#id` or hold refs, and puts
each one in its place in the body. Then it creates or assigns the record, and
sets the refs.

## Deletes

`delete :id` deletes the record and the rows it owns. The rows that refer to it
follow the delete rules of their foreign keys. A foreign key without a rule
refuses the delete, which responds with 409.

MikroORM's default rule for a nullable relation is `set null`. If a nullable
relation must refuse the delete, give it `.deleteRule('no action')` or
`.deleteRule('restrict')`:

```js
member: () => p.manyToOne(Member).nullable().deleteRule('no action')
```

A tree of rows of one entity, such as child pages with `orphanRemoval`, needs
`.deleteRule('cascade')` on its foreign key.

Custom handlers delete with `em.remove(record)` and a flush. The rows that the
record owns go with it, and the rows that refer to it follow their delete rules,
see [`mikroOptions()`](../../api/server/mikro.md#mikrooptions).

## Writes in custom handlers

Custom handlers write a body the same way as `post` and `patch :id`, with
`createRecord()` and `assignRecord()`. These functions run the checks of the
body and the ids, and handle `#id` and `#ref`. They don't flush, so the handler
can work on the entities first:

```js
import { assignRecord, createRecord } from '@ditojs/mikro'

'put reservation': action({
  body: reservationSchema,
  async handler({ db: em, body, session }) {
    const current = await findReservation(em, session)
    const loan = current
      ? await assignRecord(em, current, body)
      : await createRecord(em, Loan, body)
    await setDueDate(em, loan)
    return loan
  }
})
```

The `deserialize` chain runs in the default `post` and `patch :id` only. A
custom handler decides what the body may write, such as with its `body` schema.
The base flushes once after the handler, and loads the records of the result
again.

A handler that needs the values that the flush sets, such as the new id, flushes
itself with `await db.flush()`.
