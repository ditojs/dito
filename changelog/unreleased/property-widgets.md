### Behaviour changes

- **admin:** Fields validate on blur with the checks of all fields that edit the same value, as submits already do. Before, a field only ran its own checks, e.g. not the `required` of another field of the same name in another tab.

### New

- **admin:** `DitoTextField`, `DitoNumberField`, `DitoSwitchField` and `DitoSection` lay out the `properties` of `useDitoForm()` in `DitoSchemaForm` by their `name`, with display props only: the labels of required properties are marked, irrelevant properties hide their widgets, collapsed sections show that they contain errors and open to reveal them, also in the page's own components, and errors that no widget shows are notified.
