### Behaviour changes

- **ui:** `DitoMenuButton` is built on `reka-ui`'s `DropdownMenu`. Its menu always opens as a panel with a tip, placed with `side` and `align` instead of `placement`. `cover`, `floating` and `offset` are removed, see [`DitoMenuButton`](docs/api/ui.md#ditomenubutton).
  - Long menus stay in the closest container that scrolls and scroll their items, in `.dito-menu-button__items`.
  - ArrowUp no longer opens the menu, Tab leaves it, and it stays open when the window loses focus. The items are no longer in a `ul` of `li`s, nor buttons.
  - `.dito-menu-button` is on the button itself. Its classes `.dito-menu-button--open`, `--attached`, `--floating` and `--offset` are removed: style the open button with `[data-state='open']` and the tip with `.dito-menu-button__tip`. `.dito-menu-button__item--disabled` is replaced by `[data-disabled]`.
- **ui:** The unused transitions `dito-zoom` and `dito-slide` are removed. The animation `dito-slide-enter` stays.
- **ui:** `DitoTrigger` and the helpers `combineEvents()`, `getKey()` and `getKeyNavigation()` are removed. Use `reka-ui`'s `Popover` or `DropdownMenu` instead.
