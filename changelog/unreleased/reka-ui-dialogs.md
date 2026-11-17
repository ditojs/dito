### Behaviour changes

- **admin:** Dialogs are built on `reka-ui`'s `Dialog`, which is a new peer dependency, and `focus-trap` no longer is one. Add `reka-ui` to the app's dependencies, and remove `focus-trap` unless the app uses it itself.
  - `role="dialog"` and `aria-modal` moved from `.dito-dialog` to its new child `.dito-dialog__content`, which replaces `.dito-dialog__focus-trap`. The dialog is labelled by a hidden title with `settings.label`, through `aria-labelledby` instead of `aria-label`.
  - With `clickToClose`, dialogs close on a mouse press on the overlay instead of on its release.

### Fixes

- **admin:** Enter submits dialogs only from text-like inputs, as in browsers, and no longer from checkboxes, radios and other inputs.
