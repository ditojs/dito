# Types

The TypeScript types that `@ditojs/admin` exports. Most schema types take the
type of the edited item as `$Item`, which types the `item` of the contexts
that callbacks receive.

```ts
import type { FormSchema, SchemaContext } from '@ditojs/admin'

interface Book {
  id: number
  title: string
  price: number
}

export const bookForm: FormSchema<Book> = {
  type: 'form',
  fields: {
    title: { type: 'text', required: true },
    price: {
      type: 'number',
      decimals: 2,
      visible: ({ item }: SchemaContext<Book>) => item.title !== ''
    }
  }
}
```

## Admin and configuration

| Type | Description |
| ---- | ----------- |
| `DitoAdmin` | The admin class, see [DitoAdmin](./admin.md). |
| `GlobalConfig` | The global `dito` object: `base`, `api`, `settings`. |
| `ApiConfig` | The configuration of the admin's API layer. |
| `ApiResource` | A resource of the server API, with `type`, `path`, `method`, `id`, `parent` and `query`. |
| `Resource` | The `resource` option of schemas: a path, or an object with `path`, `method`, `data` and `query`. |
| `RequestMethod` | The signature of `api.request()`. |
| `RequestMethodResponse<T>` | A `Response` with the parsed `data`. |
| `HttpMethod` | `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, … in lower case. |

## Contexts

| Type | Description |
| ---- | ----------- |
| `AdminContext` | `admin.context`, see [AdminContext](./admin.md#admincontext). |
| `SchemaContext<$Item>` | The context of schema callbacks and event handlers, see [SchemaContext](./context.md). |
| `AdminUser` | The logged-in user, with `roles` and `hasRole()`. |

## Schema values and events

| Type | Description |
| ---- | ----------- |
| `SchemaValue<$Item, $Params, $ReturnValue>` | A schema option that takes a value or a `SchemaValueCallback` returning it. |
| `SchemaValueCallback<$Item, $Params, $ReturnValue>` | A callback that receives the `SchemaContext`, merged with `$Params`. |
| `ItemEventHandler<$Item>` | An event handler that receives the `SchemaContext`. |
| `ErrorEventHandler<$Item>` | An event handler whose context has the `error`. |
| `ToggleEventHandler<$Item>` | The `onToggle` handler of sections, inlined forms and trees, with `collapsed` in its context. |
| `SchemaEvents<$Item>` | The deprecated `events: {}` object of views and forms. Use the `on…` options. |
| `BaseSchemaEvents<$Item>` | The deprecated `events: {}` object of components, adding `focus` and `blur`. |
| `SchemaToggle<$Item>` | The `onToggle` option of collapsible schemas. |
| `SchemaRules` | The `rules` option, overriding and adding validations. |

See [Events](./events.md).

## Schemas

| Type | Description |
| ---- | ----------- |
| `View<$Item>` | A top-level view: `ViewSchema` or `MenuSchema`. |
| `ViewSchema<$Item>` | `type: 'view'`. |
| `MenuSchema<$Item>` | `type: 'menu'`, a group of views in the navigation. |
| `FormSchema<$Item>` | `type: 'form'`. |
| `ResolvableForm<$Item>` | A form, a record of forms, or a promise or function returning them. |
| `Component<$Item>` | The union of all component schemas. |
| `Components<$Item>` | A record of component schemas, keyed by the names of their values. |
| `SourceComponent<$Item>` | The union of the schemas that hold items: lists, objects and trees. |
| `SchemaByType<$Item>` | Maps each type name to its schema type. |
| `ButtonSchema<$Item>` | `type: 'button' \| 'submit'`. |
| `Buttons<$Item>` | A record of button schemas, whose `type` is optional. |
| `CheckboxSchema<$Item>` | `type: 'checkbox'`. |
| `CheckboxesSchema<$Item>` | `type: 'checkboxes'`. |
| `CodeSchema<$Item>` | `type: 'code'`. |
| `ColorSchema<$Item>` | `type: 'color'`. |
| `ColorFormat` | The `format` option of colors: `'hex'`, `'rgb'`, `'hsl'`, … |
| `ComponentSchema<$Item>` | `type: 'component'`, with a custom Vue component. |
| `DateSchema<$Item>` | `type: 'date' \| 'datetime' \| 'time'`. |
| `InputSchema<$Item>` | The text inputs: `'text'`, `'email'`, `'url'`, `'password'`, `'tel'`, `'hostname'`, `'domain'`, `'creditcard'`. |
| `LabelSchema<$Item>` | `type: 'label'`. |
| `ListSchema<$Item>` | `type: 'list'`. |
| `ColumnSchema<$Item, $Value>` | A column of a list. |
| `Columns<$Item>` | A record of column schemas. |
| `MarkupSchema<$Item>` | `type: 'markup'`. |
| `MultiselectSchema<$Item, $Option>` | `type: 'multiselect'`. |
| `NumberSchema<$Item>` | `type: 'number' \| 'integer'`. |
| `ObjectSchema<$Item>` | `type: 'object'`. |
| `PanelSchema<$Item>` | `type: 'panel'`. |
| `ProgressSchema<$Item>` | `type: 'progress'`. |
| `RadioSchema<$Item>` | `type: 'radio'`. |
| `SectionSchema<$Item>` | `type: 'section'`. |
| `SelectSchema<$Item>` | `type: 'select'`. |
| `SliderSchema<$Item>` | `type: 'slider'`. |
| `SpacerSchema<$Item>` | `type: 'spacer'`. |
| `SwitchSchema<$Item>` | `type: 'switch'`. |
| `TextareaSchema<$Item>` | `type: 'textarea'`. |
| `TreeListSchema<$Item>` | `type: 'tree-list'`. |
| `TreeObjectSchema<$Item>` | `type: 'tree-object'`. |
| `UploadSchema<$Item>` | `type: 'upload'`. |
| `ValueSchema<$Item>` | `type: 'value'`. |
| `ClipboardConfig` | The `clipboard` option of forms: `true`, or `copy()` and `paste()` callbacks. |

See [Schemas](./schemas.md).

## Shared schema settings

| Type | Description |
| ---- | ----------- |
| `SchemaBase<$Item>` | The options of all schemas: `panels` and the `on…` lifecycle handlers. |
| `ComponentSchemaBase<$Item>` | The options of all components: `label`, `visible`, `default`, `rules`, … |
| `RouteSchemaBase<$Item>` | The options of views and forms, also of inlined forms and dialogs. |
| `SourceSettings<$Item>` | The options of lists, objects and trees: `form`, `columns`, `creatable`, … |
| `SelectionSettings<$Item, $Option>` | The options of components with options: `options`, `relate`, `search`. |
| `SchemaOptions<$Item, $Option>` | The `options` option. |
| `SchemaOptionsOption<$Value>` | One option: a value, or `{ label, value }`. |
| `NumberSettings<$Item>` | The options of numbers, sliders and progress bars: `min`, `max`, `step`, … |
| `TextSettings<$Item>` | The `trim` option of text inputs and textareas. |
| `AffixSettings<$Item>` | The `prefix` and `suffix` options. |
| `SchemaAffix` | One prefix or suffix, see [Affixes](./schemas.md#affixes). |
| `DataSettings<$Item>` | The `data` and `dataPath` options of `value`. |

## Custom components and types

| Type | Description |
| ---- | ----------- |
| `CustomComponentProps<$Item, $Value>` | The props of custom components: `schema`, `context`, `modelValue`, `errorsElementId`. |
| `CustomComponentEmits<$Value>` | The events of custom components: `update:modelValue`, `change`, `focus`, `blur`. |
| `TypeDescriptor` | The descriptor of a component type, see [TypeDescriptor](#typedescriptor). |

## Utility types

| Type | Description |
| ---- | ----------- |
| `OrArrayOf<T>` | `T \| T[]` |
| `OrPromiseOf<T>` | `T \| Promise<T>` |
| `OrRecordOf<T>` | `T \| Record<string, T>` |
| `OrFunctionReturning<T>` | `T \| (() => T)` |
| `Resolvable<T>` | A value, record, promise or function, resolved to `T` or a record of it. |

## Deprecated

The earlier names of these types, e.g. `DitoContext` or `HTTPMethod`, keep
working as deprecated aliases until a future major version. The
[upgrade guide](../../upgrading-to-4.x.md#typescript-types) lists them with
their new names. `ComputedSchema`, `DataSchema` and `HiddenSchema` are
deprecated aliases of `ValueSchema`, until 5.0. The `events: {}` options of schemas are deprecated too, see
[Events](./events.md#deprecated-events).

## TypeDescriptor

A type descriptor defines a type of schema components: the Vue component that
renders it, and how the admin handles its schemas and values, also where they
aren't rendered, e.g. when items are created, serialized or validated. Its
flags are statements about the type; the defaults of schema options start with
`default`. Members marked *Hook* are functions that the admin calls.

### defineType()

```ts
import { defineType } from '@ditojs/admin'

defineType(descriptor: TypeDescriptor): TypeDescriptor
```

Registers a type of schema components under `descriptor.type`, replacing a
type of the same name. Call it before the admin resolves its views. It throws
for unknown members, naming the replacement of the options of 3.x, and for the
name of a built-in type without `override: true`.

The component receives the same props and emits the same events as the
components of [`type: 'component'`](./schemas.md#component). Schemas of
custom types can't use the [removed keys](./schemas.md#removed-keys), e.g.
`format`, `compute` or `data` (see `resolvesValue`); the admin throws for
them.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `descriptor` | `TypeDescriptor` | The descriptor, see the members below. |

#### Return value

The registered descriptor, with the defaults filled in.

#### Example

```js
import { defineType } from '@ditojs/admin'
import RatingInput from './RatingInput.vue'

defineType({
  type: 'rating',
  component: RatingInput,
  defaultValue: 0,
  defaultWidth: 'auto',

  getValidations({ schema }) {
    return { range: [0, schema.max ?? 5] }
  },

  getDisplayValue({ value }) {
    return `${value ?? 0} stars`
  }
})
```

```js
// In a schema:
rating: { type: 'rating', max: 10, label: 'Rating' }
```

### Members

#### type

```ts
type: string | string[]
```

The type, or the types that share the descriptor, e.g.
`['date', 'datetime', 'time']`.

#### component

```ts
component: Component
```

The Vue component that renders the type.

#### override

```ts
override?: boolean
```

Replace the built-in type of the same name, e.g. `'color'`. Without it,
`defineType()` throws for the names of built-in types.

#### defaultValue

```ts
defaultValue?: any | ((context: SchemaContext) => any)
```

The default of `default`, the value that new items and missing values get.
Default `null`. A function is called with the context of the component and
returns the default. Objects are cloned for each use.

#### defaultNested

```ts
defaultNested?: boolean
```

The default of `nested`. Default `true`: components of the type keep their
value under their own name in the item, and their contexts describe that
value. Types with `false`, like sections and panels, work on the item itself
unless a schema sets `nested: true`; only these types accept `nested` in
schemas, the others throw.

#### defaultVisible

```ts
defaultVisible?: boolean
```

The default of `visible`. Default `true`.

#### defaultMultiple

```ts
defaultMultiple?: boolean
```

The default of `multiple`, for types that hold one or several values. Default
`false`.

#### defaultWidth

```ts
defaultWidth?: string | number
```

The default of `width`, e.g. `'auto'` for buttons and switches.

#### defaultExclude

```ts
defaultExclude?: boolean | ((context: SchemaContext) => boolean)
```

The default of `exclude`: whether the value is left out of the data sent to
the server. `true` for buttons, labels and spacers.

#### ignoresMissingValue

```ts
ignoresMissingValue?: boolean | ((context: SchemaContext) => boolean)
```

Values that are missing don't get their defaults, e.g. passwords, which the
server doesn't return.

#### treatsNullAsMissing

```ts
treatsNullAsMissing?: boolean | ((context: SchemaContext) => boolean)
```

Values that are `null` get their defaults like missing ones. Dito's own types
set it for lists, nested sections and panels, and `checkboxes` and
`multiselect` with `multiple`. Objects and single values keep `null`.

#### resolvesValue

```ts
resolvesValue?: boolean
```

The value resolves from `schema.data` or `schema.dataPath`, like the values of
`value` components. Only these types (and panels) support the `data`
option.

#### generatesLabel

```ts
generatesLabel?: boolean
```

Components without `label` get a label generated from their name. Default
`true`.

#### hasLabel

```ts
hasLabel?: boolean | ((context: SchemaContext) => boolean)
```

The container renders the label of the component. Default `true`. Types that
display the label themselves return `false`.

#### omitsSpacing

```ts
omitsSpacing?: boolean
```

The container leaves out the spacing around the component.

#### rendersLabel

```ts
rendersLabel?: boolean
```

The component renders as the label of its container, when it has one, like
`type: 'label'`.

#### alignsBelowLabels

```ts
alignsBelowLabels?: boolean
```

Components without a label align below the labels of the other components in
their row. Default `true`. Dito's sections, lists and objects set it to
`false`: their boxes start at the top of the row.

#### submitsData

```ts
submitsData?: boolean
```

Forms and sources count buttons of the type like `submit` buttons, for their
dirty state and whether they can save. Submitting the data is up to the
component.

#### hasEmbeddedForms

```ts
hasEmbeddedForms?: boolean
```

For types that hold items: the forms of the items render inside the form or
view of their source, instead of in routes of their own, as in trees.

#### getOptionsDataSchema()

```ts
getOptionsDataSchema?(schema: object): any
```

*Hook.* Returns the data schema of the options that the admin loads for the
component, e.g. `schema => schema.options`. Only types with it load options.

#### getDisplayValue()

```ts
getDisplayValue?(context: SchemaContext): string
```

*Hook.* Returns the text that list cells without `render()` and item labels
show for the value, e.g. formatted dates. Without it, they show the value.

##### Example

```js
getDisplayValue({ value }) {
  return value != null ? `${Math.round(value * 100)} %` : ''
}
```

#### getValidations()

```ts
getValidations?(context: SchemaContext): Record<string, any>
```

*Hook.* Returns the validations of the value, keyed by validator name, e.g.
`{ email: true }` or `{ range: [0, 10] }`. `required` and the schema's `rules`
are added to them; a rule set to `undefined` removes a validation.

#### setupSchema()

```ts
setupSchema?(options: {
  schema: object
  api: ApiConfig
  name: string
}): Promise<any> | void
```

*Hook.* Sets up each schema of the type when the views are resolved (for
each login), after `api.defaults` are applied, e.g. resolves schemas or
modules that it contains. The admin awaits it.

##### Example

```js
async setupSchema({ schema }) {
  // Accept `presets` as a function that loads them, e.g. a dynamic import:
  if (typeof schema.presets === 'function') {
    schema.presets = await schema.presets()
  }
}
```

#### deserializeValue()

```ts
deserializeValue?(context: SchemaContext): any
```

*Hook.* Converts a loaded value to the value that the component edits, e.g.
date strings to `Date` objects. Runs before the schema's own
`deserializeValue()`, which receives its result.

#### serializeValue()

```ts
serializeValue?(context: SchemaContext): any
```

*Hook.* Converts the edited value for storage, before the schema's own
`serializeValue()`, which receives its result. When the final result is
`undefined`, the key is left out of the serialized data.

##### Example

```js
deserializeValue({ value }) {
  return value != null ? new Set(value) : value
},

serializeValue({ value }) {
  return value instanceof Set ? [...value] : value
}
```
