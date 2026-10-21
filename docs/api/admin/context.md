# SchemaContext

Every schema callback receives a `SchemaContext` as its only argument: schema
values given as functions (`if`, `label`, `disabled`, `default`, …), value
callbacks (`computeValue()`, `formatValue()`, `serializeValue()`, …), option
callbacks and all [event handlers](./events.md).

```js
export default {
  type: 'view',
  field: {
    type: 'list',
    resource: 'books',
    form: {
      type: 'form',
      fields: {
        title: { type: 'text' },
        price: {
          type: 'number',
          // A schema value callback:
          if: ({ item }) => item.isAvailable
        },
        stock: {
          type: 'integer',
          // An event handler:
          onChange({ value, item }) {
            item.isAvailable = value > 0
          }
        }
      }
    }
  }
}
```

Members are read lazily: a callback only depends on the members that it reads.
In TypeScript, `SchemaContext<$Item>` types `item` with the type of the item.
For how contexts are used, see the
[context guide](../../guide/admin/context.md).

## Data paths

Data paths are slash-separated paths into the root data, e.g.
`'chapters/0/title'`. The paths that the context hands out have no leading
slash.

Paths that are passed *in* to the context, e.g. to
[`getValueAt()`](#getvalueat), [`validate()`](#validate),
[`isValid()`](#isvalid), [`getErrors()`](#geterrors) and
[`clearErrors()`](#clearerrors), are relative to
[`itemDataPath`](#itemdatapath), the item that the field sits in. A
leading `/` makes them absolute, `..` goes up one level, and leading above the
root throws.

## Properties

### value

```ts
context.value: any
```

The value that the context describes, at `dataPath`. In `onChange()` of fields, the parsed value. `undefined` in the events of
forms and sections, which describe their item: read `item` there. Objects
inside the data are returned editable: writes to them count as edits, see
[`markDirty()`](#markdirty). `value` itself is read-only; write to
`item[name]` to change it.

### item

```ts
context.item: $Item
```

The item that the context describes: the item that holds the field's
value, or, in the events of forms and sections, the item of the form or
section itself. That is the data of the form, view, dialog or panel, or of the
closest list entry or object, e.g. a chapter in an inlined form of
`book.chapters`. Writes to it, e.g. `item.title = 'Untitled'`, are edits that
make the data dirty when they change the value. See
[Which item a context describes](#which-item-a-context-describes).

### parentItem

```ts
context.parentItem: any
```

The closest item above `item` that isn't an array, e.g. the book of a chapter
in `book.chapters`. `null` for root items.

### rootItem

```ts
context.rootItem: any
```

The root data: in routed forms, the root data with the form's draft in place
of its item; in dialogs, the dialog's data; elsewhere the data of the page,
also inside panels with their own data, where writes through `rootItem` and
`parentItem` are edits of the page's data.

### serializedItem

```ts
context.serializedItem: any
```

`item` serialized for the server, built when it's read. In `serializeValue()`,
the item that is being serialized, so that the callback can modify sibling
values.

### serializedRootItem

```ts
context.serializedRootItem: any
```

The root item serialized for the server, built when it's read. In nested forms,
with the draft in place of the item.

### clipboardItem

```ts
context.clipboardItem: any
```

The data of the form serialized for clipboard copy and paste, in the
`clipboard.copy()` and `clipboard.paste()` callbacks. Relations to records
outside the data hold labels, e.g. `{ $label: 'Jane Austen' }`, not ids.

### name

```ts
context.name: string
```

The name of the field, the last key of its data path.

### dataPath

```ts
context.dataPath: string
```

The data path of the component. In event handlers, the path of the component
that the event comes from, like `event.target` in the DOM.

### currentDataPath

```ts
context.currentDataPath: string
```

In event handlers, the data path of the schema whose handler runs, like
`event.currentTarget` in the DOM, e.g. of the form in its `onChange()` when the
event bubbled up from one of its fields. Elsewhere the same as `dataPath`.

### itemDataPath

```ts
context.itemDataPath: string
```

The data path of `item`, e.g. `'chapters/1'`, or `''` for the root data.
Relative data paths passed to the context resolve against it.

### parentItemDataPath

```ts
context.parentItemDataPath: string | null
```

The data path of `parentItem`, `null` for root items.

### valueIndex

```ts
context.valueIndex: number | null
```

The index of the value in its list, `null` for values that aren't list entries.

### itemIndex

```ts
context.itemIndex: number | null
```

The index of `item` in its list, `null` for items that aren't list entries.

### parentItemIndex

```ts
context.parentItemIndex: number | null
```

The index of `parentItem` in its list, `null` for items that aren't list
entries.

### schema

```ts
context.schema: Field | null
```

The schema of the field.

### itemLabel

```ts
context.itemLabel: string | null
```

The text of the label of the form's item. Available in every context inside a
form, e.g. in its events and in the `if` and `label` of its fields, and
computed when it's read. `null` inside the `itemLabel()` callback itself.

### formLabel

```ts
context.formLabel: string | null
```

The text of the form's label, in the contexts of form events and in
`itemLabel()`.

### isDirty

```ts
context.isDirty: boolean
```

Whether the data has unsaved edits: the data of the form, view, dialog or panel
with its own data that the context belongs to. Only data with a submit button,
or with a field whose type `submitsData`, can be dirty.

### isCreating

```ts
context.isCreating: boolean
```

Whether the form creates a new item. `false` outside of forms.

### isRunning

```ts
context.isRunning: boolean
```

Whether the click handler of the button is running, during which the button
ignores further clicks. Writable in button handlers: set it to `false` to end
the running state early, e.g. before awaiting a dialog.

```js
{
  type: 'button',
  text: 'Publish',
  async onClick(context) {
    context.isRunning = false
    const result = await context.showDialog({
      fields: { … },
      buttons: { … }
    })
  }
}
```

### selectedTab

```ts
context.selectedTab: string | null
```

The name of the selected tab of the nearest form, `null` outside of forms and
in forms without tabs.

### routeQuery

```ts
context.routeQuery: Record<string, string | (string | null)[]>
```

The query parameters of the current URL.

### sourceQuery

```ts
context.sourceQuery: Record<string, any> | null
```

The query of the nearest list, e.g. its scope, page, order and filters. `null`
outside of lists, inside forms and in `itemLabel()`.

### user

```ts
context.user: AdminUser | null
```

The logged-in user, `null` when logged out. See
[AdminUser](./admin.md#adminuser).

### api

```ts
context.api: ApiConfig
```

The admin's `api` configuration, see [ApiConfig](./admin.md#apiconfig).

### views

```ts
context.views: Record<string, View>
```

The top-level views.

### flattenedViews

```ts
context.flattenedViews: Record<string, ViewSchema>
```

All views, including the ones inside menus, by name.

### Which item a context describes

A book, edited in a form with its own resource: `chapters` is a list with
inlined forms, `metadata` a nested section, `author` an inlined object:

| Place | `item` | `itemDataPath` | `itemIndex` | `parentItem` | `value` |
| ----- | ------ | -------------- | ----------- | ------------ | ------- |
| Field or button of the book | book | `''` | `null` | `null` | the field's |
| Field in a chapter's inlined form | chapter | `'chapters/1'` | `1` | book | the field's |
| Event of a chapter's inlined form | chapter | `'chapters/1'` | `1` | book | `undefined` |
| Event of a section without `nested` | book | `''` | `null` | `null` | `undefined` |
| Event of the nested section `metadata` | metadata | `'metadata'` | `null` | book | `undefined` |
| Event of the inlined object `author` | author | `'author'` | `null` | book | `undefined` |
| Buttons of the list `chapters` | book | `''` | `null` | `null` | the field's |
| `render()` of a cell of `chapters` | chapter | `'chapters/1'` | `1` | book | the cell's |
| `render()` of the items of `chapters` | chapter | `'chapters/1'` | `1` | book | `undefined` |
| Event of a routed chapter form | the draft | `'chapters/1'` | `1` | the draft root | `undefined` |
| Field of a panel with its own data `search` | panel data | `'search'` | `null` | book | the field's |
| Field of a panel with `nested: true`, `details` | details | `'details'` | `null` | book | the field's |
| Field or button of a dialog | dialog data | `''` | `null` | `null` | the field's |

Lists with `wrapPrimitives` give the fields of their items the wrapper object
as `item`. The buttons of lists describe the item that holds the list; in the
filters panel of a list, `item` is the filters' data and `parentItem` the item
that holds the list. The `onClick()`, `onSuccess()` and `onError()` of a
submit button get the same context. Validation evaluates `if` with the same
contexts as rendering. In the callbacks of the files of uploads, `item` is the
array of files and `itemIndex` is `null`.

## Callback and event properties

These properties are only set in the contexts of specific callbacks and events.

| Property | Type | Set in |
| -------- | ---- | ------ |
| `option` | `any` | The callbacks of `options`: the option being labelled, grouped, compared or valued |
| `options` | `any` | The callbacks of fields with options, e.g. selects, also `computeValue()`, where reading them loads them |
| `isSelected` | `boolean` | `options.label()`: whether the labelled option is selected |
| `searchTerm` | `string \| undefined` | The `search` callback of multiselects: the entered search term |
| `collapsed` | `boolean` | `onToggle()` of sections, inlined forms and trees |
| `error` | `unknown` | `onError()` of buttons and forms |
| `wasNotified` | `boolean` | Whether the handler already called `notify()`, which suppresses dito's notification in the events of buttons and forms |

## Methods

### getSchemaValue()

```ts
context.getSchemaValue<T>(key, options?): T
```

Returns the value of `key` in the context's schema, calling it with the context
if it's a function. Custom types use it to read their own schema options.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `key` | `string \| string[]` | The schema key, or an array of keys that reads a nested value, e.g. `['options', 'label']`. |
| `options.type` | `Function \| Function[]` | The expected types, e.g. `Number` or `[String, Object]`: values of other types are converted to the first type that they convert to. |
| `options.default` | `T \| (context) => T` | The value when the schema lacks `key`, called with the context if it's a function and `type` doesn't include `Function`. |

#### Return value

The resolved value.

#### Example

```js
const columns = context.getSchemaValue('columns', { type: Number, default: 2 })
```

### getValueAt()

```ts
context.getValueAt<T>(dataPath): T
```

Returns the value at `dataPath`, a [data path](#data-paths) resolved like the
`dataPath` of schemas. It reads the edited data, and callbacks that call it run
again when the value changes.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `dataPath` | `string` | The data path of the value, e.g. `'../../font'`. |

#### Return value

The value, or `undefined` if it isn't there.

#### Example

```js
// In a field of a slice of a style, at 'styles/0/slices/0/…':
const font = context.getValueAt('../../font') // 'styles/0/font'
```

### extend()

```ts
context.extend(values): SchemaContext
```

Returns a context that inherits from this one, with the members of `values`
added or overridden, e.g. to call another schema callback with a different
`value`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `values` | `object` | The members to add or override. |

#### Return value

The extended context.

#### Example

```js
// A label callback, shared by the chapters list and its select:
const getChapterLabel = ({ value }) => `${value.position}. ${value.title}`

const chapters = {
  type: 'list',
  // Call it with the item as the value:
  itemLabel: context => getChapterLabel(context.extend({ value: context.item }))
}
```

### request()

```ts
context.request<T>(options): Promise<T>
```

Sends an API request and resolves with the data of the response. Requests to
the API check the session first.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.url` | `string` | The URL, relative to the API root. Either `url` or `resource` is required. |
| `options.resource` | `Resource` | A resource, resolved relative to the nearest form or list with a resource. |
| `options.method` | `HttpMethod` | Defaults to `'get'`, or the `method` of `resource`. |
| `options.query` | `Record<string, any> \| [string, any][]` | The query parameters. |
| `options.data` | `unknown` | The request body. |
| `options.signal` | `AbortSignal` | Aborts the request. |
| `options.abortOnUnmount` | `boolean` | Ends the request when the component unmounts: its promise doesn't settle then, so the code that awaits it doesn't run on. Not with `cache`, as other components share cached requests. |
| `options.cache` | `'local' \| 'global'` | Caches the response: `'global'` for the session, until the user changes; `'local'` while the route of the form or view, or the dialog, is shown. |

#### Return value

A promise for the data of the response. Error responses reject with an `Error`
that carries the response data, e.g. `type`, `status` and `errors`.

#### Example

```js
async onClick({ request, notify }) {
  const { quantity } = await request({
    method: 'post',
    resource: { path: 'restock' },
    data: { quantity: 100 }
  })
  notify({ type: 'success', text: `${quantity} copies ordered.` })
}
```

### format()

```ts
context.format(value, options?): string | null | undefined
```

Formats a number, date or time like `format()` of
[@ditojs/utils](../utils.md), with the admin's `api.locale` and
`api.formats` as defaults.

#### Example

```js
label: ({ item, format }) => format(item.publishedAt, { date: true })
```

### navigate()

```ts
context.navigate(location): Promise<boolean>
```

Navigates to a route.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `location` | `string \| RouteLocation` | A path or Vue Router location. |

#### Return value

`true` if the navigation happened, `false` if not, e.g. when the user chose to
stay instead of discarding unsaved changes.

#### Example

```js
async onClick({ navigate, item }) {
  await navigate(`/authors/${item.authorId}`)
}
```

### getRouteUrl()

```ts
context.getRouteUrl(location): string
```

Returns the URL of a route location.

### download()

```ts
context.download(url): void
context.download({ url, filename?, query? }): void
```

Downloads a file through a link that the browser follows. Relative URLs
resolve against `api.url`, absolute and `blob:` URLs are used as they are.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `url` | `string` | The URL of the file. |
| `filename` | `string` | The name to save the file as. Optional. |
| `query` | `Record<string, any>` | Query parameters appended to the URL. |

#### Example

```js
onClick({ download, item }) {
  download({ url: `books/${item.id}/export`, filename: `${item.isbn}.pdf` })
}
```

### getResourceUrl()

```ts
context.getResourceUrl(): string
context.getResourceUrl(resource): string | null
```

Without argument, returns the URL of the nearest form or list with a resource:
of the item that the form edits, or of the collection that the list loads or
that the form creates its item in; throws without such a form or list. With
`resource`, returns its URL resolved relative to that form or list, or `null`
if it resolves to no path.

### validate()

```ts
context.validate(match?): boolean
```

Validates the data of the form, view, dialog or panel with its own data that
the context belongs to, and shows the errors. With `match`, only the values
whose data paths match.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `match` | `string \| string[] \| RegExp \| (dataPath) => boolean` | Data paths relative to `itemDataPath`, or absolute with a leading `/`. `*` matches one level; `**` in the middle matches zero or more levels (`a/**/c` matches `a/c`), at the end everything inside (`a/**` matches `a/b`, not `a`). Regular expressions and functions receive the absolute data paths, without leading slash. |

#### Return value

Whether the matching values are valid.

#### Example

```js
async onClick({ validate, submit }) {
  if (validate(['title', 'chapters/**'])) {
    await submit()
  }
}
```

### isValid()

```ts
context.isValid(match?): boolean
```

Like [`validate()`](#validate), without showing the errors.

### getErrors()

```ts
context.getErrors(match?): { [dataPath]: [{ message, keyword?, params? }] } | null
```

Returns the errors that the data holds, by the data paths of their values: the
errors that [`validate()`](#validate) showed, the validation errors of the
server, and the errors of fields, e.g. of options that failed to load. With
`match`, only those at the data paths that match, as in
[`validate()`](#validate). It is reactive, and doesn't show or change the
errors.

#### Return value

The errors by absolute data paths, or `null` without errors. Only the errors
of the server have a `keyword` and its `params`.

#### Example

```js
onChange({ getErrors }) {
  const hasChapterErrors = !!getErrors('chapters/**')
}
```

### clearErrors()

```ts
context.clearErrors(match?): void
```

Clears the errors of the data, or only those at the data paths that match
`match` and beneath them. `match` works like in [`validate()`](#validate).

#### Example

```js
onChange({ clearErrors }) {
  clearErrors('chapters')
}
```

### markDirty()

```ts
context.markDirty(): void
```

Marks the data as edited, e.g. after changing values in place that the admin
can't see. Writes through `item`, `parentItem` and `rootItem`, and to the
objects inside `value`, are edits already.

### resetItem()

```ts
context.resetItem(data?): $Item
```

Resets the data of the form, view, dialog or panel with its own data to `data`,
e.g. the response of a request, as if it was loaded: deserialized, with
defaults and computed values, and clean. Values that `data` lacks are reset
too, except the item's id, type and position. Without `data`, the data is reset
to its defaults.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.data` | `object` | The new data. Defaults to `{}`. |

#### Return value

The new data. Forms merge it into their item, so its objects keep their
identity.

#### Example

```js
async onClick({ request, resetItem }) {
  resetItem(await request({ resource: { path: 'restore' }, method: 'post' }))
}
```

### mergeItem()

```ts
context.mergeItem(data): $Item
```

Merges `data`, e.g. values that the server changed, into the data of the form,
view, dialog or panel with its own data, as if it was loaded: deserialized, with
defaults and computed values. Unlike `resetItem()`, only the values in `data`
change: the user's edits of other values stay, and the data stays as clean or
dirty as it is. Lists are merged by the ids of their items and objects in
place, so they keep their identity. The values in `data` replace the user's
edits of them and clear their errors, see
[Forms](../../guide/admin/forms.md#values-that-change-on-the-server).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `data` | `object` | The values to merge. |

#### Return value

The data, with the merged values.

#### Example

```js
async onClick({ request, getResourceUrl, mergeItem }) {
  const { exportStatus } = await request({ url: getResourceUrl() })
  mergeItem({ exportStatus })
}
```

### submit()

```ts
context.submit(options?): Promise<boolean>
```

Submits the data through the button that the context belongs to, as buttons
with a resource do when clicked: through its list or other source, or else to
its form, which saves its data or applies it to its parent. Elsewhere in a
form, e.g. in its events, layout component or field callbacks, it submits the
form like a click on its submit button, with its `resource`, `onSuccess()` and
`onError()`, but leaves the form open unless `closeForm: true` is passed.
Throws in forms without a submit button, and outside of forms and buttons of
sources.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.validate` | `boolean` | Validates first. Defaults to `true`. |
| `options.closeForm` | `boolean` | Closes the form after a successful submit. Defaults to the button's `closeForm`, and to `false` outside of buttons. |

#### Return value

Whether the submit succeeded.

### reload()

```ts
context.reload(): Promise<void>
```

Reloads the items of the list or object that the field is or is in, e.g.
of a list button after it changed the items on the server, and resolves once
they're loaded. Sources without their own `resource` are part of the data
around them and have nothing to load. Throws outside of lists and objects.

#### Example

```js
buttons: {
  import: {
    text: 'Import',
    async onClick({ request, reload }) {
      await request({ method: 'post', resource: { path: 'import' } })
      await reload()
    }
  }
}
```

### closeForm()

```ts
context.closeForm(): Promise<boolean>
```

Closes the form, navigating to its parent route. Throws outside of forms.

#### Return value

`true` if the form closed, `false` if it's still open, e.g. when the user chose
to stay instead of discarding unsaved changes.

### showDialog()

```ts
context.showDialog(options): Promise<unknown>
```

Shows a modal dialog with its own data and its own `'local'` request cache.
Also available outside of schemas as `admin.context.showDialog()`, see
[AdminContext](./admin.md#admincontext). For how to use dialogs, see the
[dialogs guide](../../guide/admin/dialogs.md).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.fields` | `Fields` | The fields of the dialog. Fields that produce routes, e.g. lists with routed forms, throw. |
| `options.buttons` | `Buttons` | The buttons. A `submit` button resolves the dialog with its data, a button named `cancel` cancels it unless it has its own `onClick()`. |
| `options.data` | `Record<string, any>` | The initial data. |
| `options.settings.label` | `string` | The accessible label of the dialog. Defaults to `'Dialog'`. |
| `options.settings.width` | `number \| string` | The maximum width of the dialog's content, without its padding: a number in pixels, or a CSS length. Defaults to `'35em'`. |
| `options.settings.minWidth` | `number \| string` | The minimum width of the dialog's content, without its padding: a number in pixels, or a CSS length. Narrow windows can make it smaller. |
| `options.settings.clickToClose` | `boolean` | Whether clicking outside of the dialog cancels it. Defaults to `false`. |
| `options.settings.minDuration` | `number` | The time in milliseconds that the dialog stays visible at least, when it's submitted right after it opened, e.g. by a password manager. Defaults to `0`. |

Submitting validates the data first, like forms do. Escape cancels dialogs
that have a `cancel` button or no buttons.

#### Return value

Resolves with the dialog's data when it's submitted, `undefined` when it's
cancelled, or the value passed to [`closeDialog()`](#closedialog).

#### Example

```js
async onClick({ showDialog, notify }) {
  const result = await showDialog({
    fields: { quantity: { type: 'integer', label: 'Quantity' } },
    buttons: { cancel: {}, order: { type: 'submit', text: 'Order' } },
    data: { quantity: 1 }
  })
  if (result) {
    notify({ text: `Ordered ${result.quantity} copies.` })
  }
}
```

### closeDialog()

```ts
context.closeDialog(value?): void
```

Closes the dialog that the context belongs to, resolving its `showDialog()`
with `value`. Throws outside of dialogs.

### confirm()

```ts
context.confirm(message, { action }?): Promise<boolean>
```

Asks for a confirmation in a dialog with the message, a Cancel button and a
button to confirm.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `message` | `TextOrHtml` | Text, whose line breaks are kept, or `html`, see [Text and HTML](./schemas.md#text-and-html). Its text is the accessible label of the dialog. |
| `options.action` | `string` | The text of the button to confirm. Defaults to `'OK'`. |

#### Return value

Resolves to `true` when confirmed, and to `false` when cancelled, also with
Escape.

#### Example

```js
async onClick({ confirm, request }) {
  if (await confirm('Delete all reviews?', { action: 'Delete' })) {
    await request({ method: 'delete', resource: { path: 'reviews' } })
  }
}
```

### prompt()

```ts
context.prompt(message, { action, value, type }?): Promise<unknown>
```

Asks for a value in a dialog with the message above a field, a Cancel button
and a button to submit. The field validates like those of other dialogs, and
it isn't required.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `message` | `TextOrHtml` | Text, whose line breaks are kept, or `html`, see [Text and HTML](./schemas.md#text-and-html). Its text is the accessible label of the dialog and the field. |
| `options.action` | `string` | The text of the button to submit. Defaults to `'OK'`. |
| `options.value` | `any` | The initial value of the field. |
| `options.type` | `string` | The type of the field, any type of field that holds a value, e.g. `'email'`, `'number'` or `'textarea'`. Defaults to `'text'`. |

#### Return value

Resolves to the value of the field when submitted, also when it's empty, e.g.
`null` for empty text, and to `undefined` when cancelled, also with Escape.

#### Example

```js
async onClick({ prompt, request }) {
  const email = await prompt('Send the invoice to:', {
    action: 'Send',
    type: 'email'
  })
  if (email !== undefined) {
    const resource = { path: 'invoice/send' }
    await request({ method: 'post', resource, data: { email } })
  }
}
```

### alert()

```ts
context.alert(message, { action }?): Promise<void>
```

Shows the message in a dialog with a single button.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `message` | `TextOrHtml` | Text, whose line breaks are kept, or `html`, see [Text and HTML](./schemas.md#text-and-html). Its text is the accessible label of the dialog. |
| `options.action` | `string` | The text of the button. Defaults to `'OK'`. |

#### Return value

Resolves once the dialog is closed, with its button or with Escape.

#### Example

```js
async onClick({ alert, item }) {
  if (item.orders > 0) {
    await alert('Books with orders can only be archived.')
  }
}
```

### notify()

```ts
context.notify(options): void
```

Shows a notification toast, with the paragraphs of `text`.
Also available outside of schemas as `admin.context.notify()`. In the handlers
of button and form events, calling it suppresses dito's own notification.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.type` | `'info' \| 'success' \| 'warning' \| 'error'` | Defaults to `'info'`. |
| `options.title` | `string` | The heading. Defaults to a label for `type`. |
| `options.text` | `TextOrHtml \| (TextOrHtml \| false \| null)[]` | Text or `html`, see [Text and HTML](./schemas.md#text-and-html). Each entry is a paragraph, newlines become `<br>`, `false` and `null` are skipped. |
| `options.html` | `string \| (string \| false \| null)[]` | Deprecated: HTML strings, rendered as they are. Use `text` with `html`. |
| `options.error` | `unknown` | The original error, logged to the console for `type: 'error'`. |
| `options.duration` | `number` | Milliseconds to show it, `0` for sticky. Defaults to a duration from the length of the content, see [`api.notifications`](./admin.md#apiconfig). |

#### Example

```js
onSuccess({ notify, itemLabel }) {
  notify({ type: 'success', text: `${itemLabel} was published.` })
}
```
