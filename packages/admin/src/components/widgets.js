import { h } from 'vue'
import DitoContainer from './DitoContainer.vue'
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

export const DitoTextField = defineWidget('DitoTextField', {
  getSchema: ({ format, maxLength, nullable }) => ({
    type: textTypesByFormat[format] ?? 'text',
    maxLength,
    // Cleared strings are empty, unless they're `nullable`:
    nullable: nullable ?? false
  })
})

export const DitoNumberField = defineWidget('DitoNumberField', {
  props: {
    step: { type: [Number, String], default: undefined }
  },
  getSchema: ({ type, minimum, maximum, range }) => ({
    type: type === 'integer' ? 'integer' : 'number',
    minimum,
    maximum,
    range
  })
})

export const DitoSwitchField = defineWidget('DitoSwitchField', {
  props: {
    labels: { type: Object, default: undefined }
  },
  getSchema: () => ({ type: 'switch' })
})

// The widgets render the type components of fields, with the display schema
// of their props and of the property's hints:
function defineWidget(name, { props = {}, getSchema }) {
  const widget = {
    name,
    props: { ...widgetProps, ...props },

    setup(props) {
      const { property, isRelevant, getContainerProps } = useWidget(props)
      const schema = { ...getSchema(property), name: props.name }
      return () =>
        isRelevant() ? h(DitoContainer, getContainerProps(schema)) : null
    }
  }
  widgetComponents.add(widget)
  return widget
}
