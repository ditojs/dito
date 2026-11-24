### Fixes

- **server:** The admin's views are authorized also when their path is
  requested in another case or encoded, which case-insensitive file systems,
  e.g. of macOS and Windows, served without `authorize`, and builds put the
  views into their own chunk also for symlinked roots and on Windows.
