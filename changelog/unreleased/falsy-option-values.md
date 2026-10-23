### Fixes

- **admin:** Options that are falsy plain values, like `0`, `false` or `''`, are selected and kept like other options. Before, `checkboxes`, `radio`, `select` and `multiselect` didn't show them as selected, and dropped them from the value when other options were checked.
