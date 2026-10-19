### Behaviour changes

- **admin:** Escape also cancels dialogs with only one button, resolving them to `undefined`.

### New

- **admin:** `context.confirm()`, `prompt()` and `alert()` show dito dialogs instead of the browser's native ones.
- **admin:** The `labelledBy` option labels fields by another element, e.g. a text above them.
