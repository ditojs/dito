# Upgrading to Dito.js 7.x

This guide describes how to upgrade an app from Dito.js 6.x to 7.x.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

7.0 builds the admin's popups, menus, fields and notifications on
[reka-ui](https://reka-ui.com), which brings new peer dependencies and
replaces the classes, components and helpers of the libraries before.

## Dependencies

Add the new peer dependencies, and remove the ones that are no longer needed,
unless the app uses them itself:

| Package                   | 7.x                                   |
| ------------------------- | ------------------------------------- |
| `reka-ui`                 | New peer of `@ditojs/admin` and `/ui` |
| `@internationalized/date` | New peer of `@ditojs/admin` and `/ui` |
| `tinycolor2`              | New peer of `@ditojs/admin`           |
| `tiptap-footnotes`        | `^4.0.1` instead of `^3`              |
| `vue-color`               | No longer a peer                      |
| `vue-multiselect`         | No longer a peer                      |
| `@kyvg/vue3-notification` | No longer a peer                      |
| `tippy.js`                | No longer a peer                      |
| `focus-trap`              | No longer a peer                      |

The other peers require their latest versions, e.g. `vue` `^3.5.46`, the
`@tiptap` packages `^3.35.0` and `objection` `^4.4.4`.

## Admin

### Removed

| 6.x                            | 7.x                                            |
| ------------------------------ | ---------------------------------------------- |
| The global `$notify()`         | `context.notify()` or `admin.context.notify()` |
| `name` of date and time fields | Removed                                        |

Of the schema's events, date and time fields only receive `focus`, `blur`,
`input` and `change`.

### Classes and styles

| 6.x                                        | 7.x                                                 |
| ------------------------------------------ | --------------------------------------------------- |
| `.multiselect__*`                          | `.dito-multiselect__*` and reka-ui's `[data-state]` |
| `.dito-notification.error` and other types | `.dito-notification--error` and other modifiers     |
| `.vue-notification-wrapper` and the like   | `.dito-notification__title`, `__content`            |
| `.dito-tabs__link--active`                 | `[data-state='active']`                             |
| `.tippy-*`, `$z-index-tippy`               | `.dito-info__popup`, `$z-index-info`                |
| `.dito-dialog__focus-trap`                 | `.dito-dialog__content`, which has `role="dialog"`  |

### Behaviour changes

- Date, datetime and time fields edit each part of the value on their own, in
  the order of `api.locale`, instead of free text. The calendar opens when a
  part is focused or clicked, and `formats` only formats display values, e.g.
  in lists. Their `change` fires once the focus leaves the field or the
  calendar closes.
- Color fields always show their swatch, also without a value, and the swatch
  opens the picker too.
- Picking the selected option of a single select keeps it. Single selects that
  aren't `required` show a clear button instead, unless `clearable: false`.
  Tab no longer picks the highlighted option.
- The combobox of multiselects is the `<input>` itself, and single selects
  show the label of their option as its value instead of as text, so tests
  read it with `toHaveValue()` instead of `toHaveText()`.
- Tabs select on mouse down, and only a real mouse press selects them:
  synthetic clicks, e.g. `click()` in the tests of apps, don't. Tests click
  tabs with the mouse, or use the keyboard.
- Notifications appear below the older ones, pause while hovered or focused,
  and close on a click.
- With `clickToClose`, dialogs close on a mouse press on the overlay instead
  of on its release.
- Infos open on hover and on a click, a tap or Enter. `.dito-info` is a button
  labelled `Info: ` and the text of its label.
- Tree lists whose items have forms always show the form pane, also while no
  item is edited, so the tree keeps its width.
- The components at the root of a form are set further apart than the ones
  inside sections, objects and list items.
- Object fields with a label use its row as their header: it holds their
  clipboard and their remove or create button, and toggles collapsible objects,
  which no longer repeat their label inside their frame. Collapsed and empty
  objects draw no frame, and pasting into an empty object creates it.
- Inlined list items and objects without a header of their own show their
  buttons on the line of the labels of their first row, so that their fields
  keep the full width. Without labels on top, the buttons stay beside the
  fields.

## UI

| 6.x                                                        | 7.x                                              |
| ---------------------------------------------------------- | ------------------------------------------------ |
| `DitoTimePicker`                                           | `DitoTimeInput`                                  |
| `DitoCalendar`, `DitoDateTimePicker`                       | `DitoDatePicker` with a `granularity`            |
| `DitoTrigger`                                              | reka-ui's `Popover` or `DropdownMenu`            |
| `combineEvents()`, `getKey()`, `getKeyNavigation()`        | Removed                                          |
| `describeDate()`, `parseDate()` and the other date helpers | Removed                                          |
| `DitoMenuButton` `placement`, `floating`, `offset`         | `side`, `align`, `cover`, `attached`             |
| `.dito-menu-button--open`                                  | `[data-state='open']` on the button              |
| `.dito-switch--checked`, `--disabled`                      | `[data-state='checked']`, `[data-disabled]`      |
| `.dito-switch__pane`, `.dito-switch__button`               | `.dito-switch__control`, `.dito-switch__thumb`   |
| `.dito-button--active` of the current page                 | `[data-selected]`                                |
| `.dito-button--prev`, `--next`, `--ellipsis-*`             | `.dito-pagination__prev`, `__next`, `__ellipsis` |
| `$popup-margin`                                            | reka-ui's `sideOffset`                           |
| The transitions `dito-zoom` and `dito-slide`               | Removed                                          |

- `DitoDatePicker` takes the dates of `@internationalized/date` and the props
  of reka-ui, see [`DitoDatePicker`](api/ui.md#ditodatepicker).
- `DitoSwitch` no longer emits `change`: listen to `update:modelValue`.
- The animations `dito-slide-enter` and `dito-slide-leave` no longer set a
  `transform-origin`: set one where they are used, e.g. `transform-origin: top`.

## Server

Files get the `url` of their storage each time they are read, and are stored
without it, see [Storages](guide/server/storages.md#storages):

- Stored urls are ignored, so data needs no migration. Code that reads the JSON
  of files straight from the database finds no `url` in rows written since.
- Custom storages that build urls without `url` need `public: true`.

### Behaviour changes

- Setting the password or changing the username of an existing user needs
  confirmed access in all controllers, not only in users controllers: model
  and relation controllers and graph writes of other models answer 403 with
  `confirmationRequired` without it, which the admin answers by asking for the
  password. This applies to users of the logged-in user's own model, e.g.
  admins changing admins, not to admins changing customers, and `authorize`
  decides who may change whom. See [Confirmed access](guide/server/controllers.md#confirmed-access).
- The `order` query parameter only takes the visible properties of the model,
  and answers 400 for unknown, `hidden` and `computed` ones.
- With `app.proxy`, `ctx.ip` is the last `X-Forwarded-For` entry, which the
  closest proxy adds, and `ctx.ips` only holds that one. Behind several proxies
  in a row, it's the address of the proxy before the last one.
- Request logs, also the `req` of JSON logs, leave out query strings.
- Session cookies whose session no longer exists start a new session with a
  new id, and sessions that end while a parallel request runs stay ended.
- `app.start()` rejects when the server can't listen, and emits `after:stop`
  when the start fails, so apps' `after:stop` hooks also run then.
- `'post password-reset'` sends at most one email per user and minute, kept in
  memory per process.
