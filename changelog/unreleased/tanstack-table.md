### Behaviour changes

- **admin:** The tables of lists are built on [TanStack Table](https://tanstack.com/table), which apps now provide as the peer dependency `@tanstack/vue-table`. List schemas don't change.
  - `DitoTableHead` takes the list's TanStack `table` instead of `listQuery`, `columns` and `hasEditButtons`.
  - The admin's `DitoPagination` is removed. Lists use the `DitoPagination` of `@ditojs/ui`.

### Fixes

- **admin:** Columns hidden through `if` don't count towards the width of the empty row and the list buttons.
