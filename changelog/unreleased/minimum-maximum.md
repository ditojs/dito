### New

- **admin:** Number types (`number`, `integer`, `slider`, `progress`) take `minimum` and `maximum`, the names of the server's model properties.

### Deprecations

- **admin:** `min` and `max` of number types and their `rules` are deprecated aliases of `minimum` and `maximum` until 6.0. They keep working and log a deprecation warning. Custom types that return `min` or `max` from `getValidations()` need to return `minimum` and `maximum`.
