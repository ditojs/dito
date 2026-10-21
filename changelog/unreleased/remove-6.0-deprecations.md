### Behaviour changes

- **admin:** The schema keys removed below throw when their schema is set up, naming their replacement, see [Upgrading to 6.x](docs/upgrading-to-6.x.md).
- **admin:** `components` of schemas, filters and `showDialog()` is removed: use `fields`. Views take their field in `field` instead of `component`.
- **admin:** `min` and `max` of `number`, `integer`, `slider` and `progress` are removed: use `minimum` and `maximum`.
- **admin:** `rules` of fields are removed: use the limits of fields, e.g. `minLength`, their types and `validate()`.
- **admin:** `events: {}` of schemas is removed: use the `on…` handlers, e.g. `onChange()`.
- **admin:** `type: 'computed'`, `'data'` and `'hidden'` are removed: use `type: 'value'`.
- **admin:** `{ html }` objects in labels, item labels, info, affixes and `render()` results, `type: 'html'` affixes and the `html` option of `notify()` are removed: use the `html` template of `@ditojs/utils`, also as `text` of label objects, affixes and `notify()`.
- **admin:** `DitoField` is removed: use `DitoSchemaField`. `login.additionalComponents` of `DitoAdmin` is removed: use `login.additionalFields`.
- **admin:** The deprecated type aliases are removed: `Component`, `Components`, `SourceComponent`, `ComponentSchemaBase`, `BaseSchema`, `SchemaFields`, `SchemaSetupMixin`, `SchemaRoute`, `SchemaRouteMixin`, `Form`, `ComputedSchema`, `DataSchema`, `HiddenSchema`, `OrItemAccessor`, `ItemAccessor`, `DitoContext`, `DitoGlobal`, `HTTPMethod` and the `Schema…Mixin` types, as well as `SchemaRules`, `SchemaEvents` and `BaseSchemaEvents`.
- **server:** `app.compileValidator()` is removed: use `app.compileJsonSchema()`.
- **server:** Hook keys that name actions by their keys, e.g. `'before:member:get tech-doc-:format'`, no longer match: use their identifiers, e.g. `'before:member:get-tech-doc-format'`.
- **server:** The type aliases `HTTPMethod`, `SelectModelProperties`, `SelectModelKeys`, `ExtractModelProperties` and `SelectModelPropertyKeys` are removed: use `HttpMethod`, `SerializedModel` and `keyof SerializedModel`.
