### Deprecations

- **admin:** The `rules` of fields are deprecated until 6.0 and log a deprecation warning. Limits are field keys, e.g. `minimum`, `maxLength` or `minItems`, and setup moves rules with their names to them. Type checks come from the type, e.g. `type: 'text'` instead of `type: 'url'` with `rules: { url: false }`, and everything else goes through `validate()`. Rules that turn validations off with `false` or `undefined` keep working until 6.0.
