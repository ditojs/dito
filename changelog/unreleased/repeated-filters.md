### Fixes

- **server:** Repeated `filter` query parameters of one name, as in
  `?filter=minPages:400&filter=minPages:600`, all apply, instead of only the
  last one.
