### Behaviour changes

- **admin, ui:** `reka-ui` is a new peer dependency, and `focus-trap` is no longer one. Add `reka-ui` to the app's dependencies and remove `focus-trap`, unless the app uses it itself.
- **admin:** Dialogs are built on `reka-ui`'s `Dialog`. They are labelled by a hidden title with `settings.label`, through `aria-labelledby` instead of `aria-label`. With `clickToClose`, they close on a mouse press on the overlay instead of on its release.
- **ui:** `DitoMenuButton` is built on `reka-ui`'s `DropdownMenu`. The keyboard skips disabled items, typing the start of a label focuses its item, and clicks on the button focus the menu.

### Internal

- **admin:** The tabs of forms and views move the focus with `reka-ui`'s `RovingFocusGroup`.
