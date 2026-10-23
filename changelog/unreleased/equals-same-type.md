### Fixes

- **utils:** The types and docs of `equals()` say which values it compares: objects and typed arrays with the same constructor or the same `Object.prototype.toString()` tag. They claimed that values of different types are never equal.
