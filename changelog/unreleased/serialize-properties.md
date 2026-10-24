### Behaviour changes

- **admin:** Several fields of the same value serialize it with each option, e.g. `trim`, `exclude` or `serializeValue()`, from the first field that defines it. Before, a value edited by a field without `trim` and a second field with `trim: true` was sent untrimmed.
