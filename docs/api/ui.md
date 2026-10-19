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

| Entry point | Description |
| ----------- | ----------- |
| `@ditojs/ui` | The components and helpers, built as an ES module. Vue and `@ditojs/utils` stay external. |
| `@ditojs/ui/style.css` | The built styles of all components. |
| `@ditojs/ui/imports.scss` | The SCSS variables, functions, mixins and placeholders, for styling your own components to match. See [Styles](#styles). |
| `@ditojs/ui/src` | The source, for builds that compile Vue single-file components with Pug templates and SCSS themselves, as the admin does. Imports the styles itself. |

There are no TypeScript types for this package.

Inside custom admin components, the admin's styles already include those of
`@ditojs/ui`, so `style.css` isn't needed there.

## Contents

| Section | Exports |
| ------- | ------- |
| [Components](#components) | `DitoButton`, `DitoMenuButton`, `DitoIcon`, `DitoInput`, `DitoSwitch`, `DitoPagination`, `DitoProgress`, `DitoTrigger`, `DitoCalendar`, `DitoDatePicker`, `DitoTimePicker`, `DitoDateTimePicker`, `TransitionHeight` |
| [Helpers](#helpers) | `getVerbButtonAttributes()`, `describeDate()`, `alterDate()`, `stepDate()`, `parseDate()`, `getDatePartAtPosition()`, `addEvents()`, `combineEvents()`, `getKey()`, `getKeyNavigation()`, `getSelection()`, `setSelection()`, `hasVNodeContent()`, `hasSlotContent()`, `raw()` |
| [Styles](#styles) | CSS classes, SCSS variables, mixins, functions and icons |

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
import { DitoButton, DitoTrigger } from '@ditojs/ui'
```

All components are Vue 3 components with the Options API. Values are bound
with `v-model` (`modelValue`), `v-model:show` or `v-model:page`. Components
that wrap a native element pass the attributes they don't declare, including
listeners, on to it, as noted per component.

### DitoButton

Renders a button, by default a `<button type="button">`, so that it doesn't
submit forms by accident.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `as` | `string \| Component` | `'button'` | The element or component to render, e.g. `'a'` or `RouterLink` for links styled as buttons. |
| `type` | `string` | `'button'` | The `type` of native buttons. |
| `text` | `string` | `null` | The text of the button. |
| `title` | `string` | `null` | The tooltip. |
| `disabled` | `boolean` | `false` | Disables the button. Elements other than `<button>` get `aria-disabled`, `tabindex="-1"` and `.dito-button--disabled`, and their clicks are stopped before they reach other handlers, e.g. the navigation of `RouterLink`. |
| `verb` | `string` | `null` | The action the button performs, e.g. `'delete'`. Adds `.dito-button--{verb}`, and labels a button without `text` with `title` and `aria-label`, e.g. `'Delete'`. |
| `subject` | `string` | `null` | What the verb acts on, added to the label: `verb="add"` with `subject="Chapter"` is labelled `'Add Chapter'`. |

| Slot | Description |
| ---- | ----------- |
| default | The content, after `text` if both are given. |
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

A button that opens a menu of items, and emits `select` with the chosen item.
It can be used with mouse and keyboard: Enter, Space and the arrow keys open
the menu, the arrow keys, Home and End move between items, Escape closes it.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `items` | `Array<{ value, label, icon?, disabled? }>` | required | The menu items. Items with an `icon` from the [icon set](#icons) show it instead of their `label`, which becomes their title. |
| `placement` | `string` | `'bottom'` | Where the menu opens, see [`DitoTrigger`](#ditotrigger). |
| `cover` | `boolean` | `true` | Opens the menu over the button, like native menus. |
| `floating` | `boolean` | `false` | Opens the menu below the button as a separate panel with a tip pointing at the button, overriding `cover`. |
| `offset` | `boolean` | `false` | Opens the menu one item padding below the top of the button, e.g. to line up with the text of a taller button. |
| `disabled` | `boolean` | `false` | Disables the button. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `select` | `item` | An enabled item was chosen. |

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

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `name` | `string` | required | The icon's name, e.g. `'calendar'`. |
| `disabled` | `boolean` | `false` | Adds `.dito-icon--disabled`. |

```vue
<DitoButton text="Upload cover">
  <template #prefix><DitoIcon name="upload" /></template>
</DitoButton>
```

### DitoInput

A text input with optional content before and after it, inside a
`.dito-input` wrapper. Clicking the affixes focuses the input.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `modelValue` | `string \| number` | `null` | The value (`v-model`). |
| `type` | `string` | `'text'` | The input type. |
| `id`, `name`, `placeholder` | `string` | `null` | Set on the input. |
| `title` | `string` | `null` | Set as `title` and `aria-label` of the input. |
| `disabled`, `readonly`, `autofocus` | `boolean` | `false` | Set on the input. |
| `focused` | `boolean` | `false` | Shows the input as focused (`.dito-input--focus`), e.g. while a popup that belongs to it is open. |
| `autocomplete` | `string` | `'off'` | Set on the input. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:modelValue` | `value` | The value changed. |

| Slot | Description |
| ---- | ----------- |
| `prefix`, `suffix` | Content before and after the input. |

| Method | Description |
| ------ | ----------- |
| `focus()`, `blur()` | Focuses or blurs the input. |

`class` goes to the wrapper; all other attributes and listeners, e.g. `min`,
`max`, `step` or `@keydown`, go to the input. Without a `size` attribute, the
input is sized to fit the longer of `min` and `max`.

```vue
<DitoInput v-model="quantity" type="number" min="1" max="99" />
```

### DitoSwitch

An on/off switch, rendered as a checkbox with `role="switch"`.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `modelValue` | `boolean` | `false` | Whether it's on (`v-model`). |
| `id`, `name` | `string` | `null` | Set on the checkbox. |
| `disabled` | `boolean` | `false` | Disables the switch. |
| `labels` | `boolean \| { checked, unchecked }` | `false` | Shows a label inside the switch: `true` shows `'on'` and `'off'`, an object its own texts. The switch grows with the longer label. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:modelValue` | `checked` | The switch was toggled. |
| `change` | `checked` | Same, for `@change` handlers. |

| Slot | Description |
| ---- | ----------- |
| `checked`, `unchecked` | Replace the label texts, when `labels` is set. |

| Method | Description |
| ------ | ----------- |
| `focus()` | Focuses the checkbox. |

`class` goes to the switch; all other attributes go to the checkbox.

```vue
<DitoSwitch
  v-model="book.inStock"
  :labels="{ checked: 'in stock', unchecked: 'sold out' }"
/>
```

### DitoPagination

Page navigation for a number of items: the range shown (`11 – 20 / 95`),
previous and next buttons, and numbered page buttons, with ellipsis buttons
that jump ten pages.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `total` | `number` | `0` | The number of items. |
| `page` | `number` | `1` | The current page, starting at 1 (`v-model:page`). |
| `pageSize` | `number` | `10` | The number of items per page. When it changes, a page beyond the last becomes the last. |
| `showTotal` | `boolean` | `true` | Shows the range and total. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:page` | `page` | Another page was chosen. |

The page buttons are only shown with more than one page.

```vue
<DitoPagination v-model:page="page" :total="orderCount" :pageSize="20" />
```

### DitoProgress

A progress bar, rendered as a native `<progress>` element. The admin's
[`progress`](./admin/schemas.md#progress) type shows it too.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `value` | `number` | `null` | The progress. Without a value, the bar is indeterminate. |
| `min`, `max` | `number` | `0`, `1` | The values of empty and full. |

All attributes go to the `<progress>` element, e.g. `aria-label`.

```vue
<DitoProgress :value="job.processed" :max="job.total" aria-label="Import" />
```

### DitoTrigger

Shows a popup next to a trigger element, positioned absolutely and kept in the
window if possible. The base of `DitoMenuButton` and the pickers.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `trigger` | `string` | `'click'` | What shows the popup: `'click'` toggles it, `'hover'` shows it while the mouse is over the trigger or the popup, `'focus'` while an input or textarea in the trigger or the popup has the focus. `'always'` adds no handlers; the popup follows `show`. |
| `show` | `boolean` | `false` | Whether the popup is shown (`v-model:show`). |
| `placement` | `string` | `'bottom'` | The side of the trigger the popup appears on, `'top'`, `'bottom'`, `'left'` or `'right'`, optionally followed by the edge it aligns with, e.g. `'bottom-left'` or `'right-top'`. Adds `.dito-popup--{placement}`. |
| `transition` | `string` | `'slide'` | The popup's transition: `'slide'`, `'fade'` or `'zoom'`, or `null` to show it at once. |
| `target` | `string \| HTMLElement` | `null` | The element the popup is positioned at, instead of the trigger: an element, or `'trigger'` or `'popup'` for these parts of the trigger itself. |
| `disabled` | `boolean` | `false` | Prevents showing the popup. Adds `.dito-trigger--disabled`. |
| `keepInView` | `boolean` | `true` | Flips the popup to the other side or edge if it doesn't fit in the window and there's more room there. |
| `matchTargetWidth` | `boolean` | `true` | Gives the popup's first child the width of the target. |
| `cover` | `boolean` | `false` | Places the popup over the trigger instead of next to it. |
| `hideWhenClickOutside` | `boolean` | `true` | Hides the popup on clicks outside trigger, target and popup, and when the window loses focus. |
| `alwaysShow` | `boolean` | `false` | Shows the popup permanently. |
| `hideDelay` | `number` | `0` | With `trigger: 'hover'`, the milliseconds to wait before hiding. |
| `customClass` | `string` | `null` | An additional class of the popup. |
| `zIndex` | `number` | `0` | A `z-index` for the popup, instead of the default one. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:show` | `show` | The popup was shown or hidden. |

| Slot | Description |
| ---- | ----------- |
| `trigger` | The trigger. |
| `popup` | The popup's content, only rendered while it's shown. |

| Method | Description |
| ------ | ----------- |
| `open()`, `close()`, `toggle()` | Shows or hides the popup. |

Escape hides the popup, and doesn't reach elements around the trigger, e.g.
dialogs.

```vue
<DitoTrigger trigger="hover" placement="right-top">
  <template #trigger>
    <DitoIcon name="info" />
  </template>
  <template #popup>
    <p class="bookshop-hint">Shipped within 2 days.</p>
  </template>
</DitoTrigger>
```

### DitoCalendar

A month calendar to choose a day, with views to choose month and year. Weeks
start on Sunday. Without a value, it shows today.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `modelValue` | `Date` | `null` | The selected date (`v-model`). |
| `locale` | `string` | `'en-US'` | The locale of month and weekday names. |
| `mode` | `string` | `'day'` | The view: `'day'`, `'month'` or `'year'`. |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:modelValue` | `date` | A day, month or year was selected. Choosing a day keeps the time of the current value. |
| `select` | – | A day was chosen, e.g. to close a popup. |

In the day view, the arrow keys move between days, Page Up and Page Down
between months, with Shift between years, and Home and End to the first and
last day of the month.

### DitoDatePicker

An input for a date, with a [`DitoCalendar`](#ditocalendar) in a popup. Dates
can be typed in the format of the locale; the up and down arrow keys open the
popup, and then step the day, month or year at the caret. The value only
changes for valid dates.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `modelValue` | `Date` | `null` | The date (`v-model`). |
| `locale` | `string` | `'en-US'` | The locale of the text and the calendar. |
| `format` | `object` | `{ date: defaultFormats.date, time: false }` | The `date` and `time` options of [`format()`](./utils.md#format) for the text. |
| `placeholder` | `string` | `null` | The input's placeholder. |
| `disabled` | `boolean` | `false` | Disables input and popup. |
| `show` | `boolean` | `false` | Whether the popup is shown (`v-model:show`). |
| `placement` | `string` | `'bottom-left'` | See [`DitoTrigger`](#ditotrigger). |
| `transition` | `string` | `'slide'` | See [`DitoTrigger`](#ditotrigger). |
| `target` | `string \| HTMLElement` | `'trigger'` | See [`DitoTrigger`](#ditotrigger). |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `update:modelValue` | `date` | The date changed, while typing or choosing. |
| `change` | `date` | The edit is done: the popup closed, the input lost focus or Enter was pressed, after the date changed. |
| `update:show` | `show` | The popup was shown or hidden. |
| `focus`, `blur` | – | The input got the focus or the popup opened, and both are gone again. |

| Slot | Description |
| ---- | ----------- |
| `prefix`, `suffix` | Content before and after the text, inside the input. |
| `trigger` | Replaces the input, e.g. with a button. |

| Method | Description |
| ------ | ----------- |
| `focus()`, `blur()` | Focuses or blurs the input. |

All other attributes go to the [`DitoInput`](#ditoinput): `class` to its
wrapper, the rest to the native input.

```vue
<DitoDatePicker
  v-model="book.publishedAt"
  locale="en-GB"
  :format="{ date: { month: 'short' }, time: false }"
  @change="save"
/>
```

### DitoTimePicker

An input for a time, with a panel to choose hours, minutes and seconds in a
popup. Typed digits overwrite the digits at the caret, keeping the format.

Props, events, slots and methods are those of
[`DitoDatePicker`](#ditodatepicker), except that `format` defaults to
`{ time: defaultFormats.time, date: false }`.

```vue
<DitoTimePicker
  v-model="shop.opensAt"
  :format="{ time: { second: false } }"
/>
```

### DitoDateTimePicker

An input for date and time, with a calendar in the popup while the caret is in
the date, and the time panel while it's in the time.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `modelValue` | `Date` | `null` | The date and time (`v-model`). |
| `locale` | `string` | `'en-US'` | The locale. |
| `format` | `object` | `null` | `date` and `time` options of [`format()`](./utils.md#format), merged deeply over the defaults with a short month, e.g. `'Oct 13, 2026, 02:05:00 PM'`. |
| `placeholder` | `string` | `null` | The input's placeholder. |
| `disabled` | `boolean` | `false` | Disables input and popup. |
| `show` | `boolean` | `false` | Whether the popup is shown (`v-model:show`). |
| `placement` | `string` | `null` | See [`DitoTrigger`](#ditotrigger). Without it, the popup is placed `'bottom-left'` for the calendar and `'bottom-right'` for the time panel. |
| `transition` | `string` | `'slide'` | See [`DitoTrigger`](#ditotrigger). |
| `target` | `string \| HTMLElement` | `'trigger'` | See [`DitoTrigger`](#ditotrigger). |

Events: `update:modelValue`, `change`, `update:show`, `focus` and `blur`, as in
[`DitoDatePicker`](#ditodatepicker). Slots: `prefix` and `suffix`. Methods:
`focus()` and `blur()`. All other attributes go to the
[`DitoInput`](#ditoinput).

```vue
<DitoDateTimePicker
  v-model="order.shippedAt"
  :format="{ time: { second: false } }"
/>
```

### TransitionHeight

A transition that animates the height of its content when it's shown or
hidden, e.g. with `v-if` or `v-show`.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `enabled` | `boolean` | `true` | Without it, the content is rendered without transition. |

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

### Dates

All date helpers work with local time.

#### describeDate()

```js
describeDate(date)
```

Returns the parts of `date` as
`{ year, month, day, hour, minute, second, millisecond }`, with `month`
counted from `0` like in `Date`. Without a date, all parts are `0`.

#### alterDate()

```js
alterDate(date, overrides = {})
```

Returns a new `Date` with the parts of `date` replaced by `overrides`, e.g.
`{ hour: 0, minute: 0 }`. Out-of-range parts roll over like in `new Date()`:
January 31, 2026 with `{ month: 1 }` becomes March 3.

#### stepDate()

```js
stepDate(date, partName, step)
```

Returns a new `Date` with the part `partName`, e.g. `'month'`, changed by
`step`. Stepping the year or month keeps the day within the new month:
January 31 plus one month is the last day of February.

#### parseDate()

```js
parseDate(string, { locale = 'en-US', date = true, time = true } = {})
```

Parses a date as [`format()`](./utils.md#format) formats it in
`locale`, e.g. `'May 14, 2026'`, `'14 May 2026'`, `'05/14/2026'` (in `en-US`)
or `'14.05.2026'`, optionally followed by a time like `'11:30:00 PM'` if `time`
is set.
With `date: false`, only a time is parsed, on January 1, 2000. Returns `null`
for anything it can't parse and for dates that don't exist.

```js
parseDate('May 14, 2026, 11:30:00 PM') // May 14, 2026, 23:30
parseDate('14.05.2026', { locale: 'de-DE', time: false }) // May 14, 2026
```

#### getDatePartAtPosition()

```js
getDatePartAtPosition(string, position, { locale, date, time } = {})
```

Returns the part of a formatted date at the caret `position` as
`{ name, start, end }`, e.g. `{ name: 'month', start: 0, end: 3 }`, or the
part before it if the caret is on a separator. Returns `null` without a
string.

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

#### combineEvents()

```js
combineEvents(...events)
```

Combines the results of several `addEvents()` calls into one `{ remove() }`.

#### getKey()

```js
getKey(event)
```

Returns `'left'`, `'up'`, `'right'`, `'down'` or `'enter'` for the arrow keys
and Enter of a keyboard event, and `undefined` for other keys.

#### getKeyNavigation()

```js
getKeyNavigation(event)
```

Returns the direction of the arrow key of a keyboard event as
`{ hor, ver, enter }`: `hor` and `ver` are `-1`, `0` or `1`, `enter` whether
it's Enter.

### Selection

#### getSelection()

```js
getSelection(input)
```

Returns the selection of an input or textarea as `{ start, end }`, or `null`
for other elements.

#### setSelection()

```js
setSelection(input, { start, end })
```

Focuses an input or textarea and selects the range from `start` to `end`.
Does nothing for other elements.

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
`.dito-switch--checked`, `.dito-input--focus` or `.dito-popup--bottom-left`.

Besides the classes of the components, the styles define:

| Class | Description |
| ----- | ----------- |
| `.dito-buttons` | A row of buttons. Modifiers: `--round` for round buttons, `--small` for tighter spacing, `--toolbar` for toolbar buttons. Elements: `__group` to group buttons with a gap between groups. |
| `.dito-chevron` | A chevron that rotates when `.dito-chevron--open`, e.g. in front of collapsible titles. |
| `.dito-resize` | A resize handle in the bottom-right corner of a positioned element. |

### Variables

The variables of `_settings.scss`, with these groups:

| Group | Variables |
| ----- | --------- |
| Colors | `$color-dark-offset`, `$color-light-offset` (how much darker the dark and light greys are), `$color-black`, `$color-darkest`, `$color-darker`, `$color-dark`, `$color-grey`, `$color-light`, `$color-lighter`, `$color-lightest`, `$color-white`, `$color-active`, `$color-highlight`, `$color-success`, `$color-warning`, `$color-error`, `$color-text`, `$color-text-inverted`, `$color-placeholder`, `$color-disabled`, `$color-shadow` |
| Sizes | `$input-height`, `$input-height-factor`, `$input-padding`, `$input-padding-ver`, `$input-padding-hor`, `$popup-margin`, `$chevron-indent` |
| Borders and shadows | `$border-radius`, `$border-color`, `$border-width`, `$border-style`, `$shadow-window`, `$shadow-focus` |
| Buttons | `$button-color`, `$button-color-hover`, `$button-color-active`, `$button-color-active-hover`, `$button-color-active-border`, `$button-round-padding`, `$button-round-padding-ver`, `$button-round-padding-hor` |
| Selects | `$select-arrow-width`, `$select-arrow-size`, `$select-arrow-bottom`, `$select-arrow-right` |
| Other | `$z-index-popup`, `$ease-out-quart`, `$ease-out-circ`, `$ease-out-elastic`, `$math-sqrt2` |

### Mixins

| Mixin | Description |
| ----- | ----------- |
| `focus-ring($color: null)` | The focus ring of keyboard-focused elements, drawn as a shadow that doesn't affect the layout. Pass `$color` on backgrounds of `$color-active`. |
| `arrow($size: $select-arrow-size, $direction: 'down', $position: absolute)` | A rotated border arrow, e.g. for selects, pointing `'up'`, `'down'`, `'left'` or `'right'`. |
| `ellipsis` | Cuts text off with an ellipsis on one line. |
| `user-select($select: none)` | Sets `user-select` and `-webkit-user-drag`. |
| `user-drag($drag: none)` | Sets `-webkit-user-drag`. |
| `reset` | Resets the default styles of headings, form elements, links, lists and tables inside the element. |
| `browser-query($browsers)` | Applies its content only in the given browsers, by the `data-agent-browser`, `data-agent-platform` and `data-agent-version` attributes that the admin sets on `.dito-root`. Takes names or maps of `browser`, `platform` and `version`. |

### Placeholders

Use with `@extend`:

| Placeholder | Description |
| ----------- | ----------- |
| `%field` | Border, padding and background of fields. |
| `%input` | `%field` with placeholder and focus styles of text inputs. |
| `%input-borderless` | Height and alignment of inputs without border, e.g. checkboxes, to line up with bordered ones. |
| `%button-disabled` | The disabled look of buttons. |
| `%icon-{name}` | One of the [icons](#icons), as a mask in `currentColor`, e.g. in a `::before`. |

### Functions

| Function | Description |
| -------- | ----------- |
| `rounded($value, $precision: 1)` | Rounds to `$precision` decimals. |
| `string-replace($string, $search, $replace: null, $replaceAll: false)` | Replaces the first or all occurrences of `$search`. |
| `string-to-list($string, $separator: ' ', $startAt: 1)` | Splits a string into a list, from the character at `$startAt`. |
| `nth-selector($selector, $index)`, `last-selector($selector)` | Returns a part of a compound selector. |

### Icons

The icons are available as [`DitoIcon`](#ditoicon) with their
`name`, as the CSS classes `.dito-icon--{name}`, and in SCSS as the
placeholders `%icon-{name}` and the list `$icons`:

`add`, `align-center`, `align-justify`, `align-left`, `align-right`,
`alternate`, `archive-download`, `archive-upload`, `arrow`, `at-sign`,
`blockquote`, `bold`, `bookmark`, `bullet-list`, `calendar`, `chevron`,
`chevrons`, `clear`, `clock`, `code-block`, `code`, `command`, `copy`,
`credit-card`, `crop`, `dollar-sign`, `drag`, `edit`, `ellipsis`, `footnotes`,
`hash`, `heading-1`, `heading-2`, `heading-3`, `heart`, `home`,
`horizontal-rule`, `image`, `info`, `italic`, `link`, `mail`, `menu`,
`ordered-list`, `paperclip`, `paragraph`, `paste`, `percent`, `redo`, `refresh`,
`remove`, `resize`, `search`, `settings`, `small`, `strike`, `subscript`,
`superscript`, `tag`, `trash`, `type`, `underline`, `undo`, `upload`.

```scss
@import '@ditojs/ui/imports.scss';

.bookshop-wishlist-button::before {
  @extend %icon-heart;
}
```

### Transitions

`DitoTrigger` uses the transitions `dito-slide`, `dito-fade` and `dito-zoom`,
and `TransitionHeight` the transition `dito-height`.
