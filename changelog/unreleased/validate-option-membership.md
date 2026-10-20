### Behaviour changes

- **admin:** `select`, `multiselect`, `radio` and `checkboxes` with options given as an array, in `options` or `options.data`, validate that their values are among them, with "must be one of the options": saving fails where the data holds values missing from the options, e.g. stored before an option was removed, or written by code. Options loaded through callbacks or `dataPath`, and multiselects with `taggable` or `search`, keep accepting values without option. `rules: { enum: false }` turns the rule off.
