<script>
import { h, provide } from 'vue'
import DitoContainer from './DitoContainer.vue'
import { useWidget, widgetProps } from '../composables/useWidget.ts'
import { appendDataPath } from '../utils/data.js'
import { propertyScopeKey } from '../utils/keys.ts'

// Lays out widgets in a section, of the object of its `name` if it's nested,
// like sections in schema views:
export default {
  name: 'DitoSection',

  props: {
    name: { type: String, required: true },
    nested: { type: Boolean, default: false },
    label: widgetProps.label,
    width: widgetProps.width,
    align: widgetProps.align,
    break: widgetProps.break,
    class: widgetProps.class,
    info: widgetProps.info,
    collapsible: { type: Boolean, default: undefined },
    collapsed: { type: Boolean, default: undefined }
  },

  setup(props, { slots }) {
    const { name, nested } = props
    const {
      scope,
      property,
      isRelevant,
      getContainerProps,
      renderWithBreaks
    } = useWidget(props, { isLayout: true, nested })
    if (nested) {
      if (!property.properties) {
        throw new Error(
          `Unable to place '${name}' in a section: It has no 'properties'.`
        )
      }
      // The scope of the widgets in the slot:
      provide(propertyScopeKey, {
        properties: property.properties,
        node: scope.node.getNode(name),
        get data() {
          return scope.data[name]
        },
        get dataPath() {
          return appendDataPath(scope.dataPath, name)
        }
      })
    }
    return () =>
      isRelevant()
        ? renderWithBreaks(
            h(DitoContainer, getContainerProps({ type: 'section', name }), {
              default: () => slots.default?.()
            })
          )
        : null
  }
}
</script>
