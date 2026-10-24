# Events

Schemas handle events with `on…` handlers named after the event: `onChange()`
handles `change`, `onClick()` handles `click`. Each handler receives the
[context](./context.md) of the event:

```js
title: {
  type: 'text',
  onChange({ value, item }) {
    item.sortTitle = value?.replace(/^(The|An?) /, '')
  }
}
```

## Which events fire where

| Schemas                                          | Events                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| All schemas                                      | `onChange()`, `onInput()`                                                      |
| Views, forms, sections, panels and inlined forms | `onInitialize()`, `onDestroy()`, `onLoad()`, `onClick()` of the buttons inside |
| Fields                                           | `onFocus()`, `onBlur()`                                                        |
| Buttons                                          | `onClick()`, `onSuccess()`, `onError()`                                        |
| Forms                                            | `onSuccess()`, `onError()`, `onApply()`, `onCancel()`                          |
| Sections, inlined forms and trees                | `onToggle()`, with `collapsed`                                                 |

- `onInput()` fires for each edit, e.g. per keystroke. `onChange()` fires once
  the edit is done, e.g. when the field loses focus, after the values that
  depend on it are updated.
- `onLoad()` fires after data was loaded from the API: on forms after loading
  their item, and for lists with a resource on the schema that holds the
  list.
- Edits through code don't fire `onInput()` and `onChange()`: these report the
  user's edits.

The form events are described in [Forms](./forms.md#form-events) and
[Nested forms](./nested-forms.md#events), the button events in
[Buttons](./buttons.md), where errors thrown by handlers go too.

## Bubbling

`input`, `change` and the `click` of buttons bubble from the field to the
schemas around it: sections, inlined forms, forms and views. A form's
`onChange()` sees the changes of all its fields:

```js
export const bookForm = {
  type: 'form',
  fields: {
    stock: { type: 'integer' },
    isAvailable: { type: 'switch' }
  },
  onChange({ dataPath, currentDataPath, item }) {
    // `dataPath` is the changed field, `currentDataPath` the form:
    if (dataPath === 'stock' && item.stock === 0) {
      item.isAvailable = false
    }
  }
}
```

A bubbled event keeps the context of the field it comes from: `value`,
`item` and `dataPath` are the changed field's, like `event.target` in the DOM.
`context.currentDataPath` is the path of the schema whose handler runs, like
`event.currentTarget`. A handler that returns `false` stops the event from
bubbling further. Panels with their own data don't pass events on.

Other events, including `toggle`, only fire on the schema that defines the
handler. For `onToggle()` of inlined forms, set it on the form of the list:
`form: { onToggle() { … } }`.

For values that always follow others, `computeValue()` is simpler, see
[Fields](./fields.md#value-hooks).

## Return values

Returning `false` stops bubbling, a value other than `undefined` from a
button's `onClick()` prevents its default action, and from `onSuccess()` or
`onError()` replaces dito's notification. Other return values are ignored, see
[Return values](../../api/admin/events.md#return-values).

## Native events

Fields add their other `on…` handlers to their input element as native event
listeners, e.g. `onKeydown()` of a text field. These handlers receive the
context too, not the DOM event.

## Reference

- [Events](../../api/admin/events.md): every event with its context values.
