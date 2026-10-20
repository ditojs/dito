### Behaviour changes

- **admin:** The elements of tree items, tree lists and objects are renamed after their blocks, so styles and tests that select them need to follow: `dito-tree-header`, `dito-tree-branch`, `dito-tree-branch__content`, `dito-tree-leaf`, `dito-tree-label` and `dito-tree-info` become `dito-tree-item__header`, `__branch`, `__branch-content`, `__leaf`, `__label` and `__info`, `dito-tree-panel` and `dito-tree-form-container` become `dito-tree-list__panel` and `__form-container`, and `dito-object-content` becomes `dito-object__content`.
- **ui:** `dito-pagination-total` becomes `dito-pagination__total`.
