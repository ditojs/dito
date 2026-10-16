# Upgrading to Dito.js 4.x

This guide describes how to upgrade an app from Dito.js 3.5 to 4.x. 4.1.0 is
the first release of Dito.js 4: 4.0.0 was withdrawn shortly after its release,
and its changes are part of 4.1.0. [`CHANGELOG.md`](../CHANGELOG.md) lists all
changes.

Start with the required code changes, in the order below. Schemas that still
use removed 3.x keys throw when they're set up and name the replacement, so the
admin tells you what's left. Then read the behaviour changes, which need no
code changes in most apps.

## Packages and builds

- `@ditojs/admin` and `@ditojs/ui` are only published as ES modules: their
  UMD builds and `require` exports are removed. `defineViteConfig()` of
  `@ditojs/build` doesn't read `rollupOutput` anymore.
- All packages have `exports` maps with `import` only, which also expose their
  `package.json`: `@ditojs/utils`, `@ditojs/build` and `@ditojs/router` can't be
  loaded with `require()` anymore. `@ditojs/server` only exposes its entry
  point: imports of its internal files, e.g. `@ditojs/server/src/…`, fail.
- `stripTags()` of `@ditojs/utils` is removed: use `stripHtml()`.
- `setDataPathEntries()` of `@ditojs/utils` is `setEntriesAtDataPath()`, and
  `escapeRegexp()` is `escapeRegExp()`.
- `isEmpty()` of `@ditojs/utils` checks the size of `Map` and `Set` objects
  and never treats dates as empty, where 3.5 returned `true` for all of them.
- Since 4.5, `@ditojs/server` loads `@ditojs/build`, `vite` and
  `@vitejs/plugin-vue` only to build the admin or serve it in development, as
  optional peer dependencies: install them as dev dependencies of the app,
  `pnpm add -D @ditojs/build vite @vitejs/plugin-vue`.
  `app.defineAdminViteConfig()` returns a promise, which Vite awaits as the
  default export of `admin.vite.config.js`.

## Server

### Services and storages

Services read their configuration as `this.config` in `initialize()`, which
needs no `super` call, instead of overriding `setup(config)`. The application
starts and stops its services itself. A `setup()` that a service still
overrides isn't called anymore:

```js
// Before:
setup(config) {
  super.setup(config)
  this.client = createClient(config)
}

// After:
async initialize() {
  this.client = createClient(this.config)
}
```

Storages are created with `constructor(app, name, config)` and named by their
key in `config.storages`, as `config.name` isn't read anymore.
`app.addStorage(config, name)` needs the name. Custom storages move the work of
`setup()` into the async `initialize()`, which needs no `super` call.

### Queries

- `upsert(data)` saves models by the ids in the data like `upsertAndFetch()`,
  without fetching them: it patches the models that exist and inserts the
  others, instead of patching what the query matches. `findById()` and
  `where()` aren't supported with `upsert()` anymore, and its `update` and
  `fetch` options are removed:

  ```js
  // Before:
  await Session.query().findById(id).upsert({ value })
  await Session.query().where('id', id).upsert(data, { fetch: true })

  // After:
  await Session.query().upsert({ id, value })
  await Session.query().upsertAndFetch({ ...data, id })
  ```

- The array forms of `patchAndFetch()` and `updateAndFetch()` throw for models
  without ids instead of inserting them: insert these with `insertAndFetch()`.
- Collection `PUT` and `PATCH` requests reject models without ids with a 400
  error instead of inserting them: create them with `POST`. With `graph`, this
  applies to the root models, while nested models can still be new.
- Outside of PostgreSQL, arrays passed to `insert()` are inserted without their
  relations, as in PostgreSQL: insert graphs with `insertDitoGraph()` or
  `insertGraph()`. `insertAndFetch()` accepts arrays there too, instead of
  throwing.
- The `expression` of `getPropertyOrRelationAtDataPath()` selects properties
  with `(@name)` instead of `(#name)`, as the scope prefix `#` is removed.
- `upsert()`, `upsertAndFetch()`, the array forms of `patchAndFetch()` and
  `updateAndFetch()`, and array inserts outside of PostgreSQL run in a
  transaction: a failure rolls back the models saved before it.
- The `text` filter searches with `'contains'` when its operator is `null` or
  empty, instead of applying no filter.

### Validation

`type: 'color'` only accepts hex colors, `#rgb`, `#rgba`, `#rrggbb` and
`#rrggbbaa`, where 3.5 accepted any string. Use `type: 'string'` for other
color strings, e.g. `'rgb(0, 0, 0)'`, and `type: 'object'` for the `rgb`,
`prgb`, `hsl` and `hsv` formats of the admin's color type.

The validator applies `discriminator` keywords: a `oneOf` with
`discriminator: { propertyName: 'type' }` validates only the variant that
`type` selects. Each variant needs a fixed `type`, with `const` or `enum`,
directly in its own `properties`.

Schemas with `type: 'object'` that combine parts through `allOf`, `anyOf` or
`oneOf` reject unknown properties also without their own `properties`. Set
`unevaluatedProperties: true` on them to allow unknown properties.

Definitions such as `'#Address'` are closed where they're used: a `$ref` to
one rejects unknown properties, while the definition itself doesn't close, so
it can serve as the base that other schemas extend, through `$ref` next to
their own keywords or as a part of `allOf`. Set `unevaluatedProperties: true`
on a definition to allow unknown properties wherever it's used.

Stored data can hold properties that these schemas now reject, e.g. values of
fields that were removed from an admin form, or keys that server code writes
without declaring them. Saving such data fails validation. The admin only
sends the values that its forms show, so saving an item in the admin drops the
values of removed fields. Declare the properties that code writes. To find the
affected rows, validate the stored values with
`new Model().$validate({ name: value }, { patch: true })`.

### Removed deprecations

| 3.5                                     | 4.x                         |
| --------------------------------------- | --------------------------- |
| `AdminController.getPath(name)`         | `resolveConfigPath(name)`   |
| `returns` of handlers, now throws       | `response`                  |
| `options.returns`, now throws           | `options.response`          |
| Scope prefix `-`, now throws            | `!`                         |
| Scope prefix `#`, now throws            | `@`                         |
| `cyclic` of the `*DitoGraph*()` methods | Remove it, it had no effect |

### Renames

| 3.5                                                         | 4.x                  |
| ----------------------------------------------------------- | -------------------- |
| `TimeStampedMixin`                                          | `TimestampedMixin`   |
| `TimeStampedModel`                                          | `TimestampedModel`   |
| Scope `timeStamped` of `TimestampedMixin`                   | `timestamped`        |
| `AdminController.getDitoObject()`                           | `getGlobalConfig()`  |
| `AdminController.sendDitoObject()`                          | `sendGlobalConfig()` |
| `initialized` of models, controllers, services and storages | `isInitialized`      |
| `AdminController.closed`                                    | `isClosed`           |

### Admin development server

The admin's HMR is served through the app's server instead of a port of its
own: remove `server.hmr.port` from the admin's Vite config.

## Admin schemas

### Value hooks

The hooks that convert values are named after what they convert:

| 3.5         | 4.x                  | Converts                            |
| ----------- | -------------------- | ----------------------------------- |
| `format()`  | `formatValue()`      | the edited value to the shown one   |
| `parse()`   | `parseValue()`       | the entered value to the edited one |
| `compute()` | `computeValue()`     | the data to a derived value         |
| `process()` | `serializeValue()`   | the edited value to the stored one  |
| –           | `deserializeValue()` | the stored value to the edited one  |

Schemas that still use the 3.5 names throw when they're set up. The date and
color types read `format` as their format setting, so a 3.5 `format()` can't be
told apart there: rename it to `formatValue()` by hand.

`serializeValue()` returning `undefined` leaves out the value's key. Virtual
fields, which convert to other values of the item, write these into
`context.serializedItem` and return nothing, instead of `exclude: true`, which
would keep their edits from making the form dirty:

```js
fullName: {
  type: 'text',
  // The stored data has no `fullName`, so it starts with a default:
  default: ({ item }) => [item.firstName, item.lastName].join(' ').trim(),
  serializeValue({ value, serializedItem }) {
    const [firstName, lastName] = value?.split(' ') ?? []
    Object.assign(serializedItem, { firstName, lastName })
  }
}
```

`deserializeValue()` runs on loaded data, save responses,
`context.resetItem(data)`, pasted data and the filters in the query. It's the
counterpart of `serializeValue()`, which runs when saving and copying.

### Dates

`formats` of the date types is `format`. The date types convert the date
strings of loaded data to `Date` objects, and back when it's saved: code that
compared the date strings of loaded data works with `Date` objects instead.
Date strings from defaults, computed values or code are displayed as dates and
saved unchanged, until the user edits them.

### Methods, computed, watch and data

Schemas can't define members of their components anymore: `methods`,
`computed`, `watch` and `data` throw. Handlers, e.g. `onClick()`, `itemLabel()`,
`render()` and `clipboard.copy()`, are called with their context only, without
the component as `this`:

- Methods: plain functions in the module of the schema.
- `computed`: read the values from the context, e.g. `item` and
  `serializedItem`, or write derived values with `computeValue()`.
- `watch` on data: `onChange()` of the form or of a component above the changed
  values, which receives the `dataPath` of the changed value.
- `data`: state in module scope, e.g. a `WeakMap` keyed by the item. The `data`
  setting of panels and of the `computed`, `data` and `hidden` types stays.
- `this.submit()` in buttons: `context.submit()`.

```js
// Before:
watch: {
  'item.deliveryAddress': {
    deep: true,
    handler() {
      this.copyAddress()
    }
  }
},
methods: {
  copyAddress() {
    Object.assign(this.item.billingAddress, this.item.deliveryAddress)
  }
}

// After:
onChange({ dataPath, rootItem }) {
  if (dataPath.startsWith('deliveryAddress/')) {
    copyAddress(rootItem)
  }
}

function copyAddress(order) {
  Object.assign(order.billingAddress, order.deliveryAddress)
}
```

This works in forms with their own resource. In nested forms, `dataPath`
starts with the data path of the form's item, and `rootItem` is the root of the
parent's data: use `item` there. Unlike `watch` in 3.5, which also fired on
writes of code, `onChange()` only fires for the edits of the user.

### Schema options

| 3.5                                    | 4.x                                          |
| -------------------------------------- | -------------------------------------------- |
| `open: true` of trees                  | `collapsed: false`, `true` by default        |
| `relate: true` with `relateBy: 'code'` | `relate: 'code'`, or `relate: true` for `id` |
| `groupBy` of options components        | `options.group`                              |
| `formats` of date types                | `format`                                     |
| `format: 'name'` of color types        | a hex format, e.g. `format: 'hex'`           |

- `relateBy`, `groupBy` and `format: 'name'` of color types throw, and so does
  `open` on trees. `collapsed` works on the tree and on its `children` schema,
  and can be a callback, called for each item.
- `options.group` is the key of the options' group, or a callback that returns
  the group of the `option` in its context.
- `nested` only works on sections and panels, and throws on other types, which
  store their data under their name anyway.
- Options that were typed but never read are removed from the types:
  `defaultSort`, `defaultScope` and `nested` of sources (use `defaultSort` of
  columns and `defaultScope` of scopes), `idKey` of forms (use the `idKey` of
  the list or object), `omitSpacing` of schemas,
  `options.groupBy`, and `dateFormat` and `locale` of date schemas (use
  `format.date` and `api.locale`).
- Relative paths in `options.dataPath` and in the `dataPath` of the
  `computed`, `data` and `hidden` types are relative to the item the component
  sits in (`context.itemDataPath`) instead of the field, so they need one `../`
  less: `'../authors'` becomes `'authors'`. A leading `/` makes them absolute,
  as it already did in `options.dataPath`, and `..` above the root throws,
  where 3.5 dropped it silently.
- Since 4.3, the `computed`, `data` and `hidden` types are one type named
  `value`, and `ValueSchema` is its schema type. The old names keep working
  until 5.0, with a deprecation warning, and `ComputedSchema`, `DataSchema` and
  `HiddenSchema` are deprecated aliases of `ValueSchema`.
- Since 4.5, labels, the results of `itemLabel()` and `info` are text unless
  they're given as `{ html }`, see
  [Text and HTML](./api/admin/schemas.md#text-and-html). Labels and callbacks
  that return HTML strings return `{ html }` instead, and callbacks that only
  escaped values with `escapeHtml()` return the plain text.
- Since 4.5, `context.itemLabel` is the text of the item's label, like
  `context.formLabel`: pass it to `notify()` as `text`, not `html`.
  `context.itemLabelText` is removed: use `context.itemLabel`.

## Event handlers

Declare handlers as `on…` properties of the schema. `events: {}` still works
and logs a deprecation warning, until 5.0, but an `on…` handler of the same
event in the same schema wins over it instead of both running. In development,
dito warns about the ignored `events` entries, naming the schema and the event.
On the submit and cancel buttons of forms and the cancel button of dialogs,
`events: { click() {} }` replaced the default handler in 3.5, and is ignored
now with a warning: move it to `onClick()`.

```js
// Before:
events: {
  click({ item }) {}
}

// After:
onClick({ item }) {}
```

An `onClick()` on the submit or cancel button of a form, or on the cancel
button of a dialog, replaces the default handler instead of running next to
it: call `context.submit()`, `context.closeForm()` or `context.closeDialog()`
from it.

Forms fire `onSuccess()` after saving, with `context.isCreating` telling new
items apart, instead of `create` and `submit`. Nested forms fire `onApply()`
when they apply their draft, where 3.5 fired `create` and `submit` too.
`onCreate()`, `onSubmit()` and `create` or `submit` in `events` throw:

```js
// Before:
onCreate({ item }) {},
onSubmit({ item }) {}

// After, in forms with their own resource:
onSuccess({ item, isCreating }) {}

// After, in nested forms:
onApply({ item }) {}
```

`onToggle()` replaces `onOpen()` on collapsible sections and inlined forms,
which lists and objects set on their `form`, with `context.collapsed` instead
of `context.open`. `onOpen()` and `open` in `events` throw:

```js
// Before:
onOpen({ open }) {}

// After:
onToggle({ collapsed }) {}
```

## Contexts

Contexts don't expose components anymore: `component`, `formComponent`,
`schemaComponent`, `viewComponent`, `dialogComponent`, `panelComponent`,
`resourceComponent` and `sourceComponent` are removed. What callbacks used them
for are members of the context. `isDirty`, `isCreating`, `validate()`,
`isValid()`, `clearErrors()`, `markDirty()` and `resetItem()` act on the data
of the nearest form, view, dialog or panel with its own data. Where they don't
apply, the methods throw, `isDirty` and `isCreating` are `false`, and
`selectedTab` and `sourceQuery` are `null`.

| 3.5                                                   | 4.x                                    |
| ----------------------------------------------------- | -------------------------------------- |
| `formComponent.isDirty`                               | `isDirty`                              |
| `formComponent.isCreating`                            | `isCreating`                           |
| `formComponent.validateAll()`                         | `validate()`                           |
| `formComponent.verifyAll()`                           | `isValid()`                            |
| –                                                     | `markDirty()`                          |
| `formComponent.setData(data)`                         | `resetItem(data)`                      |
| `schemaComponent.resetData()`                         | `resetItem()`                          |
| `formComponent.applyCleanChanges()`                   | Removed, write the values instead      |
| `formComponent.selectedTab`                           | `selectedTab`                          |
| `navigate(formComponent.parentRouteComponent.path)`   | `closeForm()`                          |
| `component.$router.resolve(location).href`            | `getRouteUrl(location)`                |
| `component.showDialog()`                              | `showDialog()`                         |
| `dialogComponent.resolve(value)`                      | `closeDialog(value)`                   |
| `getResourceUrl(resourceComponent.resource)`          | `getResourceUrl()`                     |
| `sourceComponent.query`                               | `sourceQuery`                          |
| `query`                                               | `routeQuery`                           |
| `index`                                               | `valueIndex`                           |
| `processedItem`, `processedRootItem`                  | `serializedItem`, `serializedRootItem` |
| `component.$refs.element.isOpen` in `options.label()` | `isSelected`, see below                |

- `validate(match)` shows the errors and returns whether the data is valid,
  `isValid(match)` checks without showing them, and `clearErrors(match)` clears
  the errors at the matching data paths and beneath them, or all errors without
  `match`. `match` takes data paths with `*` for one level and `**` for zero or
  more levels, or for everything inside at the end, e.g. `'items/*/title'` or
  `'items/**'`, arrays of them, regular expressions or functions. Data paths
  are relative to the item of the context, or absolute with a leading `/`,
  while regular expressions and functions receive absolute data paths.
- `resetItem(data)` resets the data to `data`, e.g. what the server saved, as
  if it was loaded: it's deserialized, gets its defaults and computed values,
  and isn't an edit, also in nested forms. Values that `data` lacks are reset
  too, except the item's id, type and position. Without `data`, it resets to
  the defaults, like the filters panel does when cleared. Forms merge the data
  into their item to keep the identity of its objects.
- `applyCleanChanges()` is removed: write the values through the context
  instead, which is an edit.
- `closeForm()` resolves to `true` once the form closed, or `false` if it's
  still open, e.g. when the user chose to keep unsaved changes.
- `navigate(location)` resolves to `true` if the navigation happened, or
  `false` if not, e.g. when the user chose to stay instead of discarding unsaved
  changes, instead of to vue-router's navigation failure.
- `getResourceUrl()` without arguments returns the URL of the nearest form or
  list with a resource, and throws without one instead of returning `null`.
- `dialogComponent.reject()` is removed. `showDialog()` resolves with the data
  of the dialog when submitted, `undefined` when cancelled, or the value of
  `closeDialog(value)`.
- `sourceQuery` is `null` outside of lists and in `itemLabel()`, so in a form
  it isn't the query of the list that opened it.
- `isSelected` is `true` for selected options, also in the open list.
- `navigateToComponent()` and `navigateToRouteComponent()` are removed:
  validating reveals the first error and focuses it, opening nested forms,
  collapsed sections and tabs on the way.
- The validation members of components, e.g. `errors`, `hasErrors`,
  `showValidationErrors()`, `resetValidation()` and `clearErrors()`, and
  `filterData()` are removed.

`valueIndex` is the index of the value in its list, next to `itemIndex` and
`parentItemIndex`, the indices of the item and its parent item in their lists:

| Callbacks of                                 | `valueIndex`         | `itemIndex`                         |
| -------------------------------------------- | -------------------- | ----------------------------------- |
| Fields, e.g. `label` and `onChange`          | `null`               | The item holding the field          |
| Rows of lists, e.g. `itemLabel` and `render` | The row              | The row                             |
| List values, e.g. the files of uploads       | The value's position | `null`, as their `item` is the list |

Each context describes its `item`: `itemDataPath`, `itemIndex`, `parentItem`,
`parentItemDataPath` and `serializedItem` belong to it. In 3.5, the events of
forms, sections and inlined and object forms, and list buttons got the values
of the item one level up. Now `itemIndex` in `onChange()` of a chapter's form is
the chapter's index, and list buttons and filters panels describe the item that
holds the list, or the list itself in single-component views, so relative data
paths in their `validate()` resolve against it. The events of forms and sections
describe their item, not a value, so `value` is `undefined` there: read `item`.
`onSuccess()` and `onError()` of submit buttons get the same context as their
`onClick()`.

### Admin services

Code outside of callbacks reaches the admin's services through `admin.context`:
`api`, `settings`, `user`, `views`, `flattenedViews`, `session`, `notify()` and
`showDialog()`. `settings` holds the settings of the `dito` object passed to
`DitoAdmin`, which defaults to `window.dito`: read them there instead of from
`window.dito.settings`. In callbacks, `api`, `user`, `views`, `flattenedViews`,
`notify()` and `showDialog()` are members of the context, e.g.
`context.api.locale` instead of `this.locale`, while `session` is only on
`admin.context`. `session.login()` and `session.ensureUser()` resolve to the
user, or `null` if the user cancels, and `session.logout()` to whether it
worked.

`closeNotifications()`, `rootComponent` and `registerLoading()` are removed, and
route records no longer have `meta.api` and `meta.schema`. `api.base` is removed
from the types and no longer defaults to `'/'`, as the admin doesn't read it:
`dito.base` is the base of its routes.

## Custom components

Custom components, of `type: 'component'` and of custom types, don't get
`DitoMixin` and `TypeMixin` mixed in anymore. They receive `schema`, `context`
and the value as `modelValue`, emit `update:modelValue` to change the value,
which fires the schema's `input` event, and `change` once the change is done,
which fires its `change` event. They can emit `focus` and `blur` too, which
fire the schema's events, and `blur` validates the value. `errorsElementId` is
the id of the element that shows their errors. `CustomComponentProps` and
`CustomComponentEmits` type them, and dito warns in development about props and
emits that a component doesn't declare.

- `value`: `modelValue`. `this.value = value`:
  `this.$emit('update:modelValue', value)`. `onChange()`:
  `this.$emit('change')`.
- `item`, `parentItem`, `rootItem` and `api`: the same members of `context`.
- `getSchemaValue(key)`: `context.getSchemaValue(key)`, which calls schema
  values that are functions with the context.
- `request()`, `format()`, `navigate()`, `download()` and `getResourceUrl()`:
  the same members of `context`. `sendRequest()` and `getQueryLink()` are
  removed: use `context.request()`, and `context.routeQuery` with
  `context.navigate()`.
- `getLabel()`, `getStore()`, `setStore()`, `removeStore()`, `focus()`, `on()`,
  `off()`, `emit()`, `emitEvent()` and `emitChangeEvent()` are removed.
- The `component` of list items receives the item as `modelValue`, and the
  `component` of columns the cell's value, with the column as `schema`.

```js
// Before:
export default {
  computed: {
    max() {
      return this.getSchemaValue('max')
    }
  },
  methods: {
    rate(rating) {
      this.value = rating
      this.onChange()
    }
  }
}

// After:
export default {
  emits: ['update:modelValue', 'change'],
  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: Number, default: null }
  },
  computed: {
    max() {
      return this.context.getSchemaValue('max')
    }
  },
  methods: {
    rate(rating) {
      this.$emit('update:modelValue', rating)
      this.$emit('change')
    }
  }
}
```

The admin's own components are internal, and so is `DitoComponent.component()`:
custom code can't reach them or their members. Only the components of
`@ditojs/ui` are public.

## Custom types

Types are defined with `defineType(descriptor)` from `@ditojs/admin` instead of
`admin.register(type, options)`. The descriptor names the component, which
follows the contract of custom components above:

```js
import { defineType } from '@ditojs/admin'
import DitoRating from './DitoRating.vue'

defineType({
  type: 'rating',
  component: DitoRating,
  defaultValue: 0,
  getValidations: ({ schema }) => ({ range: [0, schema.max ?? 5] })
})
```

| 3.5 option                            | 4.x descriptor                       |
| ------------------------------------- | ------------------------------------ |
| `excludeValue`                        | `defaultExclude`                     |
| `generateLabel`                       | `generatesLabel`                     |
| `ignoreMissingValue()`                | `ignoresMissingValue()`              |
| `treatNullAsMissing()`                | `treatsNullAsMissing()`              |
| `omitSpacing`                         | `omitsSpacing`                       |
| `valueFromDataSchema`                 | `resolvesValue`                      |
| `rendersOwnLabel()`                   | `hasLabel()`, inverted               |
| `processSchema(api, schema, name, …)` | `setupSchema({ schema, api, name })` |
| `processValue(context, graph)`        | `serializeValue(context)`            |
| `getTypeValidations(schema, context)` | `getValidations(context)`            |

- `defaultValue`, `defaultNested`, `defaultVisible`, `defaultMultiple` and
  `defaultWidth` keep their names.
- `defaultExclude`, `ignoresMissingValue`, `treatsNullAsMissing` and `hasLabel`
  take a boolean or a callback that receives the context.
- `setupSchema()` only sets up the schema and doesn't add routes.
  `getValidations()` receives the schema as `context.schema`.
- `getSourceType()`, `getPanelSchema()` and `getFormSchemasForProcessing()` of
  dito's list types are internal or removed.
- `defineType()` throws for the options of 3.5, naming their replacement, and
  for the names of built-in types without `override: true`.

## TypeScript types

| 3.5                                  | 4.x                                  |
| ------------------------------------ | ------------------------------------ |
| `SchemaOpen`, `OpenEventHandler`     | `SchemaToggle`, `ToggleEventHandler` |
| `SchemaDitoMixin`, `SchemaTypeMixin` | Part of `ComponentSchemaBase`        |
| `HTTPVerb`                           | `HttpMethod`                         |

- These keep working as deprecated aliases: `SchemaFields` and
  `SchemaSetupMixin` (`SchemaBase`), `BaseSchema` (`ComponentSchemaBase`),
  `SchemaRoute` and `SchemaRouteMixin` (`RouteSchemaBase`), `Form`
  (`FormSchema`), `OrItemAccessor` (`SchemaValue`), `ItemAccessor`
  (`SchemaValueCallback`), `HTTPMethod` (`HttpMethod`), `DitoContext`
  (`SchemaContext`), `DitoGlobal` (`GlobalConfig`), `SchemaSourceMixin`
  (`SourceSettings`), `SchemaOptionsMixin` (`SelectionSettings`),
  `SchemaNumberMixin` (`NumberSettings`), `SchemaTextMixin` (`TextSettings`),
  `SchemaAffixMixin` (`AffixSettings`) and `SchemaDataMixin` (`DataSettings`).
  `@ditojs/server` keeps `HTTPMethod` as a deprecated alias of `HttpMethod` too.
- `EmitterMixin`, `LoadingTracker` and the types of component instances, e.g.
  `DitoComponentInstance` and `DitoFormInstance`, are removed.
- The types follow what the admin reads, so code that type-checked against 3.5
  may need changes: context members are `readonly` except `isRunning`; `trim`,
  `inlined` and `disabled` of panels take plain values instead of callbacks;
  `placeholder` is a string except in multiselects, the only type with
  `search`; `editable` and `deletable` of lists are booleans; `compact` is
  typed on forms, sections and sources, not on views; `onInitialize()`,
  `onDestroy()` and `onLoad()` are typed only where they fire, so move
  `onLoad()` of lists and objects to the form, view, section or panel around
  them; `error` of `ErrorEventHandler` is `unknown`; affixes are typed by their
  `type`, e.g. `{ type: 'icon', name }`; `thumbnails` of uploads takes `true`,
  `'small'`, `'medium'` or `'large'`; `showDialog()` requires `buttons`; and
  views and forms have no `resource`, which they never read, as forms load and
  save through their list or object.
- The `ApiConfig` of `@ditojs/server` has no `dateFormat` and `resources`
  anymore: set `resources` on the admin's `api`.
- The types of `@ditojs/server` follow what the server reads: controllers have
  no `allow`, which only actions objects read; `authorize` takes settings by
  action name, e.g. `{ 'post import': 'admin' }`, instead of by HTTP method;
  actions have no `method` option, as the method is part of their name;
  `ResponseError` has its `code` in `data.code`; `ApplicationConfig` has no
  top-level `api` and no `app.logger`; the event emitter and knex helper
  methods are on the static side of models only, e.g. `Model.on()`; and
  `$hasRole()` returns the matched role or `false`.

## Styles

- `.dito-form-nested` is `.dito-form--embedded`, and the component
  `DitoFormNested` is `DitoFormEmbedded`, as the forms that trees render inside
  their source are embedded forms.
- The modifiers of `DitoTrigger` and its popups follow BEM:
  `.dito-trigger-disabled` is `.dito-trigger--disabled`, and
  `.dito-popup-{placement}`, e.g. `.dito-popup-bottom-left`, is
  `.dito-popup--{placement}`.
- The deprecated `$pulldown-radius`, `$pulldown-padding-ver`,
  `$pulldown-padding-hor` and `$pulldown-padding` SCSS variables are removed.
- The SCSS variable `$ease-put-quint` of `@ditojs/ui` is `$ease-out-quint`.

## UI

- `DitoDatePicker`, `DitoTimePicker` and `DitoDateTimePicker` emit `change`
  once the edit is done, when the popup closes, the input loses focus or Enter
  is pressed, and `update:modelValue` for each value. Listen to
  `update:modelValue` for each value.
- The `disabledDate` prop of `DitoCalendar` and `DitoDatePicker`, the
  `disabledHour`, `disabledMinute` and `disabledSecond` props of
  `DitoTimePicker` and `DitoTimePanel`, and `.dito-calendar-item-disabled` are
  removed: validate the value instead.
- `DitoButton` with a `verb` and without `text` is labelled by its verb, also
  when its default slot displays text: pass that text as `text`.
  `getVerbButtonAttributes()` doesn't take `hasText` anymore.

## Behaviour changes

### Schemas

- `rules: { name: false }` removes the rule `name`, like `undefined`, where the
  rule kept validating in 3.5.
- Object defaults of `api.defaults` only fill in what schemas leave out, also
  inside nested objects, where 3.5 overrode the values that schemas set
  themselves. Use a default function to override schema values. This includes
  `type`: object defaults that turn a custom type into another one no longer
  work, write them as functions, e.g.
  `buttonAsync: schema => ({ disabled: isRunning, ...schema, type: 'button' })`.
- The create menu of lists and objects offers their forms by `creatable` only,
  where 3.5 also left out forms by their `if`, the `if` of their components
  and `visible`. Move such conditions to `creatable`, whose callback gets the
  context of the list.

### Dirty state and saving

- Forms are dirty once their data is edited, until it's saved, applied or
  loaded again, instead of when it differs from the loaded data: reverting an
  edit leaves them dirty, while writes that don't change a value aren't edits.
- Writes count as edits when they change a value that a field shows and that
  is saved; helper values without a field don't, e.g.
  `Object.assign(item, { isSelected: true })`. Changes of fields with
  `exclude`, or of values inside them, don't make the data dirty. Sources with
  their own resource are excluded by default: with `exclude: false`, changes of
  their lists, e.g. of the order of their items, make the form dirty.
- Only data that can be saved is dirty: views, dialogs and panels without a
  button of type `submit` are never dirty, and views without one don't ask
  about unsaved changes. Excluded sources with their own resource track the
  edits of their list, e.g. the order of their items, which their buttons clean
  when they submit them.
- Writes through the data of contexts, i.e. `item`, `parentItem`, `rootItem`
  and `value`, are edits: `onClick({ item }) { item.text = clean(item.text) }`
  makes the form dirty. Code that changes values in place, e.g. a date through
  `setHours()`, calls `context.markDirty()`.
- Save responses and `context.resetItem(data)` merge into the form's data in
  place: open nested forms keep their edits.
- Leaving a form while it saves waits for the save, which 3.5 didn't, and only
  asks about unsaved changes if the save fails. "Save & close" and opening a
  created item only navigate if the user is still in the form.
- Submitting waits for running uploads and loads of data and options without
  the 30 second limit of 3.5, as `api.timeout` bounds the requests.
- Saving the forms of the children of tree items doesn't reload the tree.

### Nested forms

- Nested forms without `mutate: true` edit a draft of their item: OK merges the
  draft into the item and makes the parent dirty if it changed, Cancel leaves
  the parent untouched. `serializeValue()` runs only when the parent is saved.
- In the draft, `rootItem` and `parentItem` show the parent's data with the
  draft in place of the item. Everything outside of the item is read-only
  there: writes warn and are ignored.
- Forms with `mutate: true` edit the parent's data directly: the parent turns
  dirty right away, and Cancel only closes them.
- Open nested forms follow their item when it moves, which replaces the history
  entry. The forms of list items close when their item is removed, instead of
  showing the next one.

### Errors

- Errors stay with their values when sections collapse, tabs switch and items
  move. Any change of a value clears its errors, also writes through code.
- Errors inside values that no deeper field displays, e.g. of objects edited as
  code, show on the field of the value, with their path.
- Rows of lists and tree items with errors in their items or children are
  marked with `.dito-table__row--error` and `.dito-tree-item--error`.
- Saving or applying a form successfully clears all errors of its data, also of
  fields that aren't shown, and the buttons of sources clear the errors of the
  source's data once they submitted it.
- Errors thrown by event handlers, e.g. in `onClick()`, reach `onError()` and
  the code that awaits them as they are, instead of wrapped in an
  `AggregateError`: read `error.message` instead of `error.errors[0].message`.

### Fields and display

- Cells without `render()` and item labels show values as their types display
  them, e.g. 'June 1, 2026' for `type: 'date'` instead of the stored string.
  Columns that format values otherwise use `render()` with `context.format()`.
- Date, datetime and time fields fire `change` once the edit is done: when the
  picker closes, the field loses focus or Enter is pressed. `input` fires for
  each value.
- `input` fires for each edit in all types, and bubbles to the schemas above
  like `change`, so `onInput()` of a form sees every edit. Returning `false`
  from a handler of either event stops it from bubbling further.
- Selects and multiselects keep values that their options lack and show them as
  unavailable, instead of setting them to `null`.
- Since 4.2, lists, `checkboxes` and multiselects with `multiple` never hold
  `null`: a stored `null` loads as their `default`, or `[]`. Multiselects with
  `multiple` default to `[]` like checkboxes, and clearing them sets `[]`, so
  new and cleared ones are sent as `[]` instead of `null`. To store empty
  values as `null`, return it from `serializeValue()`:
  `serializeValue: ({ value }) => (value.length > 0 ? value : null)`. Objects
  and single choices keep `null`. `required` rejects empty arrays, so required
  lists and fields with multiple values need at least one entry.
- Tabs render once they're selected and stay rendered.
- In panels with their own data, e.g. filters, `item` is the panel's data and
  `rootItem` the data of the page. Writes through `rootItem` and `parentItem`
  there are edits of the page's data, like in forms with `mutate: true`. In
  dialogs, `rootItem` is the dialog's data.

### Routes, requests and the clipboard

- The URLs of the forms of lists in nested sections and inlined objects contain
  the name of their container, like the data paths of their items, e.g.
  `/books/1/contents/notes/2` for a list `notes` in a section `contents` with
  `nested: true`.
- The items of tree lists with a resource are addressed by their id in URLs
  instead of their index.
- `request({ cache: 'local' })` caches while the route of the form or view is
  shown, and dialogs have their own local cache while they're open.
- Pasting writes the copied values into the item, which keeps its id and
  position. The items of its lists are added as new items with new temporary
  ids, and lists with their own resource are left out. Copying gives related
  items new temporary ids, distinct for each id in each list, e.g. `@12` and
  `@13` for the id `7` and the temporary id `@7`, which both became `@7`
  before. Copying the item of a nested form leaves out the ids of its items.
- Since 4.3, relations to records outside the copied data are copied by the
  labels of their options instead of their ids, e.g.
  `author: { $label: 'Jane Austen' }`, and pasting resolves them through the
  options of the fields. `clipboard.copy()` and `clipboard.paste()` see the
  labels instead of the ids.
- Since 4.5, `clipboard` on lists copies and pastes the list as a whole,
  instead of adding copy and paste buttons to the items. Give the items a
  clipboard through `form: { components, clipboard }`, or a form with its own
  `clipboard`.

### Data paths

- `**` in the middle of the data paths of `getValueAtDataPath()` and
  `getEntriesAtDataPath()` of `@ditojs/utils`, and so of the `assets` of
  models, matches zero or more levels instead of one or more, like in
  `.gitignore` and in `match` of `context.validate()`: `a/**/c` matches `a/c`
  too. At the end, `a/**` still matches everything inside `a`, but not `a`.

### Server

- Since 4.5, hooks identify custom actions by their method and path, without
  colons, e.g. `'before:member:get-tech-doc-format'` for
  `'get tech-doc-:format'`, see
  [Hooks](./api/server/controllers.md#hooks). Keys with the action's key keep
  working until 5.0, with a deprecation warning. Two actions of the same type
  with the same identifier throw: change the route of one of them. Wildcard
  hooks like `'before:*:*'` also run for actions with route parameters.
- `authorize: false` on an action or a controller denies access, where 3.5
  skipped it and fell back to the next setting, or made the action public.
  Remove it from actions that need to stay reachable.
- As in 3.5, the messages of all errors thrown in actions reach the client, also
  of errors that aren't `ResponseError`s. Throw a `ResponseError` (or a
  subclass) for messages meant for clients, and catch other errors whose
  messages shouldn't leave the server.

## New features

- Context members: `isDirty`, `isCreating`, `validate()`, `isValid()`,
  `clearErrors()`, `markDirty()`, `resetItem()`, `submit()`, `closeForm()`,
  `closeDialog()`, `showDialog()`, `getRouteUrl()`,
  `getSchemaValue(key, { type, default })`, `routeQuery`, `sourceQuery`,
  `selectedTab` and `isSelected` in option labels, see [Contexts](#contexts).
- Handlers of bubbled events receive `currentDataPath`, the data path of the
  component whose handler runs, next to the `dataPath` of the changed value,
  e.g. the form's own and the changed field's in `onChange()` of a form.
- `serializedItem` and `serializedRootItem` are available in all callbacks,
  e.g. `if` and `computeValue()`, and in `serializeValue()` they're the data
  being built.
- Forms fire `onCancel()` when their cancel button closes them. A value
  returned from `onSuccess()` or `onError()` of forms suppresses the
  notification, like on buttons.
- `itemLabel` holds the label of the form's item in all callbacks inside a
  form, e.g. its events like `onSuccess()` and the `if` and `label` of its
  components, computed when it's read. In `itemLabel()` itself, it's `null`.
- Trees fire `onToggle()`, set on the tree or on its `children` schema, with
  `context.collapsed` and the item's context when their items collapse or
  expand.
- Type descriptors can state `rendersLabel`, `submitsData` and
  `hasEmbeddedForms`, display values with `getDisplayValue(context)`, convert
  stored values with `deserializeValue(context)`, and load options with
  `getOptionsDataSchema(schema)`, e.g. `schema => schema.options`, whose
  component reads the loaded options as `context.options`. `type` takes an
  array of types that share the descriptor, e.g. `type: ['date', 'datetime']`.
- `multiple` of uploads, `lines` of textareas and markups, and `placeholder` of
  multiselects take callbacks.
- Lists with `wrapPrimitives` support routed forms, which edit the wrapped
  value as their draft and write it back at its index.
- Panels with `nested: true` hold their values under their name, like nested
  sections, e.g. `item.details.title`. Panels with their own `data` can't be
  nested and throw.
- New types: `AdminContext`, `AdminUser` and `TypeDescriptor`.
  `context.extend()` is typed, and the SCSS variable `$error-bar-width` sets
  the width of the marks of rows with errors.
