### Fixes

- **admin:** Resources given as functions receive the `method` of requests, as documented, e.g. `context.request({ resource, method: 'post' })`. Before, they only received their `parent`.
