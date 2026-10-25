# Changelog

The changes of each release of Dito.js. For upgrading to a new major
version, see the upgrade guides in `docs/`.

## 6.1.0 (2026-10-25)

See [Upgrading to 6.1](docs/upgrading-to-6.x.md#61) for what apps need to
change.

### Behaviour changes

- **server:** S3 storages use [aws-lite](https://aws-lite.org) instead of the AWS SDK and `multer-s3`:
  - Install `@aws-lite/client` and `@aws-lite/s3` instead of `@aws-sdk/client-s3` and `@aws-sdk/lib-storage`.
  - `s3` needs `region` and `credentials`, which no longer come from environment variables or `~/.aws`, see [S3StorageConfig](docs/api/server/storage.md#s3storageconfig).
  - Object options like `acl` or `cacheControl` take strings only, and apply to imported files too.
  - Without `url`, files get the URL of the bucket. The `MulterS3File` type is removed.
- **server:** `UserMixin` rejects `hash` in all untrusted input, not only in `UsersController`.
- **server:** Asset signatures cover the files' metadata, so admin pages that were open during the update need a reload before saving files.
- **server:** `ctx.transaction` no longer emits `'commit'` and `'rollback'`.
- **server:** `ctx.logIn()` and `ctx.logOut()` are removed: use `ctx.login()` and `ctx.logout()`.
- **admin:** Empty values and defaults, see [Empty values](docs/api/admin/schemas.md#empty-values):
  - A `null` written while editing stays until saving, e.g. when clearing a number to type another one. Saving and copying replace it with the `default`, or the empty value of the type, in values that aren't `nullable`.
  - The clear button of fields with `nullable: false` sets their `default`.
  - Custom types declare their data type with `getProperty()`. `treatsNullAsMissing` is removed.
- **admin:** `required` arrays need one item everywhere, also in written properties and custom types. `minItems: 0` accepts none, see [Types and limits of fields](docs/guide/admin/validation.md#types-and-limits-of-fields).
- **admin:** Several fields of the same value take each rule and option, e.g. `minLength` or `trim`, from the first field that sets it, and validate the value once.
- **admin:** Trees take `details` instead of `properties`, with the type `Details`.
- **admin:** Removed: `DitoFormEmbedded` (use `DitoForm`) and `context.nested`.
- **admin:** Renamed classes: `dito-root--overlay-sidebar` and `--sliding-sidebar` are on `.dito-page` as `dito-page--…`, `dito-tree-item--dragging` is `dito-draggable--dragging`, and `.dito-properties` of trees is `.dito-tree-item__details`.
- **admin:** The login dialog shows icons in its fields, and its Forgot? button moves into the password field.
- **admin:** "is required" shows before the other messages of a value.
- **ui:** The Sass placeholders are BEM modifiers, e.g. `%field--has-errors` or `%icon--clear`.
- **ui:** `DitoInput` spaces its prefix and suffix by its padding.
- **router:** Routes with several params in one segment, e.g. `/a/:x-:y`, throw when added.
- **router:** `getAllowedMethods(path)` adds the `prefix` itself, as `find()` does.

### New

- **admin:** Input affixes can be buttons, and affixes with `hover: true` only show while hovering, as the clear button does now.
- **admin:** `getProperty()` of custom types, e.g. `getProperty: () => ({ type: 'number' })`.
- **ui:** A `lock` icon.

### Fixes

- **server:**
  - `$ref`s in `anyOf` and `oneOf` reject unknown properties again, as in 3.5.
  - Files stored in a transaction that rolls back are removed again, in all transactions.
  - Clients can't overwrite stored files by sending asset files back with `data`.
  - S3 storages give imported and copied files a URL.
- **admin, forms:**
  - Removing an item whose form has unsaved changes closes the form, instead of keeping it on the removed item.
  - The validation notification lists the errors of hidden fields.
  - Enter submits dialogs only once.
  - Forms of `useDitoForm()` that fail to set up log the error instead of loading.
  - Panels with an object as `data` no longer write into the schema.
  - `notify()` no longer breaks lists in `html` paragraphs apart.
- **admin, fields:**
  - Options that are `0`, `false` or `''` are selected like other options.
  - Values without an option show as unavailable for all kinds of options.
  - A failed upload keeps the file that was there before.
  - `nullable` and `trim` callbacks of text fields are respected.
  - Empty strings that are options stay `''`.
  - `DitoSelectField` and `DitoRadioField` throw for arrays, pointing to the fields that support them.
  - A named `DitoCustomField` emits `change` on blur, and its content fills the field.
- **admin, resources:**
  - Resource functions receive the `method` of the request and return their own `method` and `query`.
  - Buttons whose resource function reads its `parent` submit again.
- **admin, trees:** Items without children can show their `details`, and `details` respect their `if`.
- **admin, layout:**
  - Pages are wide only for `wide` forms again.
  - The menu shows no empty items.
  - Back from an object without data no longer loops.
  - Large sections and lists open fast again.
- **admin, types:** Resources without `type` and all standard `autocomplete` values type-check.
- **ui:**
  - Collapsible sections open smoothly again.
  - `aria-invalid="false"` shows no error.
- **schema:** `decimals` accepts numbers in exponent form, e.g. `1e-7`.
- **utils:** `equals()` handles objects without prototype, and `html([])` returns an empty value.

### Internal

- **admin, schema:** The packages no longer publish their tests.

## 6.0.0 (2026-10-23)

See [Upgrading to 6.x](docs/upgrading-to-6.x.md) for what apps need to change.

### Behaviour changes

- **server:** Patches check the values of `required` properties that they send, rejecting empty strings with 'is required'.
- **server:** `UserMixin` rejects empty passwords with a validation error, instead of setting the hash of `''`.
- **server:** Values outside `range` are reported as `range` errors, "must be between 1 and 5", instead of `minimum` or `maximum` errors.
- **server:** Removed, see [Server](docs/upgrading-to-6.x.md#server):
  - `app.compileValidator()`: use `app.compileJsonSchema()`.
  - Hook keys that name actions by their keys, e.g. `'before:member:get tech-doc-:format'`, no longer match: use their identifiers, e.g. `'before:member:get-tech-doc-format'`.
  - The types `HTTPMethod`, `SelectModelProperties`, `SelectModelKeys`, `ExtractModelProperties` and `SelectModelPropertyKeys`: use `HttpMethod`, `SerializedModel` and `keyof SerializedModel`.
- **admin:** Removed schema options, see [Schemas](docs/upgrading-to-6.x.md#schemas):
  - `components` of schemas, filters and `showDialog()`: use `fields`, and `field` instead of `component` in views.
  - `min` and `max`: use `minimum` and `maximum`.
  - `rules`: use the limits of fields, their types and `validate()`.
  - `events: {}`: use the `on…` handlers, e.g. `onChange()`.
  - `type: 'computed'`, `'data'` and `'hidden'`: use `type: 'value'`.
- **admin:** `format` of `color` fields is renamed to `colorFormat`, and of `date`, `datetime` and `time` fields to `formats`. The old keys are ignored. `format`, `parse`, `compute` and `process` only throw as 3.x value hooks when they're callbacks.
- **admin:** HTML, see [HTML](docs/upgrading-to-6.x.md#html):
  - Strings returned by `render()` of columns, lists, objects and uploads, and the messages of `confirm()`, `prompt()` and `alert()`, show as escaped text: create HTML with `html` of `@ditojs/utils`.
  - `{ html }` objects, `type: 'html'` affixes and the `html` option of `notify()` are removed: use the `html` template.
- **admin:** `DitoField` is removed: use `DitoSchemaField`. `login.additionalComponents` is removed: use `login.additionalFields`.
- **admin:** The deprecated TypeScript type aliases are removed, see [TypeScript types](docs/upgrading-to-6.x.md#typescript-types).
- **admin:** Hidden fields, see [Behaviour changes](docs/upgrading-to-6.x.md#behaviour-changes):
  - Values of hidden fields (`if` false, or in hidden sections, tabs or panels) aren't saved or copied.
  - Of several fields of the same value, only shown ones run `serializeValue()` and display the value in item labels and table cells. Hidden fields still set their defaults.
  - A nested section whose fields are all hidden counts as hidden, together with its own value.
  - An `if` that throws is logged and its field treated as shown, instead of stopping validation.
- **admin:** Item labels and table cells only display the values of the item itself, not of its nested sections.
- **admin:** Validation and errors:
  - Fields validate on blur with the checks of all fields of the same value, as submits do.
  - Collapsed schemas render their content hidden while it holds errors, and reveal the errors.
  - The Validation Errors notification lists all errors that no mounted component displays, e.g. of nested forms that aren't open.
  - Options given as an array no longer reject values that aren't among them: the server's `enum` decides.
  - The labels of `required` fields are marked with `*`.
- **admin:** Data and defaults:
  - `object` fields with `nullable: false` start as an object with the defaults of their form instead of `null`.
  - Copies hold only values that have a field, and drop the ids in nested sections, so pasting creates new records.
  - Emptied text fields save their empty value, `null`, or `''` with `nullable: false`, instead of their `default`.
  - Uploads with `multiple` call `downloadUrl()` and `thumbnailUrl()` with the context of each file, as `value` and `valueIndex`.
- **admin:** Routes, see [Routes of forms](docs/api/admin/schemas.md#routes-of-forms) and [Tabs](docs/api/admin/schemas.md#tabs):
  - The URLs of routed forms contain the names of their tabs, sections and panels, e.g. `/admin/books/1/pricing/editions/0`.
  - The selected tab is a segment of the URL path instead of the hash, e.g. `/admin/books/1/pricing`.
  - Forms open through the sources that render them, also in collapsed sections, tabs and panels. Paths that no source claims lead back to the form or page.
  - The forms of items of items open once their parent item exists.
  - Views keep their components mounted, hidden, while an item's form is open, and route the forms of inlined lists and trees.
  - Hidden sources load their data once shown, lists take their query back into the URL when forms close, and reload only if a form saved an item.
- **ui:** Calendar states are modifiers: `dito-calendar-item-today`, `-active`, `-current` and `-gray` become `dito-calendar__item--today`, `--active`, `--current` and `--gray`.
- **ui:** Fields show errors and disabled state by `--has-errors` and `--disabled` modifiers of their own block instead of `.dito-container--…` classes. Custom blocks that extend `%field` or `%input` need to set them, see [UI](docs/upgrading-to-6.x.md#ui).
- **schema:** `keywords._enum` and `keywords.multipleOf` lose `validate()`, and the `empty` format loses `validatesEmptyValues`.

### New

- **server:** The `decimals` keyword limits the decimal places of numbers, as in the admin, e.g. `decimals: 2`.
- **admin:** Labels, item labels, info, affixes, `render()` results, dialog messages and `notify()` paragraphs take `html` values, see [Text and HTML](docs/api/admin/schemas.md#text-and-html).
- **admin:** Forms with properties and widgets, see [the guide](docs/guide/admin/widgets.md) and [Widgets](docs/api/admin/widgets.md):
  - Forms of `useDitoForm()` can describe their data with `properties` in the format of the server's model properties, plus the admin's keywords such as `if`, `computed` or `validate()`.
  - Widgets lay them out in `DitoSchemaForm`, one per field type, e.g. `DitoTextField` or `DitoSelectField`, with the display options of the type as props.
  - `DitoSection`, `DitoListField`, `DitoObjectField` and `DitoTreeListField` with `DitoTreeLevel` lay out sections, lists, objects and trees.
  - `DitoCustomField` edits a property with the content of its slot, e.g. `v-model="field.value"`.
  - Nested forms in schema views can use `properties` instead of `fields`, see [Nested forms in schema views](docs/guide/admin/widgets.md#nested-forms-in-schema-views).
  - Written properties support times with `{ type: 'string', format: 'iso-time' }`.
- **utils:** The `html` tagged template creates HTML that the admin renders, escaping the values it includes. `isHtml()` recognizes it and `asHtml()` converts values, see [HTML](docs/api/utils.md#html).

### Fixes

- **admin, fields:**
  - Options fields with `nullable: false` no longer fail on their empty value.
  - `context.getErrors()` lists the errors of a value once, also when several fields edit it.
  - Nested forms take their component paths and field ids from their route, also on reload.
- **admin, forms:**
  - Forms of `useDitoForm()` that create an item no longer fail with "Maximum call stack size exceeded" when items are added to their lists.
  - The form of `useDitoForm()` in a page fills the view and keeps its buttons at its bottom.
  - `DitoSchemaForm` outside of pages, e.g. in dialogs, pads its content like forms in views.
  - Buttons that are all hidden take no space.

### Internal

- **admin:** `RouteTree` only holds menus and views, and setup names components, tabs and panels by their keys.

## 5.4.1 (2026-10-21)

### Fixes

- **schema:** `@ditojs/schema` 5.4.0 was published with an unresolved dependency on `@ditojs/utils` (`workspace:^`), so `@ditojs/schema` and `@ditojs/admin` 5.4.0 couldn't be installed.

## 5.4.0 (2026-10-21)

See [Upgrading to 5.4](docs/upgrading-to-5.x.md#54) for what apps need to
change.

### Behaviour changes

- **server:** Validation errors carry the messages of `@ditojs/schema` that the admin shows, instead of Ajv's, e.g. "must be 5 or more" instead of "must be >= 5". Their `keyword` and `params` stay the same: clients that match message texts need to match those instead.
- **admin:** Several fields of the same value, e.g. in two tabs, take each aspect, e.g. `default` or `serializeValue()`, from the first field in form order that defines it. All of them validate the value, and items are sent with the values of all their forms.
- **admin:** Validation follows the server, with the definitions of `@ditojs/schema`:
  - `maxLength` is validated, counted in characters, not only set as the `maxlength` of inputs: saving fails where code wrote longer values.
  - `required` accepts empty arrays, except on types whose empty value is an array, e.g. lists, `checkboxes`, multiselects and uploads with `multiple`.
  - `minimum`, `maximum` and `range` only apply to numbers.
  - `url` fields require a scheme: `example.com` fails, `https://example.com` passes.
  - `date`, `datetime` and `time` fields reject invalid dates, e.g. `new Date('soon')` or `'14:30'`, with "must be a valid date".
  - `select`, `multiselect`, `radio` and `checkboxes` with options given as an array reject values missing from them, with "must be one of the options". Options from callbacks or `dataPath`, and multiselects with `taggable` or `search`, still accept them.
  - `integer` says "must be a whole number", and `decimals` e.g. "must be a number with at most 2 decimal places".
- **admin:** Empty values: `markup` stores an empty editor as `null` instead of e.g. `<p></p>`, `code` sends `null` instead of `''` when emptied, and `upload` with `multiple` holds `[]` instead of `null` while it has no value.

### Deprecations

- **server:** `app.compileValidator()` is deprecated in favour of `app.compileJsonSchema()`.
- **admin:** The `rules` of fields are deprecated: use field keys for limits, e.g. `minimum` or `maxLength`, the type for type checks, and `validate()` for the rest, see [Types and limits of fields](docs/guide/admin/validation.md#types-and-limits-of-fields).
- **admin:** `min` and `max` of number types are deprecated aliases of `minimum` and `maximum`. Custom types return `minimum` and `maximum` from `getValidations()`.

### New

- **server:** `app.compileDitoSchema()` compiles schemas in the format of model properties, and `app.compileJsonSchema()` plain JSON schemas, see [Validation](docs/api/server/application.md#validation).
- **admin:** `context.getErrors(match?)` returns the errors of the data by data path, e.g. for the markup of `useDitoForm()` pages.
- **admin:** Fields take `minLength`, `pattern`, `minItems` and `maxItems`, and number types `minimum` and `maximum`, as the server's model properties do.
- **admin:** `nullable: false` on string fields and `checkbox` stores no value as `''` or `false` instead of `null`.
- **schema:** New package `@ditojs/schema` with the formats and keywords that the server and the admin share.

### Fixes

- **admin, forms:**
  - Leaving a form with unsaved changes asks "Do you want to discard them?" instead of "Do you really want to cancel?".
  - Edits of fields in the panels of lists and other sources mark the form as unsaved.
  - Values merged into the data, e.g. with `context.mergeItem()`, replace the errors of fields in panels too.
- **admin, fields:** Clear buttons don't show for `''`.

## 5.3.0 (2026-10-20)

### Behaviour changes

- **admin:** The paths below a page render the page, e.g. `/tools/cache-purge/unknown`, where the admin rendered no view before.

### Deprecations

- **admin:** The types `Components`, `Component`, `SourceComponent` and `ComponentSchemaBase` are deprecated aliases of `Fields`, `Field`, `SourceField` and `FieldSchemaBase`.
- **admin:** `login.additionalComponents` is deprecated in favour of `login.additionalFields`. It keeps working and logs a deprecation warning.

### New

- **admin:** The types `Fields`, `Field`, `SourceField` and `FieldSchemaBase` name the `fields` of schemas, the union of all field schemas such as the `field` of views, the fields that hold items, and the options that all fields share.
- **admin:** `login.additionalFields` adds fields to the login dialog, named like the `fields` of schemas.
- **admin:** Forms of `useDitoForm()` in pages support lists and trees whose items edit in forms with routes of their own, below the path of the page, e.g. `/upload/sets/0/cuts/1`, also in deep links. Their forms apply their changes to the page's form. Outside of pages, e.g. in dialogs, the lists still need `inlined: true`.

### Fixes

- **admin:** Open deep links at startup instead of the root, also when the views resolve before the first navigation of the router.
- **admin:** Lay out the forms of inlined list items and objects with their `component`, as routed forms do, instead of in rows.

## 5.2.0 (2026-10-20)

### Behaviour changes

- **admin:** The elements of tree items, tree lists and objects are renamed after their blocks, so styles and tests that select them need to follow: `dito-tree-header`, `dito-tree-branch`, `dito-tree-branch__content`, `dito-tree-leaf`, `dito-tree-label` and `dito-tree-info` become `dito-tree-item__header`, `__branch`, `__branch-content`, `__leaf`, `__label` and `__info`, `dito-tree-panel` and `dito-tree-form-container` become `dito-tree-list__panel` and `__form-container`, and `dito-object-content` becomes `dito-object__content`.
- **admin:** A form with `component` but no `fields` throws an error at setup. Before, `component` on forms was ignored.
- **admin:** Setup renames `components` to `fields` and `component` with a schema on views to `field`, so code that reads `components` or `component` from schemas after setup needs to read `fields` or `field`.
- **admin:** The components of the types register globally as `Dito<Name>Type` instead of `DitoType<Name>`, e.g. `DitoTextType`, without aliases for the old names. Apps that place them by their global name need the new names.
- **ui:** `dito-pagination-total` becomes `dito-pagination__total`.

### Deprecations

- **admin:** `DitoField` is renamed to `DitoSchemaField`, which places the fields of the schema in layouts. `DitoField` stays as an alias until 6.0.
- **admin:** `components` is deprecated in favour of `fields`, and `component` with a schema on views in favour of `field`. Both keep working and log a deprecation warning. `component` on other schemas stays the Vue component of forms, sections, `type: 'component'` fields and pages.

### New

- **admin:** Type descriptors can set `alignsBelowLabels: false` for types whose components start at the top of rows with labels, like sections, lists and objects.
- **admin:** Forms with `component` and `fields` lay out their fields with `DitoSchemaField` and `DitoPane`, as sections do.
- **admin:** `useDitoContext()` returns the context of the form, or of the list item, that a component is in.
- **admin:** Pages: a view of `type: 'page'` displays a Vue `component`, e.g. `component: () => import('./CachePurgePage.vue')`, under its `path`, whose route params the component reads with vue-router's `useRoute()`. Pages with required params have no menu item. The component reads the page's context with `useDitoContext()`.
- **admin:** `fields` is the new name of the schema option `components` of views, forms, tabs, sections, panels, inlined lists and objects and custom filters, and of the options of `showDialog()`, e.g. `{ type: 'form', fields: { title: { type: 'text' } } }`. A view's single field is given in `field`, e.g. `{ type: 'view', field: { type: 'list', … } }`. `api.defaults` may use `fields` as well.
- **admin:** `context.submit()` outside of buttons, e.g. in form events, layout components, `useDitoContext()` and field callbacks, submits the form like a click on its submit button, with its `resource`, `onSuccess()` and `onError()`, instead of throwing. The form stays open unless `submit({ closeForm: true })` closes it. Forms without a submit button throw `Unable to submit: The form has no submit button.`
- **admin:** `useDitoForm()` sets up a form in any Vue component, e.g. of a page, with the options of forms and `resource` and `id`: it loads the item of `id`, reloads when `id` changes, creates an item when `id` is `null` and saves it after, and returns the form's context. `DitoSchemaForm` renders it with its buttons, and its default slot lays out the fields with `DitoSchemaField` and `DitoPane`. In pages, leaving the route asks to discard unsaved changes, which the trail and the browser's unload warning show. In dialogs, the form's submit button closes the dialog with the saved item.

### Fixes

- **admin:** Display-only `component` fields no longer pass their item's value to their component, which rendered it as an attribute.
- **admin:** Views of any type with required params in their `path` no longer get a menu item, whose link couldn't resolve, and menus whose items all have required params are hidden.

### Internal

- **admin:** `DitoSchemaInlined` and `DitoSchema` take `bordered`, which displays the header above the content in a border, as in labelled sections.

## 5.1.0 (2026-10-19)

### Behaviour changes

- **server:** Errors that aren't `ResponseError`s, e.g. a plain `Error` thrown in an action, respond with "An error has occurred." instead of their message, unless they have `expose: true` or a status below 500, or `config.env` is `'development'`. Their message still goes to the log and the `'error'` events. Apps throw `ResponseError`s for messages meant for clients, see [Plain errors](docs/guide/server/errors.md#plain-errors).
- **server:** Actions and model queries no longer wrap other errors in `ResponseError`s, and pass them on as they are: plain errors with a status below 500 respond with only their `message`, without `code` or other data, and `'error'` listeners receive the raw error, which often has no `status`.
- **server:** `DatabaseError`s with status 500 or higher respond with "An error has occurred." instead of the database's message, through `expose: false`, which `ResponseError`s take as an option.
- **server:** Logins that fail with other errors than `ResponseError`s below 500, e.g. a plain `Error` in a `before:login` hook, respond with their own status or 500 like other actions, instead of 401 and the login response with their message.
- **server:** Uploads beyond multer's `limits` respond with status 413 for `fileSize` and 400 for the others, with multer's message and `code`, instead of status 500.
- **server:** Errors are logged by their status alone, at level `info` below 500, also when they aren't `ResponseError`s, e.g. of invalid JSON bodies, and errors with `expose: true` are logged too.
- **admin:** Escape also cancels dialogs with only one button, resolving them to `undefined`.

### New

- **server:** Setting an inherited action to `false` drops it, without repeating the actions to keep in `allow`.
- **server:** In the admin's development mode, apps that link Dito.js from a checkout load its admin and UI from their sources, also for their own imports.
- **server:** `UsersController.actionNames` lists the actions of its features, `passkeys`, `totp` and `passwordReset`, e.g. for `allow: ['get', ...UsersController.actionNames.totp]`.
- **admin:** The `align` option places a component vertically in its line: `'top'`, `'center'` or `'bottom'`.
- **admin:** `context.confirm()`, `prompt()` and `alert()` show dito dialogs instead of the browser's native ones.
- **admin:** The `labelledBy` option labels fields by another element, e.g. a text above them.
- **admin:** `context.getValueAt(dataPath)` reads values at data paths relative to the item, like the `dataPath` of schemas, e.g. `'../../font'`.
- **admin:** Display-only `component` fields, without a `default`, need no `modelValue` or value events.
- **admin:** The `component` option of sections lays out their components with a Vue component instead of in rows.
- **admin:** `DitoField` places the components of sections with `component`, with their labels, errors and validation, and passes its slot on to custom components.
- **admin:** `DitoPane` places groups of the components of sections with `component` in rows, with their widths, wrapping and aligned labels.
- **admin:** `context.mergeItem(data)` merges values from the server into the form as if loaded, keeping the user's edits of other values and the dirty state, and clears the errors of the merged values.
- **admin:** `primary: true` gives buttons the look of submit buttons, and the focus in dialogs, without submitting.
- **admin:** `context.request()` takes `abortOnUnmount: true` to end requests when the component unmounts, e.g. of polling components.
- **ui:** The `placement` of `DitoTrigger` and `DitoMenuButton` can center popups on their trigger, e.g. `'bottom-center'`, and `keepInView` shifts them back into the window.
- **ui:** `DitoProgress` shows a progress bar, which the admin's `progress` type uses too.

### Fixes

- **admin:** The account and the Sign In button stay at the right of the header, next to the sidebar's toggle, in every layout: while the sidebar slides, on wide pages and in views without panels. Notifications show at the window's right edge.
- **admin:** The account's menu opens centered below it.
- **admin:** The dialogs for authentication codes and backup codes are wide enough for their labels, like the Security and Change Password dialogs.
- **admin:** The `progress` type honours `min` and `max` also when only one of them is set.

## 5.0.1 (2026-10-19)

### New

- **admin:** The `minWidth` setting of dialogs sets the minimum width of their content.

### Fixes

- **admin:** The dialog of the backup codes fits their label and two codes per line again.
- **admin:** The Security dialog is at least as wide as its Change Password dialog, also when it only shows the password.

## 5.0.0 (2026-10-19)

### Behaviour changes

- **server:** Dito.js handles logins and sessions itself instead of through koa-passport. `app.passport` is removed, and `ctx.req.user` and custom Passport strategies are gone. Existing sessions stay valid.
- **server:** `UserMixin.login()` is now `authenticate()`, which reads the credentials only from the request body and resolves to their user without logging them in.
- **server:** `UserMixin.sessionQuery()` is internal: apps set `sessionScope` instead.
- **server:** `UsersController` needs `app.session`, and `'post confirm-access'` when it routes `patch`, `put` or other actions that need confirmed access, else its setup throws.
- **server:** `UsersController` only treats users of its own model class as logged in, not users of its subclasses.
- **server:** Changing a user's password ends their other sessions. When users change their own password, the session of the request stays logged in.
- **server:** `post`, `patch` and `put` of `UsersController` reject `hash`, and `patch` and `put` need confirmed access of a user of the controller's model class to set passwords or change usernames, also of other users. Without a login, they answer 401, without confirmed access 403 with `confirmationRequired`, and the admin asks the user to confirm.
- **server:** The session cookie defaults to `sameSite: 'lax'`.
- **server:** Session models need an `expiresAt` column, see [Upgrading to 5.x](docs/upgrading-to-5.x.md#sessions).
- **server:** Unused assets are released every hour instead of after writes of asset data.
- **server:** `assets.cleanupTimeThreshold` and `danglingTimeThreshold` are renamed to `deleteUnusedAfter` and `deleteUnsavedAfter`, and the `timeThreshold` option of `app.releaseUnusedAssets()` to `olderThan`. Unknown asset options and invalid durations throw on startup.
- **server:** Actions that a subclass redefines keep the `authorize` of the inherited action unless they set their own, and a subclass's actions object ranks above it. This can open as well as close access.
- **server:** The app always listens to its `'error'` events, also before `start()`, and `log.errors: false` only stops logging them. With it, nothing logs request errors, Koa's fallback included.
- **admin:** Dialogs validate their data on submit, like forms.
- **admin:** The `width` setting of dialogs is the width of their content, without their padding, and takes any CSS length besides pixel numbers. It defaults to `'35em'`, slightly wider than the 480 pixels before.
- **admin:** `@simplewebauthn/browser` and `lean-qr` are required peer dependencies.
- **admin:** Single list views scroll their table between the list header and the buttons, instead of the whole view. Scope buttons no longer shrink their labels, and scroll in their own row when they don't fit.
- **server:** Dito.js uses objection 4.2, see [Objection 4](docs/upgrading-to-5.x.md#objection-4) for the changes that come with it.

### New

- **server, admin:** Logins with passkeys, through `PasskeyService`, see [Passkeys](docs/guide/server/controllers.md#passkeys).
- **server, admin:** Two-factor authentication with TOTP, through `TotpService`, see [Two-factor authentication](docs/guide/server/controllers.md#two-factor-authentication).
- **server, admin:** Password resets by email, with `app.authentication.passwordReset`, see [Password reset](docs/guide/server/controllers.md#password-reset).
- **server, admin:** Security changes need confirmed access, from a recent login or `'post confirm-access'`, see [Confirmed access](docs/guide/server/controllers.md#confirmed-access).
- **server:** Users change their own password through `'post password'` of `UsersController`.
- **server, admin:** The admin offers password changes, passkeys, TOTP and password resets when the users controller at `api.users` in the server's `config.admin.api` routes them, and requests them under their action names below `api.users.path`, e.g. `users/passkey-login`.
- **server:** `CredentialMixin` and `CredentialModel` store the passkeys and TOTP of all user models in one table.
- **server:** `app.name` names the app for passkey managers and authenticator apps.
- **server:** Authorize functions are called with their controller as `this`.
- **server:** Services configured as `true` in `config.services` are set up with their defaults.
- **server:** Started apps delete expired records every hour, through `app.deleteExpiredRecords()` and `Model.deleteExpiredRecords()`: expired sessions, unused assets and the records of models that override it. `config.app.deleteExpiredRecordsEvery` sets the interval, and `dito db:delete_expired_records` runs it once.
- **admin:** `settings.minDuration` keeps dialogs visible for a minimum time.
- **admin:** The `empty` option of lists shows a text while a list has no items.
- **admin:** `context.reload()` reloads the items of the list or object that a component is in.

### Fixes

- **admin:** The admin fits phone windows: the page can't be widened or panned, the overlay menu closes from its title bar, wide tables, scopes and header tabs scroll, and dialogs fit the window.
- **admin:** Password managers no longer offer to sign in on edit forms, and fill in the password dialogs of the logged-in user, which pass them the username.
- **server:** Empty `PATCH` requests to existing members answer with the unchanged member instead of 404.
- **server:** Logins with unknown usernames take as long as wrong passwords, and usernames and passwords that aren't strings answer like wrong ones.
- **server:** `super` calls work in actions in the options form, e.g. `{ handler, parameters }`, instead of throwing.
- **admin:** Dialog buttons that are wider than their components stay off the dialog's edges.
- **admin:** Failed logins show the message of the server's response.
- **admin:** Errors of `context.request()` carry the `status` of their response.
- **admin:** Lists outside of routes, e.g. in dialogs, keep their scope, page, order and filters to themselves instead of using the route's.
- **server:** Inserts of several models at once handle the asset files of all of them, where models after the first were skipped when the first had no asset data.

## 4.8.0 (2026-10-18)

### Behaviour changes

- **router:** Paths without a route for the request's method respond with 404 instead of 405 or 501 (#328).
- **router:** HEAD requests run the GET route of their path. GET handlers with side effects need to check `ctx.method` (#329).
- **router:** Methods can be passed in any case to `add()`, `find()` and `getAllowedMethods()` (#335).
- **router:** Routes with `*` or `**` inside a segment, e.g. `/files/*.json`, or with a param inside a segment after `**`, throw when added.
- **admin:** The login and logout labels read "Sign In" and "Sign Out" (#344).
- **admin:** Dialogs focus their submit button, also in confirmations, so Enter confirms.
- **admin:** Fields only validate on blur when they were edited.
- **server:** A place in the data that several overlapping asset data paths reach, e.g. `'content.items[**].file'` and `'**.file'`, counts once and uses the first path's storage. Apps with overlapping paths should run `db:recount_assets` after upgrading (#385, #387).
- **utils:** `debounceAsync()` resolves each call with the result of its own run, and `cancel()` only settles calls that still wait (#347, #349).
- **utils:** `equals()` never treats values of different types as equal, and compares typed arrays element by element (#373).
- **utils:** `*` in `getValueAtDataPath()` keeps values that are arrays instead of merging them (#357).
- **utils:** `normalizeDataPath()` and `resolveDataPath()` throw for a `..` that leads above the root (#358).
- **utils:** `capitalize()` doesn't start new words after digits, e.g. `'1st'`. This can also change the column names of generated join tables (#356).
- **utils:** `escapeHtml()` escapes single quotes (#359).
- **utils:** `isAbsoluteUrl()` only accepts valid characters in schemes (#360).

### New

- **ui:** `DitoMenuButton` takes `floating`, which opens the menu as a separate panel below the button (#344).
- **admin:** The account menu opens as a floating panel (#344).
- **utils:** `isTypedArray()` checks for typed arrays, including Node.js buffers (#350).

### Fixes

- **router:** Fixes to matching `*`, `**` and params next to each other (#330–#334).
- **router:** A trailing slash in the `prefix` option is ignored (#336).
- **admin:** Color fields validate the color typed into them on blur (#390).
- **admin:** Everything behind the topmost dialog is inert.
- **server:** `toJSON()` no longer replaces a record's own asset files with the signed copies (#388).
- **utils:** `isUrl()` stays fast for long invalid URLs, and accepts URLs ending in `?` or `#` (#348).
- **utils:** `clone()` copies typed arrays and Node.js buffers (#350).
- **utils:** `deindent` interpolates `null` and `undefined` (#352).
- **utils:** `toCallback()` calls its callback only once (#353).
- **utils:** `flatten()` handles arrays of any length (#354).
- **utils:** Invalid data paths, e.g. numbers, throw a clear error (#369).

## 4.7.2 (2026-10-16)

### New

- **admin:** The zips that `clipboard: { interchange: true }` downloads store their files under their names, e.g. `files/cover.png`, instead of their storage keys, numbering different files of the same name, also when they only differ in case. Zips downloaded with 4.7.0 and 4.7.1 still upload (#323).

### Fixes

- **admin:** Lists whose value isn't an array, e.g. an object that the app converts with `computeValue()`, keep their value when the data is loaded, copied, pasted and saved, instead of being handled as one item of the list's form, e.g. its `default` form, which added that form's values to them and left out their other keys. Their values are no longer validated or given the computed and default values of that form.

## 4.7.1 (2026-10-16)

### New

- **server:** The references of `app.getAssetReferences()` include the `config` of the model's asset data path that they were found through, e.g. to read `readDimensions`.

## 4.7.0 (2026-10-16)

### Behaviour changes

- **server:** `PATCH users/self` runs the `member.patch` action of `UsersController` with all its settings and hooks. The `'patch self'` collection action of 4.6.0 is removed: remove it from `collection.allow` and from overrides.
- **server:** Relation controllers authorize their parent member after the parameters are validated, and asset uploads on relations always need the parent's `patch` authorization. `handleRequestAuthorization()`, `authorizeMember()` and `getActionAuthorize()` are removed.
- **server:** `getMember()` uses `member.get` only where `allow` routes it, and otherwise fetches the member by id through `fetchMember()`.
- **server:** Validation:
  - The validator runs Ajv with `strictSchema`, `strictNumbers` and `strictTuples`, so schemas with unknown keywords, e.g. `item` instead of `items`, throw when the app sets up its models. Fix the schema, or pass `new Validator({ options: { strictSchema: false } })`, see [Validator](docs/api/server/validator.md#constructor).
  - `nullable` properties with a model type or a `$ref` get the defaults of the referenced schema, and their own `default`.
  - `$validateGraph()` reports only the errors of related models for relations, and applies their defaults, unless it validates a patch.
  - The "must match "else" schema" errors of `if` keywords are left out.
- **server:** Assets:
  - Asset files count one reference for each place that stores them, also several in one record. Run `db:recount_assets` after upgrading.
  - `releaseUnusedAssets()` removes unused assets after `assets.cleanupTimeThreshold` and unsaved uploads after `assets.danglingTimeThreshold`, instead of after the sum of both. With `cleanupTimeThreshold: 0`, unused assets are removed right away: to keep files, use a long threshold, e.g. `'100y'`.
  - `releaseUnusedAssets()` keeps assets that data still references despite a count of 0, and corrects their count. Unused assets are released after the write's transaction completes, so rollbacks can't lose files.
  - `handleAddedAndRemovedAssets()` throws an `AssetError` when an added file's asset was released in the meantime.

### New

- **server:** `app.recountAssets()` and the `db:recount_assets` command correct the reference counts of all assets, and `app.getAssetReferences()` finds every place that stores an asset file, see [recountAssets()](docs/api/server/application.md#recountassets).
- **admin:** `clipboard: { interchange: true }` adds a menu to the Copy and Paste buttons to download the data with its files as a zip, and to upload it again, e.g. into another installation, see [Download and Upload](docs/guide/admin/forms.md#download-and-upload). `interchange: { filename }` names the downloads. Requires the new peer dependency `fflate`.
- **ui:** `DitoMenuButton`:
  - Items take an `icon`, shown instead of their label, and the icon set has `archive-download` and `archive-upload`.
  - `cover: false` attaches the menu below the button.

### Fixes

- **server, databases:**
  - `Model.count()` and the `count` action count rows on SQLite and MySQL.
  - `truncate()` no longer applies the default scope of the model.
  - Relating several models to a many-to-many relation works on SQLite and MySQL.
  - With `better-sqlite3`, `Date` values in queries match stored dates, and a failed commit no longer makes every later transaction fail.
  - `log.sql` logs the rows of SQLite responses as arrays.
  - Upserts and array saves use the knex passed to `query()`.
  - Constraint violations at commit, e.g. of deferred foreign keys, respond with 409 instead of 500.
- **server, validation:** Typed objects with properties in `allOf` no longer reject each other's properties.
- **server, assets:** Writes of several records count the asset references of each record, so deleting one no longer releases files that others still store.
- **admin:**
  - Upload fields break long file names instead of widening their table.
  - The trail of the header scrolls where the header is too narrow for it.
  - The menu and the sidebar slide in and out without their content's layout changing.
  - The account menu opens below the user name.
  - Cancelling the object form of a view with a single `component`, e.g. the account settings, returns to the admin's root.
  - Downloads of `clipboard: { interchange: true }` are named after the form and item label, e.g. `Page Home.zip`.
- **ui:** Tab moves through the items of an open `DitoMenuButton` instead of closing it.

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

- **server:** Hook keys that name custom actions by their keys, e.g. `'before:member:get tech-doc-:format'`, keep working until 6.0 with a deprecation warning that names the new key.

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
- **admin:** `type: 'value'` replaces `type: 'computed'`, `'data'` and `'hidden'`, which keep working until 6.0 with a deprecation warning, and `ValueSchema` replaces `ComputedSchema`, `DataSchema` and `HiddenSchema`, which stay as deprecated aliases.

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

The first release of Dito.js 4, which includes the withdrawn 4.0.0, so these notes list all changes since 3.5.0. The admin is rebuilt around its data: forms, dialogs and panels keep their edits, dirty state and errors also for fields that aren't rendered, nested forms edit drafts, and callbacks receive typed contexts instead of components. See [Upgrading to 4.x](docs/upgrading-to-4.x.md) for what apps need to change.

### Behaviour changes

- **admin:** The value hooks are renamed: `format()` → `formatValue()`, `parse()` → `parseValue()`, `compute()` → `computeValue()` and `process()` → `serializeValue()`. The old names throw, except `format()` on date and color types, where `format` is the format setting: rename these by hand, see [Value hooks](docs/upgrading-to-4.x.md#value-hooks).
- **admin:** Schemas can't define `methods`, `computed`, `watch` and `data`, and handlers like `onClick()` or `itemLabel()` are called with their context only, without the component as `this`: use plain functions, `onChange()` and module state, see [Methods, computed, watch and data](docs/upgrading-to-4.x.md#methods-computed-watch-and-data).
- **admin:** Schema options, see [Schema options](docs/upgrading-to-4.x.md#schema-options); the old options throw:
  - `formats` of the date types is `format`, and the date strings of loaded data become `Date` objects.
  - Trees open their items with `collapsed: false` instead of `open: true`. `collapsed` is `true` by default and can be a callback.
  - `relate` takes the key to relate options by, e.g. `relate: 'code'`, instead of `relateBy`, and `groupBy` is `options.group`.
  - `format: 'name'` of the color type is removed: use a hex format, e.g. `'hex'`.
  - `nested` only works on sections and panels.
  - Options that were never read are removed from the types, e.g. `defaultSort` and `defaultScope` of sources and `idKey` of forms.
- **admin:** Relative paths in `options.dataPath` and in the `dataPath` of the `computed`, `data` and `hidden` types are relative to the item instead of the field, so they need one `../` less: `'../authors'` becomes `'authors'`. The `match` of `validate()` resolves the same way, and `..` above the root throws.
- **admin:** Events, see [Event handlers](docs/upgrading-to-4.x.md#event-handlers):
  - Declare handlers as `on…` properties, e.g. `onClick()`. `events: {}` is deprecated until 6.0, and an `on…` handler of the same event wins over it.
  - An `onClick()` on the submit or cancel buttons of forms and dialogs replaces their default handler: call `context.submit()`, `context.closeForm()` or `context.closeDialog()` from it.
  - Forms fire `onSuccess()` after saving, with `context.isCreating`, and nested forms `onApply()` when they apply their draft, instead of `create` and `submit`, which throw.
  - `onToggle()` with `context.collapsed` replaces `onOpen()` with `context.open`.
  - `input` fires for each edit in all types and bubbles like `change`. Returning `false` from a handler of either stops it from bubbling.
  - Date, datetime and time fields fire `change` once the edit is done.
  - Errors thrown by handlers reach `onError()` as they are, instead of wrapped in an `AggregateError`: read `error.message`.
- **admin:** Contexts, see [Contexts](docs/upgrading-to-4.x.md#contexts):
  - Contexts don't expose components anymore, e.g. `component` or `formComponent`: what callbacks used them for are context members, listed under New.
  - Renamed members: `query` → `routeQuery`, `index` → `valueIndex`, `processedItem` → `serializedItem` and `processedRootItem` → `serializedRootItem`. `sourceComponent.query` is `context.sourceQuery`.
  - `dialogComponent.resolve(value)` is `context.closeDialog(value)`, `formComponent.setData(data)` and `schemaComponent.resetData()` are `context.resetItem(data)` and `context.resetItem()`, and the validation members of components are `context.validate()`, `isValid()` and `clearErrors()`. `dialogComponent.reject()`, `applyCleanChanges()`, `filterData()`, `navigateToComponent()` and `navigateToRouteComponent()` are removed.
  - `context.navigate()` resolves to whether the navigation happened, and `getResourceUrl()` without arguments throws when there is no resource.
  - Each context describes its own `item`, with `itemDataPath`, `itemIndex` and `parentItem`: in the events of forms and sections and in list buttons, 3.5 gave those of the item one level up. `context.value` is `undefined` there.
  - In panels with their own data, `item` is the panel's data and `rootItem` the page's. In dialogs, `rootItem` is the dialog's data.
  - `onSuccess()` and `onError()` of submit buttons get the same context as their `onClick()`.
- **admin:** Code outside of callbacks reaches the admin's services through `admin.context`, and its `settings` replace `window.dito`, see [Admin services](docs/upgrading-to-4.x.md#admin-services). `closeNotifications()`, `rootComponent`, `registerLoading()`, `meta.api` and `meta.schema` of routes, and `api.base` are removed: `dito.base` is the base of the routes.
- **admin:** Custom components don't get `DitoMixin` and `TypeMixin` anymore: they receive `schema`, `context` and `modelValue`, and emit `update:modelValue` and `change`, see [Custom components](docs/upgrading-to-4.x.md#custom-components). The admin's own components are internal, and their actions, e.g. `request()` and `navigate()`, are context members.
- **admin:** Types are defined with `defineType(descriptor)` instead of `admin.register()`, with renamed options, and `processSchema()`, `processValue()` and `getTypeValidations()` are `setupSchema()`, `serializeValue()` and `getValidations()`, see [Custom types](docs/upgrading-to-4.x.md#custom-types).
- **admin:** TypeScript types, see [TypeScript types](docs/upgrading-to-4.x.md#typescript-types):
  - `SchemaOpen` is `SchemaToggle` and `OpenEventHandler` is `ToggleEventHandler`. `HTTPVerb` (use `HttpMethod`), the mixin types and the types of component instances are removed.
  - Many types are renamed and keep working as deprecated aliases, e.g. `DitoContext` → `SchemaContext`, `DitoGlobal` → `GlobalConfig` and `Form` → `FormSchema`.
  - The types follow what the admin reads, and options that were missing are typed.
- **server:** TypeScript types: `HTTPMethod` is `HttpMethod`, as a deprecated alias. `ApiConfig` has no `dateFormat` and `resources`: set `resources` on the admin's `api`. Custom keywords receive `instancePath` instead of `dataPath`. The types follow what the server reads, e.g. `Authorize` takes settings by action name, and options that were missing are typed.
- **admin:** `.dito-form-nested` and `DitoFormNested` are `.dito-form--embedded` and `DitoFormEmbedded`, and the deprecated `$pulldown-*` SCSS variables are removed.
- **ui:** `$ease-put-quint` is `$ease-out-quint`, `.dito-trigger-disabled` is `.dito-trigger--disabled`, and `.dito-popup-{placement}` is `.dito-popup--{placement}`.
- **ui:** `DitoDatePicker`, `DitoTimePicker` and `DitoDateTimePicker` emit `change` once the edit is done, and `update:modelValue` for each value. The `disabledDate`, `disabledHour`, `disabledMinute` and `disabledSecond` props are removed, see [UI](docs/upgrading-to-4.x.md#ui).
- **ui:** `DitoButton` with a `verb` and without `text` is labelled by its verb, and `getVerbButtonAttributes()` doesn't take `hasText` anymore.
- **build:** `@ditojs/admin` and `@ditojs/ui` are only published as ES modules, and all packages have `exports` maps with `import` only: `require()` and imports of internal files, e.g. `@ditojs/server/src/…`, fail. `defineViteConfig()` doesn't read `rollupOutput` anymore, see [Packages and builds](docs/upgrading-to-4.x.md#packages-and-builds).
- **utils:** `stripTags()` is removed: use `stripHtml()`. `setDataPathEntries()` is `setEntriesAtDataPath()`, and `escapeRegexp()` is `escapeRegExp()`.
- **utils, server:** `**` in the middle of data paths, also in the `assets` of models, matches zero or more levels, like in `.gitignore`: `a/**/c` matches `a/c` too.
- **server:** Services and storages, see [Services and storages](docs/upgrading-to-4.x.md#services-and-storages):
  - `Service.setup(config)` is `configure(config)`, and the application starts and stops its services itself: an overridden `setup()` isn't called anymore.
  - Storages are created with `constructor(app, name, config)` and named by their key in `config.storages`. `app.addStorage(config, name)` needs the name, and the async `initialize()` replaces `setup()`.
- **server:** Queries, see [Queries](docs/upgrading-to-4.x.md#queries):
  - `upsert(data)` saves models by the ids in the data, patching those that exist and inserting the others, instead of patching what the query matches. Its `update` and `fetch` options are removed.
  - Collection `PUT` and `PATCH` requests reject models without ids with a 400 error, and the array forms of `patchAndFetch()` and `updateAndFetch()` throw for them: create them with `POST` or `insertAndFetch()`.
  - These methods and array inserts outside of PostgreSQL run in a transaction, so a failure rolls back the models saved before it.
  - Outside of PostgreSQL, arrays passed to `insert()` are inserted without their relations, as in PostgreSQL: use `insertDitoGraph()` or `insertGraph()` for graphs.
  - Text filters without an operator search like `contains`, instead of not filtering.
- **server:** Validation, see [Validation](docs/upgrading-to-4.x.md#validation):
  - `discriminator` keywords are applied: each variant of the `oneOf` needs a fixed `type` in its `properties`.
  - Objects that combine parts through `allOf`, `anyOf` or `oneOf` without their own `properties`, and `$ref`s to definitions like `'#Address'`, reject unknown properties. Set `unevaluatedProperties: true` to allow them.
  - `type: 'color'` only accepts hex colors: use `type: 'string'` or `type: 'object'` for others.
- **server:** Deprecations are removed, e.g. the scope prefixes `-` and `#` (use `!` and `@`), and `TimeStampedMixin`, `getDitoObject()`, `initialized` and others are renamed, see [Removed deprecations](docs/upgrading-to-4.x.md#removed-deprecations) and [Renames](docs/upgrading-to-4.x.md#renames).
- **server:** The admin's HMR is served through the app's server: remove `server.hmr.port` from the admin's Vite config.
- **admin:** Dirty state and saving, see [Dirty state and saving](docs/upgrading-to-4.x.md#dirty-state-and-saving):
  - Forms are dirty once their data is edited, until it's saved, applied or loaded again: reverting an edit leaves them dirty.
  - Only writes of values that a field shows and that are saved are edits, not those of `exclude` fields or of sources with their own resource. Writes through `item`, `parentItem`, `rootItem` and `value` are edits; code that changes values in place calls `context.markDirty()`.
  - Views, dialogs and panels without a button of type `submit` are never dirty.
  - Save responses and `context.resetItem(data)` merge into the data in place, so open nested forms keep their edits.
  - Leaving a form while it saves waits for the save, and submitting waits for uploads and loads without the 30 second limit of 3.5.
  - Saving the forms of tree items' children doesn't reload the tree.
- **admin:** Nested forms without `mutate: true` edit a draft of their item, which OK merges into the parent and Cancel discards, see [Nested forms](docs/upgrading-to-4.x.md#nested-forms). Open forms follow their item when it moves, and close when it's removed.
- **admin:** Errors stay with their values when sections collapse, tabs switch and items move, and any change of a value clears them. Errors of values without a field of their own show on the field around them, and rows and tree items with errors inside are marked, see [Errors](docs/upgrading-to-4.x.md#errors).
- **admin:** Cells and item labels show values as their types display them, e.g. dates, and selects keep values that their options lack, showing them as unavailable. Tabs render once they're selected.
- **admin:** Object defaults of `api.defaults` only fill in what schemas leave out, and the create menu of lists offers forms by `creatable` only, not by their `if` or `visible`.
- **admin:** Routes, requests and the clipboard, see [Routes, requests and the clipboard](docs/upgrading-to-4.x.md#routes-requests-and-the-clipboard):
  - The URLs of forms of lists in nested sections and inlined objects contain the container's name, e.g. `/books/1/contents/notes/2`, and tree items with a resource are addressed by id.
  - `request({ cache: 'local' })` caches while the route is shown, and dialogs have their own local cache.
  - Pasting writes the copied values into the item, which keeps its id and position, and copied related items get new temporary ids.

### New

- **admin:** Context members for what callbacks used components for, e.g. `isDirty`, `isCreating`, `validate(match)`, `isValid(match)`, `clearErrors(match)`, `markDirty()`, `resetItem(data)`, `submit()`, `closeForm()`, `closeDialog(value)`, `showDialog()` and `getSchemaValue()`, see [New features](docs/upgrading-to-4.x.md#new-features). `match` takes data paths with `*` and `**`, regular expressions or functions.
- **admin:** Values:
  - `deserializeValue()` converts stored values to edited ones, and `serializeValue()` returning `undefined` leaves out the key. Types can define both.
  - `serializedItem` and `serializedRootItem` are available in all callbacks.
- **admin:** Events:
  - Handlers of bubbled events receive `currentDataPath`, the data path of the component whose handler runs.
  - Forms fire `onCancel()`, and a value returned from their `onSuccess()` or `onError()` suppresses the notification.
  - Trees fire `onToggle()` with `context.collapsed`.
- **admin:** `itemLabel` and `itemLabelText` hold the label of the form's item in all callbacks inside a form, and option labels receive `context.isSelected`.
- **admin:** Type descriptors can state `rendersLabel`, `submitsData` and `hasEmbeddedForms`, display values with `getDisplayValue()`, load options with `getOptionsDataSchema()`, and take an array as `type`.
- **admin:** Custom components are typed with `CustomComponentProps` and `CustomComponentEmits`, can emit `focus` and `blur`, and receive `errorsElementId`.
- **admin:** `multiple` of uploads, `lines` of textareas and markups, and `placeholder` of multiselects take callbacks, lists with `wrapPrimitives` support routed forms, and panels with `nested: true` hold their values under their name.
- **admin:** The types `AdminContext`, `AdminUser` and `TypeDescriptor`, and the SCSS variable `$error-bar-width`.
- **server:** `ApiConfig` has `formats` and `timeout`, and `ApiResource` has `method`, `id` and `query`.
- **utils:** `resolveDataPath(dataPath, path)` resolves `path` relative to `dataPath`.

### Fixes

- **admin, nested forms:**
  - Applying a nested form no longer drops or serializes values twice, and cancelling it leaves no temporary ids in the parent.
  - Removing an item before an open nested form's item no longer switches the form and drops its edits.
  - Copying no longer carries other items' ids into pasted items.
- **admin, routes and resources:**
  - Lists in forms shared by several views, lists with their own `path`, lists in nested sections, and lists with names like `sourceURLs` open the right forms.
  - Lists linked to views with several components get correct edit links and can create items.
  - Relative resources resolve against the nearest form or list with a resource, e.g. `pages/1` instead of `pages/pages/1` in trees.
- **admin, events:**
  - The `on…` handlers of sections fire, and `click` events of buttons bubble through all schemas above.
  - `onError()` of buttons that calls `context.notify()` replaces the default notification.
- **admin, fields:**
  - `markup` edits that don't blur the editor, e.g. links, are written right away, and the focus returns to the editor after the link dialog.
  - Saving with an error in a collapsed section or inlined form opens it and focuses the field.
  - `rules: { name: false }` removes the rule.
  - The `if` of components of panels with their own data only runs with that data.
- **admin, other:**
  - `spinner: null` hides the header's spinner, and `admin.el` holds the mounted element.
  - `showDialog()` works without `buttons` or `components`.
  - `creatable` callbacks that return `{ label, query }` work for lists, and the create button of sources with a single `disabled` form is disabled.
  - Lists with `columns` as an array label their items by the first column.
  - Tree items with `null` children sort as empty lists.
- **utils:**
  - `isEmpty()` checks the size of `Map` and `Set` and never treats dates as empty.
  - `setValueAtDataPath()` errors print the path with `/`.
  - `isCreditCard()` no longer accepts numbers that only start like a card number.
  - `debounceAsync()` keeps working after `cancel()` and with `immediate`.
  - `getEntriesAtDataPath()` no longer adds a trailing slash for trailing wildcards, which wrote `assets` to the wrong key.
- **server, controllers:**
  - `authorize: false` on an action or controller denies access, where it was skipped.
  - The `authorize` of a `UsersController` doesn't apply to `login`, `logout` and `session`, and logins of users without a password hash fail with 401 instead of 500.
  - `allow: ['*']` on `collection` and `member` routes all actions.
  - `{ from: 'member' }` parameters are left out of parameter validation.
  - Controllers that override `relations` keep the relation and member actions of their base.
  - `CollectionController` is exported.
- **server, models:**
  - `UserMixin` hashes passwords of a custom `passwordProperty`, and calls the `setup()` of the model it extends.
  - Foreign keys that relations add to related models no longer go missing when the related model is registered first.
  - `upsertAndFetch()` and the array forms of `patchAndFetch()` and `updateAndFetch()` return all saved rows regardless of the `default` scope.
  - `hooks` accept arrays of handlers.
  - A JSON Schema `required` array on a property no longer makes the property itself required.
  - `getPropertyOrRelationAtDataPath()` leaves array wildcards out of relation expressions (#214).
- **server, other:**
  - `db:create_migration` creates valid columns for `type: 'asset'`, model types, `type: 'color'` and `$ref` properties, uses `increments()` only for integer keys, and names join table columns like the relations do.
  - `db:seed` exits with an error code when a seed fails.
  - The `assets` and `logger` options of one application no longer change the defaults of later ones.
  - Files uploaded to S3 storages without `url` get the S3 url.

### Internal

- The admin is written in TypeScript where it was rebuilt, and its components use `setup()` and composables instead of mixins.

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

Changes since v3.2.7. No public API was removed: these are fixes, security hardening and accessibility work, with a few behaviour changes that apps may need to act on, listed under _Upgrade notes_.

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
