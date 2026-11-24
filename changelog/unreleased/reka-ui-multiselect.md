### Behaviour changes

- **admin:** Multiselects are built on `reka-ui`'s `Combobox`, with the values of `multiple` ones in its `TagsInput`. `vue-multiselect` is no longer a peer dependency; remove it unless the app uses it itself.
  - Picking the selected option of a single select keeps it instead of clearing it. Single selects that aren't `required` show a clear button instead, unless `clearable: false`.
  - Tab no longer picks the highlighted option, and Enter without a highlighted option doesn't submit dialogs.
  - The combobox is the `<input>` itself, and single selects show the label of their option as its value instead of as text, so tests read it with `toHaveValue()`, not `toHaveText()`.
  - The `.multiselect__*` styles are removed. The markup uses `.dito-multiselect__*` classes and the `data-state` attributes of `reka-ui`.
  - Multiselects with `search` reset their search term when the list closes, and single selects show the selected label again.
  - The remove buttons of tags are no longer tab stops. The arrow keys move between the tags, and Backspace removes them.

### Fixes

- **admin:** `clearable` fields only show their clear button when there is something to clear, and no longer for an empty list of values, e.g. of `multiple` multiselects.
