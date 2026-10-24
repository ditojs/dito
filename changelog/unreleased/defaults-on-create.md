### Behaviour changes

- **admin:** Defaults replace `null` only in data that is created or loaded, e.g. new forms, loaded items and added or pasted list items. A `null` that is written later stays, also in values that aren't `nullable` and in lists that code sets to `null`. Values that go missing later, e.g. in items that code adds or of fields that `fields()` callbacks create, still get their defaults.

### Fixes

- **admin:** Clearing a property that isn't `nullable` and has a `default`, e.g. to type another number, no longer puts the default back right away.
