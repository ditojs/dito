### Behaviour changes

- **admin:** Multiselects are built on `reka-ui`'s `Combobox`, with the values of `multiple` ones in its `TagsInput`. `vue-multiselect` is no longer a peer dependency; remove it unless the app uses it itself.
  - Picking the selected option of a single select keeps it instead of clearing it. Use `clearable: true` to let users clear it.
  - The `.multiselect__*` styles are removed. The markup uses `.dito-multiselect__*` classes and the `data-state` attributes of `reka-ui`.
