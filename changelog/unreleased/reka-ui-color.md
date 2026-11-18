### Behaviour changes

- **admin:** The picker of `type: 'color'` is built on `reka-ui`'s `ColorArea`, `ColorSlider`, `ColorField` and `ColorSwatch`, and `vue-color` is no longer a peer dependency; `tinycolor2` is one instead. Remove `vue-color` from the app's dependencies unless the app uses it itself. The stored values keep their `colorFormat`. The picker has no hex input of its own, as the field's input is one.
- **ui:** The SCSS variable `$popup-margin` is removed. Popups get their gap from `reka-ui`'s `sideOffset`.
