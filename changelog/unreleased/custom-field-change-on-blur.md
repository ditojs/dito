### Fixes

- **admin:** `DitoCustomField` with `name` emits `change` once the focus leaves its content after an edit, instead of on every write, and validates the value then, like the other widgets. Writes without focus in the field still emit `change` right away.
