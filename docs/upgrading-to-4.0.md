# Upgrading to Dito.js 4.0

## Admin

### Routes

The routes of the admin are generated from a route tree, built once from the
schemas of the views, instead of by the types while they set up their schemas.

- The URLs of the forms of lists in nested sections and inlined objects contain
  the name of their container, like the data path of their items, e.g.
  `/books/1/contents/notes/2` for a list `notes` in a section `contents` with
  `nested: true`. Sections without `nested: true` hold no data of their own and
  stay out of the URLs.
- The forms of lists in forms that are shared by several views or lists are
  routed in each of them.
- `maxDepth` limits how often a list with routed forms occurs inside itself in
  a route, also when its form is shared, and lists beyond it don't render, as
  intended. In inlined content, it limits how deep forms with routes are
  reached through lists that share the same forms.
- Lists with their own `path`, and lists whose names don't survive normalizing
  their paths (e.g. `sourceURLs`), open their items' forms.
- Lists linked to views (`view:`) link to the form of the view also when the
  view has several components, and can create items there.
- The items of tree lists with a resource are addressed by their id in URLs,
  like the items of other lists with a resource.
- Saving the forms of the children of tree items doesn't reload the tree,
  which only matters for trees whose children have their own resource.

### Data

Views, forms, dialogs and panels with their own data each have a data model,
which components write the data through.

- Forms are dirty once their data is edited, until it's saved, applied or
  loaded again, instead of when it differs from the data they started with.
  Reverting an edit leaves the form dirty, while writes that don't change the
  value aren't edits.
- Dirty state belongs to the one that saves the data: the form or view, and
  each source with its own resource for the changes of its list and inside
  it, e.g. the order of its items or the children of tree items. They only
  count as dirty if they have a button of type `submit`, whatever its name,
  like views, dialogs and panels with their own data. Views without one no
  longer ask about unsaved changes. `context.isDirty` tells this.
- Direct writes to the data don't make it dirty, e.g. of what an action on the
  server saved. `formComponent.applyCleanChanges()` is removed: write the data
  directly instead. Code that edits data directly calls
  `context.markEdited()`.
- Custom types and custom components change their value by emitting
  `update:modelValue`, which writes it through the data model, an edit if the
  value changes. Code that changes a value in place calls
  `context.markEdited()`. `emitChangeEvent()` is removed: emit `change`.
- Forms with `mutate: true` edit the item of their parent through the data
  model of the parent, which turns dirty right away. Cancel only closes them.
  When they create their item or load it through their own resource, they
  have their own data model.
- Applying a nested form makes the parent dirty if it changes the item.
- Changes of the lists of sources with their own resource are clean again
  once a button of the source submitted them through a resource, while other
  edits stay dirty. Saving the form leaves them dirty, as it doesn't send them.
- The response of a save is merged into the form's data, also over edits that
  code made while the save was pending (its fields are disabled meanwhile).
  If the form opened another item in the meantime, the response is dropped.
- Leaving a form while it saves waits for the save, for up to 30 seconds.
  "Save & close" and opening a created item only navigate if the route is
  still within the form once the save is done, so they never override where
  the user went in the meantime.
- Components in panels with their own data, e.g. filters, get their defaults
  and computed values, and their edits don't make the view or form dirty.
- Dialogs are the containers of their data: `rootItem` in the contexts inside
  them is their data, and the data paths of their components start at it.
- Panels with their own data, e.g. filters, have their own data model, but
  stay within the data around them: their data is `item` in the contexts
  inside them, `rootItem` stays the root data of the page, and the data paths
  of their components continue the panel's. The callbacks that decide about a
  panel itself, `if`, `visible`, `label`, `sticky` and `data()`, receive the
  context of the data around the panel, with the panel's schema.
- Submitting waits for running uploads, without a time limit, so that the
  stored files are sent, also through the buttons of sources with their own
  resource, which also wait for the loads of data schemas and options now.
- Type components, schemas and panels no longer have `isDirty`, type
  components no longer `markDirty()`.
- Forms merge the data of the server into their data in place instead of
  replacing it, when saving, when reloading their item and through
  `context.replaceItem(data)`, which returns the form's data. Objects keep
  their identity: open nested forms keep their edits, and items keep their
  uids, item stores and the errors of unchanged values. Values missing in the
  response are removed, new items get their ids from it in order. The data of
  sources with their own resource is kept, wherever they are in the schema,
  not only for mounted components. Saving still clears the errors of the
  values.
- `schemaComponent.filterData()` is removed.
- Nested forms without `mutate: true` edit a draft of their item, which
  applying merges into the item in place, instead of writing the data
  serialized for the server back into the parent: values the form leaves out
  or excludes stay, related objects stay whole, and `serializeValue()` only
  runs when the parent is saved. New items in the draft keep their uids, and
  Cancel leaves the parent untouched, also temporary ids of references.
- In nested forms, `rootItem`, `parentItem` and the options and computed
  values that read data paths see the parent's data with the draft in place
  of the item. Everything outside the item is read-only there: writes warn
  and are ignored. Forms with `mutate: true` edit the parent's data directly,
  as before.
- `context.replaceItem(data)` in nested forms merges the data into the
  draft like an edit: it reaches the parent once the form is applied, and is
  discarded on Cancel, which asks to discard it first. So are the responses of
  their buttons with resources.
- Open nested forms keep their item when it or the item of a parent form
  moves, e.g. as items before it are added, removed or moved, and follow it to
  its new index in the URL, which replaces the current history entry. Forms of
  list items close once their item is removed, like the forms of tree items
  did, instead of showing the next one.
- The data serialized for the server and for the clipboard is only built when
  saving and copying. `serializedItem` and `serializedRootItem` of contexts
  (before `processedItem` and `processedRootItem`) are built when they're read
  and cached until the data that they read changes, also in the callbacks of
  the data model, e.g. `if` and `computeValue()`, which lacked them. In
  `serializeValue()`, they're the data being built. Components no longer have
  `processedData`, `processedRootData`, `processedItem`, `processedRootItem`,
  `processData()` and `setData()`: read `serializedItem` and
  `serializedRootItem` from the context.
- Pasting writes the data through the data model as new items, after
  `clipboard.paste()` received the copied data: related items get new
  temporary ids each time, and sources with their own resource are left out.
  Values that don't change are kept as they are and don't make the data
  dirty.
- Copying the item of a nested form leaves out the ids of its items, and keeps
  the ids of relations to data outside the item. The copied ids of related
  items are marked as `@7` for the id `7`, and as `@@7` for the temporary id
  `@7`, which both turned into `@7` before.

### Value hooks

The hooks that convert values are named after what they convert, and a new
hook converts stored values to the values that the components edit:

| 3.x         | 4.0                  | Converts                                    |
| ----------- | -------------------- | ------------------------------------------- |
| `format()`  | `formatValue()`      | the edited value to the displayed one       |
| `parse()`   | `parseValue()`       | the entered value to the edited one         |
| `compute()` | `computeValue()`     | the data to a derived value                 |
| `process()` | `serializeValue()`   | the edited value to the stored one          |
| –           | `deserializeValue()` | the stored value to the edited one          |

- `deserializeValue()` runs on the values of loaded data, of the data that
  saves respond with, of `context.replaceItem(data)`, of pasted data and of
  the filters in the query, before the values of their items. It's the
  counterpart of `serializeValue()`, which runs for saving and copying.
- The types' hooks of the same names run before the schema's, e.g. the date
  types convert strings to `Date` objects in `deserializeValue()`, and back in
  `serializeValue()`. Date values that code writes, e.g. defaults and computed
  values, are `Date` objects: the date components no longer convert strings.
- Cells without `render()` and item labels show values as their component's
  type describes them in `getValueText()`: the date types format their dates
  with `context.format()` and the type's `format`, e.g. 'June 1, 2026' for
  `type: 'date'`, instead of the stored string.
- `formats` of the date types is `format`, and the color type reads `format`
  as before, which no longer clashes with `format()`.
- Schemas that still define `format()`, `parse()`, `compute()`, `process()`
  or `formats` throw an error when they're set up, naming the replacement.
  The date and color types read `format` as their setting: there, a
  `format()` of 3.x can't be told apart, and needs to be renamed to
  `formatValue()` by hand.

### Validation

- Errors live in the data model, by the data that holds each value and its
  name, so they stay with items that move, and with fields that aren't
  mounted, e.g. in collapsed sections.
- The errors of values, of validation and of the server, apply to the value
  that they were set for: any change of the value clears them for good, also
  in place or through direct writes, even if it changes back. Validating a
  value again, e.g. on blur, only replaces its validation errors.
- The errors of fields, e.g. of options that failed to load or of searches,
  stay until their source removes them, unlike the errors of values.
- Errors inside values that no deeper field displays show on the field of the
  value, with their `path` in it, e.g. "The address field's street is
  required." for an object edited as code, instead of only in the
  notification. Revealing them focuses that field.
- Nested forms take over the errors of their item when they open, and when
  their parent reveals errors while they're open.
- The rows of lists and the items of trees whose items or children hold
  values with errors are marked with `dito-table__row--error` and
  `dito-tree-item--error`, e.g. for errors in the forms of nested routes.
- The validation errors of the server for the buttons of lists with their own
  resource are notified, as their items are edited in their own forms.
- Type components no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated`, `verify()`, `markTouched()`, `clearValidation()`,
  `resetValidation()`, `addError()`, `getErrors()`, `clearErrors()`,
  `showValidationErrors()` and `validate()`: `context.validate(match)`
  validates the values whose data paths match.
- Forms, views and schemas no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated`, `clearErrors()` and `resetValidation()`, and no
  longer `validateAll()`, `verifyAll()` and `showValidationErrors()`:
  `context.validate()` and `context.verify()` validate the data of the form,
  view, dialog or panel with its own data. Forms clear the errors of their
  data once they're submitted, also mutating forms, which share the data
  model of their parent.
- Panels no longer have `errors`, `isTouched`, `isValid`, `isValidated`,
  `validateAll()`, `verifyAll()`, `resetValidation()` and `clearErrors()`:
  `context.validate()` in panels with their own data validates their data.
- `navigateToComponent()` and `navigateToRouteComponent()` are removed:
  validating reveals the errors, opening the forms of nested routes, collapsed
  schemas, inlined items and the tabs of their fields, and focuses the first
  one.

### Contexts

The contexts that callbacks receive no longer expose components:
`component`, `formComponent`, `schemaComponent`, `viewComponent`,
`dialogComponent`, `panelComponent`, `resourceComponent` and `sourceComponent`
are removed. The state and actions that callbacks used them for are members of
the context. `isDirty`, `isCreating`, `validate()`, `markEdited()` and
`replaceItem()` belong to the data of the context: of its form, view, dialog or
panel with its own data, e.g. the filters panel, a nested form being its own.
Forms with `mutate: true` are the exception: they edit the item of their
parent in the parent's data, so their `isDirty` reports the parent's state, as
does their entry in the breadcrumb trail.

The callbacks of a component, e.g. its `if`, `label` and `events`, see the
item that the component is in, the callbacks that decide about a panel the data
around the panel, and the ones of the panel's components the panel's data.
Components without a schema or data of their own, e.g. tabs, scopes, the table
head, label affixes and the clipboard, give their callbacks the context of the
component that renders them. Events that bubble up from components, e.g.
`change`, keep the context of the component that emitted them, with the
`dataPath` of the changed value.

- `formComponent.isDirty` and `formComponent.isCreating`: `isDirty` and
  `isCreating`, which is `false` outside of forms.
- `formComponent.validateAll()`: `validate()`, which shows the errors and
  returns whether the data is valid.
- `formComponent.dataModel.markEdited()`: `markEdited()`.
- `formComponent.setData(data)`: `replaceItem(data)`, which returns the data.
  Forms merge `data` into their item, views, dialogs and panels replace their
  data with it, which is set up with the defaults right away.
- `navigate(formComponent.parentRouteComponent.path)`: `closeForm()`, which
  throws outside of forms, as `closeDialog()` does outside of dialogs.
- `component.$router.resolve(location).href`: `getRouteUrl(location)`.
- `query`, the query of the route: `routeQuery`. `sourceComponent.query`:
  `sourceQuery`, the query of the nearest list, e.g. its scope and filters,
  `null` inside forms and in `itemLabel()`.
- `getResourceUrl(resourceComponent.resource)`: `getResourceUrl()`, the URL of
  the nearest form or list with a resource: of the item that the form edits, or
  of the collection that the list loads or the form creates its item in. It
  throws without such a form or list, instead of returning `null`.
  `getResourceUrl(resource)` and `request({ resource })` resolve `resource`
  relative to that form or list.
- `request({ cache: 'local' })` caches the response while the route of the
  form or view is shown, instead of in the nearest component with a resource
  that loads its own data, and doesn't cache outside of routes, e.g. in
  dialogs. `cache: 'global'` caches for the admin session, until the user
  changes.
- `itemLabel` and `itemLabelText` are set in the contexts of the `success` and
  `error` events of the buttons of forms and sources. The form's own context,
  e.g. of its events, no longer has them, and they're `null` in the `if` and
  `default` callbacks of the components of forms.
- `component.showDialog({ components, buttons, data, settings })`:
  `showDialog({ components, buttons }, { data, settings })`, which resolves
  with the value that the dialog is closed with. In the dialog,
  `dialogComponent.resolve(value)` is `closeDialog(value)`.
  `dialogComponent.reject()` is removed. `admin.context.showDialog()` takes
  the same arguments.
- `formComponent.selectedTab`: `selectedTab`, the selected tab of the nearest
  form. Tabs render once they're selected and stay rendered, so their
  components don't need to check for their tab. Revealing errors renders the
  tabs of their fields.
- `viewComponent.resetValidation()` after submits: the buttons of sources clear
  the errors of the source's data once they submitted it, like forms do.
- `component.$refs.element.isOpen` in `options.label()`: `isSelected`, which
  tells whether the labelled option is selected, both as the shown value, e.g.
  of a closed multiselect or its tags, and as an entry in the open list.
- In nested forms, `serializedRootItem` is the projection of `rootItem`, with
  the draft in place of the item, instead of the parent's serialized data.
- `validate(match)` and `verify(match)` validate only the values whose data
  paths match, e.g. a regular expression. `verify()` doesn't show the errors.

The members that components provide, e.g. `sourceQuery`, `isRunning` and
`submit()`, and the resource that `getResourceUrl()` and `request()` resolve
against, depend on which component evaluates the callback:

- The data model evaluates `if`, `default`, `computeValue()`, the `data()` of
  options and the validations, also for components that aren't rendered, with
  the members of the form, view, dialog or panel that holds the data.
  Rendering evaluates `if` again with the members around the component, e.g.
  of the inlined list that it is in.
- The containers of components evaluate their schema values, e.g. `visible`,
  `width`, `label` and `disabled`, with the members around the component, not
  the ones that it provides itself: `disabled: ({ isRunning }) => isRunning`
  disables a button, but not its container.

`schemaComponent.resetData()` is removed: the filters panel clears its data
with `replaceItem({})`.

`index` is renamed to `valueIndex`, the index of the value in its list, next to
`itemIndex` and `parentItemIndex`, the indices of the item and its parent item
in their lists:

| Callbacks of                                 | `valueIndex`         | `itemIndex`                |
| -------------------------------------------- | -------------------- | -------------------------- |
| Fields, e.g. `label` and `onChange`          | `null`               | The item holding the field |
| Rows of lists, e.g. `itemLabel` and `render` | The row              | The row                    |
| List values, e.g. the files of uploads       | The value's position | The item holding the list  |

### Schema handlers

Schemas no longer define members of their components: `methods`, `computed`,
`watch` and `data` are removed, and throw an error when a schema still
defines them, except `data` of panels and of the types that resolve their
value from it, e.g. `computed`. Handlers, e.g. `onChange`, `onClick`,
`itemLabel`, `render` and `clipboard.copy()`, are called with their context
only, not with the component as `this`.

- Methods: plain functions in the module of the schema, which take the
  context or the values they need.
- `computed`: read the values from the context, e.g. `item` and
  `serializedItem`, or write derived values with `computeValue()`.
- `watch` on data: `onChange` of the form or of a component above the
  changed values, which receives the `dataPath` of the changed value, also of
  nested data. Unlike watchers, it fires for edits only, not for writes of the
  data model, e.g. defaults, computed and loaded values, or of app code. Values
  that derive from other values use `computeValue()`.
- `data`: state in module scope, e.g. in a `WeakMap` or `WeakSet` keyed by the
  item. Panels keep `data` for their own data, e.g. filters.
- `this.submit()` in buttons: `submit()` of the button's context, which
  resolves with whether it succeeded, and throws outside of buttons of forms
  and sources.

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

Handlers are declared as `on…` properties of the schema, e.g. `onChange()`
and `onClick()`. The grouped `events: { change() {} }` are deprecated: they
still work in 4.0, log a deprecation warning once, and replace the `on…`
handler of the same event in the same schema, e.g. the default `onClick()` of
the cancel and submit buttons of forms. They'll be removed in a later major
version.

```js
// Before:
events: {
  click({ item }) {}
}

// After:
onClick({ item }) {}
```

`input` fires for each edit that changes the value, in all types, and `change`
once the edit is done:

- `input` fires per keystroke in text fields, with each pick in selects,
  checkboxes, radios, switches and multiselects, per step in sliders and color
  pickers, and with the `change` of lists, objects, trees and uploads. Typing
  in the search of a multiselect or focusing a field doesn't fire it.
- Date, datetime and time fields fire `change` when the picker closes, the
  field loses focus or Enter is pressed, not for each picked or typed value.
- `input` bubbles to the schemas above like `change`, with the `dataPath` of
  the edited value, so the `onInput()` of a form sees every edit. Returning
  `false` from a handler stops it.

### Admin context

`DitoAdmin` holds the services of the admin in one object, its `context` of
type `AdminContext`, instead of the `api`, `session` and `viewRegistry` injects
and the members of components that reached them:

- `api`, `user`, `views`, `flattenedViews`, `notify()` and `showDialog()`: the
  same members of the context in callbacks, and of `admin.context` elsewhere,
  where they're reactive. `locale`: `context.api.locale`. `session`:
  `admin.context.session`.
- `closeNotifications()` and `rootComponent` are removed, along with
  `rootComponent.isLoading` and the deprecated `registerLoading()`.
- Route records no longer have `meta.api` and `meta.schema`.
- Dito's components and types are registered globally with `app.component()`,
  instead of as components of the root component, so custom components can
  render them by name.

### Routes, sources and resources

Views, forms, lists, objects and trees no longer expose themselves to the
components that they render. What callbacks need of them are members of the
context, see [Contexts](#contexts), the rest is internal:

- `routeComponent`, `formComponent`, `viewComponent`, `parentRouteComponent`,
  `parentFormComponent`, `dataModelComponent`, `dialogComponent`,
  `panelComponent`, `sourceComponent`, `resourceComponent`, `dataComponent`,
  `parentResourceComponent`, `tabComponent`, `parentSchemaComponent`,
  `schemaComponents` and `mainSchemaComponent` are removed, along with the
  `$routeComponent`, `$dataModelComponent`, `$dialogComponent`,
  `$panelComponent`, `$sourceComponent`, `$resourceComponent`,
  `$dataComponent`, `$schemaComponent`, `$schemaParentComponent`,
  `$tabComponent`, `$loadingTracker`, `$verbs` and `$isPopulated` injects and
  `appState.routeComponents`.
- `RouteMixin`, `SchemaParentMixin`, `SourceMixin`, `ResourceMixin` and
  `ItemMixin` are removed, and so are the members of views, forms and sources
  that they added, e.g. `routeLevel`, `getFormRoute()`, `getCreatePath()`,
  `getFormPath()`, `resource`, `createItem()`, `createData()`, `forms`,
  `isCompact`, `linksToView`, the deprecated `setLoading()`, `label`,
  `breadcrumbPrefix`, `param`, `isNestedRoute` and `isMutating`, and the
  lookups of schemas, `getComponent()`, `getComponents()`,
  `getComponentByName()`, `getComponentsByDataPath()`, `getPanel()`,
  `getPanels()`, `components`, `panes`, `panels` and `revealComponents()`.
- The `meta` prop of the components and types is removed, along with
  `nestedMeta`.
- `DitoScopes`, `DitoPagination` and `DitoTableHead` take the `ListQuery` of
  their list as `listQuery` instead of `query`. `DitoSourceItem` takes the
  `formSchema` and `label` of the item from its source.
- Forms don't continue the source of their parent, e.g. the forms of tree
  items, whose `sourceQuery` was the tree's query.
- Relative resources resolve against the nearest form or source with a
  resource of its own: sources continue the one of their route, forms the one
  of their parent route, which is the one of the nearest form above with a
  resource. The forms of tree items no longer continue the resource of the
  tree, which resolved their item at `pages/pages/1` instead of `pages/1`.
  Lists in the items of inlined lists resolve their relative resources against
  the form too, like the lists next to them, instead of against the API root.
- Buttons submit through their source, or else to their form, which saves its
  data through its resource or applies it to its parent. The verbs of forms
  and sources, e.g. `apply` and `remove` in nested data, belong to them, not
  to resources.
- Views provide the source of their main component to their other
  components: the verbs, `sourceQuery` and submits of the components of
  single-component views outside of their list, e.g. view buttons, are the
  list's. Views have no resource: outside of their lists, relative resources
  resolve against the API root, and `getResourceUrl()` throws.
- Focusing components in nested tabs selects these tabs too, and replaces the
  hash of the route instead of adding a history entry.

### Custom types

- Types are defined with `defineType(descriptor)`, exported by `@ditojs/admin`,
  instead of `admin.register(type, options)`. The descriptor describes how the
  admin handles the schemas and values of the type, also when they aren't
  rendered, and names the component that renders it. The component receives
  the `schema`, its `context` and the value as `modelValue`, like the
  components of `type: 'component'` (see Custom components):

  ```js
  import { defineType } from '@ditojs/admin'
  import DitoRating from './DitoRating.vue'

  defineType({
    type: 'rating',
    component: DitoRating,
    defaultValue: 0,
    getValidations: schema => ({ range: [0, schema.max ?? 5] })
  })
  ```

  `type` also takes an array of types that share the descriptor, e.g.
  `type: ['date', 'datetime']`.

- The static options of type components move to the descriptor:
  `defaultValue`, `defaultNested`, `defaultVisible`, `defaultMultiple`,
  `defaultWidth`, `excludeValue` (now `defaultExclude`),
  `ignoreMissingValue()` (now `ignoresMissingValue()`),
  `treatNullAsMissing()` (now `treatsNullAsMissing()`), `generateLabel` (now
  `generatesLabel`), `omitSpacing` (now `omitsSpacing`), `processSchema()`
  (now `setupSchema()`), `processValue()` (now `serializeValue()`) and
  `getChildSourceSchemas()`. `getSourceType(type)` becomes
  `sourceType: 'list'` or `'object'`, `getTypeValidations()` becomes
  `getValidations(schema, context)`, and `getFormSchemasForProcessing()` is
  removed: the child sources of items are walked like components of their
  forms.
- Flags state what is special about the type, instead of the admin checking
  type names: `hasLabel()` returns `false` when the component displays the
  label itself instead of its container, `rendersLabel` renders the component
  as the label of its container, `resolvesValue` resolves the value from
  `schema.data` or `schema.dataPath`, `submitsData` makes buttons submit and
  count for the dirty state like `submit`, `hasFormat` reads `format` from
  the schema, which other types reject as the `format()` of 3.x, and
  `hasNestedForms` renders the
  forms of the items inside the form or view of their source. Buttons submit
  through `context.submit()` because the button component provides it, not
  because of an option.
- Only types with `getOptionsDataSchema(schema)` load options, which returns
  the data schema of the options that the data model loads. Custom types that
  load `schema.options` like `select` spread `optionsTraits` into their
  descriptor, and `numberTraits` and `textTraits` share the validations of
  numbers and the serializing of text values. All three are exported by
  `@ditojs/admin`.
- `getItemAdapter(schema)` wraps the items of sources for their forms and
  unwraps them again, e.g. the values of `wrapPrimitives`. In inlined forms
  of such items, only the component of the wrapped value shares the data path
  of the item, the others get their own. Routed forms edit the wrapped value
  as their draft, and write the unwrapped value back at its index when
  applied. They can't `mutate` the values, which aren't objects. Inlined
  items read and write the values at their index, so their state, e.g. being
  collapsed, stays at the index when the values move.
- `getPanelSchema(api, schema, dataPath, source)` receives the `listQuery` of
  the list as `source.listQuery` instead of the component.
- `processSchema(api, schema, name)` is `setupSchema(api, schema, name)`, and
  only sets up the schema, e.g. resolves the schemas that it contains. It no
  longer receives `routes` and `level`, and doesn't add routes.
- `processValue(context, graph)` is `serializeValue(context)`, without `graph`:
  the admin registers the sources and relations whose ids it serializes from
  `sourceType` and `relate` itself. The new `deserializeValue(context)`
  converts stored values to edited ones. Both run before the schema's hooks of
  the same names.
- Types that route sources next to the forms of their items, like the children
  of tree items, return their schemas from `getChildSourceSchemas(schema)`.
- Components no longer have `getTypeComponent()`.
- The components of dito's types are built with composables instead of
  `TypeMixin`, `ValueMixin`, `ContextMixin`, `TextMixin`, `NumberMixin`,
  `OptionsMixin`, `DomMixin` and `SortableMixin`, which are removed. Their
  instances no longer have `value`, `item`, `parentItem`, `rootItem`, `focused`,
  `validate()` or the resolved schema values, e.g. `readonly`, and their
  contexts are built from their props and services instead of the instance. They
  no longer have `focus()`: validating reveals and focuses the fields with
  errors.
- The data model replaces the references of components with `relate` with
  their related options once the options are loaded, and shows the errors of
  failed loads, also while the component isn't rendered.

### Custom components

The components of `type: 'component'` schemas no longer get `DitoMixin` and
`TypeMixin` mixed in. They receive the `schema`, its `context` and the value as
`modelValue`, emit `update:modelValue` to change the value, and `change` once
the change is done, which emits the schema's `change` event. `context.item`
follows the changes of the data. Components declare these props and events, so
that they don't fall through to their root element, which gets the id that the
label of the component points to, and dito warns in development if they don't.
`CustomComponentProps` and `CustomComponentEmits` describe them. The field's
attributes, e.g. `aria-describedby` and `disabled`, the optional prop
`errorsElementId`, and the `focus`, `blur` and `input` listeners fall through
too, unless the component declares them: they emit the schema's events, and
`blur` validates the value.

- `value`: `modelValue`. `this.value = value`:
  `this.$emit('update:modelValue', value)`, which writes the value through
  `parseValue()`, and `onChange()`: `this.$emit('change')`.
- `item`, `parentItem` and `rootItem`: `context.item`, `context.parentItem` and
  `context.rootItem`. `api`: `context.api`.
- `getSchemaValue(key)`: `getSchemaValue(schema, key, context)`, exported by
  `@ditojs/admin`, which calls schema values that are functions with the
  context.
- The `component` of lists and objects, which renders their items, receives
  the item as `modelValue`, and the `component` of columns the value of the
  cell, with the column as `schema`.

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
import { getSchemaValue } from '@ditojs/admin'

export default {
  emits: ['update:modelValue', 'change'],
  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: Number, default: null }
  },
  computed: {
    max() {
      return getSchemaValue(this.schema, 'max', this.context)
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

The admin's own components are no longer part of the API: they're built with
`setup()` and composables, without mixins, and custom components can't reach
them or their members. `DitoMixin`, `EmitterMixin` and
`DitoComponent.component()` are removed, and so are the types of their
instances, `DitoComponentInstanceBase`, `DitoFormInstance`, `DitoViewInstance`,
`DitoSchemaInstance`, `DitoSourceInstance` and `EmitterMixin`. Their actions
are members of the context:

- `this.request()`, `this.format()`, `this.navigate()`, `this.download()` and
  `this.getResourceUrl()`: `context.request()`, `context.format()`,
  `context.navigate()`, `context.download()` and `context.getResourceUrl()`.
  `sendRequest()` and `getQueryLink()` are removed: use `context.request()`,
  and `context.routeQuery` with `context.navigate()`.
- `getLabel()`, `getStore()`, `setStore()` and `removeStore()` are removed.
  `labelize()` is exported by `@ditojs/utils`.
- The handlers of schema events receive the context only. `on()`, `off()`,
  `emit()` and `emitEvent()` are removed. `change` events bubble from the
  components to the schemas above them unless a handler returns `false`,
  which now also stops them between schemas.

### Schema options

| 3.x                                    | 4.0                                       |
| -------------------------------------- | ----------------------------------------- |
| `open: true` of trees                  | `collapsed: false`, `true` by default     |
| `groupBy` of options components        | `options.group`                           |
| `relate: true` with `relateBy: 'code'` | `relate: 'code'`, `relate: true` for `id` |

- `options.group` is like `options.label`: the key of the options' group, or a
  callback that returns the group of the `option` of its context. The grouping
  of `groupBy` on the schema and `options.groupBy` is removed.
- Components with options keep values that no option has, also once the
  options are loaded, e.g. of removed options, and send them when saving,
  instead of setting them to `null`.
- `multiple`, `searchable`, `stayOpen` and `taggable` of multiselects,
  `multiple`, `extensions`, `accept` and `maxSize` of uploads and `lines` of
  textareas and markups also take callbacks, which are resolved with the
  context also when the values are serialized.

### Type names

The public types no longer carry the `Dito` prefix, except `DitoAdmin`, and
are named after what they are, like the classes they describe:

- `DitoContext`: `SchemaContext`, the context that callbacks receive.
- The type of `context.user`: `AdminUser`.
- `DitoDataModel`, `DitoListEntry` and `DitoValidationError` are removed, as
  the data model is internal.
- `DitoGlobal`, the type of the global `dito` object: `GlobalConfig`.
- The schema types named after the removed mixins describe the settings that
  schemas share: `SchemaDitoMixin` and `SchemaTypeMixin` are part of
  `BaseSchema`, and `SchemaSourceMixin`, `SchemaOptionsMixin`,
  `SchemaNumberMixin`, `SchemaTextMixin`, `SchemaAffixMixin` and
  `SchemaDataMixin` become `SourceSettings`, `SelectionSettings`,
  `NumberSettings`, `TextSettings`, `AffixSettings` and `DataSettings`. The
  deprecated `SchemaSetupMixin` and `SchemaRouteMixin` are removed: use
  `SchemaFields` and `SchemaRoute`.

Only `SchemaContext`, `AdminContext`, `DitoAdmin`, the schema types and the
contracts of types and custom components are exported. The contexts of data,
routes, sources and resources, the data model, the UI registry and the loading
tracker are internal.

### Removed deprecations

- `defaultSort` and `defaultScope` of sources and `omitSpacing` of schemas
  are removed from the types, as they aren't read: use `defaultSort` of
  columns, `defaultScope` of scopes, and `omitsSpacing` of type descriptors.
- `dateFormat` of date schemas is removed from the types, as it isn't read:
  use `format.date`.
- The `HTTPVerb` type is removed: use `HTTPMethod`.
- The `$pulldown-radius`, `$pulldown-padding-ver`, `$pulldown-padding-hor` and
  `$pulldown-padding` SCSS variables are removed.

## UI

### Styles

The modifiers of `DitoTrigger` follow BEM like the rest of the styles:
`.dito-trigger-disabled` is `.dito-trigger--disabled`, and the placement
classes of the popups, e.g. `.dito-popup-bottom-left`, are
`.dito-popup--bottom-left`.

## Builds

`@ditojs/admin` and `@ditojs/ui` are only published as ES modules: their UMD
builds and the `require` conditions of their exports are removed.
`defineViteConfig()` of `@ditojs/build` only builds ES modules, and its
`rollupOutput` option, which only served the UMD builds, is removed.

## Server

### Lifecycle

- `Service.setup(config)` is `configure(config)`, which services can override
  to read their configuration. The application starts and stops its services
  itself, instead of `setup()` registering them for its events.

### Queries

- `upsert()` and `upsertAndFetch()` run in a transaction, so a failure rolls
  back the patch, or the models saved before it.
- The array forms of `patchAndFetch()` and `updateAndFetch()` save each model
  by its id in one transaction, and throw for models without ids instead of
  inserting them: insert these with `insertAndFetch()`. The collection actions
  `put` and `patch` of controllers still insert the models without ids, in one
  transaction with the saved models.

### Removals

- `AdminController.getPath(name)`: `resolveConfigPath(name)`.
- `returns` of handler definitions, and `options.returns`: `response` and
  `options.response`.
- The `cyclic` option of the `*DitoGraph*()` methods, which has no effect
  since 3.3.1.

### Validation

- `type: 'color'` validates the values that the admin's color type stores:
  the hex colors `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, color keywords,
  and the objects of its `rgb`, `prgb`, `hsl` and `hsv` formats. Other color
  strings, e.g. `'rgb(0, 0, 0)'`, are rejected: use `type: 'string'` for them.

### Admin development server

- The admin's HMR is served through the app's server (`server.ws.server` in
  the admin's Vite config), instead of on a port of its own: remove
  `server.hmr.port`, and `port: 0` no longer picks a free port.
