### Behaviour changes

- **ui:** Menus and select lists open at once, while calendars and color pickers animate.
- **ui:** The animations `dito-slide-enter` and `dito-slide-leave` no longer set a `transform-origin`, so they scale from the centre unless the element sets one, e.g. `transform-origin: top`.

### New

- **ui:** The placeholder `%popup` gives popups, menus and lists their `z-index`, as used by `DitoMenuButton`, `DitoDatePicker` and the color and multiselect types, and `%popup--animated` adds the panel and enter animation of larger popups. See [Placeholders](docs/api/ui.md#placeholders).
