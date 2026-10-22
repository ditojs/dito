### Behaviour changes

- **admin:** The selected tab of a view or form is a segment of its URL path instead of the location hash, e.g. `/admin/books/1/pricing` instead of `/admin/books/1#pricing`, so the forms of sources in a tab open below it, `/admin/books/1/pricing/editions/0`. The tabs claim their names below the path of their view or form like its sources, the first one that can. Closing a form returns to the tab of the form below which it opened, and paths without a tab, e.g. after closing a form, name the selected tab.
