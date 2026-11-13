### Behaviour changes

- **admin, ui:** `reka-ui` is a new peer dependency, and `focus-trap` and `vue-multiselect` are no longer ones. Add `reka-ui` to the app's dependencies and remove the other two, unless the app uses them itself.
- **admin:** Dialogs are built on `reka-ui`'s `Dialog`. They are labelled by a hidden title with `settings.label`, through `aria-labelledby` instead of `aria-label`. With `clickToClose`, they close on a mouse press on the overlay instead of on its release.
- **admin:** Multiselects are built on `reka-ui`'s `Combobox`, with new markup: the input has `role="combobox"` and the field's label, single values show their label in it, and tags are `.dito-multiselect__tag` with a `Remove …` button. Update tests that use the `.multiselect__*` classes of vue-multiselect. Backspace in the empty input removes the last value.
- **ui:** `DitoMenuButton` is built on `reka-ui`'s `DropdownMenu`. The keyboard skips disabled items, typing the start of a label focuses its item, and clicks on the button focus the menu.

### Internal

- **admin:** The tabs of forms and views move the focus with `reka-ui`'s `RovingFocusGroup`.
