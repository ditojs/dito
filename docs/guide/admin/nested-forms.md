# Nested Forms

A nested form edits an item that is part of the data of its parent form, on a
page of its own: a list or object without a `resource`, and without
`inlined`, opens one for each item. The parent saves the item with the rest of
its data.

```js
export const book = {
  type: 'form',
  components: {
    title: { type: 'text' },
    chapters: {
      type: 'list',
      itemLabel: 'title',
      creatable: true,
      editable: true,
      deletable: true,
      draggable: true,
      form: {
        type: 'form',
        label: 'Chapter',
        components: {
          title: { type: 'text', required: true },
          text: { type: 'markup' }
        }
      }
    }
  }
}
```

Editing a chapter opens its form at `/admin/books/1/chapters/0`, addressed by
the chapter's index in the list.

## Drafts

A nested form edits a draft of its item:

- **Apply** (the submit button) validates the draft and merges it into the
  item in the parent's data. The parent becomes dirty if the item changed, and
  the change is saved with the parent. New items are added with **Add**.
- **Close** (the cancel button) discards the draft and leaves the parent
  untouched.

The parent's data outside of the item is read-only in the draft: in a nested
form, `rootItem` and `parentItem` show the parent's data with the draft in
place of the item, and writes to the rest of it are ignored, with a warning in
development.

`serializeValue()` of the fields in nested forms runs when the parent is
saved, not when the draft is applied.

## Events

Nested forms don't save, so they fire `onApply()` instead of `onSuccess()`:

```js
form: {
  type: 'form',
  label: 'Chapter',
  components: { … },
  onApply({ item, isCreating }) {
    console.log(`${isCreating ? 'Added' : 'Changed'} chapter ${item.title}`)
  },
  onCancel() {
    console.log('Chapter not changed')
  }
}
```

Applying a draft to an existing item also fires `onChange()` on the nested
form. `onCancel()` fires when Close closed the form. The value returned from
`onApply()` is ignored: unlike `onSuccess()`, it can't replace dito's
notification.

## Editing the parent's data directly

With `mutate: true` on the list, its forms edit the items in the parent's data
directly, without a draft. Their edits make the parent dirty right away, and
they have no Apply button: Close only closes them.

```js
chapters: {
  type: 'list',
  mutate: true,
  editable: true,
  form: { … }
}
```

## Items that move

An open nested form follows its item when the item moves in its list, e.g.
when another item before it is removed. When its item is removed, the form
closes.

## Lists of plain values

`wrapPrimitives` edits the items of a list of strings or numbers in forms, by
wrapping each one in an object under the given key:

```js
keywords: {
  type: 'list',
  wrapPrimitives: 'keyword',
  creatable: true,
  editable: true,
  form: {
    type: 'form',
    components: { keyword: { type: 'text' } }
  }
}
```

The list stays an array of strings, e.g. `['fantasy', 'dragons']`.

## Reference

- [Kinds of forms](../../api/admin/schemas.md#kinds-of-forms).
- [`onApply()`](../../api/admin/events.md#onapply).
