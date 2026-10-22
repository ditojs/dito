### Fixes

- **admin:** Written properties that aren't `nullable` treat a value loaded as `null` as missing, for all types, and get their `default` or their empty value: `''` for strings, `false` for booleans, `[]` for lists and `{}` with their defaults for objects. Values whose empty value is `null`, e.g. numbers and dates, stay `null`. Before, widgets of objects that the server returned as `null` failed to render.
