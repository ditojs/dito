### Behaviour changes

- **admin:** The tables of lists are built on [TanStack Table](https://tanstack.com/table), which apps now provide as the peer dependency `@tanstack/vue-table`. List schemas don't change.
  - `DitoTableHead` takes the list's TanStack `table` instead of `listQuery`, `columns` and `hasEditButtons`.
  - The admin's `DitoPagination` is removed. Lists use the `DitoPagination` of `@ditojs/ui`.

### New

- **admin:** `preview` of lists with columns shows a preview of each item below its row, opened by a button at its start.
- **admin:** Columns can be `hideable` or `hidden`, which shows them in a columns menu, `resizable` with an initial `width`, `draggable` to move them by their headers, and `pinned` to the `'start'` or `'end'` of the table. The list remembers how viewers change its columns.
- **ui:** Items of `DitoMenuButton` with `checked` are checkboxes, which keep the menu open.

### Fixes

- **admin:** Columns hidden through `if` don't count towards the width of the empty row and the list buttons.
