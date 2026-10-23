# Forms with properties and widgets

A form can describe its data with `properties` instead of `fields`, in the
format of the [properties of server models](../server/models.md), and lay it
out in a Vue template with widgets. The properties hold the data and its rules:
types, `required`, limits, defaults, `if` and the admin's own keywords. The
template only lays out. Each widget edits the property of its `name`, and its
props are display options only.

```vue
<!-- src/admin/views/DesignerPage.vue -->
<template lang="pug">
DitoSchemaForm
  DitoTextField(name="name" width="1/2")
  DitoTextField(name="email" type="email" width="1/2")
  DitoSwitchField(name="isFeatured" label="Featured")
  DitoSection(name="ranking" label="Ranking" collapsible collapsed)
    DitoNumberField(name="rank")
  DitoListField(name="awards" collapsible creatable deletable)
    DitoTextField(name="title" width="3/4")
    DitoNumberField(name="year" width="1/4")
  DitoSection(name="address" label="Address" nested)
    DitoTextField(name="city")
</template>

<script setup>
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoSwitchField,
  DitoListField,
  DitoSection
} from '@ditojs/admin'

const route = useRoute()
useDitoForm({
  resource: 'designers',
  id: () => route.params.id || null,
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'string', format: 'email', nullable: true },
    isFeatured: { type: 'boolean', default: false },
    rank: { type: 'integer', minimum: 1, if: ({ item }) => item.isFeatured },
    importName: { type: 'string', exclude: true },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', required: true, trim: true },
          year: { type: 'integer', nullable: true, range: [1900, 2100] }
        }
      }
    },
    address: {
      type: 'object',
      properties: { city: { type: 'string' } }
    }
  }
})
</script>
```

The page holds no rules of its own:

- The label of `name` marks it as required.
- `rank` hides while `isFeatured` is off. It isn't validated or sent then.
- New awards start as `{ title: '', year: null }`.
- `importName` loads but isn't sent.

Everything else about the form, e.g. `resource`, `id`, buttons, events and
leaving with unsaved changes, works as in [Forms in pages](./views.md#forms-in-pages).
Nested forms of schema views can use `properties` too, see
[Nested forms in schema views](#nested-forms-in-schema-views).

## Properties

The properties take the keywords of the server's models with the same
meaning: `type` (`string`, `number`, `integer`, `boolean`, `date`,
`datetime`, `timestamp`, `asset`, `object`, `array`), `nullable`,
`required`, `default`, `minimum`, `maximum`, `range`, `decimals`,
`minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `enum` and
`format` (`email`, `hostname`, `password`, `uri` and `iso-time`). Objects
hold `properties`, and arrays hold `items`. The admin validates them as the
server does, so the same properties can describe the model and the form.
Other types and formats, and `definitions` and `$ref`, aren't supported yet:
properties with them throw when the form is set up.

The admin's own keywords go into the same objects:

| Keyword | Meaning |
| ------- | ------- |
| `if` | Whether the value is relevant. Irrelevant values aren't validated and aren't sent, and their widgets hide. |
| `exclude` | The value loads, but isn't sent. |
| `computed` | The server computes the value, so it isn't sent. |
| `computeValue()` | Computes the value from the item, like the `computeValue()` of fields. |
| `serializeValue()`, `deserializeValue()` | Convert the value when it's sent and loaded. |
| `trim` | Trims strings when they're sent. |
| `relate` | The value holds related objects, which are sent as references. |
| `validate()` | Validates the value with a function of its own. |
| `orderKey`, `idKey` | The order and id keys of the items of arrays, as in lists. |
| `forms` | The forms of the items of arrays of several kinds, by their `type`, see [Lists and objects](#lists-and-objects). |

Every keyword may be a function of the [context](./context.md), e.g.
`required: ({ item }) => item.isPublished`.

Values without a `default` start with the empty value of their type: `''`
for strings, `false` for booleans, `[]` for arrays, `{}` with the defaults of
its properties for objects, and `null` for everything else and for all
`nullable` values. Values that aren't `nullable` get their `default` or their
empty value also when they're loaded or added as `null`. A `null` that is
written later stays, e.g. when a number is cleared to type another one, and
fails validation with "is required", as the server rejects it.

Times of day are strings with `format: 'iso-time'`, e.g. `'14:30:00'`, which
`DitoTimeField` edits.

## Widgets

Each widget edits the property of its `name` in its scope: the form, the
object of a nested `DitoSection`, or an item of a list or object. A
widget whose `name` has no property throws: "Unknown property 'x'".

The widgets render the same components as the field types, e.g. `DitoTextField`
the text field. Their props are the display options of these types, e.g.
`label`, `width`, `placeholder`, `clearable` or a select's `options`, and
never the data keywords: `required`, limits, `default` or `if` are the
property's. The property gives the widget its display hints: the required mark
of the label, limits and `maxLength` for the input, and `enum` as options. A
widget's props override these hints, e.g. loaded `options` override `enum`.
The `format` of the property only validates the value: the widget decides how
it's shown, e.g. `DitoTextField(type="email")`. The widgets emit `change` when the user
changes the value, with the [context](./context.md) of the field.

Several widgets may edit the same value, e.g. in two sections. They share its
errors, and a reveal focuses the first visible one.

See [Widgets](../../api/admin/widgets.md) for all widgets and their props.

## Sections

`DitoSection` lays out widgets in a section, with a `label`, and `collapsible`
and `collapsed`. Like the [sections](../../api/admin/schemas.md#section) of
schema views, each section has a `name`, which keeps its state, e.g. whether
it's collapsed. With `nested`, it edits the object of the property `name`,
flat in the layout: the widgets in it edit the properties of the object.
Without, they edit the data of the section's scope.

Collapsed sections don't render their widgets. While the form holds errors in
their data, they render them hidden: errors open the sections whose widgets
show them, also widgets inside other components of the page, and collapsed
sections with such errors mark their label. Sections don't hide themselves
when all their widgets are hidden by their property's `if`: hide them in the
template with a `v-if`.

## Lists and objects

`DitoListField` and `DitoObjectField` lay out the form of their items in their
default slot, which receives the [context](./context.md) of the item, e.g.
`v-slot="context"` with `context.item`, `context.itemIndex`,
`context.parentItem` and `context.dataPath`.
The widgets in the slot edit the properties of the item:

```pug
DitoListField(name="awards" creatable deletable draggable v-slot="context")
  DitoTextField(name="title" :placeholder="`Award ${context.itemIndex + 1}`")
```

The lists create, delete and reorder their items like inlined lists, and new
items start with the defaults of their properties. The lists mark the items
that contain errors, and errors open collapsed items. Objects that are
`nullable` can be created and deleted.

The items of arrays of values, e.g. `{ type: 'array', items: { type: 'number' } }`,
are edited by a widget without `name`:

```pug
DitoListField(name="prices" creatable)
  DitoNumberField(label="Price" :step="5")
```

Arrays with items of several kinds describe each kind as a form in `forms`,
by the item's `type`, with the label that the create button shows. The slot
lays out each item by its type:

```js
cuts: {
  type: 'array',
  forms: {
    style: {
      label: 'Style',
      properties: { name: { type: 'string', required: true } }
    },
    bundle: {
      label: 'Bundle',
      properties: {
        title: { type: 'string', required: true },
        discount: { type: 'integer', default: 10 }
      }
    }
  }
}
```

```pug
DitoListField(name="cuts" creatable v-slot="{ item }")
  DitoTextField(v-if="item.type === 'style'" name="name")
  template(v-else)
    DitoTextField(name="title")
    DitoNumberField(name="discount")
```

The items of lists in forms with properties are always edited in their slot.
They have no forms with routes of their own, except in trees.

## Trees

`DitoTreeListField` shows an array of objects as a tree, e.g. sets and their
cuts. Each level of the tree lays out the form of its selected item in its
`#form` slot, which receives the [context](./context.md) of the item like the
slots of lists. A `DitoTreeLevel` in the default slot declares the next level:
the array of its `name` in the items of the level around it, nested like the
data:

```js
shopSets: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', required: true },
      cuts: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string', required: true } }
        }
      }
    }
  }
}
```

```pug
DitoTreeListField(name="shopSets" itemLabel="name")
  template(#form="context")
    DitoTextField(name="name" label="Set")
  DitoTreeLevel(name="cuts" itemLabel="title" draggable)
    template(#form="context")
      DitoTextField(name="title" label="Cut")
```

The props of each level, e.g. `itemLabel` and `draggable`, apply to that level
only, like the `children` of tree lists in schema views. Levels without a
`#form` slot aren't editable, and each level has at most one level below it.
Levels can be shown and hidden like other components, e.g. with `v-if`.

Selecting an item opens its form beside the tree, which edits the item in
place. The form has its own route in the page, which follows the item's place
in the data, e.g. `/fonts/1/shopSets/0/cuts/1`, or
`/fonts/1/shop-sets/0/cuts/1` with `api.normalizePaths`, so reloads, the
browser's history and shared links open it again. Errors in items open the
forms that show them.

## Custom fields

`DitoCustomField` edits the property of its `name` with the content of its
slot. The slot receives the field as one reactive object:

```pug
DitoCustomField(name="code" label="Code" v-slot="field")
  input(v-model="field.value")
  span(v-if="field.errors") {{ field.errors[0].message }}
```

- `field.value` reads the value, and writes it through the form's data, so
  `v-model="field.value"` edits it.
- `field.errors` holds the errors of the value as `[{ message }]`, or `null`.
- `field.property` is the property of the value.
- `field.validate()` validates the value like the widgets do on blur, and
  returns whether it's valid.

Destructured, e.g. `v-slot="{ value }"`, the values are read-only.

Like the other widgets, the field emits `change` and validates the value when
the focus leaves it after an edit, also when the slot holds several inputs.

Without `name`, `DitoCustomField` displays its content in the layout of the
form, with a `label`, `width` and `info` like the other widgets, but without a
value, here with the `form` of `const form = useDitoForm({ ... })`:

```pug
DitoCustomField(label="Preview" width="1/2")
  img(:src="form.item.imageUrl")
```

## Errors

Widgets validate their value when the user leaves them after editing it.
Submitting validates the data of the whole form, also of hidden widgets in
collapsed sections and items, which open to show their errors. The errors of
the server, e.g. a `400` with the errors of its model's validation, go to the
widgets of their values in the same way. Errors of values that no widget
shows, e.g. because the template hides it with a `v-if`, go into the
"Validation Errors" notification, as in schema views.

## Nested forms in schema views

The nested forms of schema views, e.g. of objects and list items, can describe
their data with `properties` instead of `fields`, and lay it out with widgets
in their `component`, also in routed item forms:

```js
climate: {
  type: 'object',
  inlined: true,
  form: {
    type: 'form',
    properties: {
      hasTemperature: { type: 'boolean' },
      temperature: {
        type: 'number',
        range: [10, 30],
        default: 20,
        if: ({ item }) => item.hasTemperature
      }
    },
    component: ClimateLayout
  }
}
```

```js
// ClimateLayout.js
const ClimateLayout = {
  props: { schema: Object, context: Object },
  render: () => [
    h(DitoSwitchField, { name: 'hasTemperature', label: 'Heating' }),
    h(DitoSliderField, { name: 'temperature', input: true })
  ]
}
```

A form has either `fields` or `properties`. Both together throw at setup.
