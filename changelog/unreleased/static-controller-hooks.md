### New

- **server:** Controllers take `static hooks`, which run once per class that declares them, base classes first. See [Hooks](docs/api/server/controllers.md#hooks).

### Deprecations

- **server:** `hooks` instance fields of controllers are deprecated in favour of `static hooks`. They keep working and log a deprecation warning.
