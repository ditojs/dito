### Behaviour changes

- **admin:** `maxLength` is validated, not only set as the `maxlength` of text inputs: saving fails where code wrote longer values, or where `maxLength` is set on other types with text values, e.g. `markup`. Lengths are counted in characters (code points), as on the server.
- **admin:** `required` accepts empty arrays, as the server does. Lists, `tree-list`, `checkboxes`, multiselects and uploads with `multiple` still need one item, as `required` adds `minItems: 1` to the types whose empty value is an array, with the same message "is required". Other fields with array values, e.g. of `component` or custom types, accept `[]` when required.

### New

- **admin:** Fields take `minLength`, `pattern`, `minItems` and `maxItems`, with the names and meanings of the server's model properties, validated in the browser like `required`.
