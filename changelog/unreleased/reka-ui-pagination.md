### Behaviour changes

- **ui:** `DitoPagination` is built on `reka-ui`'s `Pagination`. The current page's button has `[data-selected]` instead of `.dito-button--active`.
  - The ellipses are plain spans and don't jump ten pages.
  - Near the first and last page, five page buttons show in a row.
  - `.dito-button--prev`, `--next`, `--ellipsis-prev` and `--ellipsis-next` are removed. The previous and next page buttons have `.dito-pagination__prev` and `.dito-pagination__next`, and both ellipses are `span.dito-pagination__ellipsis`.
