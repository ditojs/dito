### Fixes

- **admin:** 400 responses without a body, e.g. from a proxy, are notified like
  other request errors, instead of throwing a `TypeError` that hid them.
