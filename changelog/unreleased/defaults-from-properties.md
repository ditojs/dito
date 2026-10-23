### Behaviour changes

- **admin:** Fields with `nullable: false` that are loaded with `null` get the empty value of their type, e.g. `''` for text, like written properties.
- **admin:** Values without a type, e.g. of custom types without `getProperty()`, have no empty value: they stay missing unless they have a `default`, instead of starting as `null`, and keep a stored `null` when loaded.
- **admin:** Type descriptors lose `treatsNullAsMissing`, with no alias: only the data type of a value decides whether a loaded `null` gets its default, and `defineType()` throws for the key. Custom types declare `getProperty()` to get their data type's empty value.

### New

- **admin:** Custom types declare the data type of their values with `getProperty()`, in the format of the server's `properties`, e.g. `getProperty: () => ({ type: 'number' })`.
