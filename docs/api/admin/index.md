# Admin API

`@ditojs/admin` renders a Vue.js admin interface from view schemas. Its public
API is the `DitoAdmin` class, `defineType()`, `DitoSchemaField`, `DitoPane`,
`useDitoContext()`, `useDitoForm()`, `DitoSchemaForm`, the schema options and
the contexts that schema callbacks and event handlers receive. Everything not documented here, including the
admin's other Vue components, is internal and may change in any release.

```js
import DitoAdmin, { defineType } from '@ditojs/admin'
import '@ditojs/admin/style.css'
```

For an introduction, see the [admin guide](../../guide/admin/index.md).

## Pages

| Page | Contents |
| ---- | -------- |
| [DitoAdmin](./admin.md) | The `DitoAdmin` class, its constructor options and the `api` configuration; `admin.context` with the user, the session, views, dialogs and notifications; the global `dito` object |
| [Schemas](./schemas.md) | The options that all schemas share, and the options of every component type: fields, options, layout, lists and objects, views, forms and dialogs |
| [SchemaContext](./context.md) | The context that schema callbacks and event handlers receive |
| [Events](./events.md) | The `on…` event handlers of schemas, forms, views and buttons |
| [Types](./types.md) | The exported TypeScript types, `defineType()` and the descriptors of custom component types |

## Exports

| Export | Description |
| ------ | ----------- |
| `default`, `DitoAdmin` | The [DitoAdmin](./admin.md) class |
| `defineType()` | Defines a custom component type, see [`defineType()`](./types.md#definetype) |
| `DitoSchemaField` | Places a field of a section or form with `component`, see [Laying out fields](../../guide/admin/custom-types.md#laying-out-fields). `DitoField` is its deprecated alias until 6.0 |
| `DitoPane` | Places fields of a section or form with `component` in rows, see [Laying out fields](../../guide/admin/custom-types.md#laying-out-fields) |
| `useDitoContext()` | Returns the [context](./context.md) of the form or page, or of the list item, that the calling component is in |
| `useDitoForm()` | Sets up a form in the calling component, which loads, creates and saves the item of its `resource` and `id`, and returns its [context](./context.md), see [Forms in pages](../../guide/admin/views.md#forms-in-pages) |
| `DitoSchemaForm` | Renders the form of `useDitoForm()` with its buttons, its default slot lays out the fields, see [Forms in pages](../../guide/admin/views.md#forms-in-pages) |

All other exports are TypeScript types, see [Types](./types.md).

| Entry point | Description |
| ----------- | ----------- |
| `@ditojs/admin` | The JavaScript module and its types |
| `@ditojs/admin/style.css` | The admin's styles |
| `@ditojs/admin/imports.scss` | The SCSS variables and mixins, for styling custom components |

UI components shared with the admin, such as buttons, inputs and date pickers,
are public in [@ditojs/ui](../ui.md).
