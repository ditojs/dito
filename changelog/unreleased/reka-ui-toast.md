### Behaviour changes

- **admin:** Notifications are built on `reka-ui`'s `Toast`, and `@kyvg/vue3-notification` is no longer a peer dependency. Remove it from the app's dependencies unless the app uses it itself.
  - The global `$notify()` is gone; use `context.notify()` or `admin.context.notify()`.
  - The types are modifiers, e.g. `.dito-notification--error` instead of `.dito-notification.error`, and the parts are `.dito-notification__title` and `.dito-notification__content`.
  - New notifications appear below the older ones instead of above them.
  - Notifications pause while hovered or focused, and while the window is blurred. They close on a click. Swiping is off, so their text stays selectable and pages scroll on touch.
  - Notifications are tab stops, and F8 focuses their region. The region is a polite live region, so screen readers announce them when idle.
  - The library's classes, like `.vue-notification-wrapper`, are gone.
