### Fixes

- **admin:** Forms and sources whose resource function reads its `parent` set up again: the admin checks whether they declare a `resource` instead of calling the function without its context. A declared resource function that returns `null` thus also counts as a resource of its own.
