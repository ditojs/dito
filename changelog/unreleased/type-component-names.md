### Internal

- **admin:** The components of the types register globally as `Dito<Name>Type` instead of `DitoType<Name>`, e.g. `DitoTextType`. Apps that place them by their global name need the new names.
