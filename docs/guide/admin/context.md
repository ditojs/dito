# The Context

Every callback of a schema receives one argument, the context: option
callbacks like `if` and `label`, value hooks like `computeValue()`, and event
handlers like `onClick()`. It holds the data around the component, the actions
of its form and the services of the admin:

```js
components: {
  title: { type: 'text' },
  subtitle: {
    type: 'text',
    if: ({ item }) => !!item.title
  },
  checkIsbn: {
    type: 'button',
    async onClick({ item, request, notify }) {
      const { isValid } = await request({
        resource: '/isbn-check',
        query: { isbn: item.isbn }
      })
      notify({ text: isValid ? 'The ISBN is valid.' : 'Unknown ISBN.' })
    }
  }
}
```

Destructure the members you need. Callbacks only depend on the members they
read, and run again when these change.

## The data

- `value` is the value of the component, stored under `name` in `item`.
- `item` is the item that holds the value: the data of the form, or of the
  closest list entry or object.
- `parentItem` is the closest item above `item`, e.g. the book of a chapter,
  or `null`.
- `rootItem` is the data of the form or view at the top.
- [`getValueAt()`](../../api/admin/context.md#getvalueat) reads other values
  by their [data path](#data-paths), e.g. of items above `parentItem`.
- `serializedItem` and `serializedRootItem` are the same data, serialized as
  it would be sent to the server.

In a chapter of a book, edited in an inlined list `chapters`:

```js
chapters: {
  type: 'list',
  inlined: true,
  components: {
    title: {
      type: 'text',
      // `item` is the chapter, `parentItem` the book:
      placeholder: ({ itemIndex, parentItem }) =>
        `${parentItem.title}, chapter ${itemIndex + 1}`
    }
  }
}
```

Writes through `item`, `parentItem` and `rootItem` are edits, like the user's:
they make the form dirty, clear the errors of the value and update what
depends on it, see [Dirty state](./dirty-state.md). `value` itself is
read-only; write `item[name]` instead, or edit the objects inside `value`.

```js
onChange({ item }) {
  // Keep the stock at zero for books that aren't available:
  if (!item.isAvailable && item.stock > 0) {
    item.stock = 0
  }
}
```

## Data paths

Each value has a data path: its keys from the root data, joined by `/`, e.g.
`chapters/0/title`. The context hands them out without a leading `/`:
`dataPath` is the path of the value, e.g. `'chapters/0/title'`,
`itemDataPath` the path of `item`, e.g. `'chapters/0'`, and
`parentItemDataPath` the path of `parentItem`, e.g. `''`, or `null`.
`valueIndex`, `itemIndex` and `parentItemIndex` are the indices of the value
and the items in their lists.

Paths that you pass to dito, e.g. to `validate()` or in `options.dataPath`,
are relative to the context's item, `itemDataPath`. A leading `/` makes them
absolute, and `..` goes up one level:

```js
// In a field of a chapter, at 'chapters/0/…':
validate('title')        // 'chapters/0/title'
validate('notes/*/text') // the texts of all notes of the chapter
validate('/title')       // 'title', the book's title
validate('../1/title')   // 'chapters/1/title', the next chapter's title
```

Paths that lead above the root throw.

In paths that match, `*` matches one level and `**` zero or more levels:
`'chapters/**/text'` matches `chapters/text` and `chapters/0/notes/1/text`. At
the end, `**` matches everything inside: `'chapters/**'` matches the values
inside `chapters`, but not `chapters` itself.

## Which item a context describes

A context describes one value: `value`, stored under `name` in `item`. Where
dito hands a callback an item, it also hands over the item's path,
`itemDataPath`, and `itemIndex` and `parentItem` follow from that path.

In a book with an inlined list `chapters` and a section `metadata` with
`nested: true`:

| Callback | `item` | `itemDataPath` | `parentItem` |
| -------- | ------ | -------------- | ------------ |
| A field of the book | the book | `''` | `null` |
| A field of a chapter | the chapter | `'chapters/1'` | the book |
| An event of a chapter's form, e.g. `onInitialize()` | the chapter | `'chapters/1'` | the book |
| A field of `metadata` | the metadata | `'metadata'` | the book |
| An event of `metadata`, e.g. `onInitialize()` | the metadata | `'metadata'` | the book |
| The `buttons` of the list `chapters` | the book | `''` | `null` |

- The own events of forms and sections describe their item, not a value:
  `value` is `undefined`. Read `item`. Events that
  bubble up from a field keep the field's context, see
  [Events](./events.md#bubbling).
- The buttons of a list describe the item that holds the list, or the list's
  array itself in single-component views, so relative paths in their
  `validate()` resolve against it.
- In a [nested form](./nested-forms.md), `item` is the draft, and `rootItem`
  the parent's data with the draft in place of the item.
- In the callbacks of the files of an `upload`, `value` is the file, `item`
  the array of files, `itemDataPath` the path of the upload, and `itemIndex`
  `null`.

The API lists all places, see
[Which item a context describes](../../api/admin/context.md#which-item-a-context-describes).

## The label of the item

Inside a form, every context has `itemLabel`, the text of the label of the
form's item. It's computed when read, from the `itemLabel` of the list or object
that holds the item:

```js
deleteButton: {
  type: 'button',
  text: ({ itemLabel }) => `Delete ${itemLabel}`,
  …
}
```

Inside the `itemLabel()` callback itself, it's `null`.

## The form's actions

`isDirty`, `isCreating`, `validate()`, `isValid()`, `clearErrors()`,
`markDirty()`, `resetItem()` and `submit()` act on the data of the closest
form, view, dialog or panel with its own data. `closeForm()` closes the form
and `closeDialog()` the dialog, `reload()` reloads the closest list or object,
and `selectedTab` names the selected tab of the form. Where they don't apply,
the methods throw, e.g. `closeForm()` outside of forms, `isDirty` and
`isCreating` are `false`, and `selectedTab` is `null`, also in forms without
tabs. They're described in
[Forms](./forms.md#acting-on-the-form-from-code),
[Validation](./validation.md), [Dirty state](./dirty-state.md),
[Buttons](./buttons.md) and [Dialogs](./dialogs.md).

## Services

The context also holds the admin's services: `user`, `api` and `views`,
`request()` for API requests, `format()` for numbers and dates in the admin's
locale, `notify()`, `showDialog()`, `navigate()`, `getRouteUrl()`,
`download()`, `getResourceUrl()`, and `routeQuery` and `sourceQuery`, the
query of the URL and of the nearest list. Code outside of callbacks reaches
the same services through `admin.context`, the
[AdminContext](../../api/admin/admin.md#admincontext).

## Calling callbacks with other values

`context.extend(values)` returns a context with members added or overridden,
e.g. to run another callback of a schema for another value:

```js
// The `info` of each order line's price, and the order's total:
const getLineTotal = ({ item }) => item.quantity * item.price

components: {
  lines: {
    type: 'list',
    inlined: true,
    components: {
      quantity: { type: 'integer', width: '1/2' },
      price: {
        type: 'number',
        width: '1/2',
        info: context => `Total ${getLineTotal(context).toFixed(2)}`
      }
    }
  },
  total: {
    type: 'label',
    label: context => {
      const total = context.item.lines.reduce(
        (sum, line) => sum + getLineTotal(context.extend({ item: line })),
        0
      )
      return `Total ${total.toFixed(2)}`
    }
  }
}
```

The extended context keeps all other members of the original one.

## Event values

Some events add values to the context, e.g. `error` in `onError()`,
`collapsed` in `onToggle()` of sections, and `currentDataPath` in handlers of
bubbled events. See [Events](./events.md).

## Reference

- [SchemaContext](../../api/admin/context.md): every member with its
  signature.
