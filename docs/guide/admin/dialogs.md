# Dialogs

Dialogs ask the user for input in a modal form. `context.showDialog()` shows
one and resolves when it closes:

```js
refund: {
  type: 'button',
  text: 'Refund',
  async onClick(context) {
    // The button doesn't need to stay busy while the dialog is open:
    context.isRunning = false
    const data = await context.showDialog({
      components: {
        amount: { type: 'number', decimals: 2, min: 0 },
        reason: { type: 'textarea', lines: 3 }
      },
      buttons: {
        cancel: {},
        refund: { type: 'submit', text: 'Refund' }
      },
      data: { amount: 0 },
      settings: { label: 'Refund Order', width: 400 }
    })
    if (data) {
      await context.request({
        method: 'post',
        resource: { path: 'refund' },
        data
      })
    }
  }
}
```

`showDialog()` takes the dialog's `components`, like those of a form, its
`buttons`, its initial `data`, and `settings` such as its accessible `label`
and its maximum `width` in pixels, see
[`showDialog()`](../../api/admin/context.md#showdialog). A `submit`
button resolves the dialog with its data, and a button named `cancel` cancels
it.

## The result

The promise resolves to:

- the dialog's data, when a `submit` button submits it, or Enter is pressed in
  an input;
- `undefined`, when it's cancelled with the `cancel` button, with Escape, or
  with a click outside if `clickToClose` is set;
- the value passed to `context.closeDialog(value)` from a handler inside the
  dialog.

Escape only cancels dialogs that have a `cancel` button or no buttons.

A confirmation only needs a label, as the result tells the answers apart:

```js
const isConfirmed = await context.showDialog({
  components: {
    message: { type: 'label', label: 'Delete all reviews of this book?' }
  },
  buttons: {
    cancel: {},
    delete: { type: 'submit', text: 'Delete' }
  }
})
if (isConfirmed) {
  await context.request({ method: 'delete', resource: { path: 'reviews' } })
}
```

Submitting validates the data like forms do, and the dialog only resolves once
it is valid. Enter in an input submits any dialog. Other buttons validate in
their handler with `context.validate()` and close the dialog with
`context.closeDialog(data)`:

```js
buttons: {
  cancel: {},
  save: {
    text: 'Save',
    onClick({ validate, closeDialog, item }) {
      if (validate()) {
        closeDialog(item)
      }
    }
  }
}
```

## Inside the dialog

The dialog's components have contexts of their own, whose `item` and
`rootItem` are the dialog's data. Their handlers can use the dialog's data and
actions, e.g. `validate()` and `closeDialog()`. Dialogs have their own cache
for `request({ cache: 'local' })` while they're open.

Dialogs can't contain lists with routed forms, as these need routes: such
components throw.

## Outside of callbacks

`admin.context.showDialog()` shows dialogs from code outside of schemas, see
[AdminContext](../../api/admin/admin.md#showdialog).

## Reference

- [Dialogs](../../api/admin/schemas.md#dialogs).
- [`showDialog()`](../../api/admin/context.md#showdialog) and
  [`closeDialog()`](../../api/admin/context.md#closedialog).
