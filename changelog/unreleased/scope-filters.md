### New

- **admin:** List scopes can set filters instead of a model scope: `published: { label: 'Published', filter: { published: true } }` sends `filter=published:true` and no `scope`. `order` sets the order of a scope's list. Scopes without them work as before, see [Scopes and filters](docs/guide/admin/lists.md#scopes-and-filters).
- **admin:** `context.sourceQuery` holds the query that the server reads, with the filters of the scope.
