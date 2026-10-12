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
  longer ask about unsaved changes. `dataModel.isDirty` tells this,
  `dataModel.isEdited` whether the data was edited at all, also where it
  can't be saved, e.g. the order of a source without such a button.
- Direct writes to the data don't make it dirty, e.g. of what an action on the
  server saved. `formComponent.applyCleanChanges()` is removed: write the data
  directly instead. Code that edits data directly calls
  `dataModel.markEdited()`, and `dataModel.markClean()` once it saved it.
- Custom types that change their value in place write it through the data
  model: `set(data, key, value)`, `insert(list, index, item)`,
  `remove(list, index)`, `move(list, from, to)` and
  `replaceItems(list, items)`. Assigning `value` does this already.
  `emitChangeEvent()` is removed: call `onChange()`.
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
  not only for mounted components. `dataModel.mergeFromServer(data)` does the
  same for other code. Saving still clears the errors of the values.
- `schemaComponent.filterData()` is removed.
- Nested forms without `mutate: true` edit a draft of their item, which
  applying merges into the item in place, instead of writing the data
  processed for the server back into the parent: values the form leaves out
  or excludes stay, related objects stay whole, and `process()` only runs when
  the parent is saved. New items in the draft keep their uids, and Cancel
  leaves the parent untouched, also temporary ids of references.
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
  its new index in the URL. Forms of list items close once their item is
  removed, like the forms of tree items did, instead of showing the next one.
- The data processed for the server and for the clipboard is only built when
  saving and copying. `processedItem` and `processedRootItem` of contexts are
  built when they're read and cached until the data that they read changes,
  also in the callbacks of the data model, e.g. `if` and `compute()`, which
  lacked them. Components no longer have
  `processedData`, `processedRootData`, `processedItem` and
  `processedRootItem`: read them from `component.context`. In `process()`,
  they're the data being built.
  `schemaComponent.processData(target)` takes only the target, `'server'` or
  `'clipboard'`, and `schemaComponent.setData()` is removed.
- Pasting writes the data through the data model as new items, after
  `clipboard.paste()` received the copied data: related items get new
  temporary ids each time, and sources with their own resource are left out.
  Values that don't change are kept as they are and don't make the data
  dirty.
- Copying the item of a nested form leaves out the ids of its items, and keeps
  the ids of relations to data outside the item. The copied ids of related
  items are marked as `@7` for the id `7`, and as `@@7` for the temporary id
  `@7`, which both turned into `@7` before.

### Validation

- Errors live in the data model, by the data that holds each value and its
  name, so they stay with items that move, and with fields that aren't
  mounted, e.g. in collapsed sections. Read and write them with
  `dataModel.getErrors(dataPath)`, `getFieldErrors(dataPath)`,
  `setErrors(dataPath, errors)`,
  `addError(dataPath, message)`, `removeError(dataPath, message)`,
  `replaceErrors(errors, { dataPath, server })` and `clearErrors(dataPath)`.
- The errors of values, of validation and of the server, apply to the value
  that they were set for: any change of the value clears them for good, also
  in place or through direct writes, even if it changes back. Validating a
  value again, e.g. on blur, only replaces its validation errors.
- The errors of fields, e.g. of options that failed to load or of searches,
  are added with `addError()` and stay until their source removes them with
  `removeError()`. `getFieldErrors()` returns their messages, `getErrors()`
  only the errors of the value.
- Nested forms take over the errors of their item when they open, and when
  their parent reveals errors while they're open.
- The rows of lists and the items of trees whose items or children hold
  values with errors are marked with `dito-table__row--error` and
  `dito-tree-item--error`, e.g. for errors in the forms of nested routes.
- The validation errors of the server for the buttons of lists with their own
  resource are notified, as their items are edited in their own forms.
- Type components no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated`, `verify()`, `markTouched()`, `clearValidation()`,
  `resetValidation()`, `addError()`, `getErrors()`, `clearErrors()` and
  `showValidationErrors()`. `validate()` remains, and replaces the errors of
  the field.
- Forms, views and schemas no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated`, `clearErrors()` and `resetValidation()`, forms
  and views no longer `validateAll()`, `verifyAll()` and
  `showValidationErrors()`. Their `dataContext` validates with `validate()` and
  `verify()`, and shows the errors of the server with
  `showValidationErrors(errors, dataPath)`. Forms clear the errors of their
  data once they're submitted, also mutating forms, which share the data
  model of their parent.
- Panels no longer have `errors`, `isTouched`, `isValid`, `isValidated`,
  `validateAll()`, `verifyAll()`, `resetValidation()` and `clearErrors()`.
  The `dataContext` of panels with their own data validates and shows errors.
- `navigateToComponent()` and `navigateToRouteComponent()` are removed.
  `dataContext.revealErrors()` reveals the errors of the data: it opens the
  forms of nested routes through the route tree, and opens collapsed schemas
  and inlined items and renders tabs through `adminContext.ui`, see
  [Routes and the UI registry](#routes-and-the-ui-registry).

### Contexts

The contexts that callbacks receive no longer expose components:
`component`, `formComponent`, `schemaComponent`, `viewComponent`,
`dialogComponent`, `panelComponent`, `resourceComponent` and `sourceComponent`
are removed. The state and actions that callbacks used them for are members of
the context. `isDirty`, `isCreating`, `validate()`, `markEdited()` and
`replaceItem()` belong to the data of the context: of its form, view, dialog or
panel with its own data, e.g. the filters panel, a nested form being its own.
Forms with `mutate: true` are the exception: they edit the item of their
parent in the parent's data, so their `isDirty` reports the parent's state.

A callback sees the context of the place where it is declared: the callbacks of
a component, e.g. its `if`, `label` and `events`, see the item that the
component is in, the callbacks that decide about a panel the data around the
panel, and the ones of the panel's components the panel's data. Components
without a schema or data of their own, e.g. tabs, scopes, the table head, label
affixes and the clipboard, give their callbacks the context of the component
that renders them. Events that bubble up from components, e.g. `change`, keep
the context of the component that emitted them, with the `dataPath` of the
changed value.

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
  `listQuery`, the query of the nearest list, e.g. its scope and filters.
- `getResourceUrl(resourceComponent.resource)`: `getResourceUrl()`, the URL of
  the nearest form or list with a resource: of the item that the form edits, or
  of the collection that the list loads or the form creates its item in. It
  throws without such a form or list, instead of returning `null`.
- `component.showDialog({ components, buttons, data, settings })`:
  `showDialog({ components, buttons }, { data, settings })`, which resolves
  with the value that the dialog is closed with. In the dialog,
  `dialogComponent.resolve(value)` is `closeDialog(value)`.
  `dialogComponent.reject()` is removed. `adminContext.showDialog()` takes
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
- In nested forms, `processedRootItem` is the projection of `rootItem`, with
  the draft in place of the item, instead of the parent's processed data.
- `validate(match)` and `verify(match)` validate only the values whose data
  paths match, e.g. a regular expression. `verify()` doesn't show the errors.

`schemaComponent.resetData()` is removed: the filters panel clears its data
with `replaceItem({})`.

### Schema handlers

Schemas no longer define members of their components: `methods`, `computed`,
`watch` and `data` are removed, and handlers, e.g. `events`, `onClick`,
`itemLabel`, `render` and `clipboard.copy()`, are called with their context
only, not with the component as `this`.

- Methods: plain functions in the module of the schema, which take the
  context or the values they need.
- `computed`: read the values from the context, e.g. `item` and
  `processedItem`, or write derived values with `compute()`.
- `watch` on data: `events.change` of the form or of a component above the
  changed values, which receives the `dataPath` of the changed value, also of
  nested data. Unlike watchers, it fires for edits only, not for writes of the
  data model, e.g. defaults, computed and loaded values, or of app code. Values
  that derive from other values use `compute()`.
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
events: {
  change({ dataPath, rootItem }) {
    if (dataPath.startsWith('deliveryAddress/')) {
      copyAddress(rootItem)
    }
  }
}

function copyAddress(order) {
  Object.assign(order.billingAddress, order.deliveryAddress)
}
```

### Admin context

`DitoAdmin` provides the services of the admin to all components as one object,
the `adminContext` inject, which it keeps as its `context` too. It replaces the
`api`, `session` and `viewRegistry` injects, and the members of components that
reached them:

- `api`, `user`, `views` and `flattenedViews`: `adminContext.api`,
  `adminContext.user`, `adminContext.views` and `adminContext.flattenedViews`,
  which are reactive. `locale`: `adminContext.api.locale`. `session`:
  `adminContext.session`.
- `notify()`, `showDialog()` and `closeNotifications()`:
  `adminContext.notify()`, `adminContext.showDialog()` and
  `adminContext.closeNotifications()`. Contexts keep `notify()` and
  `showDialog()`.
- `rootComponent` is removed. `rootComponent.isLoading`:
  `adminContext.loadingTracker.isLoading`. The deprecated
  `rootComponent.registerLoading()` is removed: use
  `adminContext.loadingTracker.begin()` or `track()`.
- Route records no longer have `meta.api`.

### Data and route contexts

Components reach the owner of their data and the view or form that renders
them through two contexts, instead of components:

- `dataContext`, provided by views, forms, dialogs and panels with their own
  data: the `model` that holds the data, `isDirty`, `isEdited`, `isCreating`,
  `hasData`, `validate()`, `verify()`, `showValidationErrors()`,
  `revealErrors()`, `markEdited()` and `replaceItem()`. Dialogs add
  `close(value)`.
- `routeContext`, provided by views and forms: its `parent` route,
  `dataContext`, the `schema`, `dataPath`, `rootData` and `componentPath` of
  the data that it renders, `loadingTracker`, `level`, `isForm`, `state`,
  `path`, `isLastRoute`, `selectedTab`, `verbs`, the `resourceContext` of
  forms, `getFormRoute()`, `getFormPath()`, `getCreatePath()`, and `close()`
  and `submit(button)` for forms, which save their data through their
  resource or apply it to their parent.

`routeComponent`, `formComponent`, `viewComponent`, `parentRouteComponent`,
`parentFormComponent`, `dataModelComponent`, `dialogComponent` and
`panelComponent` are removed, along with the `$routeComponent`,
`$dataModelComponent`, `$dialogComponent` and `$panelComponent` injects:

- `routeComponent.routeLevel`: `routeContext.level`.
- `routeComponent.getFormRoute()` and `getCreatePath()`:
  `routeContext.getFormRoute()` and `routeContext.getCreatePath()`.
- `parentRouteComponent.dataModel`: `routeContext.parent.dataContext.model`.
- `viewComponent.viewSchema`: `viewComponent.schema`, the schema that the view
  renders. The view's own schema is its `sourceSchema`.
- The `$loadingTracker` inject is removed: `routeContext.loadingTracker`, the
  tracker of the view, or `adminContext.loadingTracker` outside of views.
- `dialogComponent.resolve(value)`: `dataContext.close(value)`.
- Route records no longer have `meta.schema`: views and forms take their
  schemas from their node in the route tree.

### Source and resource contexts

Lists, objects and trees, and the forms that edit items, provide two more
contexts:

- `sourceContext`, provided by lists, objects and trees to the components that
  display them and their items: `schema`, `query`, `dataPath`,
  `componentPath`, `store`, `isDisabled`, `verbs`, `createItem()`, `reload()`,
  `submit(button)` and their `resourceContext`. Forms don't continue the
  source of their parent, e.g. the forms of tree items, whose `listQuery` was
  the tree's query.
- `resourceContext`, provided only by forms and sources with a resource of
  their own: `getResource()` and `submit(button)`. Components see the nearest
  one, e.g. in an inlined list of a form the form's, and resolve their
  relative resources against it. The resources of sources continue the one of
  their route, of forms the one of their parent route: forms without a
  resource continue the one of the nearest form above with a resource. The
  forms of tree items no longer continue the resource of the tree, which
  resolved their item at `pages/pages/1` instead of `pages/1`. Lists in the
  items of inlined lists resolve their relative resources against the form
  too, like the lists next to them, instead of against the API root.
- Buttons submit through their source, or else to their form, which saves
  its data through its resource or applies it to its parent. The verbs of
  forms and sources, e.g. `apply` and `remove` in nested data, belong to
  them, not to resources.

Views provide both contexts of their main component, e.g. to their panels.
`sourceComponent`, `resourceComponent`, `dataComponent` and
`parentResourceComponent` are removed, along with the `$sourceComponent`,
`$resourceComponent`, `$dataComponent`, `$verbs` and `$isPopulated` injects:

- `sourceComponent.query`: `sourceContext.query`.
  `sourceComponent.createItem()`: `sourceContext.createItem()`.
- `resourceComponent.resource`, the `resource` of forms and sources:
  `resourceContext.getResource()`. `resourceComponent.submit(button)`:
  `routeContext.submit(button)` in forms and `sourceContext.submit(button)` in
  sources.
- `dataComponent`: `resourceContext`. The components in sources with a
  resource read the root data of their route, like all others.
- `isPopulated`: `dataContext.hasData`.
- `sourceSchema` is only defined by views, forms and `DitoSchema`, which
  injects it from the view, form or source item that renders it. In views,
  the components outside of the main component keep the view's schema. Forms
  don't see a `sourceContext` in their own callbacks either.
- `getFormPath()` of sources: `routeContext.getFormPath()`.
- The `meta` prop of the components and types is removed, along with
  `nestedMeta`.
- The verbs and the relative resources of the components of single-component
  views outside of their list, e.g. view buttons, are the list's, like their
  submits.
- `DitoScopes`, `DitoPagination` and `DitoTableHead` take the `ListQuery` of
  their list as `listQuery` instead of `query`. `DitoSourceItem` takes the
  `formSchema` and `label` of the item from its source.
- `submit(button)` takes the `SubmitButton` that buttons pass, not the
  button's component. Handlers keep using `context.submit()`.
- `SourceMixin`, `ResourceMixin` and `ItemMixin` are removed: sources and
  forms are built from composables. The deprecated `setLoading()` of views,
  forms and sources is removed, use `loadingTracker.begin()` or `track()`.
  `createData()`, `forms`, `isCompact` and `linksToView` of sources and forms
  are removed, and `setData()` of sources returns nothing.

### Routes and the UI registry

Views and forms are built from composables, `useRouteContainer()` and
`useLeaveGuard()`, instead of `RouteMixin`, and `SchemaParentMixin` is removed.
Components no longer reach each other to reveal and focus components:
`adminContext.ui`, the `UiRegistry` of the admin, holds the handles of the
rendered components by component path, and the contexts of the rendered routes.

- `appState.routeComponents`: `adminContext.ui.routes`, the route contexts by
  level. Route contexts add `isLeaving`, `isDirty` and `breadcrumb`.
- The `$schemaParentComponent` and `$tabComponent` injects, `tabComponent`,
  `parentSchemaComponent`, `schemaComponents` and `mainSchemaComponent` are
  removed. The `$schemaComponent` inject only remains for schema events.
- Schemas no longer have `getComponent()`, `getComponents()`,
  `getComponentByName()`, `getComponentsByDataPath()` and the other lookups,
  `getPanel()` and `getPanels()`, `components`, `panes`, `panels` and
  `revealComponents()`, sections and sources no longer
  `revealComponents()`, panes no longer `focus()`.
- `adminContext.ui.reveal(dataContext, componentPath, { focus })` asks the
  components on the way to the component from the outside in to render it, e.g.
  collapsed schemas open and render the tab that contains it, which focusing
  selects, and then focuses it. Focusing components in nested tabs selects these
  tabs too.
- Forms and views no longer have `label` and `breadcrumbPrefix`, views no
  longer `param`, `isNestedRoute` and `isMutating`. Their route guards use
  `onBeforeRouteLeave()` and `onBeforeRouteUpdate()`, so components no longer
  merge the route guards of their mixins.

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
  `defaultWidth`, `excludeValue`, `ignoreMissingValue()`,
  `treatNullAsMissing()`, `generateLabel`, `omitSpacing`, `processSchema()`,
  `processValue()` and `getChildSourceSchemas()`. `getSourceType(type)` becomes
  `sourceType: 'list'` or `'object'`, `getTypeValidations()` becomes
  `getValidations(schema, context)`, and `getFormSchemasForProcessing()` is
  removed: the child sources of items are walked like components of their
  forms.
- Options tell the admin what to do for the type, as verb phrases, instead of
  checking type names: `omitLabel()` omits the label of the container, as the
  component displays it, `replaceWithLabel` replaces the component with the
  label of its container, `resolveValue` resolves the value from `schema.data`
  or `schema.dataPath`, `submitData` makes buttons count for the dirty state
  like `submit`, and `nestForms` renders the forms of the items inside the
  form or view of their source. Buttons submit through `context.submit()`
  because the button component provides it, not because of an option.
- Only types with `getOptionsDataSchema(schema)` load options, which returns
  the data schema of the options that the data model loads. Custom types that
  load `schema.options` like `select` spread `optionsTraits` into their
  descriptor, and `numberTraits` and `textTraits` share the validations of
  numbers and the processing of text values. All three are exported by
  `@ditojs/admin`.
- `getItemAdapter(schema)` wraps the items of sources for their forms and
  unwraps them again, e.g. the values of `wrapPrimitives`. In inlined forms
  of such items, only the component of the wrapped value shares the data path
  of the item, the others get their own. Routed forms edit the wrapped value
  as their draft, and write the unwrapped value back at its index when
  applied. They can't `mutate` the values, which aren't objects.
- `getPanelSchema(api, schema, dataPath, source)` receives the source context
  of the component instead of the component, with `sourceContext.listQuery`.
- `processSchema(api, schema, name)` only sets up the schema, e.g. resolves the
  schemas that it contains. It no longer receives `routes` and `level`, and
  doesn't add routes.
- Types that route sources next to the forms of their items, like the children
  of tree items, return their schemas from `getChildSourceSchemas(schema)`.
- Components no longer have `getTypeComponent()`.
- The components of dito's types are built with composables instead of
  `TypeMixin`, `ValueMixin`, `ContextMixin`, `TextMixin`, `NumberMixin`,
  `OptionsMixin`, `DomMixin` and `SortableMixin`, which are removed. Their
  instances no longer have `value`, `item`, `parentItem`, `rootItem`, `focused`,
  `validate()` or the resolved schema values, e.g. `readonly`, and their
  contexts are built from their props and services instead of the instance. They
  no longer have `focus()`: `adminContext.ui.reveal()` reveals and focuses them
  by their component path.
- The data model replaces the values of components with options once the
  options are loaded, e.g. references with their related objects, and shows
  the errors of failed loads, also while the component isn't rendered. Values
  of `taggable` multiselects that no option has are kept, also single ones.
- The schema values of the container of a component, e.g. `visible`, `width`,
  `label` and `disabled`, see the contexts of the surrounding form or list,
  not the ones that lists and buttons have of their own, e.g. `isRunning`.

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
  `parse()`, and `onChange()`: `this.$emit('change')`.
- `item`, `parentItem` and `rootItem`: `context.item`, `context.parentItem` and
  `context.rootItem`. `adminContext.api`: `context.api`.
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

### Type names

The public types no longer carry the `Dito` prefix, except `DitoAdmin`, and
are named after what they are, like the classes they describe:

- `DitoContext`: `SchemaContext`, the context that callbacks receive.
- The type of `context.user`: `AdminUser`.
- `DitoDataModel`, `DitoListEntry` and `DitoValidationError`: `DataModel`,
  `ListEntry` and `ValidationError`.
- `DitoGlobal`, the type of the global `dito` object: `GlobalConfig`.
