### Behaviour changes

- **ui:** `DitoPagination` is built on `reka-ui`'s `Pagination`. The current page's button has `[data-selected]` instead of `.dito-button--active`.
  - Near the first and last page, five page buttons show in a row.
  - `.dito-button--prev`, `--next`, `--ellipsis-prev` and `--ellipsis-next` are removed. The previous and next page buttons have `.dito-pagination__prev` and `.dito-pagination__next`, and both ellipses are `button.dito-pagination__ellipsis`, the one before the current page with `--back`.
