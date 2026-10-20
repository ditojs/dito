# Fields

Fields edit the values of an item. Each field's key in `fields` is the key
of its value: `title: { type: 'text' }` edits `item.title`.

The admin has field types for text, numbers, booleans, dates, choices, rich
content (`markup`, `code`, `color`, `upload`) and derived values, see
[Component types](../../api/admin/schemas.md#component-types). For your own,
see [Custom types](./custom-types.md).

## Common options

```js
price: {
  type: 'number',
  label: 'Price (EUR)',
  decimals: 2,
  min: 0,
  required: true,
  width: '1/3',
  default: 0,
  readonly: ({ item }) => item.isArchived,
  info: 'Including VAT'
}
```

- `label` defaults to the labelized key, e.g. "Published At" for
  `publishedAt`. `false` hides it.
- `default` is the value of new items, and of items that lack the key.
- `if` renders the field only when it returns `true`. `visible: false` only
  hides it: its value is still computed and validated.
- `readonly` and `disabled` prevent edits.
- `required` and `rules` validate the value, see [Validation](./validation.md).
- `exclude: true` leaves the value out of the data sent to the server, and its
  changes don't make the form dirty.
- `width` and `break` place the field, see [Layout](./layout.md).

See [`FieldSchemaBase`](../../api/admin/schemas.md#fieldschemabase) for
all common options.

## Choices

`select`, `multiselect`, `radio` and `checkboxes` choose from `options`: an
array, or an object that says where the options come from.

```js
format: {
  type: 'radio',
  layout: 'horizontal',
  options: [
    { label: 'Hardcover', value: 'hardcover' },
    { label: 'Paperback', value: 'paperback' },
    { label: 'E-book', value: 'ebook' }
  ]
}
```

Values that are missing from the options, e.g. after an option was removed,
are kept and shown as unavailable.

`checkboxes`, and multiselects with `multiple: true`, hold an array. It's never
`null`: a stored `null` loads as the `default`, or `[]`, and the clear button
empties it. To store empty choices as `null`, convert them when saving:

```js
genres: {
  type: 'checkboxes',
  options: ['fiction', 'poetry', 'drama'],
  serializeValue: ({ value }) => (value.length > 0 ? value : null)
}
```

## Relations

`relate` selects related objects, with options loaded from the API: while
editing, the value is the whole option, e.g. the author, and only `{ id }` is
sent when saving, which the server relates. `relate: 'code'` relates by
another key than `id`.

Options only need the keys they show and relate by, so load them through a
narrow scope of the model, instead of the full items:

```js
// src/server/models/Author.js
static scopes = {
  options: query => query.select('id', 'name').orderBy('name')
}
```

```js
author: {
  type: 'select',
  relate: true,
  options: {
    data: ({ request }) =>
      request({
        url: 'authors',
        query: { scope: 'options' },
        cache: 'global'
      }),
    label: 'name'
  }
},

genres: {
  type: 'multiselect',
  multiple: true,
  searchable: true,
  relate: true,
  options: {
    data: ({ request }) =>
      request({ url: 'genres', query: { scope: 'options' }, cache: 'global' }),
    label: 'name'
  }
}
```

The controller has to allow the scope, if it restricts them with `allowScope`,
see [Controllers](../server/controllers.md) and
[Queries](../server/queries.md). `url` is resolved against the API's URL,
unlike `resource`, which resolves relative to the nearest form or list, see
[Buttons](./buttons.md#click-handlers). `cache: 'global'` keeps the response
for the session, `cache: 'local'` while the form is shown.

Options can also come from the data being edited, with `options.dataPath`:

```js
featuredChapterId: {
  type: 'select',
  // The chapters edited in the `chapters` list of the same book:
  options: { dataPath: 'chapters', label: 'title', value: 'id' }
}
```

## Value hooks

Hooks convert a field's value on its way between the server, the data and the
input: `deserializeValue()` converts what is loaded into the data, and
`serializeValue()` what is saved or copied from it. `formatValue()` converts
the value for the input, and `parseValue()` what the user enters back.
`computeValue()` derives the value from other data. Each receives the
[context](./context.md), with the value as `value`:

```js
isbn: {
  type: 'text',
  // Show and enter ISBNs with hyphens, but store the digits only:
  formatValue: ({ value }) => value?.replace(/^(\d{3})(\d)/, '$1-$2'),
  parseValue: ({ value }) => value?.replace(/-/g, '')
},

sortTitle: {
  type: 'text',
  readonly: true,
  // Follows the title, without a leading article:
  computeValue: ({ item }) => item.title?.replace(/^(The|An?) /, '')
}
```

`computeValue()` writes its result into the data, also while the field isn't
rendered, e.g. in a tab that wasn't opened, but not while its `if` returns
`false`. Returning `undefined` keeps the current value. It receives the stored
value as it is, also a stored `null` of a list or of multiple choices, which
only fields without `computeValue()` load as their default. See
[`FieldSchemaBase`](../../api/admin/schemas.md#fieldschemabase) for
when each hook runs.

### Values that aren't stored as they are

When `serializeValue()` returns `undefined`, the key is left out of the data
sent to the server. Virtual fields use this: they write the values to store
into `context.serializedItem` and return nothing. In the customer form:

```js
name: {
  type: 'text',
  // The stored data has no `name`, so build it from what it has:
  default: ({ item }) => [item.firstName, item.lastName].join(' ').trim(),
  serializeValue({ value, serializedItem }) {
    const [firstName, ...rest] = value?.split(' ') ?? []
    Object.assign(serializedItem, { firstName, lastName: rest.join(' ') })
  }
}
```

Don't use `exclude: true` for such fields: excluded values don't make the form
dirty, so their edits could be lost without a warning.

## Dates

Date fields hold `Date` objects: loaded date strings are converted when the
data loads, and converted back when it's saved. Code may write strings into
date fields too, e.g. `item.publishedAt = '2026-10-01'`: they are shown as
dates and saved as they are. `format` sets how dates are shown:

```js
publishedAt: {
  type: 'date',
  format: { date: { day: 'numeric', month: 'long', year: 'numeric' } }
}
```

## Uploads

`upload` fields upload files to the server's upload route for their data path
and hold the file objects that the server returns:

```js
cover: {
  type: 'upload',
  accept: 'image/*',
  maxSize: '5MB',
  thumbnails: true,
  deletable: true
}
```

On the server, the model's `assets` and the controller's `assets` name the
storage of the field, see [Storages](../server/storages.md). Saving waits for
running uploads.

## Derived values

The `value` type holds a value that is never edited: a read-only field,
invisible unless `visible: true`, whose value comes from `computeValue()`,
`data` or `dataPath`. Its value is part of the data and sent to the server
unless `exclude: true`:

```js
wordCount: {
  type: 'value',
  visible: true,
  exclude: true,
  computeValue: ({ item }) => item.summary?.split(/\s+/).length ?? 0
},

authorName: {
  type: 'value',
  // Relative to the item the field sits in:
  dataPath: 'author/name',
  exclude: true
}
```

## Reference

- [Fields](../../api/admin/schemas.md#fields) and
  [Options](../../api/admin/schemas.md#options): every type's options.
- [Schema values](../../api/admin/schemas.md#schema-values): which options take
  callbacks.
