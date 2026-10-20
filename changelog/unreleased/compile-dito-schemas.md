### New

- **server:** `app.compileDitoSchema(schema, options?)` compiles a schema in Dito.js' format of model properties, with `required: true`, `type: 'date'` and model names as types, and `app.compileJsonSchema(jsonSchema, options?)` compiles plain JSON schemas.

### Deprecations

- **server:** `app.compileValidator()` is deprecated in favour of `app.compileJsonSchema()`. It keeps working until 6.0 and logs a deprecation warning.
