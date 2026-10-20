### Behaviour changes

- **admin:** `markup` stores an empty editor as `null` instead of the HTML of its empty nodes, e.g. `<p></p>`, or `''` with `hardBreak`: code that compares markup values with `'<p></p>'` or `''` needs to check for `null`.
