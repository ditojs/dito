### Fixes

- **admin:** Text fields, `textarea`, `code` and `markup` with `nullable` or `trim` as callbacks save what the callbacks return: `nullable: () => false` saves empty values as `''` instead of `null`, and `trim: () => false` no longer trims.
