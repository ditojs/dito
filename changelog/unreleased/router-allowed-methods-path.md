### Behaviour changes

- **router:** `getAllowedMethods(path)` normalizes `path` like `find()` does, with the `prefix` and, unless `strict`, the slashes. It returned no methods for paths that `find()` matches. Callers that added the `prefix` themselves pass the path without it, as to `find()`.
