# Upgrading to Dito.js 4.0

## Admin

### Routes

The routes of the admin are generated from a route tree, built once from the
schemas of the views, instead of by the types while they set up their schemas.

- The URLs of the forms of lists in nested sections and inlined objects contain
  the name of their container, like the data path of their items, e.g.
  `/books/1/contents/notes/2` for a list `notes` in a section `contents` with
  `nested: true`. Sections without `nested: true` hold no data of their own and
  stay out of the URLs.
- The forms of lists in forms that are shared by several views or lists are
  routed in each of them.
- `maxDepth` limits how often a list with routed forms occurs inside itself in
  a route, also when its form is shared, and lists beyond it don't render, as
  intended. In inlined content, it limits how deep forms with routes are
  reached through lists that share the same forms.
- Lists with their own `path`, and lists whose names don't survive normalizing
  their paths (e.g. `sourceURLs`), open their items' forms.
- Lists linked to views (`view:`) link to the form of the view also when the
  view has several components, and can create items there.
- The items of tree lists with a resource are addressed by their id in URLs,
  like the items of other lists with a resource.
- Saving the forms of the children of tree items doesn't reload the tree,
  which only matters for trees whose children have their own resource.

### Custom types

- `processSchema(api, schema, name)` only sets up the schema, e.g. resolves the
  schemas that it contains. It no longer receives `routes` and `level`, and
  doesn't add routes.
- Types whose forms render inside the form or view of their parent route set
  `hasNestedForms: true`.
- Types that route sources next to the forms of their items, like the children
  of tree items, return their schemas from `getChildSourceSchemas(schema)`.
