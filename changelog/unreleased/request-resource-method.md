### Fixes

- **admin:** Resources given as functions receive the `method` of requests, as documented, e.g. `context.request({ resource, method: 'post' })`, and the resources of submit buttons the method of their form, `'post'` when creating and `'patch'` when saving. Before, they only received their `parent`.
