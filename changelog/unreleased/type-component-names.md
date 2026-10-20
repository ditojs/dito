### Behaviour changes

- **admin:** The components of the types register globally as `Dito<Name>Type` instead of `DitoType<Name>`, e.g. `DitoTextType`, without aliases for the old names. Apps that place them by their global name need the new names.
