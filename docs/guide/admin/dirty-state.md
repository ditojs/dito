# Dirty State

A form is dirty while its data has edits that aren't saved yet. Leaving a
dirty form, by navigating away or closing it, asks the user whether to discard
the changes. `context.isDirty` tells whether the data is dirty.

## What counts as an edit

An edit is a change of a value that is saved with the data:

- The user's edits in fields, lists and uploads.
- Writes of code through the context to a value that a field shows, e.g.
  `item.title = 'Untitled'` in a handler, and changes of the items of lists.
  They count like the user's edits.
- Writes from inside a [panel with its own `data`](./layout.md#panels) through
  `rootItem` or `parentItem`: they change the page's data. Edits of the
  panel's own data aren't edits of the page.
- Only writes that change a value: writing the same value again isn't an edit.

A form stays dirty until it's saved, applied or loaded again. Undoing an edit
by hand leaves it dirty.

Changes of excluded values aren't edits: fields with `exclude: true`, buttons
and labels, and lists with their own `resource`, which save their items
themselves. Nor are writes to values that no field shows, e.g.
`item.isSelected = true` in a handler, also inside the items of lists and
objects: only the values that their forms show are sent.

```js
fields: {
  title: { type: 'text' },
  // A helper value that isn't saved, so editing it doesn't make the form dirty:
  showPreview: { type: 'switch', exclude: true }
}
```

## Changes the admin can't see

Writes that change a value in place, e.g. a `Date` through `setHours()`, don't
pass through the context. Call `context.markDirty()` after them:

```js
onClick({ item, markDirty }) {
  item.publishedAt.setHours(9, 0)
  markDirty()
}
```

Writing a new value is simpler, and an edit by itself:

```js
onClick({ item }) {
  const publishedAt = new Date(item.publishedAt)
  publishedAt.setHours(9, 0)
  item.publishedAt = publishedAt
}
```

## Values that aren't stored as they are

Don't exclude fields whose value is stored as other values, e.g. a customer's
`name` stored as `firstName` and `lastName`: their edits would not make the
form dirty. See [Fields](./fields.md#values-that-arent-stored-as-they-are).

## Only data that can be saved is dirty

Data is only dirty if there is a button that saves it: a button of type
`submit` in its `buttons`, like the default submit button of forms. Views,
dialogs and panels without such a button are never dirty, and views don't ask
about unsaved changes then.

The forms of lists with `mutate: true` have no submit button: their edits make
the parent form dirty right away.

## Lists with their own resource

Lists with a `resource` are excluded from the data of their form. To have
changes of such a list, e.g. the order of its items, make the form dirty, set
`exclude: false`:

```js
chapters: {
  type: 'list',
  resource: 'chapters',
  draggable: true,
  orderKey: 'position',
  exclude: false,
  form: () => import('../forms/chapter.js')
}
```

The list's items are then sent with the form when it's saved.

## Resetting the data

`context.resetItem(data)` replaces the data as if `data` was loaded, and
leaves it clean, see [Forms](./forms.md#acting-on-the-form-from-code).

## Reference

- [`isDirty`](../../api/admin/context.md#isdirty),
  [`markDirty()`](../../api/admin/context.md#markdirty),
  [`resetItem()`](../../api/admin/context.md#resetitem) and
  [`mergeItem()`](../../api/admin/context.md#mergeitem).
