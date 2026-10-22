import {
  computed,
  h,
  inject,
  markRaw,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  shallowReactive,
  shallowRef,
  toRefs
} from 'vue'
import DitoContainer from './DitoContainer.vue'
import { useServices } from '../composables/useSchemaContext.ts'
import { useWidget, widgetProps } from '../composables/useWidget.ts'
import { getArrayItemForm } from '../utils/schema/properties.js'
import { treeLevelsKey } from '../utils/keys.ts'

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
// `value` writes through the data model, e.g. with `v-model="field.value"`.
// Without a value, they display their content, like custom components without
// a value in schema views:
export const DitoCustomField = defineWidget('DitoCustomField', {
  hasContent: true,
  getSchema: (property, slots) =>
    property
      ? {
          type: 'component',
          component: markRaw(createCustomFieldComponent(property, slots))
        }
      : {
          type: 'component',
          label: false,
          component: markRaw({
            name: 'DitoCustomFieldContent',
            // Display content has no input that the container's id is for:
            inheritAttrs: false,
            render: () => slots.default?.()
          })
        }
})

const sourceProps = {
  collapsible: { type: [Boolean, String], default: undefined },
  collapsed: { type: Boolean, default: undefined },
  creatable: { type: Boolean, default: undefined },
  deletable: { type: Boolean, default: undefined }
}

// Lists hold objects of their `items`, or of several `forms` by their `type`,
// or values that their items wrap, which widgets without `name` edit:
export const DitoListField = defineSourceWidget('DitoListField', {
  props: {
    draggable: { type: Boolean, default: undefined },
    itemLabel: { type: [String, Function, Object, Boolean], default: undefined }
  },
  getSchema: ({ items, forms, orderKey, idKey }) => {
    const { form, itemAdapter } = forms ? {} : getArrayItemForm(items)
    return {
      type: 'list',
      ...(forms ? { forms } : { form }),
      wrapPrimitives: itemAdapter?.name,
      orderKey,
      idKey
    }
  }
})

// Objects that are `nullable` can be created and deleted:
export const DitoObjectField = defineSourceWidget('DitoObjectField', {
  getSchema: property => ({
    type: 'object',
    form: property,
    creatable: !!property.nullable,
    deletable: !!property.nullable
  })
})

const treeLevelProps = {
  itemLabel: { type: [String, Function, Object, Boolean], default: undefined },
  collapsed: { type: Boolean, default: undefined },
  deletable: { type: Boolean, default: undefined },
  draggable: { type: Boolean, default: undefined }
}

// Trees show nested lists as levels, each with its own props: the tree, and
// below it the `DitoTreeLevel` in the default slot of each level. Levels lay
// out the form of the selected item in their `#form` slot, which edits it in
// place beside the tree, in its own route:
export const DitoTreeListField = {
  name: 'DitoTreeListField',
  props: { ...widgetProps, ...treeLevelProps },
  emits: ['change'],

  setup(props, { emit, slots }) {
    const { name, property, isRelevant, getContainerProps, renderWithBreaks } =
      useWidget(props)
    const levels = shallowReactive([])
    provide(treeLevelsKey, levels)
    const formSlot = shallowRef(slots.form)
    const schema = createTreeLevelSchema(name, property, {
      props,
      formSlot,
      levels
    })
    const onChange = context => emit('change', context)
    // Render the levels, which render nothing, so that they register, and the
    // tree once they did, as it claims the routes into them. Each render hands
    // the current `#form` slot to the forms of the items:
    const isMounted = ref(false)
    onMounted(() => {
      isMounted.value = true
    })
    return () => {
      formSlot.value = slots.form
      return isRelevant()
        ? [
            slots.default?.(),
            isMounted.value
              ? renderWithBreaks(
                  h(DitoContainer, getContainerProps({ ...schema, onChange }))
                )
              : null
          ]
        : null
    }
  }
}

// A level of a tree, which registers its props and `#form` slot with the level
// around it while it's mounted:
export const DitoTreeLevel = {
  name: 'DitoTreeLevel',
  props: {
    name: { type: String, required: true },
    ...treeLevelProps
  },

  setup(props, { slots }) {
    const parentLevels = inject(treeLevelsKey, null)
    if (!parentLevels) {
      throw new Error(
        `Unable to place the tree level '${props.name}' outside of trees.`
      )
    }
    const levels = shallowReactive([])
    provide(treeLevelsKey, levels)
    const level = { props, formSlot: shallowRef(slots.form), levels }
    parentLevels.push(level)
    onUnmounted(() => parentLevels.splice(parentLevels.indexOf(level), 1))
    return () => {
      level.formSlot.value = slots.form
      return slots.default?.()
    }
  }
}

// Lists and objects lay out the form of their items in their default slot,
// which receives the context of the item itself, e.g. `v-slot="context"`. The
// forms of the items provide the scopes of the widgets in them:
function defineSourceWidget(widgetName, { props = {}, getSchema }) {
  return {
    name: widgetName,
    props: { ...widgetProps, ...sourceProps, ...props },
    emits: ['change'],

    setup(props, { emit, slots }) {
      const widget = useWidget(props)
      const schema = {
        ...getSchema(widget.property),
        name: widget.name,
        inlined: true,
        onChange: context => emit('change', context)
      }
      const renderItem = ({ context }) => slots.default(context)
      return () =>
        widget.isRelevant()
          ? widget.renderWithBreaks(
              h(
                DitoContainer,
                widget.getContainerProps(schema),
                slots.default ? { default: renderItem } : null
              )
            )
          : null
    }
  }
}

// The widgets render the type components of fields, with the display schema
// of the property's hints and of their props. Their `change` event is the one
// of the field, for edits of the user:
function defineWidget(name, { props = {}, hasContent, getSchema }) {
  return {
    name,
    props: { ...widgetProps, ...props },
    emits: ['change'],

    setup(props, { emit, slots }) {
      const widget = useWidget(props, { hasContent })
      const schema = {
        ...getSchema(widget.property, slots),
        name: widget.name,
        onChange: context => emit('change', context)
      }
      return () =>
        widget.isRelevant()
          ? widget.renderWithBreaks(
              h(DitoContainer, widget.getContainerProps(schema))
            )
          : null
    }
  }
}

// The schema of a tree level, with the schema of the level below it while one
// is registered. Its props are read from the level, so that the schemas only
// change with the registered levels:
function createTreeLevelSchema(name, { items, orderKey, idKey }, level) {
  const { props, formSlot } = level
  const { itemLabel, collapsed, deletable, draggable } = toRefs(props)
  return reactive({
    type: 'tree-list',
    name,
    form: {
      ...items,
      component: markRaw({
        name: 'DitoTreeLevelForm',
        props: {
          schema: { type: Object, required: true },
          context: { type: Object, required: true }
        },
        setup: props => () => formSlot.value?.(props.context)
      })
    },
    children: computed(() => {
      const { levels } = level
      if (levels.length > 1) {
        throw new Error(
          `Unsupported tree level with several child levels: '${
            levels.map(({ props }) => props.name).join(`', '`)
          }'.`
        )
      }
      const [child] = levels
      if (child) {
        const { name } = child.props
        const property = items.properties[name]
        if (!property) {
          throw new Error(`Unknown property '${name}'.`)
        }
        return createTreeLevelSchema(name, property, child)
      } else {
        return null
      }
    }),
    orderKey,
    idKey,
    itemLabel,
    collapsed,
    deletable,
    draggable,
    // Levels without a form have no items to edit:
    editable: computed(() => !!formSlot.value),
    mutate: true
  })
}

// The component of custom fields with a value, which passes the field to the
// slot:
function createCustomFieldComponent(property, slots) {
  return {
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
  }
}
