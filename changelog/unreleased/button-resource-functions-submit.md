### Fixes

- **admin:** Buttons with a `resource` submit on click, also when it is a function that builds on its `parent`, e.g. ``({ parent }) => `/items/${parent.id}/publish` ``. Before, the check whether they have a resource called the function without its context, which failed for functions that read it.
