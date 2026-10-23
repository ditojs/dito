### Behaviour changes

- **admin:** The `properties` of tree lists and tree objects are renamed to `details`, without an alias: `properties` on trees and their `children` throws, naming `details`. Their type is the new `Details`, of `DisplaySchema`s: the display options that `ColumnSchema` shares, without the ones to sort. The class `.dito-properties` of their table is renamed to `.dito-tree-item__details`.
