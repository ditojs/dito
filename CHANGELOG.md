# Changelog

The changes of each release of Dito.js. For upgrading to a new major
version, see the upgrade guides in `docs/`.

## 4.7.0 (unreleased)

### Behaviour changes

- **server:** `self` stands for the logged-in user in the member routes of `UsersController`, so `PATCH users/self` runs `member.patch` with all its settings, e.g. `transacted`, `parameters` and hooks, which the `'patch self'` collection action of 4.6.0 skipped. `'patch self'` is removed: remove it from `collection.allow` and from overrides.
- **server:** Relation controllers authorize their parent member in an override of `handleAuthorization()`, after the parameters are validated like all other authorization, instead of in `handleRequestAuthorization()` before anything else. Asset uploads on relations always need the parent's `patch` authorization. `handleRequestAuthorization()`, `authorizeMember()` and `getActionAuthorize()` are removed.
- **server:** `getMember()` goes through `member.get` only where `allow` routes it, and otherwise fetches the member by id through `fetchMember()`. Overrides of `member.get` that aren't routed no longer control which members `from: 'member'` parameters, `'$owner'` checks and relation requests receive.
- **server:** Values of `nullable` properties with a model type or a `$ref` get the defaults of the referenced schema, which Ajv ignored, e.g. `{ type: 'Author', nullable: true }` the defaults of `Author`, and these properties get their own `default`, e.g. `{ type: 'color', nullable: true, default: '#ffffff' }`.
- **server:** `$validateGraph()` reports only the errors of related models for relations, without the "must be null" and "must match a schema in anyOf" errors at the relation itself, and it applies the defaults of related models, unless it validates a patch.
- **server:** Validation errors of `if` keywords, "must match "else" schema", are left out, as the `then` or `else` schema reports its own. The "must be null" and "must match exactly one schema in oneOf" errors of a `oneOf` with a `null` type aren't left out anymore, which only `nullable` references produced.

### Fixes

- **server:** `Model.count()` counts rows on SQLite and MySQL, where it returned 0, and so does the `count` action of controllers.
- **server:** `truncate()` no longer applies the default scope of the model, which knex rejects.
- **server:** Relating several models to a many-to-many relation through its controller works on SQLite and MySQL, where it failed with a 500 error.
- **server:** On SQLite with the `better-sqlite3` client, `Date` values in queries are bound as ISO strings, as dates are stored, so date-range filters, `releaseUnusedAssets()` and queries like `where('createdAt', '>', date)` match.
- **server:** `log.sql` logs the rows of SQLite responses as arrays.
- **server:** On SQLite with the `better-sqlite3` client, a transaction whose commit failed, e.g. on a deferred constraint, is rolled back before the connection is used again, instead of making every later transaction fail with "cannot start a transaction within a transaction".
- **server:** Upserts and array saves that run in their own transaction use the knex passed to `query()`, instead of the model's.
- **server:** Constraint violations that make a transaction's commit fail, e.g. of deferred foreign keys, respond with 409 like the same violations in queries, instead of 500.
- **server:** Typed objects with properties in `allOf` aren't closed on their own anymore, so they no longer reject each other's properties. The object that combines them is closed instead.
- **admin:** Upload fields break long file names without spaces, instead of widening their table and the lists and forms around it.
- **admin:** Cancelling or closing the object form of a view with a single `component`, e.g. the account settings, leaves the view for the admin's root, instead of doing nothing.

## 4.6.0 (2026-10-16)

### New

- **server:** `FromModel` derives the instance types of models from their `properties` and `relations` declared `as const`, see [Deriving types](docs/guide/server/models.md#deriving-types).
- **admin:** `account.settings` in the options of `DitoAdmin` takes a form that edits the logged-in user, opened through a Settings item in the account menu at `/account/settings`, without an item in the main menu. It loads and saves the user through `api.users.self`, by default `users/self`, and shows the changes in the account menu right away.

### Fixes

- **server:** The `ModelProperties` type accepts nested `properties` of objects without `nullable: true`, and tuples as JSON Schema 2020 declares them, with `prefixItems` and `items: false`, as the validator expects.
- **server:** The `ModelProperties` type accepts `$ref` without `type`, `definitions` with object schemas, and the types that Dito.js adds, e.g. `'asset'` and model names.
- **admin:** The labels of lists with `collapsible: 'all'` expand or collapse all items when clicked, not only their double chevron, and their keyboard focus ring encloses the chevron and the text, like the labels of collapsible sections. The double chevron lines up with the chevrons of the items, at the same distance from the text.
- **admin:** Long labels of full-width components, e.g. lists in inlined forms, are clipped with an ellipsis again, instead of widening the form.
- **admin:** Inputs with label objects, e.g. `{ text, suffix }` or `{ html }`, use the text of the label as their title, instead of passing the object and causing a Vue warning.
- **admin:** The details of the active tree item, e.g. "2 items", are shown in translucent white, readable on its blue background.

## 4.5.1 (2026-10-15)

### Improvements

- **admin:** Upload fields show their copy and paste buttons before the upload and remove buttons, and show them and the drag handles of their files only on hover or focus, like inlined forms. The hidden buttons keep their space, so the table doesn't shift.
- **admin:** Open inlined forms show only their edit and remove buttons, like collapsed ones, and their other buttons on hover or focus. The hidden buttons keep their space, so the header doesn't shift.

### Fixes

- **admin:** The suffixes of collapsible labels, e.g. from `itemLabel()`, show again and are clipped with an ellipsis, instead of running out of the label and widening the form.
- **ui:** Building the admin no longer warns about the deprecated Sass `if()` function.

## 4.5.0 (2026-10-15)

### Behaviour changes

- **server:** Two actions of the same type with the same identifier in hook keys throw when the controller is set up, e.g. `'get :token'` and `'get token'`: change the route of one of them.
- **server:** `@ditojs/build`, `vite` and `@vitejs/plugin-vue` are optional peer dependencies, loaded only to build the admin or serve it in development: install them as dev dependencies of the app. `app.defineAdminViteConfig()` and `defineViteConfig()` of `AdminController` return promises, which Vite awaits as the default export of `admin.vite.config.js`.
- **admin:** Labels, the results of `itemLabel()`, `info` and the values of `label` components are text unless they're given as `{ html }`: strings show as they are, e.g. `&` and `<b>`, where labels and the strings returned by `itemLabel()` were HTML. Labels and callbacks that return HTML return `{ html }` instead. Labels show as text in tabs, the menu, the trail, column headers, buttons and accessible names, also for `{ html }`. `context.formLabel` is the text of the form's label, and `context.itemLabel` the text of the item's label, which was HTML: notifications that interpolate it pass it as `text`. `context.itemLabelText` is removed, use `context.itemLabel`.
- **admin:** `onToggle()` of collapsible sections and inlined forms also fires when the admin expands them to show a field, e.g. one with a validation error.
- **admin:** `clipboard` on lists copies and pastes the list as a whole, and doesn't add copy and paste buttons to the inlined form of `components` anymore: give the items a clipboard through `form: { components, clipboard }`, or a form with its own `clipboard`.

### New

- **server:** Hooks identify custom actions by their method and path, with hyphenated parameter names and without wildcards, e.g. `'before:member:get-tech-doc-format'` for `'get tech-doc-:format'`. `ctx.action.identifier` holds the part after `before:` or `after:`, e.g. `'member:get-tech-doc-format'`.
- **server:** `before` and `after` options of actions, hooks of the action only, which run after the controller's hooks.
- **admin:** `{ html }` on `label`, the results of `itemLabel()` and `info`, which renders its HTML, and `TextOrHtml` and `SchemaLabel` types for them. Filter placeholders use the text of `{ text }` and `{ html }` labels.
- **admin:** `clipboard` on upload fields, with copy and paste buttons next to the upload button, which copies their files and pastes them into other upload fields, adding the files that aren't there yet.
- **admin:** `validate()` on all types, which validates values that aren't empty with a callback, together with the other rules: it receives the context with the value after `formatValue()`, and returns `false` to fail with "is invalid", or a message to fail with.
- **admin:** `clipboard` on lists, with copy and paste buttons in the row of the label, or in the row of the scopes and pagination without a label: copying copies the loaded items, like forms copy theirs, as `{ items }`, and pasting appends them to `creatable` lists of the same name, each created with the form of its `type`. Items without a creatable form are left out. Lists with their own `resource` don't support it and warn.
- **admin:** `collapsible: 'all'` on lists, which adds a double chevron before the label that expands or collapses all loaded items at once, or at the start of the row of the scopes and pagination without a label. The items fire their `toggle` events, as when clicked.
- **admin:** Buttons in the header collapse the menu and the sidebar, which the browser remembers. On small screens, they hide and open as overlays: the sidebar below 1200px, the menu below 800px.
- **ui:** `.dito-chevron` of sections, inlined forms and tree items is a stroke icon like the others instead of a triangle, and `.dito-chevron--double` shows two chevrons. The focus rings of collapsible labels and tree items enclose only their chevron and label.

### Fixes

- **server:** Saving copies the files of assets from another storage than their field's, e.g. pasted from another upload field, to the field's storage under a new key, instead of referring to a file that the storage doesn't have.
- **server:** Wildcard hooks such as `'before:*:*'` and `'before:actions:*'` run for actions with route parameters too.
- **admin:** The labels of upload fields point to their inputs, which use the component path as their id, like the inputs of other types.
- **admin:** Trees and their items have the `tree`, `treeitem` and `group` roles, and sections the `region` role with their label, like lists and panels.
- **admin:** `clipboard` on objects applies to their `form`, not only to the inlined form of `components`. Forms with their own `clipboard` keep it.

### Deprecations

- **server:** Hook keys that name custom actions by their keys, e.g. `'before:member:get tech-doc-:format'`, keep working until 5.0 with a deprecation warning that names the new key.

## 4.4.0 (2026-10-14)

### Behaviour changes

- **admin:** `defineType()` throws for unknown descriptor keys, naming the replacement of the keys of 3.x, e.g. `excludeValue` or `processSchema`, and for the names of built-in types unless the descriptor has `override: true`.

### New

- **admin:** `placeholder` on selects, shown while no option is selected.
- **admin:** `taggable: { label, value }` on multiselects converts the typed text into the label and value of added options, and selects existing options with the converted value.

### Fixes

- **admin:** Tree items show the `prefix` and `suffix` of labels returned by `itemLabel()`.
- **admin:** Code fields with `null` values keep the form clean when they mount.
- **admin:** Rows with sections or inlined objects whose forms show labels align their other components with the labels.

## 4.3.0 (2026-10-14)

### Behaviour changes

- **admin:** Disabled sections and panels disable the inputs and buttons inside them, also in nested sections, instead of only greying them out. Loading forms and views no longer grey out their components, the loading spinner shows it.
- **admin:** Clipboard data holds the labels of related records outside the copied data instead of their ids, e.g. `author: { $label: 'Jane Austen' }`, and pasting resolves them through the options of the fields. Labels that match no option or several paste `null`, or are left out of multiple values, and a notification lists them. `clipboard.copy()` and `clipboard.paste()` see the labels instead of the ids.
- **admin:** `new DitoAdmin()` warns about each unknown option, and its types reject them: options other than `dito`, `api`, `views`, `login` and `spinner`. `admin.options` is typed with `login` and `spinner` only.

### New

- **admin:** `search` on multiselects turns on searching without `searchable: true`, which `searchable: false` still turns off. Other types warn about `search` when they're set up, as they ignore it.
- **ui:** `DitoDateTimePicker` supports `show`, `update:show`, `placement` and `target`, like `DitoDatePicker` and `DitoTimePicker`.

### Deprecations

- **admin:** `context.nested` is internal: `value` is `undefined` when a context describes an item.
- **admin:** `type: 'value'` replaces `type: 'computed'`, `'data'` and `'hidden'`, which keep working until 5.0 with a deprecation warning, and `ValueSchema` replaces `ComputedSchema`, `DataSchema` and `HiddenSchema`, which stay as deprecated aliases.

## 4.2.0 (2026-10-14)

### Behaviour changes

- **admin:** Lists, `checkboxes` and multiselects with `multiple` never hold `null`: a stored `null` loads as their `default`, or `[]`, without making the data dirty. Multiselects with `multiple` default to `[]` like checkboxes, and their clear button sets `[]`, so new and cleared multiselects are sent as `[]` instead of `null`. To store empty values as `null`, return it from `serializeValue()`. Objects and single choices keep `null`.
- **admin:** `required` rejects empty arrays, so required lists and fields with multiple values need at least one entry. The server's `required` still accepts them.

### Fixes

- **ui:** Date and time pickers show their value again when the focus leaves text that isn't a valid date or time, instead of keeping the text.

## 4.1.1 (2026-10-13)

- **admin:** Writes to values of list items and objects that their forms don't show, e.g. a `price` that `onLoad()` calculates, don't make the data dirty, as 4.1.0 described: only changes of fields that are saved are edits.
- **server:** `Service.configure(config)` is internal again: override `initialize()`, `start()` or `stop()` instead, which need no `super`.
- **server:** Services take an optional `config` as their third constructor argument, e.g. `new MailService(app, 'mail', config)` in tests, like storages.
- **server:** Storages set themselves up in an internal `setup()` again, and `initialize()` is an empty hook, so subclasses of the built-in storages don't need to call `super`.

## 4.1.0 (2026-10-13)

4.1.0 is the first release of Dito.js 4. 4.0.0 was withdrawn shortly after its release, and its changes are part of 4.1.0: the notes below describe all changes since 3.5.0. Dito.js 4 rebuilds the admin around its data: each view, form, dialog and panel with its own data keeps its edits, dirty state and errors, also for fields that aren't rendered, nested forms edit drafts of their items, and callbacks receive typed contexts instead of components. See [`docs/upgrading-to-4.x.md`](docs/upgrading-to-4.x.md) for how to upgrade.

### Breaking changes

#### Schemas

- **admin:** The value hooks are renamed: `format()` → `formatValue()`, `parse()` → `parseValue()`, `compute()` → `computeValue()` and `process()` → `serializeValue()`. Schemas that still use the old names throw when they're set up; on date and color types, `format` is the format setting, so rename a `format()` there by hand.
- **admin:** Schemas can't define `methods`, `computed`, `watch` and `data` anymore, and handlers, e.g. `onClick()`, `itemLabel()`, `render()` and `clipboard.copy()`, are called with their context only, without the component as `this`. Use plain functions, `onChange()` instead of `watch`, and module state instead of `data`. The `data` setting of panels and of the `computed`, `data` and `hidden` types stays.
- **admin:** `formats` of the date types is `format`. The date types convert the date strings of loaded data to `Date` objects. Date strings from defaults, computed values or code are displayed as dates and saved unchanged, until the user edits them.
- **admin:** Trees open their items with `collapsed: false` instead of `open: true`, on the tree and on its `children` schema. `collapsed` is `true` by default and can be a callback, called for each item. `open` throws on trees.
- **admin:** `relate` takes the key to relate options by, e.g. `relate: 'code'`, or `true` for `id`. `relateBy` throws.
- **admin:** `groupBy` of options components is `options.group`, the key of the options' group or a callback that returns it. `groupBy` on the schema throws.
- **admin:** `format: 'name'` of the color type is removed and throws, as the server's `type: 'color'` only accepts hex colors: use a hex format, e.g. `'hex'`.
- **admin:** `nested` only works on sections and panels, and throws on other types, which ignored it.
- **admin:** Options that were typed but never read are removed from the types: `defaultSort`, `defaultScope` and `nested` of sources, `idKey` of forms, `omitSpacing` of schemas, `options.groupBy`, and `dateFormat` and `locale` of date schemas.
- **admin:** Relative paths in `options.dataPath` and in the `dataPath` of the `computed`, `data` and `hidden` types are relative to the item the component sits in (`context.itemDataPath`) instead of the field, so they need one `../` less: `'../authors'` becomes `'authors'`. A leading `/` makes them absolute, as it already did in `options.dataPath`, and `..` above the root throws, where 3.5 dropped it silently. The `match` of `validate()`, `isValid()` and `clearErrors()` resolves the same way.

#### Events

- **admin:** Declare handlers as `on…` properties, e.g. `onClick()`. `events: {}` still works with a deprecation warning until 5.0, but an `on…` handler of the same event in the same schema wins over it instead of both running. In development, dito warns about the ignored `events` entries.
- **admin:** `events: { click() {} }` on the submit and cancel buttons of forms and the cancel button of dialogs replaced their default handler in 3.5, and is ignored now with a warning: move it to `onClick()`.
- **admin:** An `onClick()` on the submit or cancel button of a form, or on the cancel button of a dialog, replaces the default handler instead of running next to it: call `context.submit()`, `context.closeForm()` or `context.closeDialog()` from it.
- **admin:** Forms fire `onSuccess()` after saving, with `context.isCreating` telling new items apart, instead of `create` and `submit`. Nested forms fire `onApply()` when they apply their draft, where 3.5 fired `create` and `submit` too: move their `onSubmit()` to `onApply()`. `onCreate()`, `onSubmit()` and `create` or `submit` in `events` throw.
- **admin:** `onToggle()` with `context.collapsed` replaces `onOpen()` with `context.open` on collapsible sections and inlined forms, which lists and objects set on their `form`. `onOpen()` and `open` in `events` throw.

#### Contexts

- **admin:** Contexts don't expose components anymore: `component`, `formComponent`, `schemaComponent`, `viewComponent`, `dialogComponent`, `panelComponent`, `resourceComponent` and `sourceComponent` are removed. What callbacks used them for are members of the context, see [New](#new).
- **admin:** Context members are renamed: `query` → `routeQuery`, `index` → `valueIndex`, `processedItem` → `serializedItem` and `processedRootItem` → `serializedRootItem`. `sourceComponent.query` is `context.sourceQuery`, the query of the nearest list.
- **admin:** `context.navigate(location)` resolves to `true` if the navigation happened, or `false` if not, e.g. when the user chose to stay instead of discarding unsaved changes, instead of to vue-router's navigation failure.
- **admin:** `getResourceUrl()` without arguments throws when there is no form or list with a resource, instead of returning `null`.
- **admin:** In dialogs, `dialogComponent.resolve(value)` is `context.closeDialog(value)`. `dialogComponent.reject()` is removed.
- **admin:** `formComponent.setData(data)` and `schemaComponent.resetData()` are `context.resetItem(data)` and `context.resetItem()`, which reset the data like loaded data, without an edit, or to its defaults. `formComponent.applyCleanChanges()` is removed: write the values instead, which is an edit.
- **admin:** `filterData()` and the validation members of components, e.g. `validateAll()` and `verifyAll()`, are removed: use `context.validate()`, `context.isValid()` and `context.clearErrors()`.
- **admin:** `navigateToComponent()` and `navigateToRouteComponent()` are removed: validating reveals the first error and focuses it.
- **admin:** Code outside of callbacks reaches the admin's services through `admin.context`: `api`, `settings`, `user`, `views`, `flattenedViews`, `session`, `notify()` and `showDialog()`. `settings` holds the settings of the `dito` object passed to `DitoAdmin`, which the admin reads its `rootClass` and `forceDragFallback` from, instead of `window.dito`. `session.login()` and `session.ensureUser()` resolve to the user, `session.logout()` to whether it worked.
- **admin:** `closeNotifications()`, `rootComponent`, `registerLoading()` and `meta.api` and `meta.schema` of routes are removed. `api.base` is removed from the types and no longer defaults to `'/'`, as the admin doesn't read it: `dito.base` is the base of its routes.

#### Custom components and types

- **admin:** Custom components, of `type: 'component'` and of custom types, don't get `DitoMixin` and `TypeMixin` mixed in anymore. They receive `schema`, `context` and the value as `modelValue`, and emit `update:modelValue` to change the value and `change` once the change is done. The `component` of list items and columns receives the item or the cell's value as `modelValue`.
- **admin:** The admin's components are internal, and so is `DitoComponent.component()`: only the components of `@ditojs/ui` are public. Their actions are members of the context, e.g. `request()`, `navigate()`, `download()` and `getSchemaValue()`. `sendRequest()`, `getQueryLink()`, `getLabel()`, `getStore()`, `setStore()`, `removeStore()`, `focus()`, `on()`, `off()`, `emit()`, `emitEvent()` and `emitChangeEvent()` are removed.
- **admin:** Types are defined with `defineType(descriptor)` from `@ditojs/admin` instead of `admin.register(type, options)`. Renamed options: `excludeValue` → `defaultExclude`, `generateLabel` → `generatesLabel`, `ignoreMissingValue()` → `ignoresMissingValue()`, `treatNullAsMissing()` → `treatsNullAsMissing()`, `omitSpacing` → `omitsSpacing`, `valueFromDataSchema` → `resolvesValue` and `rendersOwnLabel()` → `hasLabel()`, inverted. `defaultExclude`, `ignoresMissingValue`, `treatsNullAsMissing` and `hasLabel` take a boolean or a callback that receives the context.
- **admin:** `processSchema(api, schema, name, routes, level)` is `setupSchema({ schema, api, name })` and doesn't add routes. `processValue(context, graph)` is `serializeValue(context)`, and `getTypeValidations(schema, context)` is `getValidations(context)`, with the schema in `context.schema`. `getSourceType()`, `getPanelSchema()` and `getFormSchemasForProcessing()` of dito's list types are internal or removed.

#### TypeScript types

- **admin:** Renamed types: `SchemaOpen` → `SchemaToggle` and `OpenEventHandler` → `ToggleEventHandler`.
- **admin:** Removed types: `SchemaDitoMixin` and `SchemaTypeMixin` (part of `ComponentSchemaBase`), `HTTPVerb` (use `HttpMethod`), `EmitterMixin`, `LoadingTracker`, and the types of component instances, e.g. `DitoComponentInstance` and `DitoFormInstance`.
- **admin:** Renamed types that keep working as deprecated aliases: `SchemaFields` and `SchemaSetupMixin` → `SchemaBase`, `BaseSchema` → `ComponentSchemaBase`, `SchemaRoute` and `SchemaRouteMixin` → `RouteSchemaBase`, `Form` → `FormSchema`, `OrItemAccessor` → `SchemaValue`, `ItemAccessor` → `SchemaValueCallback`, `HTTPMethod` → `HttpMethod`, `DitoContext` → `SchemaContext`, `DitoGlobal` → `GlobalConfig`, and `SchemaSourceMixin`, `SchemaOptionsMixin`, `SchemaNumberMixin`, `SchemaTextMixin`, `SchemaAffixMixin` and `SchemaDataMixin` → `SourceSettings`, `SelectionSettings`, `NumberSettings`, `TextSettings`, `AffixSettings` and `DataSettings`.
- **admin:** The types follow what the admin reads: context members are `readonly` except `isRunning`, and `searchTerm` can be `undefined`. `trim`, `inlined` and `disabled` of panels take plain values, as callbacks were always truthy. `placeholder` is a string, except in multiselects, the only type that reads `search`. `editable` and `deletable` of lists are booleans, and `compact` is typed on forms, sections and sources instead of views. `onInitialize()`, `onDestroy()` and `onLoad()` are typed where they fire: on forms, views, sections and panels. Lists and objects fire `onLoad()` on the schema around them, so it isn't typed on them. `error` of `ErrorEventHandler` is `unknown`. Views and forms have no `resource`, which they never read: forms load and save through their list or object. Affixes are typed by their `type`, `thumbnails` of uploads takes `true`, `'small'`, `'medium'` or `'large'`, and `showDialog()` requires `buttons`.
- **admin:** Typed options that were missing: labels with `prefix` and `suffix`, the `>` and `<` widths and CSS units, `nested` of panels, `creatable`, `editable`, `deletable` and `draggable` of forms, `compact`, `clipboard` and `tabs` of sources with `components`, `onClick()` of forms, sections and views for the clicks of their buttons, view labels as callbacks, resources as functions, `width` of filters, `operators: true` of text filters, the user's properties on `AdminUser`, `settings.forceDragFallback` of `GlobalConfig`, views as arrays and the optional `views` of `DitoAdmin`, and `users` of `ApiConfig` without `path`, `disabled` of forms, `options` as a function, the short form of `{ data }`, and affixes as the `prefix` and `suffix` of `itemLabel`. `download()` takes `query`, `request()` takes `signal`, `getSchemaValue()` takes arrays of keys, `CustomComponentProps` takes the schema type of custom types, and the callbacks of `api.defaults` receive forms and views.
- **server:** `HTTPMethod` is `HttpMethod`, and keeps working as a deprecated alias.
- **server:** The params of custom `validate()` and `validateAsync()` keywords are typed with `instancePath` and `ctx`, which they receive, instead of `dataPath`. `upsert()` and `upsertAndFetch()` take `PartialModelObject`, as they leave relations untouched.
- **server:** `ApiConfig` has no `dateFormat` and `resources` anymore: set `resources` on the admin's `api`.
- **server:** The types follow what the server reads: controllers have no `allow`, which only actions objects read. `Authorize` doesn't take objects keyed by HTTP method: controllers and actions objects take settings by action name, e.g. `{ 'post import': 'admin' }`. Actions have no `method` option, as the method is part of their name. `ResponseError` has no `code`, which is in `data.code`. `ApplicationConfig` has no top-level `api` and no `app.logger`. `multipleOfPrecision` of the validator is a number. Models have the event emitter and knex helper methods on their static side only, `EventEmitter` is a type only, and `$hasRole()` returns the matched role or `false`, also on `UserMixin`. `through` of relations takes only objects, as `true` throws. `ControllerError` and `ModelError` require their message. The validator's `async` and `patch` are options of `compile()`, not of its constructor, and `discriminator` defaults to `true`.
- **server:** Typed options that were missing: `hooks` and `assets` on all controllers, `path`, `authorize` and `hooks` of the relations of model controllers, `[schema, options]` and `options` of action parameters and responses, `log: false` and model names in `log.schema` and `log.relations`, model classes as `session.modelClass`, find-filter objects as scopes, hook arrays and comma-separated hook keys, `graphOptions` and objection mappings of relations, `options` of models, `convertAssetFile(file, { trusted })` and the overridable `_addFile()`, `_removeFile()`, `_readFile()`, `_listKeys()`, `_getFilePath()` and `_getFileUrl()` of storages, the `router` of applications, arrays in `events` and `addModels()`, `relate` and `unrelate` of the relations of model controllers, `ModelController` as the `parent` of relation controllers, `$parseJson(json, { trusted })`, the optional arguments of `$validateGraph()` and `sessionQuery()`, the results of `$transaction(handler)`, query filters as functions, composite ids in the `…ById()` graph methods, `app`, `options`, `keywords`, `formats` and `types` of validators, `storage` of storages, and S3 storages without `s3`.

#### Styles

- **admin:** `.dito-form-nested` is `.dito-form--embedded`, and the component `DitoFormNested` is `DitoFormEmbedded`, as the forms that trees render inside their source are embedded forms.
- **admin:** The deprecated `$pulldown-radius`, `$pulldown-padding-ver`, `$pulldown-padding-hor` and `$pulldown-padding` SCSS variables are removed.
- **ui:** The SCSS variable `$ease-put-quint` is `$ease-out-quint`, without the typo.
- **ui:** The modifiers of `DitoTrigger` and its popups follow BEM: `.dito-trigger-disabled` is `.dito-trigger--disabled`, and `.dito-popup-{placement}`, e.g. `.dito-popup-bottom-left`, is `.dito-popup--{placement}`.

#### UI

- **ui:** `DitoDatePicker`, `DitoTimePicker` and `DitoDateTimePicker` emit `change` once the edit is done, when the popup closes, the input loses focus or Enter is pressed, and `update:modelValue` for each value, instead of `change` for each value.
- **ui:** The `disabledDate` prop of `DitoCalendar` and `DitoDatePicker`, the `disabledHour`, `disabledMinute` and `disabledSecond` props of `DitoTimePicker` and `DitoTimePanel`, and `.dito-calendar-item-disabled` are removed.
- **ui:** `DitoButton` with a `verb` and without `text` is labelled by its verb, also when its default slot displays text, and `getVerbButtonAttributes()` doesn't take `hasText` anymore.

#### Builds

- **build:** `@ditojs/admin` and `@ditojs/ui` are only published as ES modules: their UMD builds and `require` exports are removed, and `defineViteConfig()` of `@ditojs/build` doesn't read `rollupOutput` anymore.
- **build:** All packages have `exports` maps with `import` only, which also expose their `package.json`: `@ditojs/utils`, `@ditojs/build` and `@ditojs/router` can't be loaded with `require()` anymore, and `@ditojs/server` only exposes its entry point, so imports of its internal files, e.g. `@ditojs/server/src/…`, fail.
- **utils:** The deprecated `stripTags()` is removed: use `stripHtml()`.
- **utils:** `setDataPathEntries()` is `setEntriesAtDataPath()`, and `escapeRegexp()` is `escapeRegExp()`.

#### Server

- **server:** `Service.setup(config)` is `configure(config)`, which services override to read their configuration. The application starts and stops its services itself, and an overridden `setup()` isn't called anymore.
- **server:** Storages are created with `constructor(app, name, config)` and named by their key in `config.storages`, as `config.name` isn't read anymore. `app.addStorage(config, name)` needs the name. Their async `initialize()` replaces `setup()`.
- **server:** `upsert(data)` saves models by the ids in the data like `upsertAndFetch()`, without fetching them: it patches the models that exist and inserts the others, instead of patching what the query matches. Its `update` and `fetch` options are removed.
- **server:** Collection `PUT` and `PATCH` requests reject models without ids with a 400 error instead of inserting them: create them with `POST`. With `graph`, this applies to the root models, while nested models can still be new.
- **server:** The array forms of `patchAndFetch()` and `updateAndFetch()` throw for models without ids instead of inserting them: insert these with `insertAndFetch()`.
- **server:** The validator applies `discriminator` keywords: a `oneOf` with `discriminator: { propertyName: 'type' }` validates only the variant that `type` selects, which needs a fixed `type` in the `properties` of each variant. The tag stays required in patches. Before, the keyword was ignored and all variants were tried.
- **server:** Schemas with `type: 'object'` that combine parts through `allOf`, `anyOf` or `oneOf` without their own `properties` reject unknown properties, as objects with `properties` do: they get the automatic `unevaluatedProperties: false`, and their parts aren't closed on their own unless they have a `type`. Set `unevaluatedProperties: true` to allow unknown properties.
- **server:** Definitions, e.g. `'#Address'`, are closed where they're used instead of where they're defined: a `$ref` to one gets the automatic `unevaluatedProperties: false`, unless it's a part of `allOf`, `anyOf` or `oneOf`, so definitions can also serve as the base of other schemas. Definitions of objects without properties stay open, and so does a definition with `unevaluatedProperties: true`, wherever it's used. Parts that only `$ref` a definition inside an outer schema that isn't closed, e.g. one without `type`, accept unknown properties now.
- **server:** Text filters without an operator search for the text anywhere, like `contains`, instead of not filtering.
- **server:** `type: 'color'` only accepts hex colors, `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, instead of any string. Use `type: 'string'` for other color strings, and `type: 'object'` for the object formats of the admin's color type, e.g. `format: 'rgb'`.
- **server:** Removed deprecations: `AdminController.getPath(name)` (use `resolveConfigPath(name)`), `returns` of handlers and `options.returns` (use `response` and `options.response`, both throw), the scope prefixes `-` and `#` (use `!` and `@`) and the `cyclic` option of the `*DitoGraph*()` methods, which had no effect.
- **server:** The `expression` of `getPropertyOrRelationAtDataPath()` selects properties with `(@name)` instead of `(#name)`, as the scope prefix `#` is removed.
- **server:** `TimeStampedMixin` and `TimeStampedModel` are `TimestampedMixin` and `TimestampedModel`, and their scope `timeStamped` is `timestamped`.
- **server:** `getDitoObject()` and `sendDitoObject()` of `AdminController` are `getGlobalConfig()` and `sendGlobalConfig()`, after the `GlobalConfig` type of the admin's `window.dito` that they create.
- **server:** `initialized` of models, controllers, services and storages is `isInitialized`, and `closed` of `AdminController` is `isClosed`.
- **server:** The admin's HMR is served through the app's server instead of a port of its own: remove `server.hmr.port` from the admin's Vite config.

### Behaviour changes

#### Schemas

- **admin:** Object defaults of `api.defaults` only fill in what schemas leave out, also inside nested objects, instead of overriding the values that schemas set themselves. The values that default functions return still override the schema's.
- **admin:** The create menu of lists and objects offers their forms by `creatable` only, where 3.5 also left out forms by their `if`, the `if` of their components and `visible`. Move such conditions to `creatable`, whose callback gets the context of the list.

#### Contexts

- **admin:** Each context describes its `item`: `itemDataPath`, `itemIndex`, `parentItem`, `parentItemDataPath` and `serializedItem` belong to it. In the events of forms, sections and inlined and object forms, and in list buttons, 3.5 gave the values of the item one level up: `itemIndex` in `onChange()` of a chapter's form is the chapter's index now. List buttons and filters panels describe the item that holds the list, or the list itself in single-component views, and relative data paths in their `validate()` resolve against it.
- **admin:** `context.value` is `undefined` in the events of forms and sections, which describe their item: read `item`.
- **admin:** `onSuccess()` and `onError()` of submit buttons get the same context as their `onClick()`.

#### Dirty state and saving

- **admin:** Forms are dirty once their data is edited, until it's saved, applied or loaded again, instead of when it differs from the loaded data: reverting an edit leaves them dirty, while writes that don't change a value aren't edits.
- **admin:** Writes count as edits when they change a value that a field shows and that is saved; helper values without a field don't. Changes of fields with `exclude`, or of values inside them, don't make the data dirty. Sources with their own resource are excluded by default: with `exclude: false`, changes of their lists, e.g. their order, make the form dirty.
- **admin:** Only data that can be saved is dirty: views, dialogs and panels without a button of type `submit` are never dirty, and views without one don't ask about unsaved changes. Excluded sources with their own resource track the edits of their list, which their buttons clean when they submit them.
- **admin:** Writes through the data of contexts, i.e. `item`, `parentItem`, `rootItem` and `value`, are edits. Code that changes values in place, e.g. a date through `setHours()`, calls `context.markDirty()`.
- **admin:** Save responses and `context.resetItem(data)` merge into the form's data in place, so open nested forms keep their edits.
- **admin:** Leaving a form while it saves waits for the save, which 3.5 didn't, and only asks about unsaved changes if the save fails. "Save & close" only navigates if the user is still in the form.
- **admin:** Submitting waits for running uploads and loads of data and options without the 30 second limit of 3.5, as `api.timeout` bounds the requests.
- **admin:** Saving the forms of the children of tree items doesn't reload the tree.
- **server:** `upsert()`, `upsertAndFetch()`, the array forms of `patchAndFetch()` and `updateAndFetch()`, and array inserts outside of PostgreSQL run in a transaction: a failure rolls back the models saved before it.
- **server:** Outside of PostgreSQL, arrays passed to `insert()` are inserted without their relations, as in PostgreSQL, instead of through `insertGraph()`: insert graphs with `insertDitoGraph()` or `insertGraph()`. `insertAndFetch()` accepts arrays there too, instead of throwing.

#### Nested forms

- **admin:** Nested forms without `mutate: true` edit a draft of their item: OK merges the draft into the item and makes the parent dirty if it changed, Cancel leaves the parent untouched. `serializeValue()` runs only when the parent is saved, and the data outside of the item is read-only in the draft.
- **admin:** Open nested forms follow their item when it moves. The forms of list items close when their item is removed, instead of showing the next one.

#### Errors

- **admin:** Errors stay with their values when sections collapse, tabs switch and items move, and any change of a value clears its errors.
- **admin:** Errors inside values that no deeper field displays, e.g. of objects edited as code, show on the field of the value, with their path.
- **admin:** Rows of lists and tree items with errors in their items or children are marked with `.dito-table__row--error` and `.dito-tree-item--error`.
- **admin:** Saving or applying a form successfully clears all errors of its data, also of fields that aren't shown.
- **admin:** Errors thrown by event handlers, e.g. in `onClick()`, reach `onError()` and the code that awaits them as they are, instead of wrapped in an `AggregateError`: read `error.message` instead of `error.errors[0].message`.

#### Fields and display

- **admin:** Cells without `render()` and item labels show values as their types display them, e.g. 'June 1, 2026' for `type: 'date'` instead of the stored string.
- **admin:** Date, datetime and time fields fire `change` once the edit is done, when the picker closes, the field loses focus or Enter is pressed.
- **admin:** `input` fires for each edit in all types, and bubbles to the schemas above like `change`. Returning `false` from a handler of either event stops it from bubbling further.
- **admin:** Selects and multiselects keep values that their options lack and show them as unavailable, instead of setting them to `null`.
- **admin:** Tabs render once they're selected and stay rendered.
- **admin:** In panels with their own data, e.g. filters, `item` is the panel's data and `rootItem` the data of the page. Writes through `rootItem` and `parentItem` there are edits of the page's data, like in forms with `mutate: true`. In dialogs, `rootItem` is the dialog's data.

#### Routes, requests and the clipboard

- **admin:** The URLs of the forms of lists in nested sections and inlined objects contain the name of their container, e.g. `/books/1/contents/notes/2`.
- **admin:** The items of tree lists with a resource are addressed by their id in URLs instead of their index.
- **admin:** `request({ cache: 'local' })` caches while the route of the form or view is shown, and dialogs have their own local cache while they're open.
- **admin:** Pasting writes the copied values into the item, which keeps its id and position. The items of its lists are added as new items with new temporary ids, and lists with their own resource are left out. Copying gives related items new temporary ids, distinct for each id in each list, e.g. `@12` and `@13` for the id `7` and the temporary id `@7`, which both became `@7` before. Copying the item of a nested form leaves out the ids of its items.

#### Data paths

- **utils, server:** `**` in the middle of the data paths of `getValueAtDataPath()` and `getEntriesAtDataPath()`, and so of the `assets` of models, matches zero or more levels instead of one or more, like in `.gitignore`: `a/**/c` matches `a/c` too. At the end, `a/**` still matches everything inside `a`, but not `a`.

### New

- **admin:** Context members for what callbacks used components for: `isDirty`, `isCreating`, `validate(match)`, `isValid(match)`, `clearErrors(match)`, `markDirty()`, `resetItem(data)`, `submit()`, `closeForm()`, `closeDialog(value)`, `showDialog()`, `getRouteUrl(location)`, `getSchemaValue(key, { type, default })`, `routeQuery`, `sourceQuery` and `selectedTab`.
- **admin:** `context.closeForm()` resolves to `true` once the form closed, or `false` if it's still open, e.g. when the user chose to keep unsaved changes.
- **admin:** `match` of `validate()`, `isValid()` and `clearErrors()` takes data paths with `*` for one level and `**` for zero or more levels, or for everything inside at the end, arrays of them, regular expressions or functions.
- **admin:** `serializeValue()` returning `undefined` leaves out the value's key. Virtual fields write the actual values into `context.serializedItem` and return nothing, instead of using `exclude: true`, so their edits make the form dirty.
- **admin:** Handlers of bubbled events receive `currentDataPath`, the data path of the component whose handler runs, next to the `dataPath` of the changed value.
- **admin:** `serializedItem` and `serializedRootItem` are available in all callbacks, e.g. `if` and `computeValue()`, and in `serializeValue()` they're the data being built.
- **admin:** `deserializeValue()` converts stored values to edited ones, for loaded data, save responses, `resetItem()`, pasted data and filters. Types can define `serializeValue()` and `deserializeValue()`, which run before the schema's.
- **admin:** Forms fire `onCancel()` when their cancel button closes them. A value returned from `onSuccess()` or `onError()` of forms suppresses the notification, like on buttons.
- **admin:** `itemLabel` and `itemLabelText` hold the label of the form's item in all callbacks inside a form, e.g. its events and the `if` and `label` of its components, computed when they're read. In `itemLabel()` itself, they're `null`.
- **admin:** Trees fire `onToggle()`, set on the tree or on its `children` schema, with `context.collapsed` when their items collapse or expand.
- **admin:** Option labels receive `context.isSelected`.
- **admin:** Type descriptors can state `rendersLabel`, `submitsData` and `hasEmbeddedForms`, display values with `getDisplayValue()`, and load options with `getOptionsDataSchema()`, whose components read the loaded options as `context.options`. `type` takes an array of types that share the descriptor.
- **admin:** `CustomComponentProps` and `CustomComponentEmits` type custom components, and dito warns in development about undeclared props and emits.
- **admin:** Custom components can emit `focus` and `blur`, which fire the schema's events, and `blur` validates the value. They receive `errorsElementId`, the id of the element that shows their errors.
- **admin:** New types: `AdminContext`, `AdminUser` and `TypeDescriptor`. `context.extend()` is typed, and the SCSS variable `$error-bar-width` sets the width of the marks of rows with errors.
- **admin:** `multiple` of uploads, `lines` of textareas and markups, and `placeholder` of multiselects take callbacks.
- **admin:** Lists with `wrapPrimitives` support routed forms.
- **admin:** Panels with `nested: true` hold their values under their name, like nested sections, e.g. `item.details.title`. Panels with their own `data` can't be nested and throw.
- **server:** The `ApiConfig` type has `formats` and `timeout`, and `ApiResource` has `method`, `id` and `query`, as the admin reads them.
- **utils:** `resolveDataPath(dataPath, path)` resolves `path` relative to `dataPath`, or from the root with a leading `/`.

### Fixes

- **admin:** Applying a nested form no longer drops values that the form doesn't cover, wipes `exclude` values, cuts related objects to `{ id }` or serializes values twice.
- **admin:** Cancelling a nested form no longer leaves temporary ids in the parent, which later saves sent as `#ref` without `#id`.
- **admin:** Removing an item before an open nested form's item no longer switches the form to the next item and drops its edits.
- **admin:** Copying no longer carries other items' ids into pasted items.
- **admin:** Lists in forms that are shared by several views or lists get their routes in each of them.
- **admin:** Lists with their own `path`, lists in nested sections, and lists whose names don't survive normalizing their paths, e.g. `sourceURLs`, open their items' forms instead of empty ones.
- **admin:** Lists linked to views with several components get correct edit links, and can create items there.
- **admin:** Relative resources resolve against the nearest form or list with a resource: the forms of tree items no longer load `pages/pages/1` instead of `pages/1`, and lists in the items of inlined lists no longer resolve against the API root.
- **admin:** `markup` edits that don't blur the editor, e.g. links applied through the dialog, are written right away, so saving immediately no longer sends the old value. After the link dialog, the focus returns to the editor.
- **admin:** The `on…` handlers of sections, e.g. `onChange()`, `onInput()`, `onClick()`, `onInitialize()` and `onDestroy()`, fire for the section and the events of its components, which they never did.
- **admin:** The `click` events of buttons bubble through all schemas above, e.g. to `onClick()` of a form around a section, instead of only to the schema right around the button.
- **admin:** `onError()` of buttons that calls `context.notify()` replaces the default notification of the error that `onClick()` threw, like on forms and resource buttons.
- **admin:** Saving with an error in a collapsed section or inlined form opens it and focuses the field, where the focus stayed on the Save button.
- **admin:** `spinner: null` in the options of `DitoAdmin` hides the header's spinner, as its types describe, which it never did.
- **admin:** `rules: { name: false }` removes the rule `name`, like `undefined`, where the rule kept validating, as validators ignore the setting `false`.
- **admin:** `showDialog()` without `buttons` or with `buttons: {}` shows a dialog that Escape cancels, instead of throwing, and `components` can be left out.
- **admin:** `creatable` callbacks that return `{ label, query }` label the create button and add the query to its route, which only worked for objects.
- **admin:** The create button of sources with a single form is disabled when the form is `disabled`, like the forms in the create menu, instead of throwing "Not allowed to create item for given form" on click.
- **admin:** Lists with `columns` as an array label their items with the value of the first column, where they had no label.
- **admin:** The `if` of the components of panels with their own data only runs with that data, where validation and the panels in `components` also ran it with the data around the panel, which could hide the panel.
- **admin:** Tree items with `null` children are sorted as an empty list, without a warning.
- **admin:** `admin.el` holds the element that the admin mounts to, also when the constructor receives a selector.
- **utils:** `isEmpty()` checks the size of `Map` and `Set` objects and never treats dates as empty, where it returned `true` for all of them.
- **utils:** Errors of `setValueAtDataPath()` print the full path, separated by `/`, e.g. `Invalid path: items/7/title` instead of `items,7`.
- **utils:** `isCreditCard()` anchors all its card patterns at both ends, so numbers that only start like a card number, e.g. a Visa prefix with 14 digits, no longer pass.
- **utils:** `debounceAsync()` keeps working after `cancel()`, where later calls resolved to `undefined` right away, and with `immediate`, calls within the delay resolve to the result of the leading call instead of never settling.
- **utils:** `getEntriesAtDataPath()` no longer keys the entries of trailing wildcards with a trailing slash, e.g. `a/b/` for `a/*`, which made models write the files of `assets` at such data paths to the wrong key.
- **server:** `authorize: false` on an action or a controller denies access. Before, it was skipped: actions fell back to the settings of their actions object or controller, or were public without one.
- **server:** `UserMixin` hashes passwords set through a `passwordProperty` other than `password`, which were never hashed, and its `setup()` calls the `setup()` of the model it extends.
- **server:** The `assets` and `logger` options of an application no longer change the defaults of the applications created after it.
- **server:** `allow: ['*']` on the `collection` and `member` of model controllers routes all their actions, instead of throwing "Missing handler in '$core' action".
- **server:** `db:create_migration` creates `json` columns for `type: 'asset'` and model types, e.g. `type: 'Author'`, and `string` columns for `type: 'color'`, instead of calling `table.asset()`, `table.Author()` and `table.color()`, which knex doesn't have, and only uses `increments()` for integer primary keys.
- **server:** `db:create_migration` takes the column types of properties with a `$ref` but no `type` from their definitions, and creates `json` columns for definitions without a `type`, instead of writing `table.undefined()`.
- **server:** `db:create_migration` names the columns of join tables like the relations do, e.g. `bookId` instead of `BookId`, which broke `manyToMany` relations without `normalizeDbNames`.
- **server:** The foreign keys that relations add to their related models, e.g. `Review.bookId` of `Book.reviews`, no longer go missing when the related model is registered first.
- **server:** `upsertAndFetch()` and the array forms of `patchAndFetch()` and `updateAndFetch()` return all saved rows regardless of the `default` scope, like `insertAndFetch()`, where rows outside it were saved but missing from the result.
- **server:** `hooks` of models and controllers accept arrays of handlers, as their types declare, instead of throwing "on only accepts instances of Function".
- **server:** A JSON Schema `required` array on a property, e.g. `required: ['type']`, no longer makes the property itself required, and adds to the properties marked `required: true` instead of being replaced by them.
- **server:** The `authorize` setting of a `UsersController` doesn't apply to its `login`, `logout` and `session` actions, which authenticate users, so users can log in. `self` still follows it.
- **server:** Logins of users without a password hash fail with 401, instead of 500 with bcrypt's "Illegal arguments".
- **server:** Files uploaded to S3 storages without `url` get the S3 url that multer-s3 returns, instead of no url.
- **server:** `db:seed` exits with an error code when a seed fails, after running the other seeds.
- **server:** `CollectionController` is exported, as its types declare.
- **server:** `{ from: 'member' }` parameters are left out of the schema that the parameters of actions are validated against, as they're resolved separately.
- **server:** Controllers that override `relations` of their base controller keep its relation and member actions.
- **server:** `getPropertyOrRelationAtDataPath()` leaves array wildcards out of the relation expressions it returns, which objection read as all relations (#214).

### Internal

- The admin is written in TypeScript where it was rebuilt, and its components are built with `setup()` and composables instead of mixins.

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
- **server:** `from: 'member'` parameters and `$owner` checks use `member.get` overrides. Overrides should pass `modify` on to `super.get()`, otherwise locks and scopes are lost. See the new section in `docs/guide/server/controllers.md` (#188).

### API and docs

- **server:** New overridable controller methods: `handleRequestAuthorization()` authorizes requests beyond their own `authorize` setting, `authorizeMember()` authorizes a member like its `get` or `patch` action, and `getActionAuthorize()` returns an action's `authorize` setting. The `id` of `fetchMember()` is optional: one-to-one relation controllers then fetch their related model.
- **ui:** A `focus-ring` SASS mixin for keyboard focus, with a color option.
- **docs:** `docs/guide/server/controllers.md` describes the authorization of relation requests, `member.get` overrides including their `this` in one-to-one relations, and the members of one-to-one relations and their 404s.

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


