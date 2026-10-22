# Upgrading to Dito.js 6.x

This guide describes how to upgrade an app from Dito.js 5.x to 6.x.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

6.0 removes the names and forms that 4.x and 5.x deprecated, without aliases
or warnings. Upgrade to the latest 5.x first and fix its deprecation warnings,
which name each replacement, except for `{ html }`, which 5.x supported without
a warning.

## Admin

### Schemas

Schema keys that 6.0 removed throw when the schema is set up, naming their
replacement, e.g. `Unsupported schema key 'components' in 'details': Use
'fields' instead.`

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

- `min` and `max` only throw on `number`, `integer`, `slider` and `progress`
  fields. Custom types that return `min` or `max` from `getValidations()` need
  to return `minimum` and `maximum`.
- Setup no longer renames the old keys, so code that reads `components` or
  `component` from schemas after setup reads `fields` and `field`.

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
  need updating, and renaming a tab changes them. Sources of the same form with
  the same URL path throw: give one of them another `path`.

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
