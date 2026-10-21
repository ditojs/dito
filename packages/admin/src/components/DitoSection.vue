<script>
import {
  h,
  nextTick,
  onUnmounted,
  provide,
  shallowRef,
  isVNode,
  Comment,
  Text
} from 'vue'
import { asArray, isArray, parseDataPath } from '@ditojs/utils'
import DitoContainer from './DitoContainer.vue'
import { useServices } from '../composables/useSchemaContext.ts'
import {
  useWidget,
  getPropertyNode,
  widgetComponents,
  widgetProps
} from '../composables/useWidget.ts'
import { appendDataPath } from '../utils/data.js'
import { getRootData } from '../utils/services.ts'
import { propertyScopeKey } from '../utils/keys.ts'

// Lays out widgets in a section, of the object of its `name` if it has one.
// Collapsed sections don't mount their widgets, but read their names from the
// slot, to show that they contain errors and to reveal them:
const DitoSection = {
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
    const services = useServices()
    const { adminContext, dataContext } = services
    const { scope, property, store, isRelevant, getContainerProps } = useWidget(
      props,
      { isLayout: true }
    )
    const { name } = props
    // The scope of the widgets in the slot:
    let slotScope = scope
    if (property) {
      if (!property.properties) {
        throw new Error(
          `Unable to place '${name}' in a section: It has no 'properties'.`
        )
      }
      slotScope = {
        properties: property.properties,
        get data() {
          return scope.data[name]
        },
        get dataPath() {
          return appendDataPath(scope.dataPath, name)
        },
        get componentPath() {
          return appendDataPath(scope.componentPath, name)
        }
      }
      provide(propertyScopeKey, slotScope)
    }
    const isNested = !!name
    const isOpened = () => (
      store.opened ?? !(props.collapsible && props.collapsed)
    )

    // Values in the slot are relevant if their properties are, and the ones
    // that contain them, e.g. of nested sections:
    const isRelevantInSlot = path => {
      let { properties, data, dataPath } = slotScope
      for (const key of path ? parseDataPath(path) : []) {
        const property = properties[key]
        if (!property) {
          // The widget throws for its unknown name:
          return true
        }
        const entry = {
          data,
          name: key,
          dataPath: appendDataPath(dataPath, key),
          itemDataPath: dataPath,
          rootData: getRootData(services),
          services
        }
        if (!getPropertyNode(key, property).isRelevant(entry)) {
          return false
        }
        properties = property.properties
        data = data?.[key]
        dataPath = entry.dataPath
      }
      return true
    }

    const componentPaths = shallowRef([])
    const unregister = adminContext.ui.register(() => componentPaths.value, {
      dataContext,
      async reveal(path, { focus }) {
        if (!isOpened()) {
          store.opened = true
          await nextTick()
          if (focus) {
            // `TransitionHeight` hides the content while it measures it, until
            // its next timeout, and hidden fields can't be focused:
            await new Promise(resolve => setTimeout(resolve))
          }
        }
      }
    })
    onUnmounted(unregister)

    return () => {
      const { names, hasDisplayContent } = getSlotContent(slots.default?.())
      const paths = names.map(name => appendName(slotScope.componentPath, name))
      if (paths.join() !== componentPaths.value.join()) {
        componentPaths.value = paths
      }
      // Like nested sections of fields, sections whose content is all hidden
      // are hidden:
      const isHidden = (
        !hasDisplayContent &&
        names.length > 0 &&
        !names.some(isRelevantInSlot)
      )
      const { model } = dataContext
      const containsErrors = (
        !isOpened() &&
        names.some(name => {
          const dataPath = appendName(slotScope.dataPath, name)
          return !!(model.getErrors(dataPath) || model.getFieldErrors(dataPath))
        })
      )
      // Unnamed sections display the data of their scope:
      return !isHidden && isRelevant(isNested)
        ? h(
            DitoContainer,
            getContainerProps(
              {
                type: 'section',
                ...(isNested && { name }),
                class: { 'dito-container--contains-errors': containsErrors }
              },
              isNested
            ),
            { default: () => slots.default?.() }
          )
        : null
    }
  }
}

export default DitoSection

// The names of the widgets in the slot, also in elements and nested sections,
// and whether it displays anything else, e.g. text or other components. Widgets
// of the scope's own value have no name:
export function getSlotContent(
  vnodes,
  content = { names: [], hasDisplayContent: false },
  prefix = null
) {
  for (const vnode of asArray(vnodes)) {
    if (isArray(vnode)) {
      getSlotContent(vnode, content, prefix)
    } else if (isVNode(vnode)) {
      const { type, props, children } = vnode
      if (type === DitoSection) {
        getSlotContent(
          children?.default?.(),
          content,
          appendName(prefix, props?.name)
        )
      } else if (widgetComponents.has(type)) {
        content.names.push(appendName(prefix, props?.name))
      } else if (isArray(children)) {
        getSlotContent(children, content, prefix)
      } else if (type === Text) {
        content.hasDisplayContent ||= !!children.trim()
      } else if (type !== Comment) {
        content.hasDisplayContent = true
      }
    } else if (vnode != null && vnode !== false) {
      content.hasDisplayContent ||= !!String(vnode).trim()
    }
  }
  return content
}

export function appendName(path, name) {
  return name ? appendDataPath(path, name) : path
}
</script>

<style lang="scss">
@import '../styles/_imports';

// Collapsed sections show that their widgets have errors:
.dito-container--contains-errors
  > .dito-section
  > .dito-schema
  > .dito-schema-header
  > .dito-label {
  color: $color-error;
}
</style>
