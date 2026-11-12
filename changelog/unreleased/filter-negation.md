### New

- **server:** A `!` before a filter's name negates it, in the `filter` query parameter (`filter=!genre:"poetry"`), in `applyFilter('!genre', 'poetry')` and in the `filter` of list scopes, see [Filters](docs/guide/server/queries.md#filters).
- **server:** The built-in `equals` filter type compares a property with one value, or with any of a list of values: `genre: { filter: 'equals' }`, applied as `filter=genre:"poetry"` or `filter=genre:["poetry","drama"]`. Like `text`, it takes `properties`.
