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

All steps run in the request's transaction. So an error in any step rolls the
write back.

## PATCH

`patch :id` changes the fields that the body sends, and leaves the others as
they are.

- An array of owned rows is the full set. Rows missing from the array are
  deleted.
- Relations to other rows link by id.
- `null` sets a column to null.
- Nested objects are rows, not partial updates.

`get :id` and `patch :id` use the same shape. So a client can send back what it
loaded. The checks of the body drop fields such as `id` or `createdAt`.

## The checks of a body

The checks read the entity's MikroORM metadata, so each column is declared once.
They keep what a client may write. They check what Postgres can't check well:

- They drop properties that clients can't write. These are the primary key,
  hidden properties, formulas, versions, generated columns, `persist(false)`
  properties, blobs, and columns with `onUpdate`. They also drop scalars and
  relations with `onCreate`, such as `createdAt`.
- JSON and array columns with `onCreate` stay writable, because
  `onCreate(() => [])` is their default.
- They check required columns on create, and `null` in columns that aren't
  nullable.
- They check the JSON types of scalars, integers, dates and enums, and of the
  items of array columns. Without this, `em.create()` would turn a string such
  as `"false"` into `true` for a boolean. `em.assign()` would throw at the first
  wrong value, without its path in the body.
- Decimals in string mode take numbers and numeric strings.
- They check the `length` of strings, in characters.
- They check that decimals have no more integer digits than their `precision`
  and `scale` leave.
- They refuse empty strings in required columns, which aren't nullable and have
  no default. Dito.js 6 did this with `required`.
- They run the schemas of custom types, see [Rules on values](#rules-on-values).
- They collect every error, each at its path in the body, such as
  `sections/2/title`. The `keyword` is `invalid_type`, `invalid_value`,
  `too_big` or `too_small`.
- They respond with 400, see
  [Validation errors](../../api/server/errors.md#validation-errors).

Postgres checks the ranges of numbers and its constraints when the base
flushes, see [Database errors](../../api/server/mikro.md#database-errors). These
errors name the field where Postgres names the column. A number out of range
responds with 400 without a field. For limits that clients see at their fields,
give the action a `body` schema, see
[Stricter input](validation.md#stricter-input).

### Rules on values

```js
import { z } from 'zod'
import { defineJsonType } from '@ditojs/mikro'

properties: {
  specs: p
    .type(
      defineJsonType({
        schema: z.object({
          weight: z.number().positive(),
          unit: z.enum(['g', 'kg'])
        })
      })
    )
    .nullable(),
  articles: p
    .type(defineJsonType({ schema: z.array(articleSchema) }))
    .onCreate(() => [])
}
```

Put the rules of a value on its column's custom type, as a
[Zod schema](validation.md). `defineJsonType()` declares a JSON column with a
schema.

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

- It is a getter, because MikroORM deep-copies custom types with the metadata.
- The checks run the schema at the property's path, wherever the property
  appears in a body.
- The schema only validates. The value is written as sent, without the schema's
  transforms and defaults.

### Rules on rows and graphs

```js
export function checkShares(book) {
  const total = book.shares.reduce((sum, { percent }) => sum + percent, 0)
  return total === 100
    ? []
    : [{ path: ['shares'], code: 'custom', message: 'must add up to 100' }]
}
```

Write rules that span several fields or rows as plain functions next to the
entity. They return issues.

A mixin's middleware runs them inside the transaction, after the data is
assigned. It throws `createValidationError(issues)`, see the
[`validated` mixin](controllers.md#middleware). Scripts call the same
functions. Rules that depend on the user stay in `deserialize` and `authorize`.

### Writes of the website

```js
'patch :id': {
  authorize: ({ c, user }) => isOwnAccount(c, user),
  body: z.strictObject({
    name: z.string().max(100),
    acceptsNewsletter: z.boolean()
  })
}
```

The admin's writes rely on the entity, the checks of the body and the database.
Writes of the website and of members also get a strict `body` schema on their
action. This also applies to default handlers. The schema is the allowlist. It
reports every error, and it sets size limits.

## Relations

```json
{ "title": "Emma", "author": { "id": 12 } }
{ "title": "Emma", "author": 12 }
```

A relation to one row takes `{ id }`, the target's id, or `null` if the relation
is nullable. Responses send it as `{ id }` or as a nested row. A write reads
only its id, so a client can send back what it loaded.

- Each id must name a row that MikroORM's default filters let through.
- Missing or soft-deleted rows respond with 400 and `invalid_value` at the
  field, such as `tags/1`.
- The check runs one query per target entity.
- The check doesn't apply the `find` of another controller. So a client can link
  a row that it can't list. A controller that needs more checks does them in
  `deserialize`.
- On a PATCH, ids that the record already links pass.

### Many-to-many relations

```json
{ "tags": [3, 7, { "id": 9 }] }
```

A many-to-many relation takes an array of ids, on either side. MikroORM writes
only the pairs that change. Kept pairs keep their pivot rows, and dropped pairs
lose them.

A pivot entity can have columns of its own, such as the due date of a book in a
loan. Its primary key is its two foreign keys. The owning side writes the pivot
rows as owned rows, through a one-to-many relation with `orphanRemoval`:

```js
const LoanBookSchema = defineEntity({
  name: 'LoanBook',
  properties: {
    loan: () => p.manyToOne(Loan).primary().deleteRule('cascade'),
    book: () => p.manyToOne(Book).primary().deleteRule('cascade'),
    dueDate: p.date()
  }
})

// In Loan, the many-to-many relation and its pivot rows:
books: () => p.manyToMany(Book).pivotEntity(() => LoanBook),
bookLinks: () =>
  p.oneToMany(LoanBook).mappedBy(link => link.loan).orphanRemoval()
```

```json
{ "bookLinks": [{ "book": 12, "dueDate": "2026-12-01" }] }
```

The key of a pivot row is its relation that isn't the one back to the parent,
here `book`. It works like the id of other owned rows:

- Each pivot row requires its key, the id of a stored row. `#ref` isn't allowed
  there.
- On a PATCH, a pivot row whose key the record links updates that row. Other
  pivot rows are new, and need their required columns. They can't hold refs.
- The array is the full set. Pivot rows missing from it are deleted.
- Two pivot rows with the same key respond with 400 at the second one.
- A body that writes both `bookLinks` and `books` responds with 400 at `books`.
  Both write the same rows.

A pivot entity with a primary key of its own doesn't work. MikroORM orders the
relation by that key. It also writes kept pairs again without their columns.

## Nested rows

```json
{
  "title": "Emma",
  "sections": [
    { "id": 4, "title": "Intro" },
    { "title": "New section" }
  ]
}
```

A one-to-many relation with `orphanRemoval` owns its rows. So does the inverse
side of a one-to-one relation with `orphanRemoval`. A body writes these rows
nested:

- A row with an id updates that row. A row without an id is new.
- An id that belongs to another record responds with 400.
- On a PATCH, the array is the full set. Owned rows missing from it are deleted.
- Two rows with the same id respond with 400 at the second one.
- The nested rows of a new row are new too, so they can't carry an id.
- `null` removes the owned row of a one-to-one relation.
- One-to-many relations without `orphanRemoval` aren't written. Their rows are
  written through their own controller.

### New rows and references

```json
{
  "chapters": [{ "#id": "c1", "title": "Intro" }],
  "featuredChapter": { "#ref": "c1" }
}
```

A body can link rows that don't exist yet. A new row carries `#id`, a key that
the client chooses. Other places in the body link to it with `{ '#ref': key }`.

- A ref can stand for a relation to one row, or for an item of a to-many
  relation. Owned relations hold their rows themselves, and a ref as an owned
  row responds with 400 at its `#ref`.
- A ref may point to a row before or after it in the body.
- Only new nested rows carry `#id`. A link to a row that the database already
  holds is its id.
- These respond with 400, before anything is created: an unknown key, a
  duplicate `#id`, `#id` on a row with an id, and a ref to a row of another
  entity.
- Markers inside JSON columns are part of the JSON value.
- The database assigns the ids. Clients don't generate them.

The write first creates the new rows that carry `#id` or hold refs. It puts each
one in its place in the body. Then it creates or assigns the record, and sets
the refs.

## Deletes

```js
member: () => p.manyToOne(Member).nullable().deleteRule('no action')
```

`delete :id` deletes the record and the rows that it owns. The rows that refer
to it follow the delete rules of their foreign keys. A foreign key without a
rule refuses the delete, which responds with 409.

MikroORM's default rule for a nullable relation is `set null`. If a nullable
relation must refuse the delete, give it `.deleteRule('no action')` or
`.deleteRule('restrict')`, as above.

A tree of rows of one entity, such as child pages with `orphanRemoval`, needs
`.deleteRule('cascade')` on its foreign key.

Custom handlers delete with `em.remove(record)` and a flush. The rows that the
record owns go with it. The rows that refer to it follow their delete rules, see
[`defineMikroConfig()`](../../api/server/mikro.md#definemikroconfig).

## Writes in custom handlers

```js
import { assignRecord, createRecord } from '@ditojs/mikro'

'put reservation': defineAction({
  body: reservationSchema,
  async handler({ em, body, session }) {
    const current = await findReservation(em, session)
    const loan = current
      ? await assignRecord(em, current, body)
      : await createRecord(em, Loan, body)
    await setDueDate(em, loan)
    return loan
  }
})
```

Custom handlers write a body the same way as `post` and `patch :id`, with
`createRecord()` and `assignRecord()`.

- These functions run the checks of the body and of the ids.
- They handle `#id` and `#ref`.
- They don't flush, so the handler can work on the records first.

The `deserialize` chain runs in the default `post` and `patch :id` only. A
custom handler decides what the body may write, such as with its `body` schema.
The base flushes once after the handler, and loads the records of the result
again.

A handler that needs the values that the flush sets, such as the new id, flushes
itself with `await em.flush()`.
