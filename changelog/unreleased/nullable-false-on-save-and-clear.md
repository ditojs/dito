### Behaviour changes

- **admin:** Saving and copying send `null` in values that aren't `nullable` as their `default`, else as the empty value of their type, e.g. `''` in text fields with `nullable: false`, `false` in switches and `[]` in lists, also when the `null` was written while editing, e.g. by `computeValue()`. The data keeps the `null` until then. Numbers and dates without a `default` still send `null`.
- **admin:** The clear button of `clearable` fields with `nullable: false` sets their `default`, instead of the empty value of their type.
