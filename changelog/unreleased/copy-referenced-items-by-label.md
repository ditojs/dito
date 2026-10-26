### Fixes

- **admin:** Copies of list items that reference a record through a field of their `idKey` with `options` hold the label of that record in `$label`, which pasting resolves to its id again, instead of losing the reference.
