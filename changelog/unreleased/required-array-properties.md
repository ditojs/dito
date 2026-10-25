### Behaviour changes

- **admin:** `required` needs one item in all array values, as in lists and fields with multiple values: also in written array properties and in fields of custom types whose property is `type: 'array'`. Before, they accepted `[]`, as the server does. `minItems` overrides it, e.g. `minItems: 0` accepts none as an answer. Fields no longer derive `minItems: 1` into the properties that `getFormProperties()` describes, so the server accepts `[]` for them.
