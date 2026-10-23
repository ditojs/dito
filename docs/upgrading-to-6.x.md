# Upgrading to Dito.js 6.x

This guide describes how to upgrade an app from Dito.js 5.x to 6.x.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

6.0 removes the names and forms that 4.x and 5.x deprecated, without aliases
or warnings. Upgrade to the latest 5.x first and fix its deprecation warnings,
which name each replacement. Three changes have no 5.x warning: `{ html }`,
which 5.x supported without one, and the renames of `format` of colors to
`colorFormat` and of dates to `formats`, whose old keys 6.0 ignores silently.

## Admin

### Schemas

| 5.x                                                    | 6.x                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `components: { title }`, also of filters and dialogs   | `fields: { title }`                                 |
| `component: { type: 'list' }` of views                 | `field: { type: 'list' }`                           |
| `{ type: 'number', min: 0, max: 10 }`                  | `{ type: 'number', minimum: 0, maximum: 10 }`       |
| `rules: { minLength: 2 }`                              | `minLength: 2`                                      |
| `{ type: 'url', rules: { url: false } }`               | `{ type: 'text' }`                                  |
| `{ type: 'text', rules: { email: true } }`             | `{ type: 'email' }`, or `validate()`                |
| `events: { change() {} }`                              | `onChange() {}`                                     |
| `type: 'computed'`, `'data'` or `'hidden'`             | `type: 'value'`                                     |
| `{ type: 'color', format: 'rgb' }`                     | `{ type: 'color', colorFormat: 'rgb' }`             |
| `{ type: 'date', format: { date } }`                   | `{ type: 'date', formats: { date } }`               |

- Custom types that return `min` or `max` from `getValidations()` need to
  return `minimum` and `maximum`.
- Setup no longer renames `components` and `component`: schemas need `fields`
  and `field`, and the old keys are ignored silently.

### HTML

`{ html }` objects no longer render as HTML, and `type: 'html'` affixes and the
`html` option of `notify()` are gone. Create HTML with the `html`
template of `@ditojs/utils`, which escapes the values that it includes, see
[Text and HTML](api/admin/schemas.md#text-and-html):

| 5.x                                                    | 6.x                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `label: { html: '<b>Title</b>' }`, also in `info`      | ``label: html`<b>Title</b>` ``                      |
| `itemLabel: ({ item }) => ({ html: item.name })`       | ``itemLabel: ({ item }) => html`${item.name}` ``    |
| `render: ({ value }) => ({ html: value })`             | ``render: ({ value }) => html`<b>${value}</b>` ``   |
| `prefix: { type: 'html', html: '<i>€</i>' }`           | ``prefix: html`<i>€</i>` ``                         |
| `notify({ html: '<b>Saved</b>' })`                     | ``notify({ text: html`<b>Saved</b>` })``            |

### Components and options

| 5.x                                                    | 6.x                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `DitoField`                                            | `DitoSchemaField`                                   |
| `new DitoAdmin(el, { login: { additionalComponents } })` | `new DitoAdmin(el, { login: { additionalFields } })` |

### TypeScript types

| 5.x                                                      | 6.x                   |
| -------------------------------------------------------- | --------------------- |
| `Component`, `Components`, `SourceComponent`             | `Field`, `Fields`, `SourceField` |
| `ComponentSchemaBase`, `BaseSchema`                      | `FieldSchemaBase`     |
| `SchemaFields`, `SchemaSetupMixin`                       | `SchemaBase`          |
| `SchemaRoute`, `SchemaRouteMixin`                        | `RouteSchemaBase`     |
| `Form`                                                   | `FormSchema`          |
| `ComputedSchema`, `DataSchema`, `HiddenSchema`           | `ValueSchema`         |
| `OrItemAccessor`, `ItemAccessor`                         | `SchemaValue`, `SchemaValueCallback` |
| `DitoContext`                                            | `SchemaContext`       |
| `DitoGlobal`                                             | `GlobalConfig`        |
| `HTTPMethod`                                             | `HttpMethod`          |
| `SchemaSourceMixin`, `SchemaOptionsMixin`                | `SourceSettings`, `SelectionSettings` |
| `SchemaNumberMixin`, `SchemaTextMixin`                   | `NumberSettings`, `TextSettings` |
| `SchemaAffixMixin`, `SchemaDataMixin`                    | `AffixSettings`, `DataSettings` |
| `SchemaRules`, `SchemaEvents`, `BaseSchemaEvents`        | Removed with `rules` and `events` |

### Behaviour changes

- The strings that `render()` of columns, lists, objects and uploads returns,
  and the messages of `confirm()`, `prompt()` and `alert()`, show as text,
  escaped. Callbacks that return HTML create it with `html`, e.g.
  ``render: ({ value }) => html`<b>${value}</b>` ``.
- Fields validate on blur with the checks of all fields that edit the same
  value, as submits already did, e.g. also the `required` of a field of the
  same name in another tab.
- A nested section whose fields are all hidden counts as hidden for the data
  of the form too, together with its own value: errors of its value go to the
  validation errors notification instead of the hidden section.
- Options given as an array no longer reject values that aren't among them:
  the `enum` of the server's model property decides.
- Validation logs an `if` that throws and treats its field as shown, instead
  of stopping.
- The URLs of routed forms of sources in tabs, sections and panels contain
  their names, e.g. `/admin/books/1/pricing/editions/0` for `editions` in the
  tab `pricing` instead of `/admin/books/1/editions/0`, so that sources of the
  same data in different tabs have their own forms. Links and bookmarks to them
  need updating, and renaming a tab changes them. Of the sources of a form with
  the same URL path, the first one opens its forms: give the others another
  `path`.
- The selected tab of a view or form is a segment of its URL path instead of
  the location hash: `/admin/books/1/pricing` instead of
  `/admin/books/1#pricing`. Links and bookmarks with `#` tabs need updating.
  Tabs share the URL with the sources of their form: give a source with the
  name of a tab another `path`.
- Paths that no source claims lead back to the form or page, once it rendered
  its components with its data. This reverses 5.3.0, where the paths below a
  page rendered the page, e.g. `/tools/cache-purge/unknown`.
- The forms of items of items open once their parent item exists, e.g.
  `/admin/books/1/chapters/0/notes/0` needs chapter `0`.
- Views keep their components mounted, hidden, while the form of an item is
  open. Hidden lists load their items once they're shown, closing a form
  returns to the list's query, e.g. `/admin/books?page=2`, and lists load again
  only if the form saved an item.
- Hidden values aren't sent: fields whose `if` is false, or that are in hidden
  sections, tabs or panels, leave out their values when the data is saved or
  copied. Hidden fields run no `serializeValue()`, and item labels and table
  cells only display the values of the item itself.
- Emptied text fields (`text` and its variants, `textarea`, `code` and
  `markup`) save their empty value, `null`, or `''` with `nullable: false`,
  instead of their `default`.
- The labels of `required` fields are marked with `*`.
- Copies drop the ids in nested sections (`nested: true`), like those of
  objects and lists, so pasting creates new records.
- `object` fields with `nullable: false` start as an object with the defaults
  of their form instead of `null`.
- Uploads with `multiple` call `downloadUrl()` and `thumbnailUrl()` with the
  context of each file: `value` is the file instead of the list, and
  `valueIndex` its index.

## UI

| 5.x                                                    | 6.x                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `dito-calendar-item-today`, `-active`, `-current`, `-gray` | `dito-calendar__item--today`, `--active`, `--current`, `--gray` |

Fields show errors and their disabled state by modifiers of their own block,
not by the classes of their container: blocks that extend `%field` or `%input`
set `--has-errors` and `--disabled` modifiers and extend `%field-has-errors`
or `%input-has-errors` and `%field-disabled` in them, see
[Placeholders](api/ui.md#placeholders). Errors of a container no longer mark
the fields inside it.

## Server

| 5.x                                                    | 6.x                                                 |
| ------------------------------------------------------ | --------------------------------------------------- |
| `app.compileValidator(schema)`                         | `app.compileJsonSchema(schema)`                     |
| `'before:member:get tech-doc-:format'` in `hooks`      | `'before:member:get-tech-doc-format'`               |
| `HTTPMethod`                                           | `HttpMethod`                                        |
| `SelectModelProperties<M>`, `ExtractModelProperties<M>` | `SerializedModel<M>`                               |
| `SelectModelKeys<M>`, `SelectModelPropertyKeys<M>`     | `keyof SerializedModel<M>`                          |

Hook keys that name actions by their keys no longer match any action, so
their hooks don't run: use the identifiers that the 5.x deprecation warnings
name, see [Hooks](api/server/controllers.md#hooks).

### Behaviour changes

- Patches check the values of `required` properties that they send, and
  reject empty strings with 'is required'. Properties that patches leave out
  remain unchecked.
- `UserMixin` rejects empty passwords with a validation error, instead of
  setting the hash of `''`.
- Values outside `range` are reported with the keyword `range` and the message
  "must be between 1 and 5", instead of as `minimum` or `maximum` errors.
  Clients that match the `keyword` of errors, as 5.4.0 recommended, need to
  match `range` for them.

## Schema

`keywords._enum` and `keywords.multipleOf` of `@ditojs/schema` lose
`validate()` and only carry the messages that the server reports, and the
`empty` format loses `validatesEmptyValues`.
