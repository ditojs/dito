### Behaviour changes

- **admin:** The validators take their checks and messages from `@ditojs/schema`, the definitions that the server uses. Two messages change: `integer` says "must be a whole number" (was "must be whole number"), and `decimals` "must be a number with at most 2 decimal places" or "must be a number with at most one decimal place" (was "must be numeric and may contain 2 decimal points"), "must be a whole number" for `decimals: 0` (was "must be numeric and may not contain decimal points") and "must be a number" for `'*'` (was "must be numeric and may contain decimal points").
- **admin:** `minimum`, `maximum` and `range` only apply to numbers, as on the server, so `rules` that set them on text values are ignored.
