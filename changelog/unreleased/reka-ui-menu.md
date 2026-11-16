### Behaviour changes

- **ui:** `DitoMenuButton` is built on `reka-ui`'s `DropdownMenu`. Its menu always opens as a panel with a tip, placed with `side` and `align` instead of `placement`. `cover`, `floating` and `offset` are removed, see [`DitoMenuButton`](docs/api/ui.md#ditomenubutton).
- **ui:** `DitoTrigger` and the helpers `combineEvents()`, `getKey()` and `getKeyNavigation()` are removed. Use `reka-ui`'s `Popover` or `DropdownMenu` instead.
