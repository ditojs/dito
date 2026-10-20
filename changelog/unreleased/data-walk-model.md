### Behaviour changes

- **admin:** Of several fields that edit the same value, e.g. in two tabs, the first one with `computeValue()`, a data schema or options computes the value and loads its options. Before, the last one did.
- **admin:** Values that go missing after the data is set up, e.g. in added items or in items that `computeValue()` returns, get the default of the first of these fields that has its own `default`, like new data. Before, the first field set its type's default, e.g. `''`.
