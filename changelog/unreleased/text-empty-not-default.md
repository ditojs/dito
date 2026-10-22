### Behaviour changes

- **admin:** Emptied text fields (`text` and its variants, `textarea`, `code` and `markup`) save their empty value, `null`, or `''` with `nullable: false`, instead of their `default`.
