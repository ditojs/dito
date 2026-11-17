# @ditojs/ui

```js
import { DitoButton, DitoDatePicker } from '@ditojs/ui'
import '@ditojs/ui/style.css'
```

Vue 3 components and helpers that the admin is built with, for use in custom
admin components and in other Vue apps. `vue` is a peer dependency.

The components of `@ditojs/admin` itself are internal; these are the public
ones.

## Entry points

| Entry point               | Description                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ditojs/ui`              | The components and helpers, built as an ES module. Vue and `@ditojs/utils` stay external.                                                            |
| `@ditojs/ui/style.css`    | The built styles of all components.                                                                                                                  |
| `@ditojs/ui/imports.scss` | The SCSS variables, functions, mixins and placeholders, for styling your own components to match. See [Styles](#styles).                             |
| `@ditojs/ui/src`          | The source, for builds that compile Vue single-file components with Pug templates and SCSS themselves, as the admin does. Imports the styles itself. |

There are no TypeScript types for this package.

Inside custom admin components, the admin's styles already include those of
`@ditojs/ui`, so `style.css` isn't needed there.

## Contents

| Section                   | Exports                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Components](#components) | `DitoButton`, `DitoMenuButton`, `DitoIcon`, `DitoInput`, `DitoSwitch`, `DitoPagination`, `DitoProgress`, `DitoDatePicker`, `DitoTimeInput`, `TransitionHeight` |
| [Helpers](#helpers)       | `getVerbButtonAttributes()`, `addEvents()`, `hasVNodeContent()`, `hasSlotContent()`, `raw()`                                                                   |
| [Styles](#styles)         | CSS classes, SCSS variables, mixins, functions and icons                                                                                                       |

## Example

A custom admin component that lets editors pick a publication date and mark a
book as featured:

```vue
<template>
  <div class="bookshop-publishing">
    <DitoDatePicker
      v-model="publishedAt"
      placeholder="Publication date"
    />
    <DitoSwitch
      v-model="featured"
      :labels="{ checked: 'featured', unchecked: 'regular' }"
    />
    <DitoButton
      verb="clear"
      text="Reset"
      @click="reset"
    />
  </div>
</template>

<script>
import { DitoButton, DitoDatePicker, DitoSwitch } from '@ditojs/ui'

export default {
  components: { DitoButton, DitoDatePicker, DitoSwitch },

  data() {
    return {
      publishedAt: null,
      featured: false
    }
  },

  methods: {
    reset() {
      this.publishedAt = null
      this.featured = false
    }
  }
}
</script>
```

## Components

```js
import { DitoButton, DitoMenuButton } from '@ditojs/ui'
```

All components are Vue 3 components with the Options API. Values are bound
with `v-model` (`modelValue`), `v-model:show` or `v-model:page`. Components
that wrap a native element pass the attributes they don't declare, including
listeners, on to it, as noted per component.

### DitoButton

Renders a button, by default a `<button type="button">`, so that it doesn't
submit forms by accident.

| Prop       | Type                  | Default    | Description                                                                                                                                                                                                                |
| ---------- | --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `as`       | `string \| Component` | `'button'` | The element or component to render, e.g. `'a'` or `RouterLink` for links styled as buttons.                                                                                                                                |
| `type`     | `string`              | `'button'` | The `type` of native buttons.                                                                                                                                                                                              |
| `text`     | `string`              | `null`     | The text of the button.                                                                                                                                                                                                    |
| `title`    | `string`              | `null`     | The tooltip.                                                                                                                                                                                                               |
| `disabled` | `boolean`             | `false`    | Disables the button. Elements other than `<button>` get `aria-disabled`, `tabindex="-1"` and `.dito-button--disabled`, and their clicks are stopped before they reach other handlers, e.g. the navigation of `RouterLink`. |
| `verb`     | `string`              | `null`     | The action the button performs, e.g. `'delete'`. Adds `.dito-button--{verb}`, and labels a button without `text` with `title` and `aria-label`, e.g. `'Delete'`.                                                           |
| `subject`  | `string`              | `null`     | What the verb acts on, added to the label: `verb="add"` with `subject="Chapter"` is labelled `'Add Chapter'`.                                                                                                              |

| Slot               | Description                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| default            | The content, after `text` if both are given.                                                                                                 |
| `prefix`, `suffix` | Content before and after the text, e.g. icons. With either, the button lays out prefix, text and suffix in a grid (`.dito-button--affixed`). |

All other attributes and listeners, e.g. `@click` or `to` for `RouterLink`, go
to the rendered element.

```vue
<DitoButton text="Save" type="submit" />
<DitoButton verb="delete" subject="Review" @click="deleteReview" />
<DitoButton :as="RouterLink" to="/books" text="All books" />
```

The admin styles common verbs, e.g. `create`, `add`, `edit`, `delete` and
`remove`, with icons or labels; `@ditojs/ui` itself only adds the class.

### DitoMenuButton

A button that opens a menu of items next to it, below by default, and emits
`select` with the chosen item. It is built on
[`reka-ui`'s `DropdownMenu`](https://reka-ui.com/docs/components/dropdown-menu),
which handles mouse and keyboard: Enter, Space and ArrowDown open the menu,
the arrow keys, Home and End move between items, Escape closes it, and Tab
leaves it.

| Prop       | Type                                        | Default    | Description                                                                                                                   |
| ---------- | ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `items`    | `Array<{ value, label, icon?, disabled? }>` | required   | The menu items. Items with an `icon` from the [icon set](#icons) show it instead of their `label`, which becomes their title. |
| `side`     | `string`                                    | `'bottom'` | The side of the button the menu opens on: `'top'`, `'right'`, `'bottom'` or `'left'`.                                         |
| `align`    | `string`                                    | `'start'`  | The edge of the button the menu aligns with: `'start'`, `'center'` or `'end'`.                                                |
| `disabled` | `boolean`                                   | `false`    | Disables the button.                                                                                                          |

| Event    | Payload | Description                 |
| -------- | ------- | --------------------------- |
| `select` | `item`  | An enabled item was chosen. |

The default slot is the content of the button. All other attributes, e.g.
`class`, `text` or `verb`, go to the inner [`DitoButton`](#ditobutton).

```vue
<DitoMenuButton
  text="Export"
  :items="[
    { value: 'csv', label: 'CSV' },
    { value: 'pdf', label: 'PDF', disabled: !hasPdfExport }
  ]"
  @select="item => exportOrders(item.value)"
/>
```

### DitoIcon

An icon from the [icon set](#icons), rendered as
`<i class="dito-icon dito-icon--{name}">` and colored with `currentColor`.

| Prop       | Type      | Default  | Description                         |
| ---------- | --------- | -------- | ----------------------------------- |
| `name`     | `string`  | required | The icon's name, e.g. `'calendar'`. |
| `disabled` | `boolean` | `false`  | Adds `.dito-icon--disabled`.        |

```vue
<DitoButton text="Upload cover">
  <template #prefix><DitoIcon name="upload" /></template>
</DitoButton>
```

### DitoInput

A text input with optional content before and after it, inside a
`.dito-input` wrapper. Clicking the affixes focuses the input.

| Prop                                | Type               | Default  | Description                                                                                       |
| ----------------------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `modelValue`                        | `string \| number` | `null`   | The value (`v-model`).                                                                            |
| `type`                              | `string`           | `'text'` | The input type.                                                                                   |
| `id`, `name`, `placeholder`         | `string`           | `null`   | Set on the input.                                                                                 |
| `title`                             | `string`           | `null`   | Set as `title` and `aria-label` of the input.                                                     |
| `disabled`, `readonly`, `autofocus` | `boolean`          | `false`  | Set on the input.                                                                                 |
| `focused`                           | `boolean`          | `false`  | Shows the input as focused (`.dito-input--focus`), e.g. while a popup that belongs to it is open. |
| `autocomplete`                      | `string`           | `'off'`  | Set on the input.                                                                                 |

| Event               | Payload | Description        |
| ------------------- | ------- | ------------------ |
| `update:modelValue` | `value` | The value changed. |

| Slot               | Description                         |
| ------------------ | ----------------------------------- |
| `prefix`, `suffix` | Content before and after the input. |

| Method              | Description                 |
| ------------------- | --------------------------- |
| `focus()`, `blur()` | Focuses or blurs the input. |

`class` goes to the wrapper; all other attributes and listeners, e.g. `min`,
`max`, `step` or `@keydown`, go to the input. Without a `size` attribute, the
input is sized to fit the longer of `min` and `max`.

```vue
<DitoInput v-model="quantity" type="number" min="1" max="99" />
```

### DitoSwitch

An on/off switch, built on `reka-ui`'s `Switch`: a button with `role="switch"`
and `[data-state='checked']` or `[data-state='unchecked']`. Inside a form, a
`name` adds a hidden checkbox that submits with it. Space and Enter toggle it,
so Enter on a switch doesn't submit a dialog.

| Prop         | Type                                | Default | Description                                                                                                                        |
| ------------ | ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `modelValue` | `boolean`                           | `false` | Whether it's on (`v-model`). Without it, the switch keeps its own state.                                                           |
| `id`, `name` | `string`                            | `null`  | Set on the switch.                                                                                                                 |
| `disabled`   | `boolean`                           | `false` | Disables the switch.                                                                                                               |
| `labels`     | `boolean \| { checked, unchecked }` | `false` | Shows a label inside the switch: `true` shows `'on'` and `'off'`, an object its own texts. The switch grows with the longer label. |

| Event               | Payload   | Description             |
| ------------------- | --------- | ----------------------- |
| `update:modelValue` | `checked` | The switch was toggled. |

| Slot                   | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `checked`, `unchecked` | Replace the label texts, when `labels` is set. |

| Method    | Description         |
| --------- | ------------------- |
| `focus()` | Focuses the switch. |

`class` goes to the `.dito-switch` element around it; all other attributes go to
the switch, `.dito-switch__control`.

```vue
<DitoSwitch
  v-model="book.inStock"
  :labels="{ checked: 'in stock', unchecked: 'sold out' }"
/>
```

### DitoPagination

Page navigation for a number of items, built on `reka-ui`'s `Pagination`: the
range shown (`11 – 20 / 95`), previous and next buttons, and numbered page
buttons, with the first and last page and ellipses for the pages left out. The
current page's button has `[data-selected]`.

| Prop        | Type      | Default | Description                                                                             |
| ----------- | --------- | ------- | --------------------------------------------------------------------------------------- |
| `total`     | `number`  | `0`     | The number of items.                                                                    |
| `page`      | `number`  | `1`     | The current page, starting at 1 (`v-model:page`).                                       |
| `pageSize`  | `number`  | `10`    | The number of items per page. When it changes, a page beyond the last becomes the last. |
| `showTotal` | `boolean` | `true`  | Shows the range and total.                                                              |

| Event         | Payload | Description              |
| ------------- | ------- | ------------------------ |
| `update:page` | `page`  | Another page was chosen. |

The page buttons are only shown with more than one page.

```vue
<DitoPagination v-model:page="page" :total="orderCount" :pageSize="20" />
```

### DitoProgress

A progress bar, rendered as a native `<progress>` element. The admin's
[`progress`](./admin/schemas.md#progress) type shows it too.

| Prop         | Type     | Default  | Description                                              |
| ------------ | -------- | -------- | -------------------------------------------------------- |
| `value`      | `number` | `null`   | The progress. Without a value, the bar is indeterminate. |
| `min`, `max` | `number` | `0`, `1` | The values of empty and full.                            |

All attributes go to the `<progress>` element, e.g. `aria-label`.

```vue
<DitoProgress :value="job.processed" :max="job.total" aria-label="Import" />
```

### DitoDatePicker

A date field with a calendar in a popup, built on
[`reka-ui`'s `DatePicker`](https://reka-ui.com/docs/components/date-picker).
The field edits each part of the date on its own, in the order of the locale,
and the button next to it opens the calendar, whose header picks the month and
year from lists. The values are dates of
[`@internationalized/date`](https://react-spectrum.adobe.com/internationalized/date/),
e.g. `CalendarDate`, or `CalendarDateTime` with a `granularity` finer than
`day`, which also edits the time.

| Prop                   | Type                                      | Default   | Description                                                     |
| ---------------------- | ----------------------------------------- | --------- | --------------------------------------------------------------- |
| `modelValue`           | `DateValue`                               | `null`    | The date (`v-model`).                                           |
| `id`                   | `string`                                  | –         | The id that labels point to with `for`.                         |
| `granularity`          | `'day' \| 'hour' \| 'minute' \| 'second'` | `'day'`   | The smallest part that the field edits.                         |
| `hourCycle`            | `12 \| 24`                                | –         | The hours of the time, or else those of the locale.             |
| `locale`               | `string`                                  | `'en-US'` | The locale of the field and the calendar.                       |
| `minValue`, `maxValue` | `DateValue`                               | –         | The range of dates, which also limits the years of the list.    |
| `disabled`, `readonly` | `boolean`                                 | `false`   | Disables the field, or keeps its value from being edited.       |
| `placeholder`          | `string`                                  | `null`    | Shown instead of the empty parts while the field isn't focused. |

| Slot               | Description                                     |
| ------------------ | ----------------------------------------------- |
| `prefix`, `suffix` | Content before and after the parts of the date. |

All other attributes go to the field, e.g. `aria-label`, and `aria-invalid`
shows errors, as in [`DitoInput`](#ditoinput). The field emits `update:open`
when the calendar opens or closes, and looks focused while it is open. Methods:
`focus()` and `blur()`.

```vue
<DitoDatePicker
  v-model="book.publishedOn"
  locale="en-GB"
/>
```

### DitoTimeInput

A time field, built on
[`reka-ui`'s `TimeField`](https://reka-ui.com/docs/components/time-field), which
edits each part of the time on its own. The values are `Time`, or dates with a
time of `@internationalized/date`, whose date it keeps. Its only prop of its own
is `locale`, `'en-US'` by default; all of `TimeFieldRoot`'s props fall through,
e.g. `modelValue` (`v-model`), `granularity`, `hourCycle` and
`defaultPlaceholder`, the value that typing starts from without a value.

Slots: `prefix` and `suffix`, as in [`DitoDatePicker`](#ditodatepicker).
Methods: `focus()` and `blur()`. With `aria-invalid`, the field shows errors,
as `DitoInput` does.

### TransitionHeight

A transition that animates the height of its content when it's shown or
hidden, e.g. with `v-if` or `v-show`.

| Prop      | Type      | Default | Description                                             |
| --------- | --------- | ------- | ------------------------------------------------------- |
| `enabled` | `boolean` | `true`  | Without it, the content is rendered without transition. |

```vue
<TransitionHeight>
  <div v-if="showDetails" class="bookshop-order-details">…</div>
</TransitionHeight>
```

## Helpers

```js
import { addEvents, hasSlotContent } from '@ditojs/ui'
```

The helpers the components are built with, for custom components that work
the same way.

### Buttons

#### getVerbButtonAttributes()

```js
getVerbButtonAttributes({ verb, subject = null, text = null })
```

Returns the attributes of a button that performs `verb`, as
[`DitoButton`](#ditobutton) sets them: the class
`dito-button--{verb}`, and, without `text`, a `title` and `aria-label` from
the labelized verb and the subject.

```js
getVerbButtonAttributes({ verb: 'add', subject: 'Chapter' })
// {
//   class: 'dito-button--add',
//   title: 'Add Chapter',
//   'aria-label': 'Add Chapter'
// }
```

### Events

#### addEvents()

```js
addEvents(targets, events, { signal } = {})
```

Adds the handlers of `events`, an object of event types and handlers, to one
or more targets (an element, an array or a `NodeList`), and returns
`{ remove() }` to remove them all. With an `AbortSignal`, they're also
removed when it aborts, and not added if it already has.

```js
const events = addEvents(window, {
  keydown: onKeyDown,
  resize: onResize
})
// later:
events.remove()
```

### Vue

#### hasVNodeContent()

```js
hasVNodeContent(vnode)
```

Returns whether a VNode or an array of them renders anything other than
comments, e.g. those of a `v-if` that is false.

#### hasSlotContent()

```js
hasSlotContent(slot, props = {})
```

Renders a slot with `props` and returns whether it has content, see
`hasVNodeContent()`. `slot` is a slot function, e.g. `this.$slots.footer`, or
the name of a slot of the current component, which only works inside
`setup()`.

```js
hasSlotContent(this.$slots.footer, { count: 0 })
```

#### raw()

```js
raw(value)
```

Wraps `value` in an object `{ value }` that Vue never makes reactive, to keep
large or foreign objects, e.g. editor instances, in reactive state without
deep reactivity.

## Styles

```scss
@import '@ditojs/ui/imports.scss';
```

`@ditojs/ui/style.css` holds the styles of all components. Custom components
can match them through `@ditojs/ui/imports.scss`, which only defines
variables, functions, mixins and placeholders, and emits no CSS by itself. In
custom admin components, use `@ditojs/admin/imports.scss`, which includes it.

### CSS classes

The components follow BEM: blocks are named `.dito-{block}`, their elements
`.dito-{block}__{element}`, and modifiers, including states,
`.dito-{block}--{modifier}`, e.g. `.dito-button--disabled`,
`.dito-input--focus` or `.dito-menu-button__item--icon`.

Besides the classes of the components, the styles define:

| Class           | Description                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.dito-buttons` | A row of buttons. Modifiers: `--round` for round buttons, `--small` for tighter spacing, `--toolbar` for toolbar buttons. Elements: `__group` to group buttons with a gap between groups. |
| `.dito-chevron` | A chevron that rotates when `.dito-chevron--open`, e.g. in front of collapsible titles.                                                                                                   |
| `.dito-resize`  | A resize handle in the bottom-right corner of a positioned element.                                                                                                                       |

### Variables

The variables of `_settings.scss`, with these groups:

| Group               | Variables                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colors              | `$color-dark-offset`, `$color-light-offset` (how much darker the dark and light greys are), `$color-black`, `$color-darkest`, `$color-darker`, `$color-dark`, `$color-grey`, `$color-light`, `$color-lighter`, `$color-lightest`, `$color-white`, `$color-active`, `$color-highlight`, `$color-success`, `$color-warning`, `$color-error`, `$color-text`, `$color-text-inverted`, `$color-placeholder`, `$color-disabled`, `$color-shadow` |
| Sizes               | `$input-height`, `$input-height-factor`, `$input-padding`, `$input-padding-ver`, `$input-padding-hor`, `$popup-margin`, `$chevron-indent`                                                                                                                                                                                                                                                                                                  |
| Borders and shadows | `$border-radius`, `$border-color`, `$border-width`, `$border-style`, `$shadow-window`, `$shadow-focus`                                                                                                                                                                                                                                                                                                                                     |
| Buttons             | `$button-color`, `$button-color-hover`, `$button-color-active`, `$button-color-active-hover`, `$button-color-active-border`, `$button-round-padding`, `$button-round-padding-ver`, `$button-round-padding-hor`                                                                                                                                                                                                                             |
| Selects             | `$select-arrow-width`, `$select-arrow-size`, `$select-arrow-bottom`, `$select-arrow-right`                                                                                                                                                                                                                                                                                                                                                 |
| Other               | `$z-index-popup`, `$ease-out-quart`, `$ease-out-circ`, `$ease-out-elastic`, `$math-sqrt2`                                                                                                                                                                                                                                                                                                                                                  |

### Mixins

| Mixin                                                                       | Description                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus-ring($color: null)`                                                  | The focus ring of keyboard-focused elements, drawn as a shadow that doesn't affect the layout. Pass `$color` on backgrounds of `$color-active`.                                                                                         |
| `arrow($size: $select-arrow-size, $direction: 'down', $position: absolute)` | A rotated border arrow, e.g. for selects, pointing `'up'`, `'down'`, `'left'` or `'right'`.                                                                                                                                             |
| `ellipsis`                                                                  | Cuts text off with an ellipsis on one line.                                                                                                                                                                                             |
| `user-select($select: none)`                                                | Sets `user-select` and `-webkit-user-drag`.                                                                                                                                                                                             |
| `user-drag($drag: none)`                                                    | Sets `-webkit-user-drag`.                                                                                                                                                                                                               |
| `reset`                                                                     | Resets the default styles of headings, form elements, links, lists and tables inside the element.                                                                                                                                       |
| `browser-query($browsers)`                                                  | Applies its content only in the given browsers, by the `data-agent-browser`, `data-agent-platform` and `data-agent-version` attributes that the admin sets on `.dito-root`. Takes names or maps of `browser`, `platform` and `version`. |

### Placeholders

Use with `@extend`:

| Placeholder                              | Description                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `%field`                                 | Border, padding and background of fields.                                                                              |
| `%field--has-errors`, `%field--disabled` | The looks of fields with errors and of disabled fields, for the block's own `--has-errors` and `--disabled` modifiers. |
| `%input`                                 | `%field` with placeholder and focus styles of text inputs.                                                             |
| `%input--has-errors`                     | `%field--has-errors` that also shows while the input has focus.                                                        |
| `%input--borderless`                     | Height and alignment of inputs without border, e.g. checkboxes, to line up with bordered ones.                         |
| `%button--disabled`                      | The disabled look of buttons.                                                                                          |
| `%icon--{name}`                          | One of the [icons](#icons), as a mask in `currentColor`, e.g. in a `::before`.                                         |
| `%popup`                                 | The panel of popups and menus: border, radius, background, shadow, `z-index` and enter animation.                      |

### Functions

| Function                                                               | Description                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `rounded($value, $precision: 1)`                                       | Rounds to `$precision` decimals.                               |
| `string-replace($string, $search, $replace: null, $replaceAll: false)` | Replaces the first or all occurrences of `$search`.            |
| `string-to-list($string, $separator: ' ', $startAt: 1)`                | Splits a string into a list, from the character at `$startAt`. |
| `nth-selector($selector, $index)`, `last-selector($selector)`          | Returns a part of a compound selector.                         |

### Icons

The icons are available as [`DitoIcon`](#ditoicon) with their
`name`, as the CSS classes `.dito-icon--{name}`, and in SCSS as the
placeholders `%icon--{name}` and the list `$icons`:

`add`, `align-center`, `align-justify`, `align-left`, `align-right`,
`alternate`, `archive-download`, `archive-upload`, `arrow`, `at-sign`,
`blockquote`, `bold`, `bookmark`, `bullet-list`, `calendar`, `chevron`,
`chevrons`, `clear`, `clock`, `code-block`, `code`, `command`, `copy`,
`credit-card`, `crop`, `dollar-sign`, `drag`, `edit`, `ellipsis`, `footnotes`,
`hash`, `heading-1`, `heading-2`, `heading-3`, `heart`, `home`,
`horizontal-rule`, `image`, `info`, `italic`, `link`, `lock`, `mail`, `menu`,
`ordered-list`, `paperclip`, `paragraph`, `paste`, `percent`, `redo`, `refresh`,
`remove`, `resize`, `search`, `settings`, `sidebar`, `small`, `strike`,
`subscript`, `superscript`, `tag`, `trash`, `type`, `underline`, `undo`,
`upload`.

```scss
@import '@ditojs/ui/imports.scss';

.bookshop-wishlist-button::before {
  @extend %icon--heart;
}
```

### Transitions

The styles include the transition `dito-fade` and the animation
`dito-slide-enter` of popups, and `TransitionHeight` uses the transition
`dito-height`.
