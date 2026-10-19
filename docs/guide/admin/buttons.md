# Buttons

Buttons run actions: open a page, send a request, show a dialog. They go into
`buttons` of forms, views, lists and panels, or among their `fields`.

```js
export const order = {
  type: 'form',
  fields: {
    number: { type: 'text', readonly: true },
    customer: { type: 'object', … },
    // A button among the fields:
    printInvoice: {
      type: 'button',
      text: 'Print Invoice',
      onClick({ download, getResourceUrl, item }) {
        // E.g. `/api/orders/12/invoice`, inside the resource of the form:
        download({
          url: getResourceUrl({ path: 'invoice' }),
          filename: `invoice-${item.number}.pdf`
        })
      }
    }
  },
  // Buttons at the bottom of the form, next to Cancel and Save:
  buttons: {
    ship: {
      text: 'Ship',
      resource: { path: 'ship', method: 'post' },
      closeForm: true
    }
  }
}
```

In `buttons`, `type` defaults to `'button'`. Buttons are excluded from the
data and have no value.

## Click handlers

`onClick()` receives the [context](./context.md) of the button, with the
data, the actions of its form and the admin's services. The `item` of a button
is the item that it sits in; for the `buttons` of a list, the item that holds
the list, see [The context](./context.md#which-item-a-context-describes):

```js
duplicate: {
  type: 'button',
  text: 'Duplicate',
  async onClick({ request, item, navigate, notify }) {
    const { id, ...data } = item
    const copy = await request({
      method: 'post',
      resource: '/books',
      data: { ...data, title: `${data.title} (Copy)` }
    })
    notify({ type: 'success', text: 'The book was duplicated.' })
    await navigate(`/books/${copy.id}`)
  }
}
```

- Async handlers are awaited. A button runs one click at a time, and shows
  that it's busy while its handler runs. When a button saves a form, the
  form's `onSuccess()` runs before the button's.
- `context.request()` resolves a `resource` relative to the nearest form or
  list with a resource, so `resource: { path: 'ship' }` in an order form sends
  to `orders/12/ship`. A leading `/` resolves from the API root. A `url`
  instead of `resource` is resolved against the API's URL, with the `query`
  next to it: `request({ url: 'orders', query: { status: 'open' } })`.
  `cache: 'global'` or `'local'` reuses responses, see
  [`request()`](../../api/admin/context.md#request).
- Errors thrown by the handler go to the button's `onError()`, as they are,
  in `context.error`. Unless `onError()` returns a value or calls `notify()`, they also show as
  notifications.
- Writes through `item` are edits, as if the user made them, see
  [Dirty state](./dirty-state.md).

## Submitting to a resource

A button with a `resource` submits the data of its form to it when clicked,
e.g. `POST books/1/publish` with the book's data, and then `onSuccess()`
fires:

```js
publish: {
  text: 'Publish',
  resource: { path: 'publish', method: 'post' },
  onSuccess({ itemLabel, notify }) {
    notify({ type: 'success', text: `${itemLabel} is now online.` })
  },
  onError({ error, notify }) {
    notify({ type: 'error', text: error.message })
  }
}
```

- The serialized item, the values of the form's components, is sent with
  `post`, `put` and `patch`, unless `resource.data` gives other data.
- The form validates its data first, and the server's validation errors are
  shown on the fields.
- The response is merged into the form's data, like a save response.
- `closeForm: true` closes the form after a successful submit.
- `onSuccess()` and `onError()` get the same context as `onClick()`, with
  `context.error` in `onError()`. They replace dito's notification when they
  return a value or call `notify()`.
- An `onClick()` that returns a value other than `undefined` prevents the
  submit, e.g. after asking the user:

```js
cancelOrder: {
  text: 'Cancel Order',
  resource: { path: 'cancel', method: 'post' },
  onClick: () => (window.confirm('Cancel this order?') ? undefined : false)
}
```

In handlers of buttons that belong to a form or a list, `context.submit()`
submits like a click does, e.g. after preparing the data:

```js
async onClick({ item, submit }) {
  // A field of the form, as only their values are sent:
  item.isAvailable = true
  await submit({ closeForm: true })
}
```

## The default buttons

Forms have a `cancel` and a `submit` button, and dialogs the buttons you give
them. `onClick()` on a default button replaces its default action, see
[Forms](./forms.md#buttons). `type: 'submit'` marks a button that saves data:
data without such a button is never dirty, see
[Dirty state](./dirty-state.md).

## Buttons that wait for a dialog

While the handler runs, the button stays busy. Set `context.isRunning` to
`false` to end that early, e.g. before awaiting a dialog that can stay open for
a while:

```js
async onClick(context) {
  context.isRunning = false
  const data = await context.showDialog({ … })
  …
}
```

See [Dialogs](./dialogs.md) for a complete example.

## Clicks in the schemas around the button

Clicks bubble up from the button to the `onClick()` of the schemas around it,
e.g. the section that holds it, then the form, until a handler returns
`false`. `context.dataPath` names the button. See
[Events](./events.md#bubbling).

## Reference

- [`button` and `submit`](../../api/admin/schemas.md#button-submit)
  options.
- [Button events](../../api/admin/events.md#button-events).
