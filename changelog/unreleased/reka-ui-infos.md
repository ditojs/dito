### Behaviour changes

- **admin:** Infos open their popup on hover and also on a click, a tap or Enter, built on `reka-ui`'s `Popover`. Hovering leaves the focus where it is. The popup stays within the scroll area of the info, e.g. the sidebar, and wraps its text there. `tippy.js` is no longer a peer dependency; remove it unless the app uses it itself.
  - `.dito-info` is a button labelled `Info: ` and the text of its label, without `data-info`. In collapsible labels, it follows the toggle button, `.dito-label__content`, instead of sitting in it. Escape or a click outside closes the popup, `.dito-info__popup`, and links in it can be reached with the keyboard.
  - Inputs without a label still show their info in their suffix. Other fields without a label, e.g. buttons, show it after the component, in containers with `.dito-container--has-info`, as buttons can't hold its button.
  - The `.tippy-*` styles are removed, and `$z-index-tippy` is renamed to `$z-index-info`.
