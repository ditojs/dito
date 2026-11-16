### Behaviour changes

- **admin:** Notifications are built on `reka-ui`'s `Toast`, and `@kyvg/vue3-notification` is no longer a peer dependency. Remove it from the app's dependencies unless the app uses it itself.
  - The global `$notify()` is gone; use `context.notify()` or `admin.context.notify()`.
  - The types are modifiers, e.g. `.dito-notification--error` instead of `.dito-notification.error`, and the parts are `.dito-notification__title` and `.dito-notification__content`.
  - Notifications pause while hovered or focused, and close on a swipe to the right as well as on a click. Screen readers announce errors at once and other notifications when idle.
