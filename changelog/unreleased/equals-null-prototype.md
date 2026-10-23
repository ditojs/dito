### Fixes

- **utils:** `equals()` compares objects without prototype, e.g. from `Object.create(null)`, like plain objects, instead of throwing.
