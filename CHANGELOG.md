# Changelog

The changes of each release of Dito.js. For upgrading to a new major
version, see the upgrade guides in `docs/`.

## 4.1.0 (unreleased)

### New

- **admin:** The context of event handlers has `handlerDataPath`, the data path of the schema whose handler runs, next to `dataPath` of the component that emitted the event, e.g. the form's own path and the changed field's in the `onChange()` of a form (#228).

## 4.0.0 (2026-10-12)

Dito.js 4.0 rebuilds the admin around its data instead of its components. Routes, links and form items are generated from a route tree built once from the view schemas. Each view, form, dialog and panel with its own data has a data model that owns all of it: edits, dirty state and errors live there, also for fields that aren't rendered. Nested forms edit drafts of their items, and save responses are merged in place. Callbacks receive typed contexts instead of components, custom types are described by type descriptors through `defineType()`, and the admin's components are built with composables instead of mixins. The hooks that convert values share one vocabulary (`formatValue()`, `parseValue()`, `computeValue()`, `serializeValue()` and the new `deserializeValue()`). See [`docs/upgrading-to-4.0.md`](docs/upgrading-to-4.0.md) for the details of every change below.

### Breaking changes

#### Admin schemas and hooks

- **admin:** The value hooks are named after what they convert: `format()` → `formatValue()`, `parse()` → `parseValue()`, `compute()` → `computeValue()`, `process()` → `serializeValue()`. The hooks of types run before the schema's hooks of the same names. Schemas that still define the 3.x names throw when they're set up, naming the replacement, except `format` of the date and color types, which is their setting: rename a 3.x `format()` there by hand.
- **admin:** Schemas no longer define members of their components: `methods`, `computed`, `watch` and `data` are removed, and handlers, e.g. `onClick`, `itemLabel`, `render` and `clipboard.copy()`, are called with their context only, without the component as `this`. Use plain functions in the schema's module, read values from the context, replace `watch` on data with the `change` event, which receives the `dataPath` of the changed value, and keep state in module scope, e.g. a `WeakMap` keyed by the item. Panels keep `data` for their own data. Schemas that still define these keys throw when they're set up. In buttons, `this.submit()` is `context.submit()`.
- **admin:** Event handlers are declared as top-level `onX` handlers, e.g. `onChange`. `events: {}` keeps working with a deprecation warning and will be removed in a later major version.
- **admin:** Date values that code writes, e.g. defaults and computed values, are `Date` objects: the date types convert stored strings in `deserializeValue()`, and their components no longer convert strings. `formats` of the date types is `format`, and throws when it's still set.
- **admin:** Date, datetime and time fields fire `change` when the picker closes, the field loses focus or Enter is pressed, not for each picked or typed value.
- **admin:** Cells without `render()` and item labels show values as their types describe them, e.g. 'June 1, 2026' for `type: 'date'` instead of the stored string. Columns that format their values otherwise use `render()` with `context.format()`.
- **admin:** Tree lists and objects take `collapsed` instead of `open`, inverted, like sources and sections, so it no longer reads like the `open` event. Trees that still define `open` throw when they're set up.
- **admin:** `relate` takes `true`, to relate options by `id`, or the key to relate them by, e.g. `relate: 'code'`: `relateBy` is removed, and throws when it's still set.
- **admin:** `groupBy` of selects, multiselects, radio buttons and checkboxes is `options.group`, next to `label`, `value`, `equals` and `data`: the key of the options' group, or a callback that returns it. The schema-level `groupBy` throws when it's still set, and `options.groupBy` is removed.
- **admin:** Schema options that were typed but never read are removed from the types: `defaultSort`, `defaultScope` and `nested` of sources, the schema-level `omitSpacing`, and `dateFormat` (use `format.date`) and `locale` (use `api.locale`) of date schemas.

#### Contexts and callbacks

- **admin:** Contexts no longer expose components: `component`, `formComponent`, `schemaComponent`, `viewComponent`, `dialogComponent`, `panelComponent`, `resourceComponent` and `sourceComponent` are removed. Their state and actions are members of the context: `isDirty`, `isCreating`, `validate(match)`, `verify(match)`, `markEdited()` and `replaceItem(data)` for the data of the nearest form, view, dialog or panel with its own data, plus `closeForm()`, `closeDialog(value)`, `getRouteUrl(location)`, `selectedTab` and `submit()` in buttons. Where they don't apply, `validate()`, `verify()`, `markEdited()`, `replaceItem()`, `closeForm()`, `closeDialog()`, `submit()` and `getResourceUrl()` without arguments throw, `isDirty` and `isCreating` are `false`, and `selectedTab` and `sourceQuery` are `null`.
- **admin:** The callbacks of a component see the item the component is in, those that decide about a panel (`if`, `visible`, `label`, `sticky`, `data()`) the data around the panel, and those of the panel's components the panel's data. Components without a schema of their own, e.g. tabs, scopes, the table head, label affixes and the clipboard, pass on the context of the component that renders them. The members that components provide, e.g. `sourceQuery`, `isRunning` and `submit()`, depend on which component evaluates the callback: the data model evaluates `if`, `default`, `computeValue()`, options `data()` and validations with the ones of the form, view, dialog or panel that holds the data, and rendering evaluates `if` again with the ones around the component, e.g. an inlined list. All other callbacks of a component's schema, also `visible`, `width`, `label`, `info` and `disabled` of its container, see the component's own, e.g. a button's `isRunning` or a select's `options`.
- **admin:** `query` is `routeQuery`, and `sourceComponent.query` is `sourceQuery`, `null` outside lists, inside forms and in `itemLabel()`.
- **admin:** `processedItem` and `processedRootItem` are `serializedItem` and `serializedRootItem`, built when read. Components no longer have `processedData`, `processedRootData`, `processedItem`, `processedRootItem`, `processData()` and `setData()`.
- **admin:** The context's `index` is `valueIndex`, next to `itemIndex` and `parentItemIndex`.
- **admin:** `showDialog({ components, buttons, data, settings })` is `showDialog({ components, buttons }, { data, settings })`, which resolves with the value the dialog is closed with: `dialogComponent.resolve(value)` is `closeDialog(value)`, and `dialogComponent.reject()` is removed.
- **admin:** `getResourceUrl()` without arguments returns the URL of the nearest form or list with a resource, and throws without one instead of returning `null`. Views have no resource.
- **admin:** `request({ cache: 'local' })` caches while the route of the form or view is shown, and not outside of routes, e.g. in dialogs.
- **admin:** `itemLabel` and `itemLabelText` are set in the `success` and `error` events of the buttons of forms, but no longer in the form's own context, and are `null` in the `if` and `default` callbacks of form components.
- **admin:** Option labels receive `isSelected` instead of reading `component.$refs.element.isOpen`.
- **admin:** `DitoAdmin` holds its services in one `AdminContext`, `admin.context`, instead of the `api`, `session` and `viewRegistry` injects: `api`, `user`, `views`, `flattenedViews`, `notify()` and `showDialog()` are members of the contexts. `locale` is `context.api.locale`, `session` is `admin.context.session`. `closeNotifications()`, `rootComponent` and the deprecated `registerLoading()` are removed, and route records no longer have `meta.api` and `meta.schema`.

#### Custom types and components

- **admin:** Types are defined with `defineType(descriptor)`, exported by `@ditojs/admin`, instead of `admin.register(type, options)`. The descriptor names the component and holds what were static options of type components: `defaultValue`, `defaultNested`, `defaultVisible`, `defaultMultiple`, `defaultWidth`, `getChildSourceSchemas()`, and `processSchema()` and `processValue(context, graph)` as `setupSchema()` and `serializeValue(context)`. `getSourceType(type)` is `sourceType`, `getTypeValidations()` is `getValidations(schema, context)`, and `getFormSchemasForProcessing()` is removed.
- **admin:** Type descriptors state what is special about a type instead of the admin checking type names: `hasLabel()`, `rendersLabel`, `resolvesValue`, `hasFormat`, `submitsData` and `hasNestedForms`. `submitsData` makes forms and sources count the type's buttons for their dirty state and whether they can save; submitting is up to the component. Options are only loaded for types with `getOptionsDataSchema()`; `optionsTraits`, `numberTraits` and `textTraits` share the behaviour of dito's own types, and custom types with `optionsTraits` receive their loaded options as `context.options`.
- **admin:** The descriptor options taken over from type components are statements too: `excludeValue` → `defaultExclude`, `generateLabel` → `generatesLabel`, `ignoreMissingValue()` → `ignoresMissingValue()`, `treatNullAsMissing()` → `treatsNullAsMissing()`, `omitSpacing` → `omitsSpacing`.
- **admin:** Custom components, of `type: 'component'` and of `defineType()`, no longer get `DitoMixin` and `TypeMixin` mixed in. They receive `schema`, `context` and the value as `modelValue`, and emit `update:modelValue` to change the value, which emits the schema's `input` event, and `change` once the change is done, which emits its `change` event. `getSchemaValue(schema, key, context)` is exported by `@ditojs/admin`, and `CustomComponentProps` and `CustomComponentEmits` type the contract. Dito warns in development about undeclared props and emits. The `component` of list items and columns receives the item or the cell's value the same way.
- **admin:** All mixins are removed: `DitoMixin`, `EmitterMixin`, `TypeMixin`, `ValueMixin`, `ContextMixin`, `TextMixin`, `NumberMixin`, `OptionsMixin`, `DomMixin`, `SortableMixin`, `RouteMixin`, `SchemaParentMixin`, `SourceMixin`, `ResourceMixin`, `ItemMixin`, `ValidationMixin` and `ValidatorMixin`, along with `DitoComponent.component()`. The admin's components are no longer part of the API: their members, e.g. `request()`, `navigate()`, `download()`, `getResourceUrl()`, are members of the context, and `sendRequest()`, `getQueryLink()`, `getLabel()`, `getStore()`, `setStore()`, `removeStore()`, `getTypeComponent()`, `focus()`, `on()`, `off()`, `emit()`, `emitEvent()` and `emitChangeEvent()` are removed.
- **admin:** The component lookups and injects are removed, e.g. `routeComponent`, `formComponent`, `parentFormComponent`, `sourceComponent`, `getComponent()`, `getComponentByName()`, `getPanel()`, `$routeComponent`, `$schemaComponent`, `$verbs` and the `meta` and `nestedMeta` props. `DitoScopes`, `DitoPagination` and `DitoTableHead` take the list's `ListQuery` as `listQuery`.
- **admin:** `getPanelSchema(api, schema, dataPath, source)` receives the list's query as `source.listQuery` instead of the component.
- **admin:** `change` events stop bubbling between schemas when a handler returns `false`.
- **admin:** An `onClick()` of the submit or cancel button of forms, or of the cancel button of dialogs, replaces the default handler instead of running next to it: call `submit()`, `closeForm()` or `closeDialog()` from it. Grouped `events` replace the `on…` handler of the same event in the same schema.

#### Routes and URLs

- **admin:** The URLs of forms of lists in nested sections and inlined objects contain the name of their container, like the data paths of their items, e.g. `/books/1/contents/notes/2`.
- **admin:** The items of tree lists with a resource are addressed by their id in URLs, like the items of other lists with a resource.
- **admin:** Relative resources resolve against the nearest form or source with a resource of its own: the forms of tree items no longer resolve at `pages/pages/1`, and lists in the items of inlined lists resolve against the form instead of the API root.

#### Dirty state and saving

- **admin:** Direct writes to the data don't make it dirty: `formComponent.applyCleanChanges()` is removed, write the data directly instead. Code that edits data in place calls `context.markEdited()`; type components no longer have `markDirty()`, and type components, schemas and panels no longer have `isDirty`.
- **admin:** `schemaComponent.filterData()` and `schemaComponent.resetData()` are removed: forms merge server data in place, and the filters panel clears its data with `replaceItem({})`.

#### Errors and validation

- **admin:** Errors live in the data model: type components no longer have `errors`, `hasErrors`, `isTouched`, `isValid`, `isValidated`, `verify()`, `markTouched()`, `clearValidation()`, `resetValidation()`, `addError()`, `getErrors()`, `clearErrors()`, `showValidationErrors()` and `validate()`, and forms, views, schemas and panels lose their validation members, e.g. `validateAll()` and `verifyAll()`. Use `context.validate(match)` and `context.verify(match)`.
- **admin:** `navigateToComponent()` and `navigateToRouteComponent()` are removed: validating reveals the errors, opening nested forms, collapsed schemas and tabs, and focuses the first one.

#### Types and public API

- **admin:** The public types no longer carry the `Dito` prefix, except `DitoAdmin`: `DitoContext` is `SchemaContext`, `DitoUser` `AdminUser`, `DitoGlobal` `GlobalConfig`. `DitoDataModel`, `DitoListEntry` and `DitoValidationError` are removed.
- **admin:** Only `SchemaContext`, `AdminContext`, `DitoAdmin`, the schema types and the contracts of types and custom components are exported. The internal contexts, the data model, the UI registry, the loading tracker and the types of component instances (`DitoComponentInstanceBase`, `DitoFormInstance`, `DitoViewInstance`, `DitoSchemaInstance`, `DitoSourceInstance`) are removed.
- **admin:** The shared schema types are named after the settings they hold: `SchemaSourceMixin`, `SchemaOptionsMixin`, `SchemaNumberMixin`, `SchemaTextMixin`, `SchemaAffixMixin` and `SchemaDataMixin` are `SourceSettings`, `SelectionSettings`, `NumberSettings`, `TextSettings`, `AffixSettings` and `DataSettings`, `SchemaDitoMixin` and `SchemaTypeMixin` are part of `BaseSchema`, and the deprecated `SchemaSetupMixin` and `SchemaRouteMixin` are removed.
- **admin:** The deprecated `HTTPVerb` type (use `HTTPMethod`) and the `$pulldown-radius`, `$pulldown-padding-ver`, `$pulldown-padding-hor` and `$pulldown-padding` SCSS variables are removed.

#### Server

- **server:** `Service.setup(config)` is `configure(config)`, which services override to read their configuration. The application starts and stops its services itself.
- **server:** The array forms of `patchAndFetch()` and `updateAndFetch()` save each model by its id in one transaction, and throw for models without ids instead of inserting them: use `insertAndFetch()` for these. The collection actions `put` and `patch` still insert models without ids.
- **server:** `type: 'color'` validates the color strings that the admin's color type stores: hex colors and color keywords. Other strings, e.g. `'rgb(0, 0, 0)'`, are rejected: use `type: 'string'` for them. The objects of the admin's `rgb`, `prgb`, `hsl` and `hsv` formats need properties of `type: 'object'`, which are stored as JSON. This replaces the 3.2.7 behaviour that 3.5.0 restored.
- **server:** Outside PostgreSQL, arrays passed to `insert()` and `insertAndFetch()` are inserted in one transaction without their relations, as in PostgreSQL, instead of through `insertGraph()` with them: insert graphs with `insertDitoGraph()` or `insertGraph()`.
- **server:** `AdminController.getPath(name)` is removed: use `resolveConfigPath(name)`. `returns` of handler definitions and `options.returns` are removed: use `response` and `options.response`. The `cyclic` option of the `*DitoGraph*()` methods, which has no effect since 3.3.1, is removed.
- **server:** The admin's HMR is served through the app's server instead of a port of its own: remove `server.hmr.port` from the admin's Vite config; `port: 0` no longer picks a free port. `app.stop()` closes the Vite server before the app's server.

#### UI

- **ui:** `DitoDatePicker`, `DitoTimePicker` and `DitoDateTimePicker` emit `change` once the edit is done, when the popup closes, the input loses focus or Enter is pressed, instead of with each value. `update:modelValue` fires for each value.
- **ui:** The modifiers of `DitoTrigger` and its popups follow BEM: `.dito-trigger-disabled` is `.dito-trigger--disabled`, and `.dito-popup-{placement}`, e.g. `.dito-popup-bottom-left`, is `.dito-popup--{placement}`.

#### Build

- **build:** `@ditojs/admin` and `@ditojs/ui` are only published as ES modules: their UMD builds and the `require` conditions of their exports are removed. `defineViteConfig()` of `@ditojs/build` only builds ES modules, and its `rollupOutput` option is removed.

### Behaviour changes

- **admin:** Forms are dirty once their data is edited, until it's saved, applied or loaded again, instead of when it differs from the data they started with: reverting an edit leaves them dirty, while writes that don't change a value aren't edits.
- **admin:** Only what can save counts as dirty: forms, views, dialogs, panels with their own data and sources with their own resource are dirty only with a button of type `submit`. Without one, `context.isDirty` stays `false`, and views no longer ask about unsaved changes. Edits inside a source with its own resource, e.g. reordering, applied nested forms and inline fields, count for that source, are clean again once its button submitted them, and stay dirty when the form saves.
- **admin:** Nested forms without `mutate: true` edit a draft of their item: OK merges the draft into the item in place and makes the parent dirty if it changed, Cancel leaves the parent untouched, also temporary ids of references. `serializeValue()` runs only when the parent is saved. In the draft, everything outside the item is read-only. `replaceItem()` and the responses of buttons with resources in nested forms write into the draft. Forms with `mutate: true` edit the parent's data directly, so the parent turns dirty right away, their `isDirty` is the parent's, and Cancel only closes them.
- **admin:** Save responses, reloads and `replaceItem()` merge into the form's data in place: open nested forms keep their edits, items keep their uids, stores and the errors of unchanged values, and the data of sources with their own resource is kept. A response arriving after the form opened another item is dropped, and saving only cleans the edits it carried.
- **admin:** Leaving a form while it saves waits for the save, up to 30 seconds, and only asks about unsaved changes if it failed. "Save & close" and opening a created item only navigate if the route is still within the form.
- **admin:** Submitting waits for running uploads without a time limit, also through the buttons of sources with their own resource, which also wait for data schemas and options to load.
- **admin:** Errors stay with the data that holds each value, so they survive collapsing sections, switching tabs and items moving. Any change of a value clears its errors for good, also writes through code and changes back to the rejected value. The errors of fields, e.g. of failed option loads, stay until their source removes them.
- **admin:** Errors inside values that no deeper field displays show on the field of the value, with their path, e.g. for objects edited as code.
- **admin:** Rows of lists and tree items whose items or children hold errors are marked with a red bar (`dito-table__row--error`, `dito-tree-item--error`), e.g. for errors in the forms of nested routes.
- **admin:** Forms clear the errors of their data once submitted, also mutating forms, and the buttons of sources clear the errors of the source's data after submitting it.
- **admin:** Tabs render once they're selected and stay rendered. Focusing components in nested tabs selects these tabs and replaces the hash of the route instead of adding a history entry.
- **admin:** Open nested forms follow their item to its new index when it or a parent item moves, replacing the history entry. Forms of list items close once their item is removed instead of showing the next one.
- **admin:** Pasting writes through the data model as new items: related items get new temporary ids each time, sources with their own resource are left out, and unchanged values don't make the data dirty. Copying the item of a nested form leaves out the ids of its items, and copied ids are marked `@7` for the id `7` and `@@7` for the temporary id `@7`.
- **admin:** Values that the data model writes, e.g. defaults, computed and loaded values, don't fire `change`, unlike the watchers they replace.
- **admin:** Components in panels with their own data, e.g. filters, get their defaults and computed values, and their edits don't make the view or form dirty. Their data is `item` inside the panel, while `rootItem` stays the page's root data. Dialogs are the containers of their data: `rootItem` inside them is their data.
- **admin:** The data model replaces the values of components with options once the options are loaded, also while the component isn't rendered. Selects and multiselects keep values that their options lack instead of setting them to `null`.
- **admin:** In single-component views, the view's own buttons and panels use the list's verbs, query and submits.
- **admin:** Saving the forms of the children of tree items doesn't reload the tree.
- **admin:** The schema values of a component's container, e.g. `visible`, `width`, `label`, `info` and `disabled`, see the members of the component, e.g. a button's `isRunning`, and are evaluated once for the container and the component. `disabled: ({ isRunning }) => isRunning` also disables the button's container.
- **admin:** Dito's components and types are registered globally with `app.component()`, so custom components can render them by name.
- **admin:** After applying the link dialog of `markup` fields, the focus returns to the editor instead of the toolbar button.
- **server:** `upsert()` and `upsertAndFetch()` run in a transaction: a failure rolls back the patch, or the models saved before it.

### New

- **admin:** A route tree, built once from the view schemas, generates the routes, edit and create links, form items, menus and breadcrumb trail. The forms of lists in forms shared by several views or lists are routed in each of them, and `maxDepth` limits how often a list occurs inside itself in a route, also through shared forms.
- **admin:** `deserializeValue()` converts stored values to edited ones: for loaded data, save responses, `replaceItem()`, pasted data and filters in the query. It's the counterpart of `serializeValue()`.
- **admin:** `defineType()` with type descriptors, which describe how the admin handles the schemas and values of a type, also when they aren't rendered; `type` takes one type or an array sharing the descriptor.
- **admin:** The `getValueText(context)` hook of type descriptors gives the text that cells and item labels show for a value.
- **admin:** `getItemAdapter(schema)` wraps and unwraps the items of sources for their forms. Lists with `wrapPrimitives` support routed forms, which edit the wrapped value as their draft and write it back at its index.
- **admin:** Typed contexts: `SchemaContext` with the new members `isDirty`, `isCreating`, `validate(match)`, `verify(match)`, `markEdited()`, `replaceItem()`, `closeForm()`, `closeDialog()`, `getRouteUrl()`, `routeQuery`, `sourceQuery`, `selectedTab`, `submit()` and `isSelected`, and `AdminContext` as `admin.context`.
- **admin:** `serializedItem` and `serializedRootItem` are available in the callbacks of the data model too, e.g. `if` and `computeValue()`, and are the data being built inside `serializeValue()`.
- **admin:** Dialogs can save through their submit buttons.
- **docs:** `CHANGELOG.md` collects the notes of all releases since 3.3.0, and `docs/upgrading-to-4.0.md` describes the upgrade.

### Fixes

- **admin:** Applying a nested form no longer drops values the form doesn't cover, wipes `exclude` values, cuts related objects to `{ id }` or runs `serializeValue()` (before `process()`) twice.
- **admin:** Nested forms read their draft instead of the parent's live data, e.g. in `dataPath` options, and Cancel no longer leaves temporary ids in the parent, which later saves sent as `#ref` without `#id`.
- **admin:** Removing an item before an open nested form's item no longer switches the form to the next item and drops its unsaved edits.
- **admin:** Selects no longer set values missing from their options to `null` as a clean change, which the next unrelated save sent.
- **admin:** Copying the item of a nested form no longer carries other items' ids into pasted items, and the clipboard ids of real ids and temporary ids no longer collide.
- **admin:** Forms with shared schemas get their nested routes in every place, not only in the first one set up.
- **admin:** Lists with their own `path`, lists inside nested sections, and lists whose names don't survive normalizing their paths (e.g. `sourceURLs`) open their items' forms instead of empty ones, and lists with forms inside inlined content get their routes.
- **admin:** Lists linked to multi-component views get correct edit links, and can create items there.
- **admin:** The forms of tree items no longer resolve their resource at `pages/pages/1` instead of `pages/1`, and no longer see the tree's query as their `sourceQuery`.
- **admin:** Views no longer stay dirty after their buttons submitted.
- **admin:** Errors of fields in collapsed sections are no longer lost.
- **admin:** `markup` edits that don't blur the editor, e.g. links applied through the dialog, are written right away, so saving immediately no longer submits the old value.
- **admin:** Leaving or reloading right after a save started no longer asks about unsaved changes, and "Save & close" no longer overrides a navigation made while saving.
- **admin:** Computed values of freshly set-up data are written when the data is set up, so edits made right after loading can no longer land before them.
- **admin:** `rootItem` and `parentItem` are set in `itemLabel()` and `render()` callbacks.
- **admin:** Failed loads of forms are notified.
- **admin:** Single `taggable` multiselects keep values that no option has instead of setting them to `null` on load.
- **admin:** Tree items with `null` children are sorted as an empty list, without a warning.
- **admin:** The placeholder of multiselects resolves `searchable` and `taggable` callbacks.

### Internal

- The admin is written in TypeScript where it was rebuilt: the route tree, the data model, the contexts, the composables and the type descriptors.
- No mixins are left: all components and types are built with `setup()` and composables.
- The admin's source is smaller than 3.5.0's, despite the new route tree, data model, drafts and contexts.

## 3.5.0 (2026-10-11)

### Behaviour changes

These changes close security holes or fix data loss, but existing apps may notice them:

- **server (security):** Relation requests are authorized for their parent member: accessing a relation requires the parent's member `get` authorization, changing it also its member `patch` authorization unless the relation's action has an `authorize` setting of its own, also when `allow` doesn't route these actions, with `'$owner'` and `'$self'` referring to the parent (#207). The parent is resolved through its `member.get` and scope, with one extra lookup per relation request, so relations of hidden parents answer 404; before, relation actions without their own `authorize` setting were accessible without any authorization.
- **server (security):** dito's graph methods, `upsertAndFetch()`, the arrays of `patchAndFetch()` / `updateAndFetch()` and `insert()` with arrays reject objection's graph control properties `'#dbRef'`, `'#unrelate'` and `'#delete'` with a `GraphError` (400), as they let clients relate rows of other parents and override `noUnrelate` / `noDelete`. This reverts the keeping of `'#unrelate'` / `'#delete'` in related references of 3.3.1 and 3.4.0; code that needs them can use objection's own `insertGraph()` / `upsertGraph()`. `'#id'` and `'#ref'` are still accepted.
- **server (security):** Unsigned asset files from allowed import sources (`allowedImports`) are only accepted with keys in the format of generated keys, and disk storages keep their file paths inside their folder. Before, the keys of such files weren't checked and could address files outside the storage folder.
- **server:** Array `patchAndFetch()` / `updateAndFetch()` / `upsertAndFetch()` and collection `PATCH` / `PUT` requests only save the models themselves, like `patch()` / `update()` of single models: their related models are left alone instead of being updated or inserted. Use the `*DitoGraph()` methods to save relations (#206, closes #191).
- **server:** Requests with transactions fail when committing fails, e.g. on deferred constraints, instead of answering with success while knex silently loses the data (knex#6141).
- **admin:** `emit()` calls its callbacks like `EventTarget` dispatches events: the callbacks registered when the emit starts, skipping the ones removed in the meantime, e.g. by `off()` or by `once()` in a concurrent emit. Callbacks added during an emit are called from the next emit on, unlike 3.2, and callbacks removing themselves or others, including `once()` callbacks, no longer make the emit skip the callbacks after them (#210).

### Fixes

- **admin:** Clicking Create while an item is still loading no longer shows that item in the create form.
- **admin:** Leaving an unsaved create form for an existing item loads that item instead of keeping the empty one.
- **admin:** Forms nested in views without resources provide the view's data as `rootItem` and `parentItem`.
- **admin:** Components placed directly in views without resources provide the view's data as `rootItem`, also to the validation rules and `exclude` / `process` callbacks of nested schemas (#193).
- **admin:** The children of tree objects can be edited: their edit links lead to their forms (#189).
- **admin:** Closed children of a tree list's root reopen when a form below them is opened, like deeper levels (#197).
- **admin:** After logging out and in again, nested forms get their routes again (#187).
- **admin:** Forms with tabs keep their selected tab while the forms of their list or tree items are open, and when returning from them (#192).
- **admin:** Only the form of the last route follows the tab in the route's hash, which fixes an endless loop with tabbed forms of tree items in tabbed forms (#211).
- **admin:** Reloading the page on the form of a list or tree item in a tab no longer shows a blank parent form.
- **admin:** Applying the form of a tree item keeps the item's children instead of deleting them.
- **admin:** Tree lists that are the only component of a view get edit links that match their routes.
- **admin:** Tree lists render without a route component, e.g. in dialogs.
- **admin:** Tree items show the keyboard focus ring, also when selected.
- **server:** `'commit'` listeners of request transactions run after the commit: errors in them still fail the request, after the data is committed, but no longer trigger the `'rollback'` events. Transactions that handlers roll back themselves without an error emit `'rollback'` instead of `'commit'`, so that e.g. imported asset files are cleaned up (#209).
- **server:** `member.get` overrides receive the same `this` for `from: 'member'` parameters and `$owner` checks as for routed requests.
- **server:** One-to-one relation controllers without `member.get` overrides support `$owner` checks and pass the related model to `from: 'member'` parameters. On empty relations, the actions that resolve the member (`$owner` checks, `from: 'member'` parameters) answer 404, like their member routes (#194).

### Restored behaviour of 3.2.7

3.3 and 3.4 changed some behaviour that apps may rely on. 3.5.0 restores it; changes are planned for 4.0:

- **server:** The `color` type accepts any string again. 3.3 only accepted hex colors and color keywords.
- **server:** Collection `PATCH` / `PUT` requests and array `patchAndFetch()` / `updateAndFetch()` insert root models without ids again. 3.3.1 skipped them. Note that this doesn't check `post` permissions. Related models are no longer inserted, see above (#206).
- **admin:** Separate emits of the same event don't wait for each other again. 3.4.0 queued them, which made a handler that awaits an emit of its own event hang. See above for the callbacks called by each emit (#210).

### Behaviour changes of 3.3 and 3.4 that stay

- **admin:** Errors in `load` handlers are shown as notifications instead of only being logged.
- **admin:** Relative download URLs like `files/1` resolve against the API, with its authentication.
- **admin:** The `upload` property of files in upload values is `{ id, success }` instead of the upload object.
- **server:** `from: 'member'` parameters and `$owner` checks use `member.get` overrides. Overrides should pass `modify` on to `super.get()`, otherwise locks and scopes are lost. See the new section in `docs/controllers.md` (#188).

### API and docs

- **server:** New overridable controller methods: `handleRequestAuthorization()` authorizes requests beyond their own `authorize` setting, `authorizeMember()` authorizes a member like its `get` or `patch` action, and `getActionAuthorize()` returns an action's `authorize` setting. The `id` of `fetchMember()` is optional: one-to-one relation controllers then fetch their related model.
- **ui:** A `focus-ring` SASS mixin for keyboard focus, with a color option.
- **docs:** `docs/controllers.md` describes the authorization of relation requests, `member.get` overrides including their `this` in one-to-one relations, and the members of one-to-one relations and their 404s.

### Internal

- The coverage thresholds are enforced in CI.
- Development uses objection 3.5.0; the peer dependency stays `^3.3.0`.
- Tests cover known bugs of nested forms, routing and options.



## 3.4.0 (2026-10-09)

### Behavior changes

- **server:** Unrelating an empty one-to-one relation (`DELETE` on a `belongsTo` relation without a related row) now responds with 404, like `hasOne` relations do, instead of `{ count: 1 }`.
- **admin:** Applying the link dialog of `markup` fields without a URL now removes the link.

### Features

- **admin:** `nodes.heading: true` enables all six heading levels in `markup` fields, both in the editor and in its buttons.

### Fixes

- **server:** Boolean JSON schemas (`true` / `false`) are returned unconverted, cached definitions are only merged when there are any, and combining formats no longer adds an empty format to `allOf`.
- **server:** With `allowedImports`, importing files without a URL (from storages without `url`) is rejected instead of throwing.
- **admin:** Forms nested in views find their data in views without resources, and in views with several components.
- **admin:** Navigating from an item to the create route of the same form sets up a new item instead of keeping the loaded one.
- **admin:** Async events emitted to callbacks registered with `once()` reach all callbacks.
- **admin:** Pasting several paragraphs, lists or quotes into single-line `markup` fields inserts them as one line with breaks.
- **admin:** Request errors without a message are reported without details, and invalid views or menu items throw a clear error.

### Internal

- Test coverage is at 99.9% of lines and 99% of branches; Dito's own tests no longer depend on the e2e tests of applications.
- Code that is unreachable through Dito's own control flow is removed.



## 3.3.1 (2026-10-09)

Requires Objection.js **3.3.0**, which now handles mixed graph algorithms and cyclic `#ref` graphs itself.

### Upgrade notes

- **Objection.js 3.3.0** is now the minimum (peer `^3.3.0`), and **knex** `^3.3.0` (the peer was `>=3.0.1` without an upper bound).
- **`cyclic` option deprecated:** Objection.js now resolves cyclic `#ref` references in `insertGraph()` / `upsertGraph()` itself, so the `cyclic` option of the `*DitoGraph*()` methods is no longer needed. It's still accepted with a deprecation warning and will be removed in 4.0. Cycles need a nullable or deferrable foreign key; cycles made only of property references (`#ref{…}`) are rejected.
- **`patchById()` / `updateById()`** now come from Objection.js. Passing `undefined` as id throws.
- **`@aws-sdk/client-s3`** is now an optional peer of `@ditojs/server`, only needed for S3 storage; `@aws-sdk/lib-storage` is no longer a peer (multer-s3 depends on it itself).

### Fixes

- **server:** Queries that mix `withGraphJoined()` and `withGraphFetched()` no longer fail (regression in 3.3.0 with Objection.js 3.2.0). `withGraph()` and the scopes applied to the graph now use Objection.js's algorithm-agnostic `withGraph()` and `isJoinChildQuery()`.
- **server:** Array `patchAndFetch()` / `updateAndFetch()` no longer insert related models (a misspelled `noInsert` option).
- **server:** `#unrelate` and `#delete` markers of Objection.js now work on related models in the `*DitoGraph*()` methods.
- **types:** The server types are aligned with Objection.js 3.3, including result narrowing of `withGraph()`.

### Internal

- Dito's own workaround for cyclic `#ref` graphs is removed.
- All packages are now released together, to keep their versions in sync.



## 3.3.0 (2026-10-09)

Changes since v3.2.7. No public API was removed: these are fixes, security hardening and accessibility work, with a few behaviour changes that apps may need to act on, listed under *Upgrade notes*.

> **Known issue:** with Objection.js 3.2.0, queries that mix `withGraphJoined()` and `withGraphFetched()` fail. This is fixed in **v3.3.1**, which requires Objection.js 3.3.0. Please upgrade to v3.3.1.

### Upgrade notes

### Dependencies

- **`@floating-ui/dom` is a new peer dependency of `@ditojs/admin`** (a
  required peer of `@tiptap/vue-3`). Add it to the app:
  `pnpm add @floating-ui/dom`.
- **`type-fest` is now a regular dependency of `@ditojs/admin`**, as only its
  type declarations use it. Apps that only installed it to satisfy the peer
  can remove it.
- `@tiptap/extension-text-style` is no longer a peer of the admin; remove it
  unless the app uses it itself.
- **`vue` is now a peer dependency of `@ditojs/ui`**, so its dist no longer
  bundles a second Vue runtime. Apps already provide `vue`; nothing to do
  unless `@ditojs/ui` is used without it.
- The admin's UMD / `require()` build now exposes `{ DitoAdmin, default }`
  instead of the class itself; read `.DitoAdmin` or `.default` from it. ESM
  imports are unchanged, and `import { DitoAdmin }` now works too.
- Library builds of `@ditojs/build` keep subpaths of dependencies external
  (e.g. `@tiptap/pm/*`, `@vueuse/integrations/*`); apps must provide these
  packages instead of relying on inlined copies. CSS subpaths are still
  bundled.

### Admin: notifications, labels and dialogs

- **`notify()` escapes `text` and `title`.** Markup in `text` now shows as
  literal tags (a dev warning points to it). Pass formatted text through the
  new `html` option instead, and escape any data in it with `escapeHtml()`:
  `notify({ type: 'info', html: '<b>Saved</b> ' + escapeHtml(name) })`.
  `text` and `html` are mutually exclusive in the types.
- **Item labels escape item data.** `getItemLabel()` escapes the item's
  string values; HTML returned by developer `render()` / `itemLabel()`
  callbacks is still rendered as HTML. Apps that stored markup in item fields
  to style labels must render it through `itemLabel()` instead.
  `itemLabel()` callbacks return HTML, so they must escape the values they
  insert with `escapeHtml()`. `DitoContext` gains `itemLabelText`, the
  plain-text form of the HTML `itemLabel`; form `aria-label`s use this text.
- **Confirmations are admin dialogs instead of native `window.confirm()`**
  (delete, remove, leave with unsaved changes, remove file). E2E suites that
  answer native dialogs (`page.on('dialog')`) must click the dialog's buttons
  instead: `Cancel`, or the submit button named after the verb, e.g.
  `Delete`. The clipboard reports errors through notifications instead of
  `alert()`.
- **A `beforeunload` prompt shows when a form or view has unsaved changes.**
  E2E suites that reload or navigate away from dirty forms may need to accept
  the native `beforeunload` dialog, or save / discard first.
- **Plain select values whose option disappeared are kept** and shown as
  "(unavailable)", instead of being cleared silently. Apps relying on the
  value being dropped must clear it themselves, e.g. in `onChange` of the
  field the options depend on.
- Color fields emit `change` only once the user's edit is done, and no longer
  for values changed by code. `onChange` handlers that relied on programmatic
  changes must react to the source of the change instead.
- Deleting items from a list with its own `resource` no longer marks the form
  dirty (the server already applied the change); `change` is still emitted.
- Validation errors are rendered in flow below the field (an alert list
  linked via `aria-describedby`) instead of in a tippy tooltip, so forms with
  errors are taller. Inputs receive the focus instead of their wrappers.
- Schema handlers in the `onX` form are now wired to native DOM events like
  `events: { x }` already was. Unknown validator names, schema members that
  override component members and unsupported `emitEvent()` options now log
  warnings.

### Admin: deprecations

- **`setLoading()`** on resources and views and **`DitoRoot.registerLoading()`**
  are deprecated; they forward to the new loading trackers
  (`loadingTracker.begin()` / `.track()`). `isLoading` is now read-only and
  only declared on resource components, views and the root.
- **`$pulldown-*` SCSS variables** (`$pulldown-radius`, `$pulldown-padding*`)
  are deprecated until 4.0; the pulldown no longer uses them.
- `options.groupBy` (the unused type in the declarations) is deprecated; use
  the schema's `groupBy`, now also supported by radio and checkboxes.

### Admin / UI: removed and renamed CSS classes

Apps that style or select these classes (including e2e locators) must update:

- `.dito-pulldown`, `.dito-pulldown--open`, `.dito-pulldown__item`,
  `.dito-pulldown__item--disabled`: the create button and account menu use
  ui's `DitoMenuButton` (`.dito-menu-button__menu`, `__item`,
  `__item--disabled`).
- The tippy `error` theme (`[data-theme~='error']`): error tips are gone,
  see above.
- `.dito-label--active`: replaced by `:focus-visible`.
- `.dito-page--width-60` / `--width-80`, `.dito-sidebar--width-60` /
  `--width-99`: breakpoints use container queries now.
- `.dito-drop-target`: now `.dito-upload--drop-target` on the upload.
- `.dito-date-time-picker__inner` (and its `--focus` modifier).
- Dead selectors that never matched were fixed: `.dito-switch-label` →
  `.dito-switch__label`, `.dito-upload-footer` → `.dito-upload__footer`.
- Markup changes: calendar controls and the login link are `<button>`s
  instead of `<a>`s; drag handles are focusable `DitoDragHandle`s; the
  calendar grid has rows (`.dito-calendar__week`, `.dito-calendar__item`);
  tree items render
  `DitoEditButtons` instead of inline buttons; date and time pickers render
  through `DitoPickerInput`.

### Server

- **Related models are validated fully also under models with
  `$initialize()`.** Relations are now parsed and initialized with the parent's
  options before its `$initialize()`, so `{ id }` references in graphs are
  validated as full models and fail on required fields. Link by foreign key
  (`authorId: 1`) or use `#ref` / `relate: true` instead of `{ id }` stubs.
- `new Model(json)` no longer validates, as its comment always promised;
  call `Model.fromJson()` to validate.
- **Not-found errors include the model id**:
  `'Item' model with id 12 not found`. Adjust tests matching the message.
- **`DatabaseError.cause` points at the driver's native error**
  (`error.nativeError`) instead of the wrapped Objection error. Formatted
  errors keep their stack.
- `NotImplementedError` responds with 501 instead of 404.
  `AuthenticationError` carries passport's failure status.
- `type: 'color'` validates through the new `color` format, as a hex color
  (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) or a color keyword (it accepted any
  string). Stored values such as
  `'rgb(…)'`, `'ff0000'` (no `#`) or `''` now fail validation on updates;
  migrate the data or use another type / format for these fields.
- Collection `PATCH` / `PUT` with a single object instead of an array returns
  400 (`BodyValidation`).
- Scoped deletes only delete the models of the requested scope; users excluded
  by the session scope are logged out.
- Invalid date strings in filters are left to the format check (400) instead
  of being parsed.
- `from: 'member'` parameters and `$owner` checks go through
  `member.get` again, so app overrides of `member.get` apply. Overrides receive
  `(ctx, modify, { query, forUpdate })` and should pass these on, e.g. to the
  new `fetchMember()`.
- Asset steps (`handleAddedAndRemovedAssets()` etc.) run through the
  Application methods again on model writes, so app overrides apply. All asset
  methods return arrays, also without an `Asset` model.
- Actions are routed by the HTTP methods Node.js supports
  (`http.METHODS`); other method names throw at setup.
- Sessions serialize users by `$id()`; `$is()` compares by `$id()`.
- `AdminController.getPath(name)` is deprecated; use `resolveConfigPath(name)`.

### Type declarations

- Admin: `DitoContext.user` and `parentItemDataPath` are nullable, so
  callbacks under strict TypeScript must handle `null`; new
  `DitoContext.itemLabelText`; `notify()` takes `text` or `html`;
  `rootComponent` is `DitoRootInstance`;
  `setLoading()` / `isLoading` moved to resource, view and root interfaces;
  panel schemas mapped in `SchemaByType`; `DateSchema.dateFormat` marked
  deprecated (no effect).
- Server: graph and fetch methods return `SingleQueryBuilder` or
  `ArrayQueryBuilder` depending on the input; `allowScope()`,
  `clearAllowScope()`, `allowFilter()` and `omit()` return the builder (they
  are now chainable at runtime too); `filterGraph()`, `populateGraph()` and
  `fromJson()` are typed by model class; asset methods return arrays without
  `undefined` / `null`; graph data accepts nullable relations and `#id` /
  `#ref`; new `fetchMember()` (with a `modify(query, trx)` callback),
  `relateAndFetch()`, `resolveModelClass()`, `resolveConfigPath()`. Code
  relying on the previous wider types may need narrowing or casts removed.

### Security

- Stored XSS through item labels: item values are escaped in labels of lists,
  objects, trees and the trail.
- Stored XSS through notifications: `title` and `text` are escaped; item
  labels and server error messages in form notifications go through `html`
  with escaped values.

### Fixes

### admin

- Compare route paths by whole segments (`/items/1` vs `/items/12`), for
  closing forms, active menu items and tree items.
- Validate unmounted fields before closing mutating forms.
- Don't take over user edits made while options load as clean changes.
- Run `compute()` when options resolve to `undefined`; forget options of
  removed components; don't mutate computed values when setting defaults.
- Stop waiting for pending loads after a timeout.
- Key computed values, options and item stores by data identity instead of
  list index; transfer uids by item id after saving.
- Data loads only abort the previous load; request callbacks are awaited.
- Buttons: running state, `error` handlers receiving the error, notifications
  per context.
- Don't cache failed requests; key resource requests by URL.
- `showDialog()` rejects when its components fail to set up.
- `notifications.destroyAll()` works.
- Ignore malformed filter entries in the query; show server errors of list
  filters at their fields.
- `new DitoAdmin(el, { views })` falls back to the global `dito` object.
- `schema.data()` receives a context.
- Dialogs: only close `clickToClose` dialogs on overlay clicks; Escape honours
  cancel buttons; label dialogs with `settings.label`.
- Markup: TipTap 3 `autofocus` / `enableRules`, swapped sub- / superscript,
  pending edits written before destroy, no `<p>null</p>`.
- Multiselect: added tags no longer leak into shared options and emit
  `change`; stored tags show without options.
- Checkboxes keep `0` and `false` values.
- Uploads: rows keyed by file, download responses checked, API headers and
  credentials sent with uploads and downloads, live upload status, `video/mp4`.
  Relative download URLs (`files/1`) now resolve against the API URL, for
  links and downloads alike; absolute and root-relative URLs are used as is.
- Code editor calls `onInput`; slider number input labelled.
- `decimals: 0` in the decimals validator; clear errors on empty validation
  results.
- Resolve items of named sub-menus.
- Temporary ids of unrelated sources removed on the clipboard.
- Select the default tab once the item has loaded, keeping a user-selected
  tab; focus tabs by key.
- Only open tree items along existing edit paths.
- Section labels render in flow; panels of components show in tabs, and
  validation errors in them select their tab.
- `isApiUrl()` requires a boundary; store defaults aren't written in getters;
  `defaultMultiple`, `defaultWidth`, `getSourceType` merged through
  `extends`.
- Buttons inside forms no longer submit them (`type="button"`).
- Dead and leaking CSS selectors fixed; edit buttons of tree items stay
  compact.
- The `cache: 'global'` load cache is cleared on logout and user change.

### ui

- Triggers close with Escape and clean up their listeners; positioning stops
  when hidden or unmounted.
- Pagination: don't submit forms, clamp the page to 1.
- Switch with a single custom label sized correctly.
- Input `size` binding restored.
- Date stepping clamps the day; spaces aren't parsed as digits; custom date
  format functions applied in `DitoDateTimePicker`; disabled dates and times
  are never committed.
- Focused fields keep their error border.
- Calendar resets the time to 00:00 after the date was cleared.
- Time inputs let Cmd / Ctrl / Alt shortcuts through.

### server

- Query parameters: range separator, nulls order error message.
- Validator: `_`-prefixed keywords and formats resolved; `instanceof`
  accepts constructors; self-referencing and `additionalProperties` schemas
  converted; failed conversions not cached.
- Controllers: member lookups with named parameters, per-request loggers,
  `ModelController` model class lookup.
- Graphs: parseable `relation(mod) as alias` expressions; only relatable
  models reduced to references; plain graph data filtered and populated;
  `relate: true` in collection graphs; relates through non-owned relations;
  `Location` header of related models.
- `clone()` keeps all scopes; `upsertGraph()` child queries keep the default
  scope.
- Relations loaded through `fetchGraph()`, including properties of relations.
- Streamed response logging and connect middleware (`next()`, errors, mount
  paths).
- Storages: empty uploads, mime-type detection.
- Silent env restore, migration errors, JSON seeds.
- UUID / hyphenated ids in sessions; `AssetMixin` calls `super.$parseJson()`;
  rollback warning about modified asset files.

### build

- Externalize dependency subpaths in library builds; UMD globals derived from
  module ids.
- Base64-encode raw bytes of non-svg data URIs.
- New `dist:check` script, also run in CI, checks built bundles for
  undeclared or bundled dependencies.
- Test harnesses are no longer published with admin and ui.

### utils

- `deprecate()` test made independent of test order (no runtime change).

### Improvements

- Keyboard accessibility: tabs (arrow keys, Home / End, Enter / Space),
  menus and create button, date and time pickers (calendar grid with arrow
  keys), drag handles (Alt+ArrowUp / Down, also inlined items), editor resize
  handles, tree edit buttons on focus, focus rings via `:focus-visible`.
- New `DitoMenuButton` in `@ditojs/ui`, replacing the mouse-only pulldowns of
  the create button and account menu; `DitoTrigger` gains click toggle,
  `open()` / `close()` / `toggle()` and `matchTargetWidth`.
- `DitoButton` supports verbs, link rendering and disabled links; buttons
  across the admin render through it.
- Menus and trails use real links (modifier-clicks open new tabs); sub-menus
  open on hover and focus.
- Validation errors are announced to assistive tech; aria fixes in trail and
  table head.
- Radio and checkboxes support `groupBy`, `editable` and `multiple: false`.
- New type option `rendersOwnLabel`.
- `addEvents()` in ui supports abort signals.
- Container queries for breakpoints instead of JS width measurement.
- Upload drop targets tracked reactively.

### Internal

- Tests: Vitest coverage (`pnpm coverage`), component tests in happy-dom
  mounting the real admin, unit tests across admin, ui, server, utils and
  build; line coverage now ~96%. Known bugs marked with `test.fails()`.
- Screenshot tests of all admin components and states in the Playwright
  Docker image (`pnpm -C tests screenshots`).
- Refactors behind unchanged APIs: `Session`, `ViewRegistry`,
  `LoadingTracker`, `ItemStores`, `ListQuery`, `FileDropTargets` and clipboard
  state as plain modules; `LoadingMixin` and `PulldownMixin` removed;
  `AssetManager` and shared handler parsing / `ParameterValidator` on the
  server; shared components `DitoSourceItem`, `DitoDragHandle`,
  `DitoInputAffixes`, `DitoResizeHandle`, `DitoPickerInput`, `DitoTimePanel`.
- DOM handlers removed via abort signals; release docs in the README.


