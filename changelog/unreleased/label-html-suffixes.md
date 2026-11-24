### Fixes

- **admin:** Tree items show the suffixes of their labels, e.g. a badge from
  `itemLabel` returning `{ text, suffix }`, which collapsed to no width.
- **admin:** The types of tree `children` no longer give their callbacks the
  items of the parent, e.g. in `itemLabel`.
