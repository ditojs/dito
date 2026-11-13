### Behaviour changes

- **admin, ui:** `reka-ui` is a new peer dependency, and `focus-trap`, `tippy.js` and `vue-multiselect` are no longer ones. Add `reka-ui` to the app's dependencies and remove the others, unless the app uses them itself.
- **admin:** Dialogs are built on `reka-ui`'s `Dialog`. They are labelled by a hidden title with `settings.label`, through `aria-labelledby` instead of `aria-label`. With `clickToClose`, they close on a mouse press on the overlay instead of on its release.
- **admin:** Multiselects are built on `reka-ui`'s `Combobox`, with new markup: the input has `role="combobox"` and the field's label, single values show their label in it, and the values of multiple ones are `.dito-multiselect__tag` in `reka-ui`'s `TagsInput`, each with a `Remove …` button. Update tests that use the `.multiselect__*` classes of vue-multiselect. Backspace and the arrow keys in the empty input select tags, and Backspace removes the selected one. Searches match labels regardless of case and accents. Picking the selected option of a single multiselect again keeps it, `clearable` clears it.
- **admin:** The tooltips of infos are built on `reka-ui`'s `Tooltip`, as `.dito-tooltip` in the pane of their info. `.dito-info` no longer has `data-info`.
- **ui:** `DitoTrigger` is built on `reka-ui`'s `Popover` and only shows popups at the input of its trigger, as the pickers and the color field do. The props `trigger`, `cover`, `hideWhenClickOutside`, `alwaysShow`, `hideDelay`, `customClass` and `zIndex` are removed, and popups have `data-side` and `data-align` instead of `.dito-popup--{placement}`, see [`DitoTrigger`](docs/api/ui.md#ditotrigger).
- **ui:** `DitoMenuButton` is built on `reka-ui`'s `DropdownMenu`. The keyboard skips disabled items, typing the start of a label focuses its item, and clicks on the button focus the menu. Disabled items have `data-disabled` instead of `.dito-menu-button__item--disabled`.
- **ui:** The tips of floating menus are `reka-ui` arrows, `svg.dito-menu-button__tip`, filled with the menu's color.
- **admin:** `.dito-header` no longer pads the spans inside it, only the text of the trail, `.dito-trail__text`. Pad the spans of custom header content in their own styles.

### Internal

- **admin:** The tabs of forms and views move the focus with `reka-ui`'s `RovingFocusGroup`.
