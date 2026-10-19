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
      fields: {
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

`showDialog()` takes the dialog's `fields`, like those of a form, its
`buttons`, its initial `data`, and `settings` such as its accessible `label`
and the minimum and maximum widths of its content, `minWidth` and `width`, see
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

Escape only cancels dialogs that have a `cancel` button, or at most one button.

Submitting validates the data like forms do, and the dialog only resolves once
it is valid. Enter in an input submits any dialog. Other buttons validate in
their handler with `context.validate()` and close the dialog with
`context.closeDialog(data)`:

```js
buttons: {
  cancel: {},
  save: {
    text: 'Save',
    primary: true,
    onClick({ validate, closeDialog, item }) {
      if (validate()) {
        closeDialog(item)
      }
    }
  }
}
```

`primary: true` gives such a button the look of a `submit` button and the
dialog's initial focus, without submitting the dialog.

## Confirmations, prompts and alerts

For the cases of the browser's `confirm()`, `prompt()` and `alert()`, the
context has methods of these names that show dito dialogs with a message and a
button for the `action`, `'OK'` by default:
[`confirm()`](../../api/admin/context.md#confirm) resolves to whether it was
confirmed, [`prompt()`](../../api/admin/context.md#prompt) to the value of its
field of the `type` or `undefined` when cancelled, and
[`alert()`](../../api/admin/context.md#alert) once it's closed:

```js
const isConfirmed = await context.confirm(
  'Delete all reviews of this book?',
  { action: 'Delete' }
)
if (isConfirmed) {
  await context.request({ method: 'delete', resource: { path: 'reviews' } })
  await context.alert('All reviews were deleted.')
}
```

## Inside the dialog

The dialog's fields have contexts of their own, whose `item` and
`rootItem` are the dialog's data. Their handlers can use the dialog's data and
actions, e.g. `validate()` and `closeDialog()`. Dialogs have their own cache
for `request({ cache: 'local' })` while they're open.

Dialogs can't contain lists with routed forms, as these need routes: such
fields throw.

## Outside of callbacks

`admin.context.showDialog()`, `confirm()`, `prompt()` and `alert()` show
dialogs from code outside of schemas, see
[AdminContext](../../api/admin/admin.md#methods).

## Reference

- [Dialogs](../../api/admin/schemas.md#dialogs).
- [`showDialog()`](../../api/admin/context.md#showdialog),
  [`closeDialog()`](../../api/admin/context.md#closedialog),
  [`confirm()`](../../api/admin/context.md#confirm),
  [`prompt()`](../../api/admin/context.md#prompt) and
  [`alert()`](../../api/admin/context.md#alert).
