### Behaviour changes

- **admin:** `markup` stores an empty editor as `null` instead of the HTML of its empty nodes, e.g. `<p></p>`, or `''` with `hardBreak`, and `code` sends `null` instead of `''` when emptied, like `text` and `textarea`: code that compares these values with `'<p></p>'` or `''` needs to check for `null`.

### New

- **admin:** `nullable: false` on string fields (`text` and its variants, `textarea`, `code`, `markup`) and `checkbox` stores no value as `''` or `false` instead of `null`, for properties that aren't `nullable` on the server.

### Fixes

- **admin:** Clear buttons don't show for `''`, e.g. after deleting the text of an input.
