### Behaviour changes

- **admin:** The forms of items below other forms and pages open through the sources that render them: the rendered sources of a view, form or page claim the paths below it, the first one that can. Collapsed sections, tabs and panels render their content hidden while the route continues into it, so deep links reach sources in them. Paths that no source claims lead back to the form or page, once it rendered its components with its data, instead of showing an empty page or the page under the unclaimed path.
- **admin:** The forms of items of items open once their parent item exists, e.g. `/admin/books/1/chapters/0/notes/0` needs chapter `0`.

### Internal

- **admin:** `RouteTree` only holds menus and views. The forms of `useDitoForm()` in pages no longer add routes.
- **admin:** Setup names components, tabs and panels by their keys, so panes and tabs render the schemas themselves instead of copies with their names, and forms that contain themselves are recognized by their source schemas again.
