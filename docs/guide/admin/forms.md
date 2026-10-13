# Forms

A form edits one item: a book of the books list, the shipping address of a
customer, a chapter of a book. Lists and objects name their form in `form`, or
`forms` for items of several kinds, see [Lists and objects](./lists.md). A
form's `creatable` and `disabled` decide whether the source's create button
offers it, see [Several kinds of items](./lists.md#several-kinds-of-items).

```js
// src/admin/forms/book.js
export const bookForm = {
  type: 'form',
  label: 'Book',
  components: {
    title: { type: 'text', required: true },
    isbn: { type: 'text' },
    publishedAt: { type: 'date' },
    summary: { type: 'textarea' }
  }
}
```

A module that exports one form, like this one, can be passed as
`form: () => import('../forms/book.js')`. The export's name, `bookForm`,
becomes the form's `name`.

## Kinds of forms

How a form loads and saves depends on where its items live:

- **Forms with a resource** edit items of a list or object with its own
  `resource`. They load their item, e.g. `GET books/1`, save it with `PATCH`,
  and create new items with `POST`. They open on a page of their own, e.g.
  `/admin/books/1`.
- **[Nested forms](./nested-forms.md)** edit items that are part of the data
  of their parent form, e.g. the chapters of a book, on a page of their own.
- **Inlined forms** edit the items of `inlined` lists and objects in place,
  inside the parent form, see [Lists and objects](./lists.md#items-in-the-data).
- **Embedded forms** edit the items of trees, next to the tree, see
  [Trees](./lists.md#trees).

## Buttons

Forms have two default buttons: `cancel` closes the form, and `submit` saves
or applies the data and closes the form. The forms of lists with
`mutate: true`, which edit the parent's data directly, have no submit button.

`buttons` is merged into these: change a default button, remove it with
`false`, or add your own:

```js
buttons: {
  submit: { text: 'Publish' },
  preview: {
    type: 'button',
    text: 'Preview',
    onClick: ({ item }) => window.open(`/books/${item.id}`)
  }
}
```

An `onClick()` on a default button replaces its default action. To keep it,
call it from your handler:

```js
buttons: {
  submit: {
    async onClick({ item, submit }) {
      if (item.isbn || window.confirm('Save the book without an ISBN?')) {
        await submit({ closeForm: true })
      }
    }
  }
}
```

See [Buttons](./buttons.md) for buttons that submit to other resources.

## Form events

```js
export const bookForm = {
  type: 'form',
  components: { … },

  onLoad({ itemLabelText }) {
    console.log(`Editing ${itemLabelText}`)
  },

  onSuccess({ isCreating, itemLabel, notify }) {
    // Replaces dito's own notification:
    notify({
      type: 'success',
      html: `${itemLabel} was ${isCreating ? 'added to the shop' : 'saved'}.`
    })
  },

  onError({ error }) {
    console.error(error)
  },

  onCancel() {
    console.log('Closed without saving')
  }
}
```

- `onLoad()` fires after the item was loaded, not when a new one is created.
- `onSuccess()` fires after saving, for new and existing items:
  `context.isCreating` tells them apart.
- `onError()` fires when saving fails, with `context.error`. Validation errors
  of the server are shown on the fields instead.
- A value returned from `onSuccess()` or `onError()`, or a call of
  `context.notify()` in them, replaces dito's notification.
- `onApply()` fires instead of `onSuccess()` in nested forms, see
  [Nested forms](./nested-forms.md#events).
- `onCancel()` fires when the cancel button closed the form.

The label of the item is available in all of them, as `itemLabel` (HTML) and
`itemLabelText`. See [Events](./events.md) for all events.

## Acting on the form from code

The [context](./context.md#the-forms-actions) offers the form's actions to all
callbacks inside it, e.g. `isCreating`, `isDirty`, `submit()`, `closeForm()`
and `validate()`. `closeForm()` resolves to `false` if the user chose to stay
with unsaved changes.

`resetItem(data)` resets the data as if `data` was loaded, e.g. a server
response:

```js
restore: {
  type: 'button',
  text: 'Restore Last Version',
  async onClick({ request, resetItem }) {
    resetItem(await request({ method: 'post', resource: { path: 'restore' } }))
  }
}
```

It deserializes `data`, gives it its defaults and computed values and leaves
the form clean, like a load. Values that `data` lacks are reset too, except
the item's id, type and position. Without `data`, it resets to the defaults.

## Components that depend on the data

`components` can be a callback that creates them from the context. It runs
again when the data it reads changes:

```js
components: ({ item }) => ({
  title: { type: 'text' },
  ...(item.format === 'ebook'
    ? { fileSize: { type: 'number', suffix: 'MB' } }
    : { pages: { type: 'integer' } })
})
```

For a few fields, `if` on the fields is simpler:
`pages: { type: 'integer', if: ({ item }) => item.format !== 'ebook' }`.

## Clipboard

`clipboard: true` on a form, view or section adds Copy and Paste buttons to
its header. Users copy the data of one item and paste it into another, e.g. to
start a new edition of a book from an existing one:

```js
export const bookForm = {
  type: 'form',
  clipboard: true,
  components: {
    title: { type: 'text' },
    summary: { type: 'textarea' },
    chapters: {
      type: 'list',
      components: { title: { type: 'text' } }
    }
  }
}
```

**Copy** serializes the data, as it would be sent to the server, and writes it
as JSON to the system clipboard, marked with the name of the schema. Data is
only pasted into schemas of the same name: a copied book only into book forms.
The copy leaves out the item's id and the ids of the items in its lists. Items
that relations in the copy point to get new temporary ids instead, one for
each id in each list, so that these relations keep pointing to the same items.

**Paste** writes the copied values into the item, as edits:

- The item keeps its own id and its position in its list.
- Only keys that the item already has are written.
- Lists are replaced as a whole by the copied ones, whose items are new items
  with new temporary ids.
- Lists with their own `resource` are left out, as they save their items
  themselves.
- `deserializeValue()` converts the pasted values like loaded ones, e.g. date
  strings to dates.

The form is dirty after pasting, and saving it stores the pasted data.

`clipboard` takes `copy()` and `paste()` callbacks instead of `true`. Each
receives the [context](./context.md) with the data as `clipboardItem`, and
returns the data to copy or paste. Both run synchronously, and returning
nothing from `paste()` pastes nothing:

```js
clipboard: {
  // Copy only the content, without sales data:
  copy: ({ clipboardItem }) => ({
    title: clipboardItem.title,
    summary: clipboardItem.summary,
    chapters: clipboardItem.chapters
  }),
  // Mark pasted books as copies:
  paste: ({ clipboardItem }) => ({
    ...clipboardItem,
    title: `${clipboardItem.title} (Copy)`
  })
}
```

## Reference

- [`form`](../../api/admin/schemas.md#form) options and
  [kinds of forms](../../api/admin/schemas.md#kinds-of-forms).
- [Form events](../../api/admin/events.md#form-events).
- [Clipboard](../../api/admin/schemas.md#clipboard).
