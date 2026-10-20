### Behaviour changes

- **admin:** A form with `component` but no `fields` throws an error at setup. Before, `component` on forms was ignored.

### New

- **admin:** Forms with `component` and `fields` lay out their fields with `DitoSchemaField` and `DitoPane`, as sections do.
- **admin:** `useDitoContext()` returns the context of the form, or of the list item, that a component is in.
