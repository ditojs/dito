import { h, markRaw, shallowReactive } from 'vue'
import DitoContainer from './DitoContainer.vue'
import { useServices } from '../composables/useSchemaContext.ts'
import { useWidget, widgetProps } from '../composables/useWidget.ts'
import { getArrayItemForm } from '../utils/schema/properties.js'

// Cleared strings are empty, unless they're `nullable`:
const getTextSchema = (type, { maxLength, nullable }) => ({
  type,
  maxLength,
  nullable: nullable ?? false
})

const getNumberSchema = (type, { minimum, maximum, range }) => ({
  type,
  minimum,
  maximum,
  range
})

// Static options come from the `enum` of the value, or of its items:
const getOptionsSchema = (type, property) => {
  const multiple = property.type === 'array'
  return {
    type,
    multiple,
    options: multiple ? property.items.enum : property.enum,
    relate: property.relate
  }
}

const numberProps = {
  step: { type: [Number, String], default: undefined }
}

const optionsProps = {
  options: { type: [Array, Object], default: undefined },
  // Options are edited in the forms of their items in `view`:
  editable: { type: [Boolean, Function], default: undefined },
  view: { type: String, default: undefined }
}

const linesProps = {
  lines: { type: Number, default: undefined },
  resizable: { type: Boolean, default: undefined }
}

const layoutProps = {
  layout: { type: String, default: undefined }
}

// The `type` prop picks the text type of the input, the property's `format`
// only validates the value:
export const DitoTextField = defineWidget('DitoTextField', {
  props: {
    type: { type: String, default: undefined }
  },
  getSchema: property => getTextSchema('text', property)
})

export const DitoTextareaField = defineWidget('DitoTextareaField', {
  props: linesProps,
  getSchema: property => getTextSchema('textarea', property)
})

export const DitoCodeField = defineWidget('DitoCodeField', {
  props: {
    ...linesProps,
    language: { type: String, default: undefined },
    indentSize: { type: Number, default: undefined }
  },
  getSchema: property => getTextSchema('code', property)
})

export const DitoMarkupField = defineWidget('DitoMarkupField', {
  props: {
    ...linesProps,
    whitespace: { type: [String, Boolean], default: undefined },
    enableRules: { type: [Object, Boolean], default: undefined },
    hardBreak: { type: Boolean, default: undefined },
    marks: { type: Object, default: undefined },
    nodes: { type: Object, default: undefined },
    tools: { type: Object, default: undefined }
  },
  getSchema: property => getTextSchema('markup', property)
})

export const DitoNumberField = defineWidget('DitoNumberField', {
  props: numberProps,
  getSchema: property =>
    getNumberSchema(
      property.type === 'integer' ? 'integer' : 'number',
      property
    )
})

export const DitoSliderField = defineWidget('DitoSliderField', {
  props: {
    ...numberProps,
    input: { type: Boolean, default: undefined }
  },
  getSchema: property => getNumberSchema('slider', property)
})

export const DitoProgressField = defineWidget('DitoProgressField', {
  getSchema: property => getNumberSchema('progress', property)
})

export const DitoSwitchField = defineWidget('DitoSwitchField', {
  props: {
    labels: { type: Object, default: undefined }
  },
  getSchema: () => ({ type: 'switch' })
})

// Checkboxes without an answer are `null` only if they're `nullable`:
export const DitoCheckboxField = defineWidget('DitoCheckboxField', {
  getSchema: ({ nullable }) => ({ type: 'checkbox', nullable: !!nullable })
})

export const DitoSelectField = defineWidget('DitoSelectField', {
  props: optionsProps,
  getSchema: property => getOptionsSchema('select', property)
})

export const DitoRadioField = defineWidget('DitoRadioField', {
  props: { ...optionsProps, ...layoutProps },
  getSchema: property => getOptionsSchema('radio', property)
})

export const DitoCheckboxesField = defineWidget('DitoCheckboxesField', {
  props: { ...optionsProps, ...layoutProps },
  getSchema: property => getOptionsSchema('checkboxes', property)
})

export const DitoMultiselectField = defineWidget('DitoMultiselectField', {
  props: {
    ...optionsProps,
    // Multiselects without a placeholder show none with `false`:
    placeholder: { type: [String, Boolean], default: undefined },
    searchable: { type: Boolean, default: undefined },
    search: { type: [Function, Object], default: undefined },
    stayOpen: { type: Boolean, default: undefined },
    taggable: { type: [Boolean, Object], default: undefined }
  },
  getSchema: property => getOptionsSchema('multiselect', property)
})

// The widget picks the picker, the property only validates the value:
const dateProps = {
  formats: { type: Object, default: undefined }
}

export const DitoDateField = defineWidget('DitoDateField', {
  props: dateProps,
  getSchema: () => ({ type: 'date' })
})

export const DitoTimeField = defineWidget('DitoTimeField', {
  props: dateProps,
  getSchema: () => ({ type: 'time' })
})

export const DitoDateTimeField = defineWidget('DitoDateTimeField', {
  props: dateProps,
  getSchema: () => ({ type: 'datetime' })
})

export const DitoColorField = defineWidget('DitoColorField', {
  props: {
    colorFormat: { type: String, default: undefined },
    alpha: { type: Boolean, default: undefined },
    inputs: { type: Boolean, default: undefined },
    presets: { type: Array, default: undefined }
  },
  getSchema: () => ({ type: 'color' })
})

export const DitoUploadField = defineWidget('DitoUploadField', {
  props: {
    accept: { type: [String, Array], default: undefined },
    extensions: { type: [String, RegExp, Array], default: undefined },
    maxSize: { type: [String, Number], default: undefined },
    draggable: { type: Boolean, default: undefined },
    deletable: { type: Boolean, default: undefined },
    render: { type: Function, default: undefined },
    thumbnails: { type: [Boolean, String], default: undefined },
    thumbnailUrl: { type: String, default: undefined },
    downloadUrl: { type: String, default: undefined }
  },
  getSchema: ({ type }) => ({ type: 'upload', multiple: type === 'array' })
})

// Custom fields pass the field to their slot, as one reactive object whose
// `value` writes through the data model, e.g. with `v-model="field.value"`:
export const DitoCustomField = defineWidget('DitoCustomField', {
  getSchema: (property, slots) => ({
    type: 'component',
    component: markRaw({
      name: 'DitoCustomFieldContent',
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true },
        modelValue: { type: null, default: undefined }
      },
      emits: ['update:modelValue', 'change'],

      setup(props, { emit }) {
        const { dataContext } = useServices()
        const field = shallowReactive({
          // Read the value from the context, not the `modelValue` prop, which
          // only receives written values with the next render:
          get value() {
            return props.context.value
          },
          set value(value) {
            emit('update:modelValue', value)
            emit('change')
          },
          get errors() {
            const { dataPath } = props.context
            return dataContext.getErrors(dataPath)?.[dataPath] ?? null
          },
          property,

          // Validate the value like widgets do on blur, e.g. with
          // `@blur="field.validate()"`, and return whether it's valid:
          validate() {
            return dataContext.model.validate(props.context.dataPath)
          }
        })
        return () => slots.default?.(field)
      }
    })
  })
})

const sourceProps = {
  collapsible: { type: [Boolean, String], default: undefined },
  collapsed: { type: Boolean, default: undefined },
  creatable: { type: Boolean, default: undefined },
  deletable: { type: Boolean, default: undefined }
}

const itemLabelProps = {
  itemLabel: { type: [String, Function, Object, Boolean], default: undefined }
}

// Lists hold objects of their `items`, or of several `forms` by their `type`,
// or values that their items wrap, which widgets without `name` edit:
export const DitoListField = defineSourceWidget('DitoListField', {
  props: {
    ...sourceProps,
    ...itemLabelProps,
    draggable: { type: Boolean, default: undefined }
  },
  getSchema: ({ items, forms, orderKey, idKey }) => {
    const { form, itemAdapter } = forms ? {} : getArrayItemForm(items)
    return {
      type: 'list',
      inlined: true,
      ...(forms ? { forms } : { form }),
      wrapPrimitives: itemAdapter?.name,
      orderKey,
      idKey
    }
  }
})

// Objects that are `nullable` can be created and deleted:
export const DitoObjectField = defineSourceWidget('DitoObjectField', {
  props: sourceProps,
  getSchema: property => ({
    type: 'object',
    inlined: true,
    form: property,
    creatable: !!property.nullable,
    deletable: !!property.nullable
  })
})

// Trees show nested lists as levels: the items of each level hold the next one
// in their list that has a slot of its name. The slot of each level, e.g.
// `#cuts`, lays out the form of the selected item, which edits it in place
// beside the tree, in its own route:
export const DitoTreeListField = defineSourceWidget('DitoTreeListField', {
  props: {
    ...itemLabelProps,
    collapsed: { type: Boolean, default: undefined },
    deletable: { type: Boolean, default: undefined },
    draggable: { type: Boolean, default: undefined }
  },
  getSchema: (property, slots, props) => {
    const { itemLabel, collapsed, deletable, draggable } = props
    const getLevelSchema = (name, { items, orderKey, idKey }) => {
      const children = Object.entries(items.properties).filter(
        ([key, { type }]) => type === 'array' && slots[key]
      )
      if (children.length > 1) {
        throw new Error(
          `Unsupported tree level with several child lists: '${
            children.map(([key]) => key).join(`', '`)
          }'.`
        )
      }
      const [child] = children
      return {
        type: 'tree-list',
        name,
        form: {
          ...items,
          component: markRaw({
            name: 'DitoTreeListItemForm',
            props: {
              schema: { type: Object, required: true },
              context: { type: Object, required: true }
            },
            setup: props => () => slots[name]?.(props.context)
          })
        },
        ...(child && { children: getLevelSchema(...child) }),
        orderKey,
        idKey,
        itemLabel,
        collapsed,
        deletable,
        draggable,
        editable: !!slots[name],
        mutate: true
      }
    }
    return getLevelSchema(props.name, property)
  }
})

// Sources lay out the forms of their items in their slots, which receive the
// context of the item itself, e.g. `v-slot="context"`. The forms of the items
// provide the scopes of the widgets in them:
function defineSourceWidget(widgetName, { props = {}, getSchema }) {
  return {
    name: widgetName,
    props: { ...widgetProps, ...props },
    emits: ['change'],

    setup(props, { emit, slots }) {
      const { name, property, isRelevant, getContainerProps } = useWidget(props)
      const schema = {
        ...getSchema(property, slots, props),
        name,
        onChange: context => emit('change', context)
      }
      const renderItem = ({ context }) => slots.default(context)
      return () =>
        isRelevant()
          ? h(
              DitoContainer,
              getContainerProps(schema),
              slots.default ? { default: renderItem } : null
            )
          : null
    }
  }
}

// The widgets render the type components of fields, with the display schema
// of the property's hints and of their props. Their `change` event is the one
// of the field, for edits of the user:
function defineWidget(name, { props = {}, getSchema }) {
  return {
    name,
    props: { ...widgetProps, ...props },
    emits: ['change'],

    setup(props, { emit, slots }) {
      const { name, property, isRelevant, getContainerProps } = useWidget(props)
      const schema = {
        ...getSchema(property, slots),
        name,
        onChange: context => emit('change', context)
      }
      return () =>
        isRelevant() ? h(DitoContainer, getContainerProps(schema)) : null
    }
  }
}
