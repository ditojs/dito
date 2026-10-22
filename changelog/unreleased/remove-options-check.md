### Behaviour changes

- **admin:** `select`, `multiselect`, `radio` and `checkboxes` with options given as an array no longer reject values that aren't among them, with "must be one of the options": the `enum` of the server's model property decides, as for loaded options.
