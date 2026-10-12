# Changelog

The changes of each release of Dito.js. For upgrading to a new major
version, see the upgrade guides in `docs/`.

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


