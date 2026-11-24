### Fixes

- **admin:** File sizes, e.g. `maxSize` of uploads, ignore spaces around them
  and take one decimal mark, a dot or a comma: thousands separators, as in
  `'1,000,000'`, throw instead of giving a wrong size.
