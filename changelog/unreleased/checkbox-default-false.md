### Behaviour changes

- **admin:** `checkbox` defaults to `false` instead of `null`, like `switch`, so new items no longer send `null` that booleans which aren't `nullable` reject: code that checks new checkboxes for `null` needs to check for `false`, and `required` checkboxes pass without being touched.
