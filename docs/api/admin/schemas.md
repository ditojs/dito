# Schemas

The admin is described by plain objects, the schemas: views at the top, forms
inside them, and field schemas for every input, list, section or button.
Each schema names its `type`. This page lists the options that all schemas
share, followed by the options of each type.

Event handlers (`onChange()`, `onClick()`, …) are listed per type and
described in [Events](./events.md). The context that callbacks receive is
described in [SchemaContext](./context.md).

## Field Types

| Type                                                                          | Schema type                          | Section                         |
| ----------------------------------------------------------------------------- | ------------------------------------ | ------------------------------- |
| `text`, `email`, `url`, `hostname`, `domain`, `tel`, `password`, `creditcard` | `InputSchema`                        | [Fields](#text)                 |
| `textarea`                                                                    | `TextareaSchema`                     | [Fields](#textarea)             |
| `number`, `integer`                                                           | `NumberSchema`                       | [Fields](#number-integer)       |
| `slider`                                                                      | `SliderSchema`                       | [Fields](#slider)               |
| `progress`                                                                    | `ProgressSchema`                     | [Fields](#progress)             |
| `checkbox`                                                                    | `CheckboxSchema`                     | [Fields](#checkbox)             |
| `switch`                                                                      | `SwitchSchema`                       | [Fields](#switch)               |
| `date`, `datetime`, `time`                                                    | `DateSchema`                         | [Fields](#date-datetime-time)   |
| `color`                                                                       | `ColorSchema`                        | [Fields](#color)                |
| `code`                                                                        | `CodeSchema`                         | [Fields](#code)                 |
| `markup`                                                                      | `MarkupSchema`                       | [Fields](#markup)               |
| `upload`                                                                      | `UploadSchema`                       | [Fields](#upload)               |
| `value`                                                                       | `ValueSchema`                        | [Fields](#value)                |
| `component`                                                                   | `ComponentSchema`                    | [Fields](#component)            |
| `select`                                                                      | `SelectSchema`                       | [Options](#select)              |
| `multiselect`                                                                 | `MultiselectSchema`                  | [Options](#multiselect)         |
| `radio`                                                                       | `RadioSchema`                        | [Options](#radio)               |
| `checkboxes`                                                                  | `CheckboxesSchema`                   | [Options](#checkboxes)          |
| `list`                                                                        | `ListSchema`                         | [Lists](#list)                  |
| `object`                                                                      | `ObjectSchema`                       | [Lists](#object)                |
| `tree-list`, `tree-object`                                                    | `TreeListSchema`, `TreeObjectSchema` | [Lists](#tree-list-tree-object) |
| `section`                                                                     | `SectionSchema`                      | [Layout](#section)              |
| `panel`                                                                       | `PanelSchema`                        | [Layout](#panel)                |
| `label`                                                                       | `LabelSchema`                        | [Layout](#label)                |
| `spacer`                                                                      | `SpacerSchema`                       | [Layout](#spacer)               |
| `button`, `submit`                                                            | `ButtonSchema`                       | [Layout](#button-submit)        |

`SchemaByType` maps each type name to its schema type. Unknown types throw
`Unknown Dito.js component type: '…'` when rendered. Custom types are added
with [`defineType()`](./types.md#definetype). `api.defaults` sets option
defaults per type, see [`defaults`](./admin.md#defaults).

## Schema values

```ts
type SchemaValue<$Item, $Params, $ReturnValue> =
  | $ReturnValue
  | SchemaValueCallback<$Item, $Params, $ReturnValue>

type SchemaValueCallback<$Item, $Params, $ReturnValue> =
  (context: SchemaContext<$Item> & $Params) => $ReturnValue
```

Most options are schema values: either the value itself, or a callback that
receives the [SchemaContext](./context.md) and returns it. Callbacks
are evaluated reactively, so they run again when the data they read changes.
Options whose own type is a function, e.g. `computeValue()` or `render()`, are
always called.

```js
title: {
  type: 'text',
  // A plain value:
  required: true,
  // A callback, evaluated with the context of the field:
  disabled: ({ item }) => item.isArchived
}
```

## SchemaBase

The options of all schemas: views, forms and fields.

| Option     | Type                          | Default | Description                                         |
| ---------- | ----------------------------- | ------- | --------------------------------------------------- |
| `panels`   | `Record<string, PanelSchema>` |         | Panels shown in the sidebar, see [`panel`](#panel). |
| `onChange` | `ItemEventHandler`            |         | Called after a change of a value is done. Bubbles.  |
| `onInput`  | `ItemEventHandler`            |         | Called for each edit that changes a value. Bubbles. |

The schemas that hold fields, views, forms, sections and panels, also
have `onInitialize()`, `onDestroy()` and `onLoad()`, see
[RouteSchemaBase](#routeschemabase). See [Events](./events.md) for when each
event fires and what return values mean.

## FieldSchemaBase

The options of all field types, in addition to `SchemaBase`. Whether a
type uses an option depends on the type: `autocomplete` applies to text inputs,
`minLength`, `maxLength` and `pattern` to text values, `minItems` and
`maxItems` to lists and fields with multiple values, `placeholder` to text
inputs and selects, `clearable` to inputs that can be cleared.

| Option             | Type                                                                | Default                                                                            | Description                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `string`                                                            |                                                                                    | The field type. Required.                                                                                                                                                                                                                                                                                                                                                                    |
| `name`             | `string`                                                            | the key                                                                            | The key of the value in the item. Set from the key in `fields`.                                                                                                                                                                                                                                                                                                                              |
| `label`            | `SchemaValue<TextOrHtml \| boolean \| { text?, prefix?, suffix? }>` | the labelized name                                                                 | The label, see [Text and HTML](#text-and-html). `false` hides it. The object form adds [affixes](#affixes). Buttons, labels, panels, sections and spacers don't generate one.                                                                                                                                                                                                                |
| `if`               | `SchemaValue<boolean>`                                              | `true`                                                                             | Renders the field only if `true`. Values of fields that aren't rendered aren't computed.                                                                                                                                                                                                                                                                                                     |
| `visible`          | `SchemaValue<boolean>`                                              | `true`, `false` for `value`                                                        | Shows or hides the field. Hidden fields keep their value.                                                                                                                                                                                                                                                                                                                                    |
| `default`          | `SchemaValue`                                                       | the type's default                                                                 | The value used when the item lacks the key, e.g. in new items. Values that aren't `nullable` also use it for `null`, see [Empty values](#empty-values).                                                                                                                                                                                                                                      |
| `computeValue`     | `SchemaValueCallback`                                               |                                                                                    | Computes the value reactively into the data, also when the field isn't shown, unless `if` is `false`. Returning `undefined` keeps the current value.                                                                                                                                                                                                                                         |
| `formatValue`      | `SchemaValueCallback`                                               |                                                                                    | Converts the value for display.                                                                                                                                                                                                                                                                                                                                                              |
| `parseValue`       | `SchemaValueCallback`                                               |                                                                                    | Converts the edited value before it's written into the data.                                                                                                                                                                                                                                                                                                                                 |
| `deserializeValue` | `SchemaValueCallback`                                               |                                                                                    | Converts the stored value when data is loaded, merged from a save response, reset with `resetItem()`, merged with `mergeItem()`, pasted or read from the query, after the type's own conversion. Its `item` holds the new data, while `rootItem` still holds the data from before.                                                                                                           |
| `serializeValue`   | `SchemaValueCallback`                                               |                                                                                    | Converts the value for the server and the clipboard, after the type's own conversion. Returning `undefined` leaves out the key.                                                                                                                                                                                                                                                              |
| `exclude`          | `SchemaValue<boolean>`                                              | `false`; `true` for buttons, labels, spacers and sources with their own `resource` | Leaves the value out of the data sent to the server. Changes of excluded values don't make the data dirty.                                                                                                                                                                                                                                                                                   |
| `required`         | `SchemaValue<boolean>`                                              | `false`                                                                            | Validates that there is a value: not `null` or `''`. `false` is an answer, so checkboxes only fail while they're not answered, and switches and checkboxes with [`nullable: false`](#empty-values) never. Arrays need one item, failing with "is required", see [Validation](../../guide/admin/validation.md#types-and-limits-of-fields). The labels of required fields are marked with `*`. |
| `validate`         | `(context) => boolean \| string \| void`                            |                                                                                    | Validates values that aren't empty, with the value after `formatValue()`. Returning `false` fails with "is invalid", a string fails with it as the message, e.g. `'must have 13 digits'`. See [Validation](../../guide/admin/validation.md#custom-validation).                                                                                                                               |
| `readonly`         | `SchemaValue<boolean>`                                              | `false`                                                                            | Text inputs become read-only, all other fields disabled.                                                                                                                                                                                                                                                                                                                                     |
| `disabled`         | `SchemaValue<boolean>`                                              | `false`                                                                            | Disables the field. Disabled sections and panels disable all fields inside them, also nested ones. Loading forms and views don't disable their fields.                                                                                                                                                                                                                                       |
| `autofocus`        | `SchemaValue<boolean>`                                              | `false`                                                                            | Focuses the input when rendered.                                                                                                                                                                                                                                                                                                                                                             |
| `labelledBy`       | `SchemaValue<string>`                                               |                                                                                    | The id of the element that labels the field, for fields without their own label, set as `aria-labelledby` of the input.                                                                                                                                                                                                                                                                      |
| `clearable`        | `SchemaValue<boolean>`                                              | `false`                                                                            | Adds a button that clears the value to the [empty value](#empty-values) of the type, e.g. `null`, or `[]` with `multiple`, or to the `default` with [`nullable: false`](#empty-values). Ignored while `readonly`.                                                                                                                                                                            |
| `placeholder`      | `SchemaValue<string>`                                               |                                                                                    | The hint shown in empty inputs, and in selects while no option is selected. Multiselects also take `false`, see [`multiselect`](#multiselect).                                                                                                                                                                                                                                               |
| `info`             | `SchemaValue<TextOrHtml>`                                           |                                                                                    | Info shown in a tooltip next to the label, see [Text and HTML](#text-and-html). Line breaks in text show.                                                                                                                                                                                                                                                                                    |
| `minLength`        | `SchemaValue<number>`                                               |                                                                                    | The minimum length of text values, in characters. `1` rejects `''`, but not `null`, which only `required` rejects.                                                                                                                                                                                                                                                                           |
| `maxLength`        | `SchemaValue<number>`                                               |                                                                                    | The maximum length of text values, in characters, validated and set as the `maxlength` of text inputs.                                                                                                                                                                                                                                                                                       |
| `pattern`          | `SchemaValue<string>`                                               |                                                                                    | A regular expression that text values need to match, as a string like the server's `pattern`, e.g. `'^[A-Z]{2}$'`.                                                                                                                                                                                                                                                                           |
| `minItems`         | `SchemaValue<number>`                                               |                                                                                    | The minimum number of items of lists and fields with multiple values.                                                                                                                                                                                                                                                                                                                        |
| `maxItems`         | `SchemaValue<number>`                                               |                                                                                    | The maximum number of items of lists and fields with multiple values.                                                                                                                                                                                                                                                                                                                        |
| `autocomplete`     | `SchemaValue<'on' \| 'off'>`                                        |                                                                                    | The `autocomplete` attribute of text inputs. Fields without a credential token like `username`, `current-password`, `new-password` or `one-time-code` also tell password managers to ignore them.                                                                                                                                                                                            |
| `width`            | `SchemaValue<…>`                                                    | `1` (full); `'auto'` for buttons, `checkboxes`, `radio`, `switch`                  | See [Layout options](#layout-options).                                                                                                                                                                                                                                                                                                                                                       |
| `align`            | `SchemaValue<'top' \| 'center' \| 'bottom'>`                        | `'top'`                                                                            | See [Layout options](#layout-options).                                                                                                                                                                                                                                                                                                                                                       |
| `break`            | `'before' \| 'after' \| 'both'`                                     |                                                                                    | Forces a line break before or after the field.                                                                                                                                                                                                                                                                                                                                               |
| `class`            | `string \| Record<string, boolean>`                                 |                                                                                    | CSS classes added to the field's container.                                                                                                                                                                                                                                                                                                                                                  |
| `onFocus`          | `ItemEventHandler`                                                  |                                                                                    | Called when the input receives focus.                                                                                                                                                                                                                                                                                                                                                        |
| `onBlur`           | `ItemEventHandler`                                                  |                                                                                    | Called when the input loses focus. The value is validated first.                                                                                                                                                                                                                                                                                                                             |

```js
price: {
  type: 'number',
  label: 'Price (EUR)',
  width: '1/3',
  required: true,
  decimals: 2,
  readonly: ({ item }) => item.isArchived,
  serializeValue: ({ value }) => Math.round(value * 100) // In cents
}
```

### `nested`

`nested` is an option of [`section`](#section) and
[`panel`](#panel): `true` stores their values in an object
under their own name (`item.address.city`) instead of on the item itself.
Fields and other types that store their value under their name throw
`Unsupported schema key 'nested' in '…': Only sections and panels support it.`
when it is set, and so do panels with their own `data`.

### Layout options

Fields are laid out in lines, which hold fields until their widths
exceed 100%.

| `width` value                     | Meaning                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `number` between 0 and 1, `'1/3'` | A fraction of the line.                                      |
| `'20%'`                           | A percentage of the line.                                    |
| `'auto'`                          | As wide as the content.                                      |
| `'fill'`                          | Fills the space left in the line.                            |
| `'>50%'`, `'<50%'`                | The width, growing (`>`) or shrinking (`<`) to fit the line. |
| `'200px'`                         | A width in CSS units.                                        |

`align` places a field vertically in its line, when other fields in it are
taller: `'top'` (the default), `'center'` or `'bottom'`. The label moves with
the field.

### Text and HTML

Everything that schemas and callbacks give the admin to show is text, unless
it's created with the [`html`](../utils.md#html) template of `@ditojs/utils`:
labels, item labels, info, affixes, the results of `render()`, the messages of
`confirm()`, `prompt()` and `alert()`, and the paragraphs of `notify()`.
Strings show as they are, also when they contain tags. Only `html` renders
tags, and it escapes the values that it includes, so data can't inject HTML.
These options are `TextOrHtml`: a string, `html`, or `{ text }`.

```js
import { html } from '@ditojs/utils'

title: { type: 'text', label: 'Title & Subtitle' },
isbn: { type: 'text', label: html`<abbr>ISBN</abbr>` },
author: { type: 'text', info: ({ item }) => html`By <b>${item.author}</b>` }
```

Where labels show as text, e.g. in tabs, the menu, the trail, column headers
and accessible names, `html` shows its text without the tags. Prettier formats `html` templates as HTML by default,
which changes their whitespace, so apps that use them may want to set
`embeddedLanguageFormatting: 'off'` for their JavaScript and TypeScript files.

### Removed keys

Keys that 4.0 removed, e.g. the callbacks `format()` and `compute()`, or
`methods`, `watch` and `relateBy`, throw when a schema still uses them, naming
the replacement, see the [upgrade guide to 4.x](../../upgrading-to-4.x.md#admin-schemas).
Keys that 6.0 removed aren't checked: the
[upgrade guide to 6.x](../../upgrading-to-6.x.md#admin) lists them.

## RouteSchemaBase

The options of views and forms, in addition to `SchemaBase`. Inlined forms and
dialogs use them too. Views and forms have no `resource`: forms load and save
through the list or object that holds them, see [`resource`](#source-options)
of sources.

| Option         | Type                            | Default                                                | Description                                                         |
| -------------- | ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `buttons`      | [`Buttons`](#button-submit)     |                                                        | Buttons at the bottom. Forms merge them into their default buttons. |
| `if`           | `SchemaValue<boolean>`          | `true`                                                 | Renders the view or form only if `true`.                            |
| `wide`         | `SchemaValue<boolean>`          | `false`                                                | Uses a wider content area.                                          |
| `breadcrumb`   | `string`                        | the label, in forms after the verb, e.g. `'Edit Book'` | The text in the navigation trail.                                   |
| `clipboard`    | [`ClipboardConfig`](#clipboard) |                                                        | Adds copy and paste buttons for the data.                           |
| `onInitialize` | `ItemEventHandler`              |                                                        | Called when the schema's components are set up.                     |
| `onDestroy`    | `ItemEventHandler`              |                                                        | Called when the schema is unmounted.                                |
| `onLoad`       | `ItemEventHandler`              |                                                        | Called after data was loaded from the API.                          |
| `onClick`      | `ItemEventHandler`              |                                                        | Called when a button inside is clicked, as clicks bubble.           |

## Resource

```ts
type Resource =
  | string
  | ResourceOptions
  | ((defaults: Record<string, any>) => string | ResourceOptions)

type ResourceOptions = {
  path?: string
  method?: HttpMethod
  data?: unknown
  query?: Record<string, …>
}
```

A resource names an API path, relative to the resource of the schema around
it, or absolute with a leading `/`. The object form also sets the HTTP method,
request data and query parameters; at least one key is required. A function
receives the defaults of the request, e.g. its `method`, and returns either.

```js
resource: 'books'
resource: { path: '/books/import', method: 'post' }
```

## Fields

Fields that edit a single value. All of them have the
[field options](#fieldschemabase). Unless noted, their
default value is `null`, see [Empty values](#empty-values).

Events of all fields: `onFocus`, `onBlur`, `onInput` and `onChange`, see
[Events](./events.md). Other `on…` handlers, e.g. `onKeydown`, are added to
the input element as native event listeners.

### Empty values

Fields store no value as `null`, unless their type notes another default
value, e.g. `false` for `switch`. For properties that aren't `nullable` on the
server, string fields (`text` and its variants, `textarea`, `code` and
`markup`) and `checkbox` take `nullable: false`: string fields then store `''`
instead, checkboxes `false`. For checkboxes, `null` is the state of not being
answered yet, while `false` is an answer.

```js
subtitle: { type: 'text', nullable: false },
isArchived: { type: 'checkbox', nullable: false }
```

Fields with `nullable: false`, and fields whose empty value isn't `null`, e.g.
lists and switches, replace `null` with their `default`, else with their empty
value, when the data is loaded, added or saved. A `null` that is written while
editing, e.g. by `computeValue()`, stays in the data until then.

### Affixes

Text inputs, numbers, dates, colors, selects, multiselects and buttons accept
`prefix` and `suffix` (`AffixSettings`): one affix or an array of them, shown
before or after the input.

| Affix                                                           | Description                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `'text'`, `` html`…` ``                                         | Text or HTML, see [Text and HTML](#text-and-html).                                          |
| `{ text, as? }`                                                 | Text or HTML, in an element of the tag `as` (default `div`).                                |
| `{ type: 'icon', name }`                                        | An icon of [@ditojs/ui](../ui.md).                                                          |
| `{ type: 'spinner', size?, color? }`                            | A loading spinner.                                                                          |
| `{ type: 'component', component, props? }`                      | A Vue component.                                                                            |
| `{ type: 'button', text \| icon, title?, disabled?, onClick? }` | A button showing the text or the icon, whose `onClick()` receives the context of the field. |

Each affix can have `if: SchemaValue<boolean>`, `class` and `style`. Objects
with `text` don't need a `type`. With `hover: true`, an affix only shows while
the input is hovered, in place of the other affixes of its side, which keep
their space. Clearable fields show their clear button this way in the suffix.

```js
price: {
  type: 'number',
  prefix: '€',
  suffix: { text: 'incl. VAT', if: ({ item }) => item.includesVat }
}
```

### text

`InputSchema`. The types `text`, `email`, `url`, `hostname`, `domain`, `tel`,
`password` and `creditcard` render a text input. All but `text` and `tel`
validate the format of their name. `url` requires a scheme, e.g. `https://`,
as the server's `uri` format does.

| Option             | Type                                                                                          | Default | Description                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `type`             | `'text' \| 'email' \| 'url' \| 'hostname' \| 'domain' \| 'tel' \| 'password' \| 'creditcard'` |         | Required.                                                                             |
| `trim`             | `boolean`                                                                                     | `false` | Trims whitespace from the value when it's serialized.                                 |
| `nullable`         | `boolean`                                                                                     | `true`  | `false` stores no value as `''` instead of `null`, see [Empty values](#empty-values). |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>`                                                                      |         | See [Affixes](#affixes).                                                              |

Empty strings are serialized as the default value. `password` fields show a
mask while they have no value, and items that lack the key don't get one, as
the server doesn't send passwords.

Text fields edit strings. Read-only fields that display other values through
`formatValue()`, e.g. dates, prices or lists, are [`value`](#value) fields
with `visible: true`.

```js
email: { type: 'email', required: true, trim: true },
website: { type: 'url', placeholder: 'https://' }
```

### textarea

`TextareaSchema`. A multi-line text input.

| Option      | Type                   | Default | Description                                                                           |
| ----------- | ---------------------- | ------- | ------------------------------------------------------------------------------------- |
| `type`      | `'textarea'`           |         | Required.                                                                             |
| `lines`     | `SchemaValue<number>`  | `4`     | The number of visible lines.                                                          |
| `resizable` | `SchemaValue<boolean>` | `false` | Whether the input can be resized.                                                     |
| `trim`      | `boolean`              | `false` | Trims whitespace from the value when it's serialized.                                 |
| `nullable`  | `boolean`              | `true`  | `false` stores no value as `''` instead of `null`, see [Empty values](#empty-values). |

```js
summary: { type: 'textarea', lines: 6, maxLength: 1000 }
```

### number, integer

`NumberSchema`. A number input. `integer` only accepts whole numbers.

| Option             | Type                            | Default    | Description                                                                                                     |
| ------------------ | ------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `type`             | `'number' \| 'integer'`         |            | Required.                                                                                                       |
| `minimum`          | `SchemaValue<number>`           | `range[0]` | The minimum value.                                                                                              |
| `maximum`          | `SchemaValue<number>`           | `range[1]` | The maximum value.                                                                                              |
| `range`            | `SchemaValue<[number, number]>` |            | The minimum and maximum value.                                                                                  |
| `step`             | `SchemaValue<number>`           |            | The step of the input. Without `decimals`, a whole step validates whole numbers, a fractional one its decimals. |
| `decimals`         | `SchemaValue<number>`           |            | The maximum number of decimals.                                                                                 |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>`        |            | See [Affixes](#affixes).                                                                                        |

`integer` rounds `minimum` down and `maximum` and `step` up to whole numbers.

```js
stock: { type: 'integer', minimum: 0 },
price: { type: 'number', step: 0.01, prefix: '€' }
```

### slider

`SliderSchema`. A range slider, with the [number options](#number-integer)
except the affixes.

| Option  | Type                   | Default | Description                              |
| ------- | ---------------------- | ------- | ---------------------------------------- |
| `type`  | `'slider'`             |         | Required.                                |
| `input` | `SchemaValue<boolean>` | `true`  | Shows a number input next to the slider. |

```js
rating: { type: 'slider', range: [1, 5], step: 1 }
```

### progress

`ProgressSchema`. A progress bar showing the value, with the
[number options](#number-integer) except the affixes. `range` sets the values
of empty and full, `step` rounds the value.

```js
completion: { type: 'progress', range: [0, 100], readonly: true }
```

### checkbox

`CheckboxSchema`. A checkbox for a boolean value.

| Option     | Type         | Default | Description                                                                              |
| ---------- | ------------ | ------- | ---------------------------------------------------------------------------------------- |
| `type`     | `'checkbox'` |         | Required.                                                                                |
| `nullable` | `boolean`    | `true`  | `false` stores no value as `false` instead of `null`, see [Empty values](#empty-values). |

```js
isArchived: { type: 'checkbox', label: 'Archived' }
```

### switch

`SwitchSchema`. A toggle switch for a boolean value. Its default value is
`false`, its default width `'auto'`.

| Option   | Type                                       | Default | Description                                                                                        |
| -------- | ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| `type`   | `'switch'`                                 |         | Required.                                                                                          |
| `labels` | `{ checked?: string, unchecked?: string }` |         | Shows text in the switch, `'on'` and `'off'` for missing keys. Without `labels`, no text is shown. |

```js
isAvailable: { type: 'switch', labels: { checked: 'yes', unchecked: 'no' } }
```

### date, datetime, time

`DateSchema`. A date, date and time, or time picker.

| Option             | Type                                                    | Default       | Description                                                                                                 |
| ------------------ | ------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`             | `'date' \| 'datetime' \| 'time'`                        |               | Required.                                                                                                   |
| `formats`          | `SchemaValue<{ date?: DateFormat, time?: TimeFormat }>` | `api.formats` | The display formats, merged over the admin's `api.formats`. See `format()` in [@ditojs/utils](../utils.md). |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>`                                |               | See [Affixes](#affixes).                                                                                    |

Loaded values become `Date` objects; dates without a time are read in the
local time zone. Strings that code writes into the data are shown as dates and
sent unchanged. When saving, `date` values without a time of day are sent as
plain dates (`'2026-10-13'`), while timestamps that a `date` field displays keep
their time and are sent as ISO strings, like `datetime` and `time` values.
Invalid dates and strings that aren't dates, e.g. times like `'14:30'`, fail
validation.

```js
publishedAt: {
  type: 'date',
  formats: { date: { day: 'numeric', month: 'short', year: 'numeric' } }
}
```

### color

`ColorSchema`. A color picker.

| Option             | Type                       | Default         | Description                             |
| ------------------ | -------------------------- | --------------- | --------------------------------------- |
| `type`             | `'color'`                  |                 | Required.                               |
| `colorFormat`      | `SchemaValue<ColorFormat>` | `'hex'`         | The format of the value, see below.     |
| `alpha`            | `SchemaValue<boolean>`     | `false`         | Shows the alpha slider.                 |
| `inputs`           | `SchemaValue<boolean>`     | `true`          | Shows inputs to enter values, e.g. RGB. |
| `presets`          | `SchemaValue<string[]>`    | 16 basic colors | Colors to pick from, in any CSS format. |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>`   |                 | See [Affixes](#affixes).                |

| `colorFormat`      | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| `'hex'`, `'hex6'`  | `'#rrggbb'`, or `'#rrggbbaa'` with alpha below 1                  |
| `'hex3'`, `'hex4'` | `'#rgb'`, `'#rgba'` where the color allows it, else the long form |
| `'hex8'`           | `'#rrggbbaa'`                                                     |
| `'rgb'`            | `{ r, g, b, a }`                                                  |
| `'prgb'`           | `{ r, g, b, a }` with percentage strings                          |
| `'hsl'`, `'hsv'`   | `{ h, s, l, a }`, `{ h, s, v, a }`                                |

`colorFormat: 'name'` throws `Unsupported color format`. The server's
`type: 'color'` only accepts hex strings; properties holding the object
formats use `type: 'object'`.

```js
background: { type: 'color', alpha: true, presets: ['#ffffff', '#000000'] }
```

### code

`CodeSchema`. A code editor.

| Option       | Type                   | Default        | Description                                                                           |
| ------------ | ---------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `type`       | `'code'`               |                | Required.                                                                             |
| `language`   | `SchemaValue<string>`  | `'javascript'` | The language to highlight.                                                            |
| `indentSize` | `SchemaValue<number>`  | `2`            | The indentation size.                                                                 |
| `lines`      | `SchemaValue<number>`  | `3`            | The number of visible lines.                                                          |
| `resizable`  | `SchemaValue<boolean>` | `false`        | Whether the editor can be resized.                                                    |
| `nullable`   | `boolean`              | `true`         | `false` stores no value as `''` instead of `null`, see [Empty values](#empty-values). |

```js
customCss: { type: 'code', language: 'css', lines: 10, resizable: true }
```

### markup

`MarkupSchema`. A rich text editor, based on TipTap, whose value is HTML, and
`null` when the editor is empty, whatever empty nodes it holds. Every mark, node
and tool is off unless enabled.

| Option        | Type                                                                                      | Default      | Description                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `type`        | `'markup'`                                                                                |              | Required.                                                                                       |
| `marks`       | `{ bold?, italic?, underline?, strike?, small?, code?, subscript?, superscript?, link? }` |              | The inline formats to enable, each `boolean`.                                                   |
| `nodes`       | `{ blockquote?, codeBlock?, heading?, horizontalRule?, orderedList?, bulletList? }`       |              | The blocks to enable. `heading` is `true` for all levels, or an array of levels, e.g. `[2, 3]`. |
| `tools`       | `{ history?, footnotes? }`                                                                |              | Undo/redo and footnotes.                                                                        |
| `hardBreak`   | `boolean`                                                                                 | `false`      | Enter inserts a line break instead of a new paragraph.                                          |
| `whitespace`  | `SchemaValue<'collapse' \| 'preserve' \| 'preserve-all'>`                                 | `'collapse'` | How whitespace in the HTML is parsed.                                                           |
| `enableRules` | `SchemaValue<boolean \| { input: boolean, paste: boolean }>`                              | `false`      | Enables TipTap's input and paste rules, e.g. `**bold**`.                                        |
| `lines`       | `SchemaValue<number>`                                                                     | `10`         | The number of visible lines.                                                                    |
| `resizable`   | `SchemaValue<boolean>`                                                                    | `false`      | Whether the editor can be resized.                                                              |
| `nullable`    | `boolean`                                                                                 | `true`       | `false` stores no value as `''` instead of `null`, see [Empty values](#empty-values).           |

```js
summary: {
  type: 'markup',
  marks: { bold: true, italic: true, link: true },
  nodes: { heading: [2, 3], bulletList: true, orderedList: true },
  tools: { history: true }
}
```

### upload

`UploadSchema`. Uploads files to the server's upload resource for the field's
data path, and holds the file objects that the server returns. Saving waits
for running uploads, and files that failed to upload are left out.

| Option         | Type                                                     | Default                           | Description                                                                                                                                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | `'upload'`                                               |                                   | Required.                                                                                                                                                                                                                                                                                                        |
| `multiple`     | `SchemaValue<boolean>`                                   | `false`                           | Holds an array of files instead of one.                                                                                                                                                                                                                                                                          |
| `extensions`   | `SchemaValue<OrArrayOf<string \| RegExp>>`               |                                   | The allowed file extensions, e.g. `['jpg', 'png']`.                                                                                                                                                                                                                                                              |
| `accept`       | `SchemaValue<OrArrayOf<string>>`                         |                                   | The file types that the file picker offers, e.g. `'image/*'`. Only the picker filters by it: pasted, dropped and imported files are checked by `extensions` and `maxSize`.                                                                                                                                       |
| `maxSize`      | `SchemaValue<string \| number>`                          |                                   | The maximum file size, in bytes or as a string like `'200kB'` or `'1MiB'`.                                                                                                                                                                                                                                       |
| `draggable`    | `SchemaValue<boolean>`                                   | `false`                           | Lets multiple files be reordered.                                                                                                                                                                                                                                                                                |
| `deletable`    | `SchemaValue<boolean>`                                   | `false`                           | Adds delete buttons.                                                                                                                                                                                                                                                                                             |
| `thumbnails`   | `SchemaValue<boolean \| 'small' \| 'medium' \| 'large'>` | `true` when `thumbnailUrl` is set | Shows thumbnails of images, `true` meaning `'medium'`.                                                                                                                                                                                                                                                           |
| `thumbnailUrl` | `SchemaValue<string>`                                    | the file's `url` for images       | The thumbnail URL. Receives the file as `value`.                                                                                                                                                                                                                                                                 |
| `downloadUrl`  | `SchemaValue<string>`                                    | the file's `url`                  | The download URL of files without a `url`. Receives the file as `value`.                                                                                                                                                                                                                                         |
| `render`       | `SchemaValueCallback<TextOrHtml>`                        |                                   | Returns the text or `html` shown for each file, instead of its name and thumbnail, see [Text and HTML](#text-and-html). Receives the file as `value`.                                                                                                                                                            |
| `clipboard`    | [`ClipboardConfig`](#clipboard)                          |                                   | Adds copy and paste buttons for the files next to the upload button. Pasting adds the files that aren't in the field yet, or replaces the file of single uploads, and leaves out files that `extensions` and `maxSize` don't accept. Files paste into all upload fields, also of other storages, as `{ files }`. |

```js
samplePages: {
  type: 'upload',
  multiple: true,
  accept: 'image/*',
  maxSize: '10MB',
  thumbnails: true,
  draggable: true,
  deletable: true
}
```

### value

`ValueSchema`. A value that is never edited, from `computeValue()`, `data` or
`dataPath`. It is invisible by default; `visible: true` shows the value in a
read-only input. Values are part of the data and sent to the server, unless
`exclude: true`.

| Option     | Type               | Default | Description                                                                                                                                                            |
| ---------- | ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | `'value'`          |         | Required.                                                                                                                                                              |
| `data`     | `SchemaValue<any>` |         | The value, or a callback that returns it, also asynchronously.                                                                                                         |
| `dataPath` | `string`           |         | The data path of the value, relative to the item the field sits in, e.g. `'author/name'`, or absolute with a leading `/`. `..` goes up a level; above the root throws. |

```js
// In the customer form:
fullName: {
  type: 'value',
  computeValue: ({ item }) => `${item.firstName} ${item.lastName}`,
  exclude: true
},
// In the book form:
authorName: { type: 'value', dataPath: 'author/name', exclude: true }
```

### component

`ComponentSchema`. Renders a custom Vue component as a field.

| Option      | Type                       | Default | Description                                                                |
| ----------- | -------------------------- | ------- | -------------------------------------------------------------------------- |
| `type`      | `'component'`              |         | Required.                                                                  |
| `component` | `Resolvable<VueComponent>` |         | The component, also as a promise, e.g. `import('./Rating.vue')`. Required. |

The component receives the props of `CustomComponentProps` and emits the
events of `CustomComponentEmits`:

| Prop              | Type              | Description                                                    |
| ----------------- | ----------------- | -------------------------------------------------------------- |
| `schema`          | `ComponentSchema` | The schema, whose values `context.getSchemaValue()` reads.     |
| `context`         | `SchemaContext`   | The context of the field.                                      |
| `modelValue`      | `any`             | The value, after `formatValue()`.                              |
| `errorsElementId` | `string \| null`  | The id of the element showing the errors, while there are any. |

| Emit                | Description                                                                      |
| ------------------- | -------------------------------------------------------------------------------- |
| `update:modelValue` | Changes the value, through `parseValue()`, and emits the schema's `input` event. |
| `change`            | Ends the change, and emits the schema's `change` event.                          |
| `focus`, `blur`     | Emit the schema's events; `blur` also validates.                                 |

The component's root element gets the id that the label points to. Missing
props or emits of this contract are reported as warnings in development. The
field has no value unless its schema has a `default`.

```vue
<script setup>
defineProps({ schema: Object, context: Object, modelValue: Number })
const emit = defineEmits(['update:modelValue', 'change'])
const setRating = rating => {
  emit('update:modelValue', rating)
  emit('change')
}
</script>
```

```js
rating: { type: 'component', component: import('./Rating.vue'), default: 0 }
```

## Options

Fields that select from options: `select`, `multiselect`, `radio` and
`checkboxes`. They have the
[field options](#fieldschemabase) and the
[selection options](#selection-options).

Events: `onFocus`, `onBlur`, `onInput` and `onChange`, see
[Events](./events.md).

### Selection options

`SelectionSettings`.

| Option     | Type                   | Default | Description                                                                                                                                                                             |
| ---------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`  | `SchemaOptions`        |         | The options: an array, or an object that loads them, see [The options object](#the-options-object).                                                                                     |
| `relate`   | `boolean \| string`    |         | Selects related objects: the whole option is the value while editing, and only its id is sent when saving. `true` relates by `id`, a string by the key it names, e.g. `relate: 'code'`. |
| `editable` | `SchemaValue<boolean>` | `false` | Adds a button that edits the selected option in the form of `view`. Radio buttons and checkboxes show one per option. Needs `view`.                                                     |
| `view`     | `string`               |         | The name of the view whose form edits the options.                                                                                                                                      |

Values whose option is missing, e.g. after the options changed, are kept:
selects show them as unavailable, multiselects mark their tags.

#### The options object

An array of options: plain values, which are their own labels, or
`{ label, value }` objects. Or a function, short for `{ data }`. Or an object:

| Key        | Type                                    | Default                                      | Description                                                                                                                                                            |
| ---------- | --------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`     | `SchemaValue<OrPromiseOf<any[]>>`       |                                              | The options, or a callback that loads them. A callback can return another callback, which loads the data while the outer one only tracks the reactive values it reads. |
| `dataPath` | `string`                                |                                              | Takes the options from the edited data, relative to the item the field sits in, or absolute with a leading `/`. `..` goes up a level.                                  |
| `label`    | `string \| SchemaValueCallback<string>` | `'label'` for objects                        | The key of the option's label, or a callback receiving `option` in the context.                                                                                        |
| `value`    | `string \| SchemaValueCallback`         | the `relate` key, else `'value'` for objects | The key of the option's value, or a callback receiving `option`.                                                                                                       |
| `group`    | `string \| SchemaValueCallback<string>` |                                              | The key of the option's group, or a callback receiving `option`. Selects show groups in the dropdown, radio buttons and checkboxes in fieldsets.                       |
| `equals`   | `(context) => boolean`                  |                                              | Matches a value to an option, receiving `value` and `option` in the context.                                                                                           |

Options load independently of the component, also for `computeValue()`, so
context members that depend on components, e.g. `sourceQuery`, refer to the
form, view or dialog that holds the data. Options that don't resolve to an
array throw.

```js
status: {
  type: 'select',
  options: ['open', 'paid', 'shipped', 'cancelled']
},
author: {
  type: 'select',
  relate: true,
  options: {
    data: ({ request }) => request({ resource: '/authors', cache: 'local' }),
    label: 'name'
  }
},
featuredChapter: {
  type: 'select',
  relate: true,
  // The chapters edited in a list next to this select:
  options: { dataPath: 'chapters', label: 'title' }
}
```

### select

`SelectSchema`. A native select.

| Option             | Type                     | Default | Description              |
| ------------------ | ------------------------ | ------- | ------------------------ |
| `type`             | `'select'`               |         | Required.                |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>` |         | See [Affixes](#affixes). |

```js
format: {
  type: 'select',
  options: [
    { label: 'Hardcover', value: 'hardcover' },
    { label: 'Paperback', value: 'paperback' }
  ],
  placeholder: 'Choose a format',
  clearable: true
}
```

### multiselect

`MultiselectSchema`. A searchable dropdown that selects one or several
options.

| Option             | Type                                                               | Default                                                                                                                                  | Description                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `'multiselect'`                                                    |                                                                                                                                          | Required.                                                                                                                                                                                                                                                                                                                   |
| `multiple`         | `SchemaValue<boolean>`                                             | `false`                                                                                                                                  | Selects several options, held in an array, `[]` by default. A stored `null` loads as the `default`.                                                                                                                                                                                                                         |
| `searchable`       | `SchemaValue<boolean>`                                             | `true` with `search`, otherwise `false`                                                                                                  | Adds a search input that filters the options.                                                                                                                                                                                                                                                                               |
| `search`           | `SchemaValueCallback<OrPromiseOf<any[]>> \| { filter, debounce? }` |                                                                                                                                          | Loads the options for the search term instead of filtering them: `filter` receives `searchTerm` in the context and returns the options. `debounce` delays it, in milliseconds or as `{ delay, immediate? }`. Turns on `searchable`. Only multiselects support it, other types warn about it.                                |
| `stayOpen`         | `SchemaValue<boolean>`                                             | `false`                                                                                                                                  | Keeps the dropdown open after selecting.                                                                                                                                                                                                                                                                                    |
| `taggable`         | `SchemaValue<boolean \| { label?, value? }>`                       | `false`                                                                                                                                  | Lets the user add options by typing them and pressing Enter. The `label` and `value` callbacks of an object receive the typed text as `value` in the context and return the new option's label and value, e.g. `{ value: ({ value }) => underscore(value) }`. A converted value that matches an existing option selects it. |
| `placeholder`      | `SchemaValue<string \| boolean>`                                   | generated for searchable multiselects, from the label, e.g. `'Select or search Author'`, or `'Search or add a Tag'` when also `taggable` | `false` shows none, `true` the generated one.                                                                                                                                                                                                                                                                               |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>`                                           |                                                                                                                                          | See [Affixes](#affixes).                                                                                                                                                                                                                                                                                                    |

```js
genres: {
  type: 'multiselect',
  multiple: true,
  relate: true,
  searchable: true,
  options: {
    data: ({ request }) => request({ resource: '/genres' }),
    label: 'name'
  }
},
author: {
  type: 'multiselect',
  relate: true,
  search: {
    filter: ({ request, searchTerm }) =>
      request({ resource: '/authors', query: { search: searchTerm } }),
    debounce: 300
  },
  options: { label: 'name' }
}
```

### radio

`RadioSchema`. Radio buttons. Its default width is `'auto'`.

| Option   | Type                         | Default      | Description                   |
| -------- | ---------------------------- | ------------ | ----------------------------- |
| `type`   | `'radio'`                    |              | Required.                     |
| `layout` | `'horizontal' \| 'vertical'` | `'vertical'` | The direction of the buttons. |

```js
format: {
  type: 'radio',
  layout: 'horizontal',
  options: ['hardcover', 'paperback', 'ebook']
}
```

### checkboxes

`CheckboxesSchema`. A checkbox per option. Its default width is `'auto'`, its
default value `[]`, which a stored `null` loads as too.

| Option     | Type                         | Default      | Description                                                 |
| ---------- | ---------------------------- | ------------ | ----------------------------------------------------------- |
| `type`     | `'checkboxes'`               |              | Required.                                                   |
| `multiple` | `SchemaValue<boolean>`       | `true`       | `false` selects one option at most, held as a single value. |
| `layout`   | `'horizontal' \| 'vertical'` | `'vertical'` | The direction of the checkboxes.                            |

```js
// In the user form:
roles: {
  type: 'checkboxes',
  options: [
    { label: 'Editor', value: 'editor' },
    { label: 'Sales', value: 'sales' },
    { label: 'Admin', value: 'admin' }
  ]
}
```

## Layout

Fields that group, label or act rather than edit a value: `section`,
`panel`, `label`, `spacer`, `button` and `submit`. They have the
[field options](#fieldschemabase).

### section

`SectionSchema`. Groups fields, with an optional header. By default the
section's fields read and write the item that contains the section, and
the section has no value of its own. With `nested: true` they edit an object
stored under the section's name, e.g. `item.address`.

| Option        | Type                                    | Default | Description                                                                                                                                                                                                    |
| ------------- | --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`        | `'section'`                             |         | Required.                                                                                                                                                                                                      |
| `fields`      | `Fields \| SchemaValueCallback<Fields>` |         | The fields. A callback creates them from the context, e.g. fields that depend on a selected template; it runs again when the data that it reads changes, and its `item` is the item that contains the section. |
| `form`        | `ResolvableForm`                        |         | A form for the content, instead of `fields`, for form options like `tabs`.                                                                                                                                     |
| `forms`       | `Record<string, ResolvableForm>`        |         | Forms by item type, picked by `type` of the data, else `forms.default`.                                                                                                                                        |
| `tabs`        | `Record<string, object>`                |         | Shows the fields in [tabs](#tabs).                                                                                                                                                                             |
| `nested`      | `boolean`                               | `false` | Stores the section's values in an object under its name. Its default value is then `{}`.                                                                                                                       |
| `label`       | `SchemaValue<string \| boolean>`        |         | The header of the section. Sections don't generate labels from their name.                                                                                                                                     |
| `collapsible` | `SchemaValue<boolean>`                  | `false` | Adds a toggle to the header that collapses the section.                                                                                                                                                        |
| `collapsed`   | `SchemaValue<boolean>`                  | `false` | Whether the section is collapsed initially. Only with `collapsible`.                                                                                                                                           |
| `compact`     | `boolean`                               | `false` | Renders with reduced spacing; the label then shows outside the section.                                                                                                                                        |
| `clipboard`   | [`ClipboardConfig`](#clipboard)         |         | Adds copy and paste buttons for the section's data.                                                                                                                                                            |
| `component`   | `Resolvable<VueComponent>`              |         | Lays out the fields with this Vue component instead of in rows, see below. Not supported together with `tabs`, `collapsible` and `clipboard`.                                                                  |

Events: `onToggle()`, `onInitialize()`, `onDestroy()` and `onLoad()`, and
`onInput()`, `onChange()` and `onClick()` bubbling up from the section's
fields, see [Events](./events.md).

```js
details: {
  type: 'section',
  label: 'Details',
  collapsible: true,
  fields: {
    isbn: { type: 'text', width: '1/2' },
    stock: { type: 'integer', width: '1/2' }
  }
},
// In the customer form:
shippingAddress: {
  type: 'section',
  nested: true, // Stored in `item.shippingAddress`
  fields: {
    street: { type: 'text' },
    city: { type: 'text' },
    country: { type: 'text' }
  }
}
```

With `component`, the section's label shows above the component, which
receives the props `schema` and `context` of the section. It places the
fields with `DitoSchemaField` of `@ditojs/admin`, whose prop `name` is a
key of `fields`, and whose default slot is passed on to the custom
component of `type: 'component'` fields, and groups of them in rows with
`DitoPane`, whose prop `names` holds such keys, all of them by default. See
[Laying out fields](../../guide/admin/custom-types.md#laying-out-fields).

In TypeScript, declare the keys of sections without `nested` as `never` in the
item type, and those of nested sections as their object type, see
`Fields` in [Types](./types.md).

### panel

`PanelSchema`. A box in the sidebar. Panels are given in `panels` of any
schema, or as a field of `type: 'panel'`. Like sections, their fields
read and write the item around them by default; with `nested: true` they edit
an object stored under the panel's name, e.g. `item.details.title`. A panel
with its own `data` edits that data instead, and can't be nested.

| Option          | Type                               | Default                             | Description                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | `'panel'`                          |                                     | Required.                                                                                                                                                                                                                                                                                                                                   |
| `label`         | `SchemaValue<string \| boolean>`   | the labelized name                  | The header of the panel.                                                                                                                                                                                                                                                                                                                    |
| `fields`        | `Fields`                           |                                     | The fields of the panel.                                                                                                                                                                                                                                                                                                                    |
| `nested`        | `boolean`                          | `false`                             | Stores the panel's values in an object under its name, like nested sections. Throws together with `data`.                                                                                                                                                                                                                                   |
| `data`          | `SchemaValue<Record<string, any>>` |                                     | The panel's own data, e.g. of filters. Its edits don't make the form or view dirty, but writes through `rootItem` or `parentItem` change the data around the panel and count as edits. It is the `item` of the contexts inside the panel; `data()`, `if`, `visible`, `label` and `sticky` receive the context of the data around the panel. |
| `buttons`       | `Buttons`                          |                                     | Buttons at the bottom of the panel.                                                                                                                                                                                                                                                                                                         |
| `panelButtons`  | `Buttons`                          |                                     | Small buttons in the header.                                                                                                                                                                                                                                                                                                                |
| `sticky`        | `SchemaValue<boolean>`             | `false`                             | Keeps the header at the top while scrolling.                                                                                                                                                                                                                                                                                                |
| `if`, `visible` | `SchemaValue<boolean>`             | `true`                              | Renders or shows the panel. Panels of fields in tabs only show while their tab is selected.                                                                                                                                                                                                                                                 |
| `disabled`      | `boolean`                          | the disabled state around the panel | Disables the panel's fields and buttons.                                                                                                                                                                                                                                                                                                    |

Events: `onInitialize`, `onDestroy`, `onLoad`, and `onInput` and `onChange`
bubbling up from the panel's fields, see [Events](./events.md). Panels
with their own data don't pass events on.

```js
panels: {
  statistics: {
    type: 'panel',
    label: 'Statistics',
    sticky: true,
    fields: {
      wordCount: {
        type: 'value',
        visible: true,
        exclude: true,
        computeValue: ({ item }) => item.summary?.split(/\s+/).length ?? 0
      }
    }
  }
}
```

### label

`LabelSchema`. Shows text in the place of a field: its `label` if it has
one, or else its value, which is `TextOrHtml` as well, see
[Text and HTML](#text-and-html). It is excluded from the data sent to the
server.

```js
notice: { type: 'label', label: 'Prices include VAT.' }
```

### spacer

`SpacerSchema`. Empty space in a line of fields, as wide as its `width`.
It has no value.

```js
gap: { type: 'spacer', width: '1/3' }
```

### button, submit

`ButtonSchema`. A button. `submit` is a button that submits the data: forms,
views, dialogs and panels with a `submit` button can save, so only their data
can become dirty. The default `submit` button of forms saves the form, and a
`submit` button in a dialog resolves the dialog with its data. Other `submit`
buttons submit like `button`: to their `resource`, or through `onClick()`
calling `context.submit()`. Buttons are excluded from the data, their default
width is `'auto'`, and they don't generate labels.

| Option             | Type                     | Default                 | Description                                                                                                                                                                 |
| ------------------ | ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `'button' \| 'submit'`   | `'button'` in `buttons` | Required in `fields`.                                                                                                                                                       |
| `text`             | `SchemaValue<string>`    |                         | The text of the button. Buttons named after a verb, e.g. `cancel` or `delete`, are styled for it and, without `text`, labelled with it for assistive technology.            |
| `resource`         | [`Resource`](#resource)  |                         | A resource that the button submits the data to, relative to the resource of its form or source. Clicking submits unless `onClick()` returns a value other than `undefined`. |
| `closeForm`        | `SchemaValue<boolean>`   | `false`                 | Closes the form after a successful submit.                                                                                                                                  |
| `primary`          | `SchemaValue<boolean>`   | `false`                 | Gives the button the look of `submit` buttons, and the initial focus in dialogs without a `submit` button, without submitting.                                              |
| `prefix`, `suffix` | `OrArrayOf<SchemaAffix>` |                         | See [Affixes](#affixes).                                                                                                                                                    |

Events: `onClick`, `onSuccess`, `onError`, `onFocus`, `onBlur`, see
[Button events](./events.md#button-events). A button runs one click at a time,
see [`isRunning`](./context.md#isrunning).

`Buttons` maps names to button schemas whose `type` is optional:

```js
buttons: {
  archive: {
    text: 'Archive',
    resource: { path: 'archive', method: 'post' },
    closeForm: true,
    onSuccess({ notify, itemLabel }) {
      // Replaces dito's notification:
      notify({ type: 'success', text: `${itemLabel} was archived.` })
    }
  },
  export: {
    text: 'Export',
    onClick({ download, getResourceUrl }) {
      download({ url: `${getResourceUrl()}/export`, filename: 'book.pdf' })
    }
  }
}
```

## Lists and Objects

Sources hold items that are edited with forms: `list` and `tree-list` hold an
array of items, `object` and `tree-object` a single item. Their items are
loaded from their own `resource`, or are part of the data around them. All
sources share the [source options](#source-options), in addition to the
[field options](#fieldschemabase).

### Source options

`SourceSettings`.

| Option           | Type                                                                     | Default                                       | Description                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form`           | `ResolvableForm`                                                         |                                               | The [form](#form) that edits the items. Also a promise, a function or a module namespace of `import()`.                                                                                                                                                                                                                                                                                         |
| `forms`          | `Record<string, ResolvableForm>`                                         |                                               | Forms by item type, for items of several types: the form is picked by `item.type`, else `forms.default`. The create menu offers each form by its `creatable`, and greys out the `disabled` ones; their `if` and `visible` don't affect it.                                                                                                                                                      |
| `fields`         | `Fields`                                                                 |                                               | The fields of an inlined form, instead of `form`. Implies `inlined`.                                                                                                                                                                                                                                                                                                                            |
| `tabs`           | `Record<string, object>`                                                 |                                               | The [tabs](#tabs) of the inlined form of `fields`.                                                                                                                                                                                                                                                                                                                                              |
| `compact`        | `boolean`                                                                | `false`                                       | Renders the inlined form of `fields` with reduced spacing, with labels outside of it.                                                                                                                                                                                                                                                                                                           |
| `clipboard`      | [`ClipboardConfig`](#clipboard)                                          |                                               | Adds copy and paste buttons for all loaded items to the row of the label of lists, or to the row of their scopes and pagination without a label, and to the form of objects, unless the form sets its own `clipboard`. Lists with their own `resource` and tree lists don't support it.                                                                                                         |
| `view`           | `string`                                                                 |                                               | The name of a view whose form edits the items. Editing navigates to that view. Unknown names throw.                                                                                                                                                                                                                                                                                             |
| `resource`       | [`Resource`](#resource)                                                  |                                               | The API resource of the items. Sources with a resource save their items themselves and are excluded from the data around them, unless `exclude: false`, e.g. to save their order through `serializeValue()`. Inlined sources can't have one.                                                                                                                                                    |
| `inlined`        | `boolean`                                                                | `false`                                       | Edits the items in forms inside the source instead of routed forms.                                                                                                                                                                                                                                                                                                                             |
| `collapsible`    | `SchemaValue<boolean \| 'all'>`                                          | `false`                                       | Whether inlined forms can be collapsed. `'all'` on lists also adds a double chevron before the label that expands or collapses all loaded items at once, or at the start of the row of the scopes and pagination without a label.                                                                                                                                                               |
| `collapsed`      | `SchemaValue<boolean>`                                                   | `false`                                       | Whether inlined forms are collapsed initially. Only with `collapsible`.                                                                                                                                                                                                                                                                                                                         |
| `creatable`      | `SchemaValue<boolean \| { label?, query? }>`                             | `false`                                       | Adds a button to create items. Needs a form or `view`; objects only while they're empty. `label` sets the button text, `query(context)` returns query parameters for the create route of routed forms.                                                                                                                                                                                          |
| `editable`       | `SchemaValue<boolean>`                                                   | `false`                                       | Adds edit buttons to items with routed forms.                                                                                                                                                                                                                                                                                                                                                   |
| `deletable`      | `SchemaValue<boolean>`                                                   | `false`                                       | Adds delete buttons, which ask first. Sources with a resource delete the item through it; others remove it from the data.                                                                                                                                                                                                                                                                       |
| `draggable`      | `SchemaValue<boolean>`                                                   | `false`                                       | Lets the items of lists be reordered by dragging.                                                                                                                                                                                                                                                                                                                                               |
| `orderKey`       | `string`                                                                 |                                               | The key that stores the order of dragged items. Items are numbered when loaded and when added, removed or moved.                                                                                                                                                                                                                                                                                |
| `itemLabel`      | `SchemaValue<TextOrHtml \| { text?, prefix?, suffix? }> \| false`        | the value of the first column, else of `name` | The label of items. A string names the item's key, or is the label itself when the item has no such key. Callbacks return text or `html`, see [Text and HTML](#text-and-html). Callbacks can also return objects with `prefix` and `suffix`, [affixes](#affixes) shown in the headers of inlined forms and in tree items. Items of lists without a label show their number. `false` shows none. |
| `render`         | `SchemaValueCallback<TextOrHtml>`                                        |                                               | Returns the text or `html` of items without inlined forms, instead of their label, see [Text and HTML](#text-and-html).                                                                                                                                                                                                                                                                         |
| `component`      | `Resolvable<VueComponent>`                                               |                                               | A Vue component that renders items without inlined forms. It receives `schema`, `context` and `modelValue` (the item).                                                                                                                                                                                                                                                                          |
| `columns`        | `Columns \| string[]`                                                    |                                               | The table columns of lists, see [Columns](#columns).                                                                                                                                                                                                                                                                                                                                            |
| `scopes`         | `string[] \| Record<string, string \| { label?, hint?, defaultScope? }>` |                                               | Buttons that switch between the model scopes of the list's resource. A string value is the label, `hint` the tooltip. The first scope, or the one with `defaultScope: true`, is selected by default.                                                                                                                                                                                            |
| `paginate`       | `SchemaValue<number>`                                                    |                                               | The number of items per page of lists. Without it all items are shown.                                                                                                                                                                                                                                                                                                                          |
| `page`           | `number`                                                                 | `0`                                           | The initial page, counted from 0.                                                                                                                                                                                                                                                                                                                                                               |
| `buttons`        | `Buttons`                                                                |                                               | Buttons of the source, see [`button`](#button-submit). Buttons with a `resource` submit to it relative to the source's resource.                                                                                                                                                                                                                                                                |
| `idKey`          | `string`                                                                 | `'id'`                                        | The key of the items' ids.                                                                                                                                                                                                                                                                                                                                                                      |
| `path`           | `string`                                                                 | the normalized name                           | The URL path of routed forms, after the names of the tabs, sections and panels around the source, e.g. `/admin/books/1/pricing/editions/0` for `editions` in the tab `pricing`. Of the sources of a form with the same URL path, the first one opens its forms, see [Routes of forms](#routes-of-forms).                                                                                        |
| `maxDepth`       | `number`                                                                 | `1`                                           | How often a form that contains itself is repeated before its sources stop rendering.                                                                                                                                                                                                                                                                                                            |
| `mutate`         | `boolean`                                                                | `false`                                       | Routed forms edit the parent's data directly instead of a draft. Their edits make the parent dirty right away, and they have no submit button.                                                                                                                                                                                                                                                  |
| `wrapPrimitives` | `string`                                                                 |                                               | Wraps primitive items, e.g. strings, in objects under this key for their forms, e.g. `'value'`. Throws together with `mutate` on routed forms.                                                                                                                                                                                                                                                  |

Events: `onInput` and `onChange`, which fire together for each edit of the
items, e.g. adding, removing or moving one, see [Events](./events.md). After
loading the items of its `resource`, a source fires `onLoad()` on the schema
that renders it, e.g. its view or form, not on itself. Inlined forms report
collapsing with the `onToggle()` of the form (`form: { onToggle() }`), not of
the list or object.

### list

`ListSchema`. A table of items. Its default value is `[]`, which a stored `null`
loads as too.

| Option    | Type                  | Default | Description                                                                                                       |
| --------- | --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `type`    | `'list'`              |         | Required.                                                                                                         |
| `filters` | `object`              |         | Filters shown in a panel in the sidebar, see [Filters](#filters).                                                 |
| `empty`   | `SchemaValue<string>` |         | The text of a row shown while the list has no items, e.g. `'No books yet.'`. Without it, empty lists show no row. |

```js
books: {
  type: 'list',
  resource: 'books',
  form: bookForm,
  columns: {
    title: { sortable: true, defaultSort: 'asc' },
    author: {
      render: ({ value }) => html`<b>${value?.name}</b>`
    }
  },
  filters: {
    title: { filter: 'text' },
    publishedAt: { filter: 'date-range' }
  },
  paginate: 50,
  creatable: true,
  editable: true,
  deletable: true
}
```

A list of items that are part of the item's data, edited inline:

```js
chapters: {
  type: 'list',
  inlined: true,
  draggable: true,
  orderKey: 'position',
  creatable: true,
  deletable: true,
  collapsible: true,
  itemLabel: ({ item }) => item.title || 'Untitled',
  fields: {
    title: { type: 'text' }
  }
}
```

#### Columns

`columns` maps keys of the items to `ColumnSchema`s, or lists the keys. A
`ColumnSchema` is a [`DisplaySchema`](#displayschema) with the options to sort:

| Option        | Type                      | Default | Description                                                                             |
| ------------- | ------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `sortable`    | `boolean`                 | `false` | Makes the column sortable, by the value.                                                |
| `defaultSort` | `true \| 'asc' \| 'desc'` |         | Sorts by this column by default, `true` meaning `'asc'`. The first column with it wins. |

Cells and headers get the classes `dito-cell--{name}` and
`dito-column--{name}`, with the name hyphenated.

#### DisplaySchema

`DisplaySchema` describes how a value of an item is displayed, read-only: in
the cells of the [columns](#columns) of lists, and in the `details` of
[tree items](#tree-list-tree-object).

| Option      | Type                                      | Default           | Description                                                                                                    |
| ----------- | ----------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `label`     | `TextOrHtml`                              | the labelized key | The label of the value, the header of columns.                                                                 |
| `render`    | `SchemaValueCallback<TextOrHtml \| null>` |                   | Returns the text or `html` of the value, see [Text and HTML](#text-and-html). Receives `value` in the context. |
| `component` | `Resolvable<VueComponent>`                |                   | A Vue component that renders the value.                                                                        |
| `class`     | `string`                                  |                   | CSS classes of the value's cell.                                                                               |
| `style`     | `string \| object`                        |                   | Styles of the value's cell.                                                                                    |
| `if`        | `SchemaValue<boolean>`                    | `true`            | Shows the value only if `true`.                                                                                |

#### Filters

`filters` maps the names of the model's filters on the server to filter
schemas. They render as a panel named Filters in the sidebar, with Clear and
Filter buttons. Applying them sets the list's `filter` query parameter, e.g.
`?filter=title:"contains","emma"`, which the server passes to the filters of
the model, see [Server API](../server/index.md). The query stays in the URL,
and changing filters resets the page.

| Filter                     | Options                       | Description                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ filter: 'text' }`       | `label`, `width`, `operators` | A text input, matching with `'contains'`. `operators` adds a select of the given operators of `'contains'`, `'equals'`, `'starts-with'` and `'ends-with'`, or of all of them for `true`; while no operator is chosen, the text matches like `'contains'`. |
| `{ filter: 'date-range' }` | `label`, `width`              | Two date-time inputs, `from` and `to`.                                                                                                                                                                                                                    |
| `{ fields }`               | `label`, `width`              | A custom filter: its fields' values are passed to the server's filter as arguments, in their order.                                                                                                                                                       |

`label` defaults to the labelized name; the labels of the filter's inputs
become their placeholders. `sticky: true` next to the filters keeps the
panel's header at the top while scrolling. Unknown filter types throw
`Invalid filter '…': Unknown filter type '…'.`

```js
filters: {
  title: { filter: 'text', operators: ['contains', 'starts-with'] },
  publishedAt: { filter: 'date-range', label: 'Published' },
  price: {
    label: 'Price',
    fields: {
      min: { type: 'number' },
      max: { type: 'number' }
    }
  },
  sticky: true
}
```

### object

`ObjectSchema`. A single item, edited in a routed or an inlined form. Its
default value is `null`.

| Option | Type       | Default | Description |
| ------ | ---------- | ------- | ----------- |
| `type` | `'object'` |         | Required.   |

```js
shippingAddress: {
  type: 'object',
  fields: {
    street: { type: 'text' },
    city: { type: 'text', width: '1/2' },
    country: { type: 'text', width: '1/2' }
  }
}
```

### tree-list, tree-object

`TreeListSchema`, `TreeObjectSchema`. Items with children, shown as a tree.
`tree-list` holds an array of root items, `tree-object` one root item. The
forms of the items are embedded next to the tree. Trees have the
[source options](#source-options) except the ones of inlined forms
(`inlined`, `fields`, `collapsible`, `collapsed`) and of tables
(`columns`, `paginate`, `render`, `component`), and they have no create button
or `buttons`. They add:

| Option      | Type                                | Default | Description                                                                                                                                                                 |
| ----------- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `'tree-list' \| 'tree-object'`      |         | Required.                                                                                                                                                                   |
| `children`  | `TreeListSchema & { name: string }` |         | The schema of each item's children; `name` is the key of the children array. It nests to any depth.                                                                         |
| `details`   | `Details`                           |         | Values shown under each item as `label: value` rows, opened with its toggle: keys of the item mapped to [`DisplaySchema`](#displayschema)s.                                 |
| `collapsed` | `SchemaValue<boolean>`              | `true`  | Whether items hide their children and details initially. A callback is called for each item. Items on the way to the open form are always expanded.                         |
| `onToggle`  | `ToggleEventHandler`                |         | Called when an item is collapsed or expanded, with `context.collapsed`. The tree's handler fires for its root items; set it on `children` for the items of the level below. |

`open` and `expanded` throw, naming `collapsed`, and `properties` throws,
naming `details`. `draggable`, `editable`, `deletable`, `itemLabel` and `form`
apply per level, on the tree and on `children`.

```js
genres: {
  type: 'tree-list',
  form: genreForm,
  editable: true,
  draggable: true,
  children: {
    name: 'children',
    form: genreForm,
    editable: true,
    draggable: true
  },
  onToggle({ item, collapsed }) {
    console.log(item.name, collapsed ? 'collapsed' : 'expanded')
  }
}
```

## Views, Forms and Dialogs

The schemas that hold fields: views are the pages of the admin, forms edit
the items of lists and objects, dialogs ask for input. All of them share the
options of [`SchemaBase` and `RouteSchemaBase`](#routeschemabase).

### view

`ViewSchema`. A page of the admin, listed in the navigation menu. The `views`
of [`DitoAdmin`](./admin.md) map names to views or menus.

| Option                                             | Type                      | Default             | Description                                                                                         |
| -------------------------------------------------- | ------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `type`                                             | `'view'`                  |                     | Required.                                                                                           |
| `name`                                             | `string`                  | the key in `views`  | The name of the view.                                                                               |
| `label`                                            | `SchemaValue<TextOrHtml>` | the labelized name  | The label in the menu and the trail.                                                                |
| `path`                                             | `string`                  | the normalized name | The URL path of the view.                                                                           |
| `field`                                            | `Field`                   |                     | A single field that the view displays, usually a list. It is named after the view and has no label. |
| `fields`                                           | `Fields`                  |                     | The fields of the view, instead of `field`.                                                         |
| `tabs`                                             | `Record<string, object>`  |                     | Shows groups of fields in tabs, see [Tabs](#tabs).                                                  |
| `buttons`, `if`, `wide`, `breadcrumb`, `clipboard` |                           |                     | See [RouteSchemaBase](#routeschemabase). `if` also blocks direct URL access.                        |

Events: `onInitialize`, `onDestroy`, `onLoad`, `onChange`, `onInput`,
`onClick`, see [Events](./events.md).

```js
const views = {
  books: {
    type: 'view',
    label: 'Books',
    field: {
      type: 'list',
      resource: 'books',
      form: bookForm,
      columns: ['title', 'author'],
      creatable: true,
      editable: true,
      deletable: true
    }
  }
}
```

A view with a single `field` acts on that field's list: the list's
forms are routed under the view's path, e.g. `/admin/books/1`.

### page

`PageSchema`. A view whose content is a Vue component, see
[Pages](../../guide/admin/views.md#pages).

| Option             | Type                       | Default             | Description                                                                                                          |
| ------------------ | -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `type`             | `'page'`                   |                     | Required.                                                                                                            |
| `name`             | `string`                   | the key in `views`  | The name of the page.                                                                                                |
| `label`            | `SchemaValue<TextOrHtml>`  | the labelized name  | The label in the menu and the trail.                                                                                 |
| `path`             | `string`                   | the normalized name | The URL path of the page, with route params, e.g. `'products/:id'`. Pages with required params have no menu item.    |
| `component`        | `Resolvable<VueComponent>` |                     | Required. The Vue component, e.g. `() => import('./Page.vue')`. It reads the page's context with `useDitoContext()`. |
| `if`, `breadcrumb` |                            |                     | See [RouteSchemaBase](#routeschemabase). `if` also blocks direct URL access.                                         |

### menu

`MenuSchema`. Groups views under one entry of the navigation menu.

| Option  | Type                                                         | Default           | Description                                                                                                                                                                                |
| ------- | ------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`  | `'menu'`                                                     |                   | Required.                                                                                                                                                                                  |
| `label` | `string`                                                     |                   | The label in the menu.                                                                                                                                                                     |
| `name`  | `string`                                                     | camelized `label` | The name of the group.                                                                                                                                                                     |
| `items` | `Record<string, View \| Promise<View>> \| array \| function` |                   | The views of the group, like the `views` of [`DitoAdmin`](./admin.md#parameters): also an array of `import()`s of modules that each export one named view, or a function returning either. |

```js
const views = {
  catalog: {
    type: 'menu',
    label: 'Catalog',
    items: {
      books: import('./views/books.js'),
      authors: import('./views/authors.js')
    }
  }
}
```

### form

`FormSchema`. Edits one item: the item of a list or object, or the item of a
view. `form` and `forms` of [lists and objects](#lists-and-objects) take form
schemas, also as promises, functions returning them, or module namespaces of
`import()`.

| Option                                  | Type                                 | Default            | Description                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                  | `'form'`                             |                    | Required.                                                                                                                                                                                                                                                                    |
| `name`                                  | `SchemaValue<string>`                |                    | The name of the item model, used in labels.                                                                                                                                                                                                                                  |
| `label`                                 | `SchemaValue<TextOrHtml \| boolean>` | the labelized name | The label of the form, e.g. in `'Edit Book'`.                                                                                                                                                                                                                                |
| `fields`                                | `Fields`                             |                    | The fields of the form. Can also be a callback that creates them from the context, which runs again when the data it reads changes.                                                                                                                                          |
| `properties`                            | `Record<string, object>`             |                    | The data of the form in the format of the server's model properties, instead of `fields`, laid out with [widgets](./widgets.md) in `component`, see [Forms with properties and widgets](../../guide/admin/widgets.md).                                                       |
| `component`                             | `Resolvable<VueComponent>`           |                    | A Vue component that lays out the form's `fields`, which it needs, as in [`section`](#section), or the widgets of its `properties`, and receives the props `schema` and `context` of the form, see [Laying out fields](../../guide/admin/custom-types.md#laying-out-fields). |
| `tabs`                                  | `Record<string, object>`             |                    | Shows groups of fields in tabs, see [Tabs](#tabs).                                                                                                                                                                                                                           |
| `idKey`                                 | `string`                             | `'id'`             | The key of the item's id.                                                                                                                                                                                                                                                    |
| `buttons`                               | `Buttons`                            |                    | Merged into the default buttons, see below.                                                                                                                                                                                                                                  |
| `creatable`                             | `SchemaValue<boolean>`               | `true`             | `false` leaves the form out of the source's create button and menu. Callbacks receive the context of the source: `item` is the item that holds the list or object, `value` the list or object.                                                                               |
| `editable`, `deletable`, `draggable`    | `SchemaValue<boolean>`               | `true`             | `false` disables the source's buttons of that action for the items of this form, e.g. in sources with several `forms`.                                                                                                                                                       |
| `disabled`                              | `SchemaValue<boolean>`               | `false`            | Greys out the form in the source's create menu, or disables the create button of a source with this single form.                                                                                                                                                             |
| `compact`                               | `boolean`                            | `false`            | Renders the form with reduced spacing when it's inlined, with the label outside of it.                                                                                                                                                                                       |
| `if`, `wide`, `breadcrumb`, `clipboard` |                                      |                    | See [RouteSchemaBase](#routeschemabase).                                                                                                                                                                                                                                     |

Events: `onSuccess`, `onError`, `onApply`, `onCancel`, `onToggle`, and
`onInitialize`, `onDestroy`, `onLoad`, `onChange`, `onInput`, `onClick`, see
[Form events](./events.md#form-events).

```js
export const bookForm = {
  type: 'form',
  label: 'Book',
  fields: {
    title: { type: 'text', required: true },
    author: {
      type: 'select',
      relate: true,
      options: {
        data: ({ request }) => request({ resource: '/authors' }),
        label: 'name'
      }
    },
    publishedAt: { type: 'date' }
  },
  onSuccess({ isCreating, itemLabel, notify }) {
    // Replaces dito's notification:
    notify({
      type: 'success',
      text: `${itemLabel} was ${isCreating ? 'created' : 'saved'}.`
    })
  }
}
```

#### Default buttons

Forms have a `cancel` button that closes the form, and a `submit` button that
saves or applies the data and closes the form (`closeForm: true`). Forms that
`mutate` their parent's data have no `submit` button. `buttons` is merged into
these: `submit: false` removes a default button, `onClick` replaces its
default action, and further keys add buttons.

```js
buttons: {
  submit: { text: 'Publish' },
  preview: {
    type: 'button',
    onClick: ({ item }) => window.open(`/books/${item.id}`)
  }
}
```

#### Kinds of forms

| Kind     | How                                                                                               | Behaviour                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routed   | `form` on a list or object                                                                        | Opens on its own page under the source's path, e.g. `/admin/books/1`.                                                                                                       |
| Inlined  | `inlined: true` or `fields` on a list or object                                                   | Rendered inside the list or object, one per item. `collapsible` and `collapsed` apply.                                                                                      |
| Nested   | `form` on a list or object without its own `resource`, whose items are part of the data around it | Routed. Edits a draft of the item that is applied to the parent's data on submit (`onApply`); the parent saves it. With `mutate: true` it edits the parent's data directly. |
| Embedded | the forms of `tree-list` and `tree-object` items                                                  | Routed, and shown next to the tree in the page of the form or view around it.                                                                                               |

#### Routes of forms

The paths below a view, form or page open the routed forms of the sources
that it renders: of the rendered sources, the first one whose `path`, after
the names of the tabs, sections and panels around it, matches opens its form. Collapsed
sections, tabs and panels render their content hidden while the path
continues into it, so links reach the sources in them. Paths that no source
claims lead back to the view, form or page once it rendered its components
with its data. The forms of items of items open once the parent item exists,
e.g. `/admin/books/1/chapters/0/notes/0` needs chapter `0`.

While a form is open, the view or form below which it opened stays mounted,
hidden, so its sources keep their state. Hidden sources load their items once
they're shown: a link into the form of an item doesn't load the list, the
form loads the item by its id. Closing the form returns to the list with its
query, e.g. `/admin/books?page=2`, and the list loads again only if the form
saved an item.

### Tabs

`tabs` of views, forms and sections map names to tab schemas: the options of
a form or view without `tabs` and `type`, plus:

| Option       | Type                   | Default            | Description                 |
| ------------ | ---------------------- | ------------------ | --------------------------- |
| `type`       | `'tab'`                |                    | Required.                   |
| `label`      | `string`               | the labelized name | The label of the tab.       |
| `defaultTab` | `SchemaValue<boolean>` | the first tab      | Selects this tab initially. |

The selected tab of a view or form is named in the URL after its path, e.g.
`/admin/books/1/metadata`, and the forms of the sources in a tab open below it.
The tabs of sections and inlined forms aren't in the URL. Tabs share these
names with the `path` of the sources of their form: give a source with the
name of a tab another `path`.

```js
tabs: {
  content: {
    type: 'tab',
    defaultTab: true,
    fields: { title: { type: 'text' }, summary: { type: 'textarea' } }
  },
  metadata: {
    type: 'tab',
    fields: { isbn: { type: 'text' } }
  }
}
```

### Dialogs

Dialogs are forms shown with
[`context.showDialog()`](./context.md#showdialog), which lists their
options.

### Clipboard

`clipboard` of views, forms, sections and objects adds copy and paste buttons
to their header, of lists to the header of their items, and of
[uploads](#upload) to the header of their files:

```ts
type ClipboardConfig =
  | boolean
  | {
      name?: string
      copy?: (context: SchemaContext) => unknown
      paste?: (context: SchemaContext) => unknown
      interchange?:
        | boolean
        | {
            filename?:
              | string
              | ((context: SchemaContext) => string | null)
          }
    }
```

For how to use it, see the [forms guide](../../guide/admin/forms.md#clipboard).
`true` copies the data, serialized like for the server, as JSON to the system
clipboard, and keeps it in the admin as a fallback for browsers that don't let
it read the clipboard. Data is only pasted into schemas of the same name and
kind, e.g. the items of a list only into lists of the same name, except for the
files of uploads, which paste into all uploads. The data of forms is named by
the first of: the form's `clipboard.name`, the `clipboard.name` of the list or
object of its item, the form's `name`, the name of the list or object. Lists
are named by their `clipboard.name`, or else by their name. So
`clipboard: { name }` lets lists of different names share their items.

- Copying leaves out the item's id, and the ids of the items of its lists, so
  that they paste as new items. Items that relations inside the copied data
  point to get new temporary ids instead, so the pasted relations point to the
  pasted items. Lists with their own resource are left out.
- Relations to records outside the copied data hold the labels of their
  options instead of ids, through `options.label`:
  `author: { $label: 'Jane Austen' }`, or an array of these for multiple
  values. Copying loads the options that aren't loaded yet.
- Pasting writes the copied values of the keys that the item has into it, as
  edits: lists are replaced, not added to. The item keeps its id and its
  position (`orderKey`). Each paste gives the related items fresh temporary
  ids, so pasting twice doesn't repeat them.
- Lists copy their loaded items as `{ items }`, each like the form of the item
  copies it, and only paste when they're `creatable`: the items are appended
  as new items, each with the form of its `type`, leaving out the items whose
  form isn't `creatable`.
- Pasting resolves the labels of related records to the option of the field
  whose label matches, ignoring case and whitespace. Labels that match no
  option or several paste `null`, or are left out of multiple values, and are
  listed in a notification.
- `copy()` receives the serialized data as `context.clipboardItem` and returns
  the data to copy. `paste()` receives the copied data as
  `context.clipboardItem` and returns the data to paste, which is then
  deserialized like loaded data. Both see the labels of related records, not
  their ids.
- `interchange: true` adds a menu to download the data with its files as a
  zip, and to upload such a zip again, see
  [Download and Upload](../../guide/admin/forms.md#download-and-upload). The
  zip is named after the form and item label, e.g. `Page Home.zip`, or after
  `interchange.filename`, a string or a function that receives the copied data
  as `context.clipboardItem`.

```js
clipboard: {
  copy: ({ clipboardItem: { title, genres } }) => ({ title, genres }),
  paste: ({ clipboardItem }) => ({
    ...clipboardItem,
    title: `${clipboardItem.title} (Copy)`
  })
}
```
