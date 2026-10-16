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

  onLoad({ itemLabel }) {
    console.log(`Editing ${itemLabel}`)
  },

  onSuccess({ isCreating, itemLabel, notify }) {
    // Replaces dito's own notification:
    notify({
      type: 'success',
      text: `${itemLabel} was ${isCreating ? 'added to the shop' : 'saved'}.`
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

The text of the item's label is available in all of them, as `itemLabel`. See
[Events](./events.md) for all events.

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
Relations to records outside the copy, e.g. the author of a book, hold the
label that their field shows for the record instead of its id, as ids differ
between databases: `author: { $label: 'Jane Austen' }`, or an array of these
for multiple values. Options that aren't loaded yet are loaded first.

**Paste** writes the copied values into the item, as edits:

- The item keeps its own id and its position in its list.
- Only keys that the item already has are written.
- Lists are replaced as a whole by the copied ones, whose items are new items
  with new temporary ids.
- Lists with their own `resource` are left out, as they save their items
  themselves.
- `deserializeValue()` converts the pasted values like loaded ones, e.g. date
  strings to dates.
- Labels of related records are matched against the field's options, ignoring
  case and whitespace. A label that matches no option or several pastes
  `null`, or is left out of multiple values, and a notification lists these,
  e.g. "Not found when pasting: Author 'Jane Austen'".

The form is dirty after pasting, and saving it stores the pasted data.

`clipboard` takes `copy()` and `paste()` callbacks instead of `true`. Each
receives the [context](./context.md) with the data as `clipboardItem`, and
returns the data to copy or paste. Both see the labels of related records
outside the copy, not their ids. Both run synchronously, and returning nothing
from `paste()` pastes nothing:

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

`clipboard` on a list adds Copy and Paste buttons above its items, for the
list as a whole:

- **Copy** copies the loaded items, each like a form copies its item, as
  `{ items }`: paginated lists copy only the page that is shown. Relations
  between the items are copied by their labels, like relations to records
  outside the copy.
- **Paste** appends the items to the list, each created with the form of its
  `type`, and leaves out the items whose form isn't `creatable`. Only lists
  of the same name that are `creatable` paste, e.g. the chapters of one book
  into the chapters of another.
- Lists with their own `resource` and tree lists don't support it.

The items themselves only get Copy and Paste buttons through the `clipboard`
of their form, e.g. `form: { components, clipboard: true }`.

### Download and Upload

`clipboard: { interchange: true }` adds a menu to the Copy and Paste buttons,
with **Download** and **Upload**, to move data together with its files, e.g.
a book with its cover and sample pages into another installation. It works
wherever `clipboard` does, on forms, lists and uploads, and combines with
`copy()` and `paste()`:

```js
clipboard: { interchange: true }
```

**Download** saves the data that Copy would copy as a zip:

- `data.json` holds the data with its `$schema` and `$type`, as Copy writes
  it to the clipboard.
- `files/<name>` holds each file of the [upload](../../api/admin/schemas.md#upload) fields in the
  data under its name, e.g. `files/cover.png`. Different files of the same
  name are numbered, e.g. `files/cover (2).png`, also when they only differ
  in case, and `/ \ : * ? " < > |` and control characters are replaced with
  `-`. `data.json` refers to each file as
  `{ key, name, type, size, width, height, $file: 'files/<name>' }`, without
  the file's `url` and `signature`.

**Upload** reads such a zip and pastes its data like Paste, but only when its
`$schema` and `$type` match. It first uploads each referenced file through
the upload route of its field, where the server stores it under a new key, and
replaces the reference with the stored file. Files that the field's
`extensions` or `maxSize` don't accept, or that are missing from the zip, are
left out and listed in a notification. Entries of the zip that `data.json`
doesn't refer to are never read. The form is dirty afterwards, and saving it
stores the data with the new files.

The zip carries what the clipboard carries: lists with their own `resource`
are left out, and relations to records outside the data travel as their
labels, `{ $label }`, which resolve against the options of the installation
that the zip is uploaded into. The files need a `url` to be downloaded.

## Reference

- [`form`](../../api/admin/schemas.md#form) options and
  [kinds of forms](../../api/admin/schemas.md#kinds-of-forms).
- [Form events](../../api/admin/events.md#form-events).
- [Clipboard](../../api/admin/schemas.md#clipboard).
