### Fixes

- **admin:** Lists and objects of written properties that aren't `nullable` get their empty value when they are loaded as `null`, `[]` or `{}` with their defaults, as lists and nested sections of fields do. Before, widgets of objects that the server returned as `null` failed to render.
