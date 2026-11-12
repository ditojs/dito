### New

- **admin:** A list scope's `filter` can be a callback of the list's context that returns the filters, e.g. `mine: { label: 'Mine', filter: ({ user }) => ({ author: user.id }) }`, see [Scopes and filters](docs/guide/admin/lists.md#scopes-and-filters).
