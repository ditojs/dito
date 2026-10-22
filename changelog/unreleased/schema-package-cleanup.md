### Behaviour changes

- **schema:** `keywords._enum` and `keywords.multipleOf` lose `validate()` and only carry the messages that the server reports. The `empty` format loses `validatesEmptyValues`, which the admin never applies it with.

### New

- **server:** The `decimals` keyword limits the decimal places of numbers, as in the admin, e.g. `decimals: 2`, with the same message. Properties that the admin derives from fields with `decimals` include it.
