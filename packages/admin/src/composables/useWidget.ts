import { h, inject, onMounted, onUnmounted, type VNode } from 'vue'
import { appendDataPath } from '../utils/data.js'
import { getRootData } from '../utils/services.ts'
import { getPropertyNode } from '../utils/schema/properties.js'
import { layoutKey, propertyScopeKey } from '../utils/keys.ts'
import {
  useComponentPath,
  continueComponentNode
} from './useComponentPath.ts'
import { useServices } from './useSchemaContext.ts'
import type { DataContext } from '../utils/DataContext.ts'
import type { Schema } from '../utils/types.ts'

// The display props that all widgets pass to their components. The data
// keywords, e.g. `required` or `default`, are only the property's:
export const widgetProps = {
  name: { type: String, default: null },
  label: { type: [String, Boolean, Object], default: undefined },
  width: { type: [String, Number], default: undefined },
  align: { type: String, default: undefined },
  break: { type: String, default: undefined },
  // Declared, to reach the container also of widgets that render breaks:
  class: { type: [String, Object], default: undefined },
  info: { type: [String, Object], default: undefined },
  placeholder: { type: String, default: undefined },
  prefix: { type: [String, Object, Array], default: undefined },
  suffix: { type: [String, Object, Array], default: undefined },
  clearable: { type: Boolean, default: undefined },
  readonly: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: undefined },
  autofocus: { type: Boolean, default: undefined }
} as const

export interface WidgetProps {
  readonly name: string | null
  readonly [key: string]: any
}

// Find the property of the widget's `name` in the scope that it's in, for the
// widget to render it through `DitoContainer` like panes render fields, with a
// display schema of its props. Widgets without `name` edit the value of their
// scope, e.g. the primitive items of lists, or else only display their content,
// if they have any. Unnested layouts lay out the scope's data:
export function useWidget(
  props: WidgetProps,
  {
    isLayout = false,
    nested = true,
    hasContent = false
  }: { isLayout?: boolean; nested?: boolean; hasContent?: boolean } = {}
) {
  const scope = inject(propertyScopeKey, null)
  const layout = inject(layoutKey, null)
  if (!scope || !layout) {
    throw new Error(
      `Unable to place '${props.name}' outside of forms with \`properties\`.`
    )
  }
  const isScopeValue = props.name == null && !isLayout && !!scope.valueName
  const name = isScopeValue ? scope.valueName! : props.name
  if (name == null && !hasContent) {
    throw new Error(
      isLayout
        ? 'Unable to place sections without `name`.'
        : 'Unable to place widgets without `name` outside of lists of values.'
    )
  }
  // Widgets of display content hold no value, like unnested sections:
  const hasValue = nested && name != null
  const property = hasValue ? scope.properties[name] : null
  if (hasValue && !property) {
    throw new Error(`Unknown property '${name}'.`)
  }
  const services = useServices()
  const { dataContext } = services
  const getValueDataPath = () =>
    hasValue && !isScopeValue
      ? appendDataPath(scope.dataPath, name)
      : scope.dataPath
  // Several widgets of the same name in a scope add a segment to the component
  // path of their parent to tell them apart. Display content has no state or
  // path of its own:
  const occurrence =
    name != null
      ? addOccurrence(dataContext!, appendDataPath(scope.dataPath, name))
      : 0
  const segment = occurrence > 0 ? `~${occurrence + 1}` : null
  const { node } = useComponentPath(
    () => scope.dataPath,
    parent =>
      continueComponentNode(parent, scope.dataPath).getNode(segment ?? '')
  )
  // Like the components of panes, the containers of widgets take their paths
  // and their stores, which outlive them, from their nodes:
  const getContainerNode = () => node.value.getNode(name ?? '')
  // The paths of widgets follow their layout, so their containers attach to
  // the node of their property while they're mounted, to display its errors:
  if (hasValue) {
    const valueNode = scope.node.getNode(name!)
    const leaf = {
      get componentPath() {
        return getContainerNode().componentPath
      }
    }
    onMounted(() => valueNode.leaves.add(leaf))
    onUnmounted(() => valueNode.leaves.delete(leaf))
  }
  const propertyNode = property ? getPropertyNode(name!, property) : null

  return {
    scope,
    name,
    property: property as Schema | null,

    // Widgets of irrelevant properties hide themselves:
    isRelevant() {
      return (
        !propertyNode ||
        propertyNode.isRelevant({
          data: scope.data,
          name,
          dataPath: getValueDataPath(),
          itemDataPath: scope.dataPath,
          rootData: getRootData(services),
          services
        })
      )
    },

    // The props override the hints of the property, e.g. loaded `options` its
    // `enum`. Unnested sections display their scope:
    getContainerProps(schema: Schema) {
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
        dataPath: getValueDataPath(),
        data: scope.data,
        itemDataPath: scope.dataPath,
        store: getContainerNode().store,
        nested: hasValue,
        disabled,
        compact,
        generateLabels
      }
    },

    // Breaks before or after the widget end its line in the pane, as for the
    // `break` of fields:
    renderWithBreaks(container: VNode) {
      const renderBreak = (sides: string[]) =>
        sides.includes(props.break)
          ? h('span', { class: 'dito-pane__break' })
          : null
      return [
        renderBreak(['before', 'both']),
        container,
        renderBreak(['after', 'both'])
      ]
    }
  }
}

// The occurrences of the widgets of each name, by its path in their scopes:
const occurrencesByDataContext = new WeakMap<
  DataContext,
  Map<string, Set<number>>
>()

// Take the first free occurrence of the name, until the widget is unmounted:
function addOccurrence(dataContext: DataContext, path: string) {
  let occurrencesByPath = occurrencesByDataContext.get(dataContext)
  if (!occurrencesByPath) {
    occurrencesByPath = new Map()
    occurrencesByDataContext.set(dataContext, occurrencesByPath)
  }
  const occurrences = occurrencesByPath.get(path) ?? new Set()
  occurrencesByPath.set(path, occurrences)
  let occurrence = 0
  while (occurrences.has(occurrence)) {
    occurrence++
  }
  occurrences.add(occurrence)
  onUnmounted(() => occurrences.delete(occurrence))
  return occurrence
}
