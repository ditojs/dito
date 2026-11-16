### Behaviour changes

- **ui:** `DitoPagination` is built on `reka-ui`'s `Pagination`. Its ellipses no longer jump ten pages, and the current page's button has `[data-selected]` instead of `.dito-button--active`.
  - `.dito-button--prev`, `--next`, `--ellipsis-prev` and `--ellipsis-next` are removed. The previous page's button has `.dito-pagination__prev`, and both ellipses are `span.dito-pagination__ellipsis`.
