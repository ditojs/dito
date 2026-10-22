### Behaviour changes

- **admin:** The URLs of routed forms of sources in tabs, sections and panels contain their names, e.g. `/admin/books/1/pricing/editions/0` instead of `/admin/books/1/editions/0`, so that sources of the same data in different tabs open their own forms. Sources of the same form with the same URL path throw, naming both. Forms whose nested form is open select the tab of its source, also after a reload, so closing the nested form returns to it.

### Fixes

- **admin:** Nested forms of items in their parent's data take their component paths and field ids from their route, e.g. `pricing/editions/0/price`, also on reload, instead of from the first source of the same data. Errors in their items open the form of the first source whose form displays the field.
