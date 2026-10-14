# Events

Schemas handle events with `on…` handlers, named after the event: `onChange()`
handles `change`. Each handler receives the [SchemaContext](./context.md)
of the event, extended with the values of the event, e.g. `error` in
`onError()`.

```js
const form = {
  type: 'form',
  components: {
    stock: {
      type: 'integer',
      onChange({ value, item }) {
        item.isAvailable = value > 0
      }
    }
  },
  onSuccess({ notify, itemLabel, isCreating }) {
    const action = isCreating ? 'created' : 'saved'
    notify({ text: `${itemLabel} was ${action}.` })
  }
}
```

## Handlers

- Handlers can be async: events are awaited, e.g. buttons show their progress
  while their `onClick()` runs.
- Errors thrown by handlers are passed on as they are. Errors of button
  handlers go to the button's `onError()`.
- `context.dataPath` is the data path of the component that the event comes
  from, `context.currentDataPath` the one of the schema whose handler runs.
- Fields bind their other `on…` handlers to their input as native events, e.g.
  `onKeydown()` of a text field. These handlers receive the context, not the
  DOM event.

## Return values

| Event | Return value |
| ----- | ------------ |
| `input`, `change`, `click` | `false` stops the event from bubbling |
| `click` of buttons | Any value other than `undefined` prevents the default, e.g. buttons with a `resource` submitting it |
| `success`, `error` of buttons and forms | Any value other than `undefined` suppresses dito's notification, as does calling `context.notify()` |
| All others | Ignored |

## Bubbling

`input`, `change` and the `click` of buttons bubble from the component to the
schemas around it: sections, inlined forms, forms and views, until a handler
returns `false`. Panels with their own data don't pass events on. All other
events, including `toggle`, only fire on the schema that defines them.

```js
const form = {
  type: 'form',
  components: {
    price: { type: 'number' },
    stock: { type: 'integer' }
  },
  // Fires for changes of both fields:
  onChange({ dataPath, currentDataPath }) {
    console.log(`${dataPath} changed in ${currentDataPath}`)
  }
}
```

## Deprecated `events`

The object `events: { change() { … } }` is deprecated and logs a warning.
It's used only for events that the schema has no `on…` handler for: `on…`
handlers win, also the default `onClick()` of the Save and Cancel buttons of
forms. During development, an ignored `events` entry logs a warning.

## Schema events

### onInitialize()

```ts
onInitialize(context): unknown
```

Fires when the component tree of the schema is set up: views, forms, dialogs,
panels, sections and inlined forms. Fires again when the schema changes, e.g.
when the form of a list with `forms` changes with the item's `type`.

### onDestroy()

```ts
onDestroy(context): unknown
```

Fires when the component of the schema is unmounted.

### onLoad()

```ts
onLoad(context): unknown
```

Fires after data was loaded from the API, once the values derived from it are
written, including the ones that depend on options to load:

- Forms: after loading their item, not when creating one.
- Lists and trees with a resource fire `load` on the schema that renders them,
  e.g. the view of a single-component view, or the form or section that contains
  the list.

```js
const form = {
  type: 'form',
  onLoad({ item, itemLabel }) {
    document.title = itemLabel
  }
}
```

### onInput()

```ts
onInput(context): unknown
```

Fires for each edit that changes the value of a field, e.g. per keystroke.
Bubbles. Edits that don't write while typing, e.g. of lists, fire `input` and
`change` together.

### onChange()

```ts
onChange(context): unknown
```

Fires once an edit of a field is done, after the values derived from it are
written. `context.value` is the parsed value. Bubbles. Also fires on a nested
form when it applies its draft to an existing item.

### onFocus()

```ts
onFocus(context): unknown
```

Fires when a field receives focus.

### onBlur()

```ts
onBlur(context): unknown
```

Fires when a field loses focus, after it's validated.

### onToggle()

```ts
onToggle({ collapsed, ...context }): unknown
```

Fires when a collapsible section, an inlined form or a tree item collapses or
expands. Doesn't bubble. Define it where the toggling
happens: on the section, on the inlined form (`form: { onToggle() }` of
`inlined: true` lists and objects), or on the tree. `collapsed` tells the new
state.

```js
const section = {
  type: 'section',
  collapsible: true,
  components: { … },
  onToggle({ collapsed }) {
    console.log(collapsed ? 'collapsed' : 'expanded')
  }
}
```

## Button events

`type: 'button'` and `type: 'submit'` components. `onClick()`, `onSuccess()`
and `onError()` of a button receive the same context, extended with `error` in
`onError()`.

### onClick()

```ts
onClick(context): unknown
```

Fires when the button is clicked, once at a time: further clicks are ignored
while it runs, see [`isRunning`](./context.md#isrunning). Bubbles up
to the `onClick()` of the schemas around the button, see
[Bubbling](#bubbling). Returning a value other than `undefined` prevents the
default, see [Return values](#return-values). On the default buttons of forms
and dialogs, `onClick()` replaces the default action.

```js
{
  type: 'button',
  text: 'Duplicate',
  async onClick({ request, item, navigate }) {
    const copy = await request({
      method: 'post',
      resource: 'books',
      data: { ...item, id: undefined }
    })
    await navigate(`/books/${copy.id}`)
  }
}
```

### onSuccess()

```ts
onSuccess(context): unknown
```

Fires after the button submitted its data successfully: the submit buttons of
forms, buttons with a `resource`, and the submit buttons of nested forms when
they applied their draft. Fires after the form's own `onSuccess()` or
`onApply()`. Can suppress dito's notification, see
[Return values](#return-values).

### onError()

```ts
onError({ error, ...context }): unknown
```

Fires when the `onClick()` of the button throws, or its submit fails with an
error other than validation errors, which are shown on the fields. Can
suppress dito's notification, see [Return values](#return-values).

`context.error` is the thrown error, or the error data of the response.

## Form events

`type: 'form'` schemas, including the forms of lists, objects and trees. The
contexts of form events describe the form's item, see
[Which item a context describes](./context.md#which-item-a-context-describes):
`value` is `undefined`, and they have `itemLabel` and `formLabel`.

### onSuccess()

```ts
onSuccess(context): unknown
```

Fires after a form with its own resource saved its item, new and existing ones;
`context.isCreating` tells whether the item was created. Fires before the
`onSuccess()` of the submit button. Can suppress dito's notification, see
[Return values](#return-values). Nested forms
fire [`onApply()`](#onapply) instead.

```js
onSuccess({ isCreating, item, notify }) {
  if (isCreating) {
    notify({ type: 'success', text: `Book #${item.id} was created.` })
  }
}
```

### onError()

```ts
onError({ error, ...context }): unknown
```

Fires when saving the item fails, with an error other than validation errors,
which are shown on the fields. Fires before the `onError()` of the submit
button. Can suppress dito's notification, see
[Return values](#return-values).

### onApply()

```ts
onApply(context): unknown
```

Fires after a nested form, whose item is part of its parent's data, applied its
draft to the parent's data. The parent still needs to be saved. The return
value is ignored.

### onCancel()

```ts
onCancel(context): unknown
```

Fires when the form was closed with its Cancel button. Doesn't fire when the
user chose to stay on the form instead of discarding unsaved changes.

### onLoad()

See [`onLoad()`](#onload).
