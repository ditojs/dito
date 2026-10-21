import {
  inject,
  onBeforeMount,
  onUnmounted,
  reactive,
  useId
} from 'vue'
import { appendDataPath } from '../utils/data.js'
import { getRootData } from '../utils/services.ts'
import { PropertyNode } from '../utils/schema/properties.js'
import { layoutKey, propertyScopeKey } from '../utils/keys.ts'
import { useComponentPath } from './useComponentPath.ts'
import { useServices } from './useSchemaContext.ts'
import type { DataContext } from '../utils/DataContext.ts'
import type { Schema } from '../utils/types.ts'

// The display props that all widgets pass to their components. The data
// keywords, e.g. `required` or `default`, are only the property's:
export const widgetProps = {
  name: { type: String, default: null },
  label: { type: [String, Boolean], default: undefined },
  width: { type: [String, Number], default: undefined },
  info: { type: String, default: undefined },
  placeholder: { type: String, default: undefined },
  prefix: { type: String, default: undefined },
  suffix: { type: String, default: undefined },
  clearable: { type: Boolean, default: undefined },
  readonly: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: undefined },
  autofocus: { type: Boolean, default: undefined }
} as const

// The widgets that sections find in their slots:
export const widgetComponents = new WeakSet<object>()

export interface WidgetProps {
  readonly name: string | null
  readonly [key: string]: any
}

// Find the property of the widget's `name` in the scope that it's in, for the
// widget to render it through `DitoContainer` like panes render fields, with a
// display schema of its props. Widgets without `name` edit the value of their
// scope, e.g. the primitive items of lists, and layouts the scope's data:
export function useWidget(
  props: WidgetProps,
  { isLayout = false }: { isLayout?: boolean } = {}
) {
  const scope = inject(propertyScopeKey, null)
  const layout = inject(layoutKey, null)
  if (!scope || !layout) {
    throw new Error(
      `Unable to place '${props.name}' outside of \`DitoSchemaForm\` with ` +
      '`properties`.'
    )
  }
  const isScopeValue = props.name == null && !isLayout
  const name = isScopeValue ? (scope.valueName ?? null) : props.name
  if (isScopeValue && name == null) {
    throw new Error(
      'Unable to place widgets without `name` outside of lists of values.'
    )
  }
  const property = name != null ? scope.properties[name] : null
  if (name != null && !property) {
    throw new Error(`Unknown property '${name}'.`)
  }
  const services = useServices()
  const { adminContext, dataContext } = services
  const getValueDataPath = (nested = true) =>
    nested && !isScopeValue
      ? appendDataPath(scope.dataPath, name!)
      : scope.dataPath
  // Widgets have the component paths of their data paths, so that errors are
  // revealed by their data paths, also in sections and list items. Several
  // widgets of a value and the values of scopes get paths of their own, and
  // reveal their value through them. Layouts get one that contains no widgets:
  let getParentPath = () => scope.componentPath
  if (name != null) {
    const occurrence = addOccurrence(dataContext!, getValueDataPath())
    if (occurrence > 0) {
      getParentPath = () =>
        appendDataPath(scope.componentPath, `~${occurrence + 1}`)
    }
    if (occurrence > 0 || isScopeValue) {
      let unregister: () => void
      onBeforeMount(() => {
        const { ui } = adminContext
        unregister = ui.register(
          () =>
            isScopeValue
              ? scope.componentPath
              : appendDataPath(scope.componentPath, name),
          {
            dataContext,
            focus() {
              const path = appendDataPath(getParentPath(), name)
              ui.getHandles(path, dataContext).find(handle => !!handle.focus)
                ?.focus!()
            }
          }
        )
      })
      onUnmounted(() => unregister())
    }
  } else {
    const id = useId()
    getParentPath = () => appendDataPath(scope.componentPath, id)
  }
  useComponentPath(() => scope.dataPath, getParentPath)
  const store = reactive({})
  const node = property ? getPropertyNode(name!, property) : null

  return {
    scope,
    name,
    property: property as Schema | null,
    store,

    // Widgets of irrelevant properties hide themselves:
    isRelevant(nested = true) {
      return (
        !node ||
        node.isRelevant({
          data: scope.data,
          name,
          dataPath: getValueDataPath(nested),
          itemDataPath: scope.dataPath,
          rootData: getRootData(services),
          services
        })
      )
    },

    // The props override the hints of the property, e.g. loaded `options` its
    // `enum`. Unnested widgets, e.g. sections without `name`, display their
    // scope:
    getContainerProps(schema: Schema, nested = true) {
      const { disabled, compact, generateLabels } = layout.props
      return {
        schema: {
          ...schema,
          ...Object.fromEntries(
            Object.entries(props).filter(
              ([key, value]) => key !== 'name' && value !== undefined
            )
          ),
          // Only to mark the label, the property validates the value:
          required: property?.required
        },
        dataPath: getValueDataPath(nested),
        data: scope.data,
        itemDataPath: scope.dataPath,
        store,
        nested,
        disabled,
        compact,
        generateLabels
      }
    }
  }
}

// The nodes of the properties, which widgets and sections ask:
const nodesByProperty = new WeakMap<Schema, PropertyNode>()

export function getPropertyNode(name: string, property: Schema) {
  let node = nodesByProperty.get(property)
  if (!node) {
    node = new PropertyNode(name, property)
    nodesByProperty.set(property, node)
  }
  return node
}

// The occurrences of the widgets of each value, by their data paths:
const occurrencesByDataContext = new WeakMap<
  DataContext,
  Map<string, Set<number>>
>()

// Take the first free occurrence of the value, until the widget is unmounted:
function addOccurrence(dataContext: DataContext, dataPath: string) {
  let occurrencesByDataPath = occurrencesByDataContext.get(dataContext)
  if (!occurrencesByDataPath) {
    occurrencesByDataPath = new Map()
    occurrencesByDataContext.set(dataContext, occurrencesByDataPath)
  }
  const occurrences = occurrencesByDataPath.get(dataPath) ?? new Set()
  occurrencesByDataPath.set(dataPath, occurrences)
  let occurrence = 0
  while (occurrences.has(occurrence)) {
    occurrence++
  }
  occurrences.add(occurrence)
  onUnmounted(() => occurrences.delete(occurrence))
  return occurrence
}
