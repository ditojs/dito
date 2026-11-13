### Behaviour changes

- **admin:** `reka-ui` is a new peer dependency, and `focus-trap` is no longer one. Add `reka-ui` to the app's dependencies and remove `focus-trap`, unless the app uses it itself.
- **admin:** Dialogs are built on `reka-ui`'s `Dialog`. They are labelled by a hidden title with `settings.label`, through `aria-labelledby` instead of `aria-label`. With `clickToClose`, they close on a mouse press on the overlay instead of on its release.
