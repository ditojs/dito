### Behaviour changes

- **admin:** Setup renames `components` to `fields` and `component` with a schema on views to `field`, so code that reads `components` or `component` from schemas after setup needs to read `fields` or `field`.

### New

- **admin:** `fields` is the new name of the schema option `components` of views, forms, tabs, sections, panels, inlined lists and objects and custom filters, and of the options of `showDialog()`, e.g. `{ type: 'form', fields: { title: { type: 'text' } } }`. A view's single field is given in `field`, e.g. `{ type: 'view', field: { type: 'list', … } }`. `api.defaults` may use `fields` as well.

### Deprecations

- **admin:** `components` is deprecated in favour of `fields`, and `component` with a schema on views in favour of `field`. Both keep working and log a deprecation warning. `component` on other schemas stays the Vue component of forms, sections, `type: 'component'` fields and pages.
