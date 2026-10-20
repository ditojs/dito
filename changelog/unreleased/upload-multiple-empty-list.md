### Behaviour changes

- **admin:** `upload` with `multiple` holds `[]` instead of `null` when it has no value yet, as it already sends: code that checks new items for `null` needs to check for an empty array.
