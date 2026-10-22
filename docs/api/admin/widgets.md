# Widgets

Widgets lay out forms with `properties` in Vue templates: the form of
`useDitoForm()` in `DitoSchemaForm`, and the `component` of nested forms with
`properties`. Each widget edits the property of its `name`, and renders the
component of a field type with its props as display options. The data
keywords, e.g. `required`, limits, `default` and `if`, are the property's, and
the TypeScript props reject them. See
[Forms with properties and widgets](../../guide/admin/widgets.md).

```js
import { DitoTextField, DitoListField } from '@ditojs/admin'
```

## Props of all widgets

| Prop | Type | Description |
| ---- | ---- | ----------- |
| `name` | `string` | The key of the property in the scope of the widget: the form, the object of a nested `DitoSection`, or the item of a list or object. Widgets without `name` edit the items of arrays of values. |
| `label` | `string \| false` | The label, by default the labelized `name`, or `false` for none. |
| `width` | `string \| number` | The width, as for [fields](./schemas.md#layout-options). |
| `info` | `string` | The info of the label. |
| `placeholder` | `string` | The placeholder of the input. |
| `prefix`, `suffix` | `string` | The [affixes](./schemas.md#affixes) of the input. |
| `clearable` | `boolean` | Whether the input shows a button that clears the value. |
| `readonly` | `boolean` | Whether the value is read-only. |
| `disabled` | `boolean` | Whether the widget is disabled. |
| `autofocus` | `boolean` | Whether the input is focused when the form opens. |
| `@change` | `(context) => void` | Emitted when the user changed the value, with the [context](./context.md) of the field. |

## Widgets

Each widget renders the component of the field type in its section. Its own
props are the options of that type, with the same meaning.

| Widget | Field type | Own props | Picks from the property |
| ------ | ---------- | --------- | ----------------------- |
| `DitoTextField` | [text](./schemas.md#text) | `type`: `text` (default), `email`, `url`, `hostname`, `domain`, `creditcard` or `password` | `maxLength` |
| `DitoTextareaField` | [textarea](./schemas.md#textarea) | `lines`, `resizable` | `maxLength` |
| `DitoCodeField` | [code](./schemas.md#code) | `language`, `indentSize`, `lines`, `resizable` | |
| `DitoMarkupField` | [markup](./schemas.md#markup) | `lines`, `resizable`, `whitespace`, `enableRules`, `hardBreak`, `marks`, `nodes`, `tools` | |
| `DitoNumberField` | [number, integer](./schemas.md#number-integer) | `step` | `integer` from `type`, `minimum`, `maximum`, `range` |
| `DitoSliderField` | [slider](./schemas.md#slider) | `step`, `input` | `minimum`, `maximum`, `range` |
| `DitoProgressField` | [progress](./schemas.md#progress) | | `minimum`, `maximum`, `range` |
| `DitoSwitchField` | [switch](./schemas.md#switch) | `labels` | |
| `DitoCheckboxField` | [checkbox](./schemas.md#checkbox) | | `nullable` |
| `DitoSelectField` | [select](./schemas.md#select) | `options`, `editable`, `view` | Options of `enum`, `multiple` of arrays, `relate` |
| `DitoRadioField` | [radio](./schemas.md#radio) | `options`, `editable`, `view`, `layout` | Options of `enum`, `relate` |
| `DitoCheckboxesField` | [checkboxes](./schemas.md#checkboxes) | `options`, `editable`, `view`, `layout` | Options of `items.enum`, `relate` |
| `DitoMultiselectField` | [multiselect](./schemas.md#multiselect) | `options`, `editable`, `view`, `placeholder` (also `false`), `searchable`, `search`, `stayOpen`, `taggable` | Options of `enum`, `multiple` of arrays, `relate` |
| `DitoDateField` | [date](./schemas.md#date-datetime-time) | `formats` | |
| `DitoTimeField` | [time](./schemas.md#date-datetime-time) | `formats` | Strings of `format: 'iso-time'` edit as times |
| `DitoDateTimeField` | [datetime](./schemas.md#date-datetime-time) | `formats` | |
| `DitoColorField` | [color](./schemas.md#color) | `colorFormat`, `alpha`, `inputs`, `presets` | |
| `DitoUploadField` | [upload](./schemas.md#upload) | `accept`, `extensions`, `maxSize`, `draggable`, `deletable`, `render`, `thumbnails`, `thumbnailUrl`, `downloadUrl` | `multiple` of arrays of assets |
| `DitoListField` | [list](./schemas.md#list) | `collapsible`, `collapsed`, `creatable`, `deletable`, `draggable`, `itemLabel` | The items of `items`, or of `forms` by their `type`, `orderKey`, `idKey` |
| `DitoObjectField` | [object](./schemas.md#object) | `collapsible`, `collapsed`, `creatable`, `deletable` | Create and delete buttons for `nullable` objects |
| `DitoTreeListField` | [tree-list](./schemas.md#tree-list-tree-object) | `collapsed`, `deletable`, `draggable`, `itemLabel` of its level | `orderKey`, `idKey` of each level |
| `DitoTreeLevel` | `children` of [tree-list](./schemas.md#tree-list-tree-object) | `name` (required), `collapsed`, `deletable`, `draggable`, `itemLabel` of its level | |
| `DitoSection` | [section](./schemas.md#section) | `name` (required), `nested`, `collapsible`, `collapsed` | |
| `DitoCustomField` | | | |

The label of all widgets shows the required mark of `required` properties, and
all widgets hide while their property's `if` is false.

### Slots

| Widget | Slot props | Description |
| ------ | ---------- | ----------- |
| `DitoListField` | `context` | The form of each item, in which widgets edit the item's properties. The slot receives the [context](./context.md) of the item itself, e.g. `v-slot="context"` with `context.item` and `context.itemIndex`. In arrays of values, `item` wraps the value as `item.value`. |
| `DitoObjectField` | `context` | The form of the object, with the [context](./context.md) of the object as for lists. |
| `DitoTreeListField`, `DitoTreeLevel` | `context` | `#form`: the form of the selected item of the level, routed beside the tree, with the [context](./context.md) of the item as for lists. The default slot holds the `DitoTreeLevel` of the next level, the array of its `name` in the items. |
| `DitoSection` | | The widgets of the section, of the object of its `name` if it's `nested`. `DitoSection` takes only `label`, `width` and `info` of the props of all widgets. |
| `DitoCustomField` | `field` | The content that edits the value, with the field as one reactive object, see below. |

### The field of `DitoCustomField`

| Member | Type | Description |
| ------ | ---- | ----------- |
| `field.value` | `any` | The value, which writes through the form's data, e.g. with `v-model="field.value"`. |
| `field.errors` | `{ message }[] \| null` | The errors of the value. |
| `field.property` | `object` | The property of the value. |
| `field.validate()` | `() => boolean` | Validates the value like the widgets do on blur, e.g. with `@blur="field.validate()"`, and returns whether it's valid. |

Destructured, e.g. with `v-slot="{ value }"`, the members are read-only.
