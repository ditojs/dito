### New

- **admin:** Template forms: the form of a list or object with its own resource, with `component` and no `components`, takes its components from the field components in the component's template, e.g. `<DitoTextField path="title" required />`, which register their schema with their props as options. The form loads, validates (the mounted fields), saves (the fields that registered), keeps drafts and guards against leaving as other forms do.
- **admin:** Field components of the built-in types, `DitoTextField`, `DitoNumberField`, `DitoListField`, `DitoObjectField` and others, with `path` (dotted paths place values in objects) and the type's options as props, and `defineFieldComponent(type)` for custom types. The default slot of inlined list and object fields is the form of their items.
- **admin:** Forms with `component` and `components` lay out their components with `DitoSchemaField` and `DitoPane`, as sections do.
- **admin:** `useDitoContext()` returns the context of the form, or of the list item, that a component is in.
