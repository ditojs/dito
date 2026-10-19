# Custom Types

When no built-in type fits, render a field with your own Vue component: once,
with `type: 'component'`, or as a type of its own with `defineType()`, which
schemas then use like the built-in types.

The admin's own components are internal and not meant to be imported. Build
custom components with plain Vue and the public components of
[`@ditojs/ui`](../../api/ui.md), e.g. `DitoProgress` for the progress of a
background job.

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

A `component` field has no value unless its schema has a `default`.

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
