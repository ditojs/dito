### Fixes

- **schema:** `decimals` counts the decimals of numbers that JavaScript prints in exponent form, so the server and the admin accept `0.0000001` for `decimals: 8`, and `1e21` for `decimals: '*'`. Strings without any digit, like `'-'` or `'+'`, aren't accepted as numbers anymore.
