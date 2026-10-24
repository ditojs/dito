### Behaviour changes

- **admin:** Values that aren't `nullable` replace `null` with their `default`, else with the empty value of their type, e.g. `''` in text fields with `nullable: false`, `false` in switches and `[]` in lists, only when the data is created, loaded or saved: in new forms, loaded items, added or pasted list items, and in the data that saving and copying send. A `null` that is written while editing, e.g. by clearing a number or by `computeValue()`, stays in the data until then, also in lists that code sets to `null`. Numbers and dates, whose empty value is `null`, send `null` without a `default`. Values that go missing later, e.g. in items that code adds or of fields that `fields()` callbacks create, still get their defaults.
- **admin:** The clear button of `clearable` fields with `nullable: false` sets their `default`, instead of the empty value of their type.
- **admin:** Values without a type, e.g. of custom types without `getProperty()`, have no empty value: they stay missing unless they have a `default`, instead of starting as `null`, and keep a stored `null` when loaded.
- **admin:** Type descriptors lose `treatsNullAsMissing`, with no alias: only the data type of a value decides whether a loaded `null` gets its default, and `defineType()` throws for the key. Custom types declare `getProperty()` to get their data type's empty value.

### New

- **admin:** Custom types declare the data type of their values with `getProperty()`, in the format of the server's `properties`, e.g. `getProperty: () => ({ type: 'number' })`.

### Fixes

- **admin:** Clearing a value that has a `default` and isn't `nullable`, e.g. a number to type another one, no longer puts the default back right away.
