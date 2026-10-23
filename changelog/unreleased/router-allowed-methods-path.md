### Fixes

- **router:** `getAllowedMethods(path)` normalizes `path` like `find()` does, with the `prefix` and, unless `strict`, the slashes. It returned no methods for paths that `find()` matches.
