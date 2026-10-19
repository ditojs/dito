# Custom Types

When no built-in type fits, render a field with your own Vue component: once,
with `type: 'component'`, or as a type of its own with `defineType()`, which
schemas then use like the built-in types.

The admin's own components are internal and not meant to be imported, except
`DitoSchemaField` and `DitoPane`, which place fields in custom layouts, see
[Laying out fields](#laying-out-fields). Build custom components with plain
Vue and the public components of [`@ditojs/ui`](../../api/ui.md), e.g.
`DitoProgress` for the progress of a background job.

## The component

A custom component receives the props `schema`, the field's schema,
`context`, the field's [context](./context.md), and `modelValue`, the value
after `formatValue()`. It emits `update:modelValue` to change the value,
through `parseValue()`, which fires the schema's `onInput()`, and `change` to
end the change, which fires `onChange()`, see
[`component`](../../api/admin/schemas.md#component).

A star rating, which writes each click as a finished change:

```vue
<!-- src/admin/components/StarRating.vue -->
<template>
  <div class="star-rating">
    <button
      v-for="star in max"
      :key="star"
      type="button"
      :class="{ 'star-rating__star--active': star <= (modelValue ?? 0) }"
      @click="rate(star)"
    >
      ★
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  schema: { type: Object, required: true },
  context: { type: Object, required: true },
  modelValue: { type: Number, default: null }
})
const emit = defineEmits(['update:modelValue', 'change'])

// Read schema options through the context, which calls callbacks:
const max = computed(() =>
  props.context.getSchemaValue('max', { type: Number, default: 5 })
)

function rate(star) {
  emit('update:modelValue', star)
  emit('change')
}
</script>
```

- Read schema options with `context.getSchemaValue(key, { type, default })`,
  so options can be callbacks too.
- Text inputs emit `update:modelValue` for each keystroke and `change` when
  they lose focus. Components that change the value in one step emit both.
- Components can emit `focus` and `blur` too, which fire the schema's
  `onFocus()` and `onBlur()`; `blur` validates the value. `errorsElementId`,
  an optional prop, is the id of the element that shows the field's errors,
  e.g. for `aria-describedby`.
- In development, the admin warns about components that don't declare these
  props and events.
- In TypeScript, `CustomComponentProps` and `CustomComponentEmits` of
  `@ditojs/admin` type them.

## One field: `type: 'component'`

```js
rating: {
  type: 'component',
  component: () => import('../components/StarRating.vue'),
  label: 'Rating',
  max: 10,
  default: 0
}
```

A `component` field has no value unless its schema has a `default`. Without
one, its component can also only display, declaring just the props `schema`
and `context`, without `modelValue` and its events:

```js
readingTime: {
  type: 'component',
  component: () => import('../components/ReadingTime.vue')
}
```

Such components still receive the field's event handlers. If they contain
inputs of their own, they declare `emits: ['change']`, so the inputs' native
`change` events don't fire the schema's `onInput()` and `onChange()`.

## A type of its own: `defineType()`

`defineType()` registers a type under a name, with defaults and hooks that the
admin applies to every schema of the type, also where the component isn't
rendered, e.g. when items are created, validated or saved:

```js
// src/admin/types/rating.js
import { defineType } from '@ditojs/admin'
import StarRating from '../components/StarRating.vue'

defineType({
  type: 'rating',
  component: StarRating,
  defaultValue: 0,
  defaultWidth: 'auto',

  getValidations({ schema }) {
    return { range: [0, schema.max ?? 5] }
  },

  // What list cells and item labels show for the value:
  getDisplayValue({ value }) {
    return '★'.repeat(value ?? 0)
  }
})
```

Import the module before creating the admin, so the type exists when the views
are set up:

```js
// src/admin/index.js
import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'
import './types/rating.js'

new DitoAdmin('#dito-admin', {
  views: () => import('./views/index.js')
})
```

Schemas then use the type like any other:

```js
rating: { type: 'rating', max: 10 }
```

The descriptor also sets the defaults of `width`, `visible` and `exclude`,
converts values when they're loaded and saved, prepares schemas when the views
are set up, and more, see [TypeDescriptor](../../api/admin/types.md#typedescriptor).

A type whose values are stored differently than they're edited, e.g. prices
stored in cents and edited in euros:

```js
defineType({
  type: 'price',
  component: PriceInput,
  deserializeValue: ({ value }) => (value != null ? value / 100 : value),
  serializeValue: ({ value }) =>
    value != null ? Math.round(value * 100) : value
})
```

Schemas of custom types can't use option names that the admin reserves or
reports as removed, e.g. `format`, `compute` or `data`.

## Laying out fields

A section or a form with `component` renders its `components` with that Vue
component instead of in rows. The component receives the `schema` and
`context` of the section or form, and places each field with `DitoSchemaField`,
whose `name` is a key of its `components`. The fields render as in rows, with
their labels, errors, info, `width` and disabled state, and they validate,
change and save the same way. The section's label shows above the component.

A volume slider with a switch to mute it, next to the slider's track:

```js
playback: {
  type: 'section',
  label: 'Playback',
  component: () => import('../components/PlaybackLayout.vue'),
  components: {
    volume: {
      type: 'component',
      component: () => import('../components/VolumeSlider.vue'),
      default: 50
    },
    isMuted: { type: 'switch', label: 'Muted' }
  }
}
```

```vue
<!-- src/admin/components/PlaybackLayout.vue -->
<template>
  <DitoSchemaField name="volume">
    <DitoSchemaField name="isMuted" />
  </DitoSchemaField>
</template>

<script setup>
import { DitoSchemaField } from '@ditojs/admin'

defineProps({ schema: Object, context: Object })
</script>
```

The default slot of `DitoSchemaField` is passed on to the custom component of
a `type: 'component'` field, so `VolumeSlider` renders the switch with
`<slot />` next to its track.

`DitoPane` places a group of fields in rows, as the section would without
`component`: with their widths, wrapping and alignment, and with the labels of
a row aligned. Its `names` are keys of the section's `components`, all of them
by default. The pane fills the rest of the row it's placed in, here next to a
summary:

```js
book: {
  type: 'section',
  component: () => import('../components/BookLayout.vue'),
  components: {
    summary: { type: 'textarea', label: 'Summary', width: '1/3' },
    title: { type: 'text', label: 'Title' },
    author: { type: 'text', label: 'Author', width: '1/2' },
    year: { type: 'number', label: 'Year', width: '1/2' }
  }
}
```

```vue
<!-- src/admin/components/BookLayout.vue -->
<template>
  <DitoSchemaField name="summary" />
  <DitoPane :names="['title', 'author', 'year']" />
</template>

<script setup>
import { DitoSchemaField, DitoPane } from '@ditojs/admin'

defineProps({ schema: Object, context: Object })
</script>
```

Components inside the layout read the [context](./context.md) with
`useDitoContext()`, e.g. to show a part only for some items. In TypeScript,
`useDitoContext<Book>()` types the item:

```vue
<script setup>
import { DitoSchemaField, useDitoContext } from '@ditojs/admin'

const context = useDitoContext()
</script>

<template>
  <DitoSchemaField name="title" />
  <p v-if="context.item.isPublished">Published</p>
</template>
```

- Forms with `component` need `components`, all fields come from the schema.
- Fields that the layout doesn't place still validate, and then block saving
  without showing their errors.
- `width` applies where the parent element of a field is a flex row, like the
  row that holds the layout.
- `DitoSchemaField` and `DitoPane` throw outside the component of a section or
  form, and for names that aren't in its `components`.
- Sections with `component` don't support `tabs`, `collapsible` and
  `clipboard`.

## Type defaults: `api.defaults`

`api.defaults` of `DitoAdmin` sets defaults for all schemas of a type, keyed
by the type's name. An object fills in what schemas leave out:

```js
new DitoAdmin('#dito-admin', {
  api: {
    defaults: {
      'multiselect': { searchable: true },
      'tree-list': { draggable: true }
    }
  },
  views: () => import('./views/index.js')
})
```

A function receives the schema and returns values that override the schema's.
Only a function can change `type`, so it can give a name of your own to a
configured built-in type, without a component or `defineType()`:

```js
// src/admin/defaults/index.js
import { isFunction } from '@ditojs/utils'

// `stockBadge: { type: 'badge', text: ({ item }) => … }` in any form:
export const badge = ({ text }) => ({
  type: 'component',
  component: () => import('../components/Badge.vue'),
  label: false,
  exclude: true,
  computeValue: context => (isFunction(text) ? text(context) : text)
})

export const multiselect = { searchable: true }
```

```js
// src/admin/index.js
import DitoAdmin from '@ditojs/admin'
import * as defaults from './defaults/index.js'

new DitoAdmin('#dito-admin', {
  api: { defaults },
  views: () => import('./views/index.js')
})
```

Camelized keys, e.g. `treeList`, match too, so a module's exports can serve as
the defaults. See [`defaults`](../../api/admin/admin.md#defaults).

## Reference

- [TypeDescriptor](../../api/admin/types.md#typedescriptor): every descriptor
  member and `defineType()`.
- [`component`](../../api/admin/schemas.md#component) fields.
- [`section`](../../api/admin/schemas.md#section) with `component`.
