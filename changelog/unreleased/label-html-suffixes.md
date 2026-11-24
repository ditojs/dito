### Fixes

- **admin:** Tree items show the suffixes of their labels, e.g. a badge from
  `itemLabel` returning `{ text, suffix }`, which collapsed to no width.
- **admin:** The types of tree `children` give their callbacks the items of
  the array that `name` picks, instead of the items of the parent.
