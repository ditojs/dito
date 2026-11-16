### Behaviour changes

- **admin:** Infos open their popup on a click or tap instead of on hover, built on `reka-ui`'s `Popover`. `tippy.js` is no longer a peer dependency; remove it unless the app uses it itself.
  - `.dito-info` is a button labelled `Info`, without `data-info`. Escape or a click outside closes the popup, `.dito-info__popup`, and links in it can be reached with the keyboard.
  - The `.tippy-*` styles are removed, and `$z-index-tippy` is renamed to `$z-index-info`.
