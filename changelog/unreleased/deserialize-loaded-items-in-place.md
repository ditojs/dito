### Fixes

- **admin:** `context.getValueAt()` finds the parent items of the items that lists load in callbacks that deserializing them calls, e.g. `options` of selects.
