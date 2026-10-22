### New

- **server:** The `decimals` keyword limits the decimal places of numbers, as in the admin, e.g. `decimals: 2`, with the same message. Properties that the admin derives from fields with `decimals` include it.

### Internal

- **schema:** `keywords._enum` and `keywords.multipleOf` only carry the messages that the server reports. The `empty` format loses `validatesEmptyValues`, which the admin never applies it with.
