# Validation

The admin validates in two places: in the browser, with the rules of the
fields, and on the server, with the schemas of the models. Errors of both are
shown on the fields they belong to.

## Rules of fields

`required` and the rules of the field types validate in the browser:

```js
components: {
  title: { type: 'text', required: true },
  email: { type: 'email' },            // Validates the format
  pages: { type: 'integer', min: 1 },  // Validates whole numbers of 1 or more
  price: { type: 'number', range: [0, 1000], decimals: 2 },
  website: { type: 'url', rules: { url: false } } // Turns the rule off
}
```

The rules are `required`, `email`, `url`, `hostname`, `domain`, `creditcard`,
`min`, `max`, `range`, `decimals` and `integer`. The text types `email`,
`url`, `hostname`, `domain` and `creditcard` validate their format by their
name, and number types the limits they're given. `password` fields don't
validate a format, and `required` accepts them unchanged, so a saved password
needn't be entered again. `rules` adds
or changes rules, e.g. `rules: { max: 100 }`, and turns them off when set to
`false` or `undefined`. Rules other than `required` only apply to values that
aren't empty.

`required` takes a callback:

```js
isbn: {
  type: 'text',
  required: ({ item }) => item.format !== 'ebook'
}
```

## Custom validation

`validate()` validates the value with a callback, together with the other
rules. It receives the context, with the value after `formatValue()`, and
returns `false` to fail with "is invalid", or a message to fail with:

```js
isbn: {
  type: 'text',
  label: 'ISBN',
  validate: ({ value }) =>
    /^97[89]\d{10}$/.test(value.replaceAll('-', '')) ||
    'must be an ISBN with 13 digits'
}
```

The error reads "The ISBN field must be an ISBN with 13 digits." `true` and
`undefined` pass. Like the rules, `validate()` only applies to values that
aren't empty, and runs synchronously: validate values that need requests on
the server.

## When validation runs

- A field validates its value when it loses focus.
- Saving validates all data of the form, also of fields in tabs that were
  never opened and of collapsed sections. It shows all errors and reveals the
  first one, opening tabs, sections and nested forms on the way, and focuses
  its field.
- Any change of a value clears its errors, also writes through code.
- A successful save clears all errors of the form.

Fields hidden with `if` aren't validated.

## Validation on the server

The models validate all data they receive. When a save fails with validation
errors, the admin shows the server's errors on the fields at their data
paths:

```js
// src/server/models/Book.js
import { Model } from '@ditojs/server'

export class Book extends Model {
  static properties = {
    title: { type: 'string', required: true },
    isbn: { type: 'string', pattern: '^\\d{13}$' }
  }
}
```

Errors of values that no field displays, e.g. inside an object edited as
code, are shown on the closest field above them, with their path. Errors that
no field takes are listed in a notification. See
[Validation](../server/validation.md) in the server guide.

## Validating from code

`context.validate(match)` validates and shows the errors, `isValid(match)`
only checks, and `clearErrors(match)` clears errors. All three act on the data
of the form, view, dialog or panel, and take an optional `match`:

```js
checkChapters: {
  type: 'button',
  text: 'Check Chapters',
  onClick({ validate, notify }) {
    if (validate('chapters/**')) {
      notify({ type: 'success', text: 'All chapters are complete.' })
    }
  }
}
```

`match` takes a [data path](./context.md#data-paths), relative to the item of
the context and with `*` and `**` wildcards, an array of such paths, or a
regular expression or a function, which receive the absolute data paths,
without a leading `/`. `clearErrors('chapters')` clears the errors of
`chapters` and of everything inside it. Without `match`, all three act on all
data.

## Reference

- [`validate()`](../../api/admin/context.md#validate),
  [`isValid()`](../../api/admin/context.md#isvalid) and
  [`clearErrors()`](../../api/admin/context.md#clearerrors).
- The rules of each type in [Fields](../../api/admin/schemas.md#fields).
