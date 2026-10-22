<script>
import { h, provide } from 'vue'
import DitoContainer from './DitoContainer.vue'
import { useWidget, widgetProps } from '../composables/useWidget.ts'
import { appendDataPath } from '../utils/data.js'
import { propertyScopeKey } from '../utils/keys.ts'

// Lays out widgets in a section, of the object of its `name` if it has one:
export default {
  name: 'DitoSection',

  props: {
    name: { type: String, default: null },
    label: widgetProps.label,
    width: widgetProps.width,
    info: widgetProps.info,
    collapsible: { type: Boolean, default: undefined },
    collapsed: { type: Boolean, default: undefined }
  },

  setup(props, { slots }) {
    const { scope, property, isRelevant, getContainerProps } = useWidget(
      props,
      { isLayout: true }
    )
    const { name } = props
    if (property) {
      if (!property.properties) {
        throw new Error(
          `Unable to place '${name}' in a section: It has no 'properties'.`
        )
      }
      // The scope of the widgets in the slot:
      provide(propertyScopeKey, {
        properties: property.properties,
        get data() {
          return scope.data[name]
        },
        get dataPath() {
          return appendDataPath(scope.dataPath, name)
        }
      })
    }
    const isNested = !!name
    // Unnamed sections display the data of their scope:
    return () =>
      isRelevant(isNested)
        ? h(
            DitoContainer,
            getContainerProps(
              { type: 'section', ...(isNested && { name }) },
              isNested
            ),
            { default: () => slots.default?.() }
          )
        : null
  }
}
</script>
