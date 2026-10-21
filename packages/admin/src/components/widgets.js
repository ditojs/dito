import {
  h,
  markRaw,
  onUnmounted,
  provide,
  shallowReactive,
  shallowRef
} from 'vue'
import DitoContainer from './DitoContainer.vue'
import { getSlotContent, appendName } from './DitoSection.vue'
import { appendDataPath } from '../utils/data.js'
import { getItemFormSchemaFromForms } from '../utils/schema/lookup.js'
import { propertyScopeKey } from '../utils/keys.ts'
import { useServices } from '../composables/useSchemaContext.ts'
import {
  useWidget,
  widgetComponents,
  widgetProps
} from '../composables/useWidget.ts'

// The text types of the server's formats:
const textTypesByFormat = {
  email: 'email',
  hostname: 'hostname',
  password: 'password',
  uri: 'url'
}

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
  options: { type: [Array, Object], default: undefined }
}

const linesProps = {
  lines: { type: Number, default: undefined },
  resizable: { type: Boolean, default: undefined }
}

const layoutProps = {
  layout: { type: String, default: undefined }
}

export const DitoTextField = defineWidget('DitoTextField', {
  getSchema: property =>
    getTextSchema(textTypesByFormat[property.format] ?? 'text', property)
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

// Dates edit dates, the others dates with times:
export const DitoDateField = defineWidget('DitoDateField', {
  props: {
    format: { type: Object, default: undefined }
  },
  getSchema: ({ type }) => ({ type: type === 'date' ? 'date' : 'datetime' })
})

export const DitoColorField = defineWidget('DitoColorField', {
  props: {
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
          get value() {
            return props.modelValue
          },
          set value(value) {
            emit('update:modelValue', value)
            emit('change')
          },
          get errors() {
            const { dataPath } = props.context
            return dataContext.getErrors(dataPath)?.[dataPath] ?? null
          },
          property
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

// Lists hold objects of their `items`, or of several `forms` by their `type`,
// or values that their items wrap, which widgets without `name` edit:
export const DitoListField = defineSourceWidget('DitoListField', {
  props: {
    draggable: { type: Boolean, default: undefined }
  },
  getSchema: ({ items, forms, orderKey, idKey }) => ({
    type: 'list',
    ...(
      forms
        ? { forms }
        : { form: items.properties ? items : { properties: { value: items } } }
    ),
    wrapPrimitives: forms || items.properties ? undefined : 'value',
    orderKey,
    idKey
  })
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

// The scope of the widgets in the form of an item:
const DitoPropertyScope = {
  name: 'DitoPropertyScope',
  props: {
    scope: { type: Object, required: true }
  },

  setup(props, { slots }) {
    provide(propertyScopeKey, {
      get properties() {
        return props.scope.properties
      },
      get data() {
        return props.scope.data
      },
      get dataPath() {
        return props.scope.dataPath
      },
      get componentPath() {
        return props.scope.componentPath
      },
      get valueName() {
        return props.scope.valueName
      }
    })
    return () => slots.default()
  }
}

// Lists and objects lay out the form of their items in their default slot,
// with a scope for each item, and the slot props `{ item, index }`:
function defineSourceWidget(widgetName, { props = {}, getSchema }) {
  const widget = {
    name: widgetName,
    props: { ...widgetProps, ...sourceProps, ...props },
    emits: ['change'],

    setup(props, { emit, slots }) {
      const { scope, name, property, isRelevant, getContainerProps } =
        useWidget(props)
      const { adminContext, dataContext } = useServices()
      const schema = {
        ...getSchema(property),
        name,
        inlined: true,
        onChange: context => emit('change', context)
      }
      const isList = property.type === 'array'
      const valueName = schema.wrapPrimitives
      const getItemProperties = item =>
        isList
          ? property.forms
            ? (getItemFormSchemaFromForms(property.forms, item)
                ?.properties ?? {})
            : schema.form.properties
          : property.properties
      const getItemScope = (item, index) => {
        const getPath = path => {
          path = appendDataPath(path, name)
          return index != null ? appendDataPath(path, index) : path
        }
        return {
          properties: getItemProperties(item),
          data: item,
          dataPath: getPath(scope.dataPath),
          componentPath: getPath(scope.componentPath),
          valueName
        }
      }
      // Collapsed items don't mount their widgets, so register their paths,
      // which the items reveal:
      const componentPaths = shallowRef([])
      const unregister = adminContext.ui.register(
        () => componentPaths.value,
        { dataContext }
      )
      onUnmounted(unregister)

      const renderItem = ({ item, index = null }) =>
        h(DitoPropertyScope, { scope: getItemScope(item, index) }, () =>
          slots.default({ item: valueName ? item[valueName] : item, index })
        )

      return () => {
        const value = scope.data[name]
        const items = isList ? (value ?? []) : value ? [value] : []
        const paths = slots.default
          ? items.flatMap((item, index) => {
              const { componentPath } = getItemScope(
                item,
                isList ? index : null
              )
              return getSlotContent(slots.default({ item, index })).names.map(
                name => appendName(componentPath, name)
              )
            })
          : []
        if (paths.join() !== componentPaths.value.join()) {
          componentPaths.value = paths
        }
        return isRelevant()
          ? h(
              DitoContainer,
              getContainerProps(schema),
              slots.default ? { default: renderItem } : null
            )
          : null
      }
    }
  }
  widgetComponents.add(widget)
  return widget
}

// The widgets render the type components of fields, with the display schema
// of the property's hints and of their props. Their `change` event is the one
// of the field, for edits of the user:
function defineWidget(name, { props = {}, getSchema }) {
  const widget = {
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
  widgetComponents.add(widget)
  return widget
}
