# Template Forms

A form can declare its fields in the template of a Vue component instead of in
`components`. Each field component, e.g. `DitoTextField`, registers the schema
of its type with its props as options, and renders the field as a schema form
would. The form loads, validates, saves, keeps drafts, guards against leaving
with unsaved changes and shows its buttons, clipboard and notifications as
any other form: the fields are the form's `components`, only declared
elsewhere.

## A form with `component`

A form with `component` and no `components` takes its components from the
fields in the component's template, which receives the props `schema` and
`context` of the form:

```js
// src/admin/views/editions.js
export const editions = {
  type: 'view',
  label: 'Editions',
  component: {
    type: 'list',
    resource: { path: 'editions' },
    itemLabel: 'year',
    columns: { year: { sortable: true } },
    form: {
      type: 'form',
      label: 'Edition',
      clipboard: true,
      component: () => import('../components/EditionEditor.vue')
    }
  }
}
```

```vue
<!-- src/admin/components/EditionEditor.vue -->
<template>
  <DitoNumberField path="year" :min="1900" :max="2100" required />
  <DitoListField
    v-for="section in sections"
    :key="section"
    :path="section"
    :label="capitalize(section)"
    inlined
    creatable
    deletable
    draggable
    collapsible="all"
    :itemLabel="({ item }) => item.title || 'Entry'"
  >
    <DitoTextField path="title" required />
    <DitoMarkupField path="text" />
  </DitoListField>
</template>

<script setup>
import { capitalize } from '@ditojs/utils'
import { DitoListField, DitoMarkupField, DitoNumberField, DitoTextField } from '@ditojs/admin'

defineProps(['schema', 'context'])
const sections = ['news', 'releases']
</script>
```

Template forms are the `form` of a list or object with its own `resource`,
which saves the item. Inlined lists and objects, ones without a `resource` and
`forms` by type need `components`: their items are saved with the data around
them, through the declared schema.

There is a field component for every built-in type that holds or edits a
value: `DitoTextField`, `DitoNumberField`, `DitoSelectField`, `DitoListField`,
… , see [Exports](../../api/admin/index.md#exports).

## Fields

`path` is the key of the value in the item. Dotted paths place the value in an
object of the item, e.g. `path="address.city"` edits `item.address.city`.

The other props are the options of the field's type, as in the schema, see
[Schemas](../../api/admin/schemas.md). Bare attributes are `true`, as for
Vue's boolean props, e.g. `required`. Callbacks receive the
[context](./context.md), e.g. `:label="({ item }) => …"`, and `@change` is the
schema's `onChange()`. Props are read live: `:min="minYear"` changes the
validation when `minYear` changes. The default slot is passed on to the custom
component of `DitoComponentField`.

A custom type gets its field component with `defineFieldComponent()`:

```js
import { defineType, defineFieldComponent } from '@ditojs/admin'
import StarRating from './components/StarRating.vue'

defineType({ type: 'rating', component: StarRating })
export const RatingField = defineFieldComponent('rating')
```

## Lists of items

The default slot of a list field with `inlined` is the form of its items: the
fields in it edit each item, with paths relative to the item. All items share
one form, which the first registration of each field defines, so options that
differ per item are callbacks, e.g. `:required="({ item }) => …"`. Adding,
removing, dragging and collapsing items are the list's own. Object fields with
`inlined` take the form of their object the same way.

## Validation and saving

Only the fields that are mounted validate, also in each list item, so a field
in a closed `v-if` or in a collapsed item doesn't block saving. Use `v-show`
for fields that should validate while they're hidden. Errors of the server
show on the fields once they mount.

The form saves the values of all fields that registered since its data was
loaded, also of the ones that unmounted, together with `id`, `type` and the
order key, as forms with `components` do. Values without a field aren't sent,
and the server keeps them, except in objects and list items, which are sent
with the values of their fields only.

## The context in code

`useDitoContext()` returns the [context](./context.md) of the form, or of the
list item in the slot of a list field, e.g. to read `item`, `isDirty` or call
`notify()`:

```vue
<script setup>
import { useDitoContext } from '@ditojs/admin'

const context = useDitoContext()
</script>

<template>
  <DitoTextField v-if="context.item.isPublished" path="publishedBy" />
</template>
```

In TypeScript, `useDitoContext<Edition>()` types the item.

## Layouts of declared components

A form with `component` and `components` lays out its declared components
instead, placed with `DitoSchemaField` and `DitoPane` as in sections, see
[Laying out fields](./custom-types.md#laying-out-fields).
