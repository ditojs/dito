import SchemaContext from '../../SchemaContext.js'
import { getUid } from '../uid.js'
import { SchemaGraph } from '../SchemaGraph.js'
import {
  toModelData,
  appendDataPath,
  getRelativeDataPath,
  getItemDataPath
} from '../data.js'
import { isMatchingType, convertType } from '../type.js'
import {
  isObject,
  isArray,
  isFunction,
  asArray,
  clone,
  labelize,
  getValueAtDataPath,
  resolveDataPath
} from '@ditojs/utils'
import {
  getTypeDescriptor,
  getSourceType,
  getChildSourceSchemas,
  getItemAdapter
} from './types.ts'
import {
  someNestedSchemaComponent,
  hasNestedSchemaComponents,
  isPanelWithOwnData,
  isListSource,
  hasNestedData
} from './structure.js'
import { getLabelForRelated } from './options.ts'
import { walkData, cloneItem, getSchemaSource } from './walk.js'
import {
  hasFormSchema,
  getFormSchemas,
  getItemFormSchema,
  getItemFormSchemaFromForms
} from './lookup.js'

export function getSchemaValue(
  keyOrDataPath,
  { type, schema, callback = true, default: def, context } = {}
) {
  const types = type && asArray(type)
  // For performance reasons, data paths are only supported as arrays:
  let value = schema
    ? isArray(keyOrDataPath)
      ? getValueAtDataPath(schema, keyOrDataPath, () => undefined)
      : schema[keyOrDataPath]
    : undefined

  if (value === undefined && def !== undefined) {
    if (callback && isFunction(def) && !isMatchingType(types, def)) {
      // Support `default()` functions for any type except `Function`:
      def = def(context)
    }
    return def
  }

  if (isMatchingType(types, value)) {
    return value
  }
  // Any schema value can be a function, resolved when the value is evaluated:
  if (callback && isFunction(value)) {
    value = value(context)
  }
  // See if we can convert to the expected types:
  if (types && value != null && !isMatchingType(types, value)) {
    for (const type of types) {
      const converted = convertType(type, value)
      if (converted !== value) {
        return converted
      }
    }
  }
  return value
}

// Labels are text or `{ text | html, prefix, suffix }` objects, which the
// renderers display as they are:
export function getLabel(schema, context, name) {
  return schema
    ? getSchemaValue('label', { schema, context, type: [String, Object] }) ||
      labelize(name || schema.name)
    : labelize(name) || ''
}

export function shouldRenderSchema(schema, context) {
  return (
    getSchemaValue('if', {
      type: Boolean,
      schema,
      context,
      default: true
    }) && (
      // Panels with their own data evaluate their components in it:
      isPanelWithOwnData(schema) ||
      shouldRenderComponents(schema, context)
    )
  )
}

export function shouldRenderComponents(schema, context) {
  return (
    !hasNestedSchemaComponents(schema) ||
    // Sources render their components for each item, with its own context:
    !!getSourceType(schema) ||
    // Evaluate the components with their own contexts, like when rendered:
    someNestedSchemaComponent(schema, (component, name) =>
      shouldRenderSchema(component, context.createChildContext(component, name))
    )
  )
}

export function getCreatableForms(schema, context) {
  return Object.fromEntries(
    Object.entries(getFormSchemas(schema, context)).filter(([, form]) =>
      getSchemaValue('creatable', {
        type: Boolean,
        default: true,
        schema: form,
        context
      })
    )
  )
}

function getContext(context) {
  return isFunction(context) ? context() : context
}

export function resolveValue(value, context) {
  return isFunction(value)
    ? toModelData(value(getContext(context)))
    : clone(value)
}

export function getDefaultValue(schema, context) {
  return schema.default !== undefined
    ? resolveValue(schema.default, context)
    : getEmptyValue(schema, context)
}

const emptyValuesByPropertyType = { string: '', boolean: false }

export function getEmptyValue(schema, context) {
  // NOTE: Components may not be instantiated when items are created, e.g. in
  // nested forms, so the type descriptors define `defaultValue`:
  const descriptor = getTypeDescriptor(schema)
  const value = resolveValue(descriptor?.defaultValue, context)
  // Fields with `nullable: false` store the empty value of their property's
  // type instead of `null`, e.g. `''` for strings:
  return value === null && schema.nullable === false
    ? (emptyValuesByPropertyType[
        descriptor.getProperty?.(schema, getContext(context))?.type
      ] ?? null)
    : value
}

export function shouldExcludeValue(schema, context) {
  const exclude =
    schema.exclude !== undefined
      ? schema.exclude
      : getTypeDescriptor(schema)?.defaultExclude
  return isFunction(exclude) ? exclude(getContext(context)) : !!exclude
}

export function shouldIgnoreMissingValue(schema, context) {
  return getDescriptorFlag(schema, 'ignoresMissingValue', context)
}

function isMissingValue(schema, data, name, context) {
  // Read the value only if needed, or tracked walks would depend on all values:
  return (
    !(name in data) || (
      getDescriptorFlag(schema, 'treatsNullAsMissing', context) &&
      data[name] === null
    )
  )
}

export function hasValueFromDataSchema(schema) {
  return (
    !!getTypeDescriptor(schema)?.resolvesValue &&
    !!(schema.data || schema.dataPath)
  )
}

export function getMultipleValue(schema, context) {
  return getSchemaValue('multiple', {
    type: Boolean,
    schema,
    context,
    default: !!getTypeDescriptor(schema)?.defaultMultiple
  })
}

export function shouldSetDefaultValue(schema, data, name, context, {
  shouldSetDefaultsOfComponentsWithCompute = true
} = {}) {
  return (
    (shouldSetDefaultsOfComponentsWithCompute || !schema.computeValue) &&
    isMissingValue(schema, data, name, context) &&
    !shouldIgnoreMissingValue(schema, context)
  )
}

// Set missing values to their defaults to watch them for changes, and number
// list items by their order key to store their order even if it never changes.
export function initializeData(schema, data = {}, services, {
  dataPath = null,
  rootData = data,
  shouldSkipSourcesWithResource = false,
  // New data starts with all defaults for `computeValue()` to rely on, but in
  // loaded data, `computeValue()` may derive missing values instead:
  shouldSetDefaultsOfComponentsWithCompute = true
} = {}) {
  const visit = entry => {
    const { node, data, name } = entry
    const value = node.getDefaultValue(entry, {
      shouldSetDefaultsOfComponentsWithCompute
    })
    // Types without values, e.g. buttons, get no key, like in the data of
    // items that `computeValue()` returns:
    if (value !== undefined) {
      data[name] = value
    }
    const { source } = node
    if (source && hasItemsNumberedByOrderKey(source) && isArray(data[name])) {
      updateOrder(source, data[name])
    }
  }

  return walkData(schema, data, {
    dataPath,
    services,
    rootData,
    shouldSkipSourcesWithResource,
    visit
  })
}

// Never write into `data`, as `DataModel` writes the computed values. Functions
// in `dataPath` are only called by computes that read it, e.g. through `index`.
export function getComputedValue(schema, data, name, dataPath, {
  itemDataPath = null,
  services = null,
  rootData = null,
  getOptions = null
} = {}) {
  const context = () =>
    // Pass a function, so the `options` getter isn't evaluated on creation:
    new SchemaContext(services, () => {
      const properties = {
        schema,
        // Override value to prevent endless recursion through `this.value` in
        // `SchemaContext`, and read it lazily, so `computeValue()` only depends
        // on it if it reads it:
        get value() {
          return data[name]
        },
        name,
        nested: true,
        data,
        get dataPath() {
          return isFunction(dataPath) ? dataPath() : dataPath
        },
        get itemDataPath() {
          return isFunction(itemDataPath) ? itemDataPath() : itemDataPath
        },
        rootData
      }
      if (getOptions) {
        Object.defineProperty(properties, 'options', {
          get: getOptions,
          enumerable: true
        })
      }
      return properties
    })
  const { computeValue } = schema
  // Like the data model, only compute values of shown components, as
  // `computeValue()` may rely on the conditions of `if`:
  if (
    computeValue &&
    getSchemaValue('if', {
      type: Boolean,
      schema,
      context: getContext(context),
      default: true
    })
  ) {
    const value = computeValue(getContext(context))
    if (value !== undefined) {
      return value
    }
  }
  return getValueOrDefault(schema, data, name, context)
}

export function getValueOrDefault(schema, data, name, context) {
  const shouldUseDefault = (
    isMissingValue(schema, data, name, context) &&
    !shouldIgnoreMissingValue(schema, context)
  )
  return shouldUseDefault ? getDefaultValue(schema, context) : data[name]
}

// The value as the component edits it, after `formatValue()`. The components
// compare values by identity, e.g. with options:
export function getEditedValue(schema, value, context) {
  const { formatValue } = schema
  return formatValue ? toModelData(formatValue(getContext(context))) : value
}

// The value to store for the edited value, after `parseValue()`:
export function parseEditedValue(schema, value, createContext) {
  return convertValue(schema, 'parseValue', value, createContext)
}

export function serializeData(schema, sourceSchema, data, dataPath, {
  services,
  rootData,
  target
} = {}) {
  const options = { services, rootData, target }
  // Data without a source, e.g. of dialogs and panels, has nothing to identify:
  const serializedRootData = sourceSchema
    ? cloneItem(getSchemaSource(sourceSchema), data)
    : {}
  const graph = new SchemaGraph(dataPath)

  const visit = entry => {
    const { node, data, name, serializedData } = entry
    const value = node.hasMissingValue(entry)
      ? node.getDefaultValue(entry)
      : data[name]
    // The forms of the items expect them wrapped by the item adapter of the
    // source, so wrap before and unwrap after. Always shallow-clone arrays:
    const itemAdapter = node.source?.itemAdapter
    serializedData[name] = isArray(value)
      ? itemAdapter
        ? value.map(itemAdapter.wrap)
        : [...value]
      : value
  }

  const after = entry => {
    const { node, data, name, dataPath, itemDataPath, serializedData } = entry
    const { source } = node
    const itemAdapter = source?.itemAdapter
    let value = serializedData[name]
    // Unwrap the items again, to bring the data back into its native form:
    if (itemAdapter && isArray(value)) {
      value = value.map(itemAdapter.unwrap)
    }
    // Register the sources and relations whose ids the graph serializes:
    let labels
    const schema = node.fields[0]?.schema
    if (source?.isSource) {
      graph.addSource(dataPath, source)
    } else if (schema?.relate) {
      // Internally related data (`options.dataPath`) needs both the options
      // (for '#ref') and the value ('#id') serialized:
      const path = schema.options?.dataPath
      const relatedDataPath = path
        ? resolveDataPath(getItemDataPath(dataPath, true), path)
        : null
      graph.addRelation(dataPath, relatedDataPath, schema)
      if (target === 'clipboard' && !graph.isInternal(relatedDataPath)) {
        labels = getRelatedLabels(
          { schema, data, name, dataPath, itemDataPath },
          value,
          options
        )
      }
    }
    // Values that are excluded or that `serializeValue()` returns nothing for,
    // e.g. of virtual fields, leave out their key:
    value = node.serialize(value, entry)
    if (value === undefined) {
      delete serializedData[name]
    } else {
      serializedData[name] = labels ?? value
    }
  }

  walkData(schema, data, {
    dataPath,
    services,
    rootData,
    serializedData: serializedRootData,
    visit,
    after
  })

  return graph.serialize(sourceSchema, serializedRootData, options)
}

// Return whether the value at `dataPath` is excluded from the data that is
// sent: whether no component holds it, or its component or one that contains
// it is excluded. Of the items of lists and objects, only the values of their
// forms' components are sent, see `cloneItem()`. Excluded sources with their
// own resource send their data themselves, so only the components below them
// decide.
export function isDataPathExcluded(schema, data, dataPath, {
  dataPath: itemDataPath = '',
  services = null,
  rootData = data
} = {}) {
  // The entries of the values that contain the value, outermost first:
  const entries = []
  walkData(schema, data, {
    dataPath: itemDataPath,
    services,
    rootData,
    // Only visit the fields that contain the value. The fields of their panels
    // edit the data around them, and decide for themselves:
    shouldVisit: entry => (
      getRelativeDataPath(dataPath, entry.dataPath) !== null
    ),
    visit: entry => entries.push(entry)
  })
  const excludedEntry = entries.findLast(entry => entry.node.isExcluded(entry))
  if (excludedEntry) {
    return !excludedEntry.node.source?.hasResource
  }
  const holder = entries.at(-1)
  if (!holder) {
    return true
  }
  const { source } = holder.node
  const relativeDataPath = getRelativeDataPath(dataPath, holder.dataPath)
  return (
    !!source?.hasForms &&
    relativeDataPath !== '' &&
    !(source.isList && /^\d+$/.test(relativeDataPath))
  )
}

// Convert the stored values of `data` in place to the values that the
// components edit. Values are converted before the items in them are walked:
export function deserializeData(schema, data, {
  services = null,
  dataPath = null,
  rootData = data,
  shouldVisit
} = {}) {
  const visit = entry => {
    const { node, data, name } = entry
    if (name in data) {
      const value = node.deserialize(data[name], entry)
      if (value !== data[name]) {
        data[name] = value
      }
    }
  }
  return walkData(schema, data, {
    dataPath,
    services,
    rootData,
    shouldVisit,
    visit
  })
}

// Walk the layout of `schema` along `data`, with the component paths of its
// components, tabs and panels, the forms of items and their child sources, and
// call `visit()` for each nested component. Several components of the same
// value each have their own component path.
// NOTE: Items with an item adapter are walked wrapped, and the wrapped value
// keeps the item's data path.
export function walkComponentPaths(schema, data, {
  dataPath = null,
  componentPath = '',
  services = null,
  rootData = data,
  wrappedValueName = null,
  childSourceSchemas = [],
  shouldWalk = () => true,
  visit = null
}) {
  const walkOptions = { services, rootData, shouldWalk, visit }
  const getDataPath = (dataPath, token) =>
    dataPath != null
      ? appendDataPath(dataPath, token)
      : null

  const walkComponents = (components, parentComponentPath) => {
    if (components) {
      for (const [name, componentSchema] of Object.entries(components)) {
        const isNestedComponent = hasNestedData(componentSchema)
        const isWrappedValue = name === wrappedValueName
        const componentDataPath =
          isNestedComponent && !isWrappedValue
            ? getDataPath(dataPath, name)
            : dataPath
        const entry = {
          schema: componentSchema,
          data,
          name,
          dataPath: componentDataPath,
          // The data path of `data`, which wrapped values keep:
          itemDataPath: dataPath,
          componentPath: appendDataPath(parentComponentPath, name)
        }
        if (!shouldWalk(entry)) {
          continue
        }
        if (isPanelWithOwnData(componentSchema)) {
          // The components of panels with their own data don't edit `data`.
          continue
        }
        if (!isNestedComponent) {
          walkComponentPaths(componentSchema, data, {
            ...walkOptions,
            dataPath,
            componentPath: entry.componentPath
          })
        } else {
          const itemAdapter = getItemAdapter(componentSchema)
          const walkItem = (value, index = null) => {
            const item = itemAdapter ? itemAdapter.wrap(value) : value
            // Values that aren't objects hold no data of the form, e.g. ones
            // that `computeValue()` converts to objects:
            if (isObject(item)) {
              const itemDataPath =
                index !== null
                  ? getDataPath(componentDataPath, index)
                  : componentDataPath
              const itemComponentPath =
                index !== null
                  ? appendDataPath(entry.componentPath, index)
                  : entry.componentPath
              const context = SchemaContext.createForSchema(services, {
                ...entry,
                rootData
              })
              const form = getItemFormSchemaFromForms(
                getFormSchemas(componentSchema, context),
                item
              )
              // Items without a matching form, e.g. of unknown types, stay as
              // they are:
              if (form) {
                walkComponentPaths(form, item, {
                  ...walkOptions,
                  dataPath: itemDataPath,
                  componentPath: itemComponentPath,
                  wrappedValueName: itemAdapter?.name ?? null,
                  childSourceSchemas: getChildSourceSchemas(componentSchema)
                })
              }
            }
          }

          visit?.(entry)

          // Only read the values of sources with forms, or tracked walks would
          // depend on all values:
          if (hasFormSchema(componentSchema)) {
            const value = data[name]
            if (isArray(value)) {
              value.forEach(walkItem)
            } else if (value != null && !isListSource(componentSchema)) {
              // Lists only hold items in arrays. Apps may store them in other
              // values that `computeValue()` converts, e.g. objects by type:
              walkItem(value)
            }
          }

          // Their panels display the data that contains them, as above:
          walkTabOrPanelSchemas(componentSchema.panels, entry.componentPath)
        }
      }
    }
  }

  const walkTabOrPanelSchemas = (schemas, parentComponentPath) => {
    // Tabs and panels add their names to component paths, not to data paths,
    // except nested panels, which hold their data like nested components:
    for (const [name, tabOrPanelSchema] of Object.entries(schemas || {})) {
      if (hasNestedData(tabOrPanelSchema)) {
        walkComponents({ [name]: tabOrPanelSchema }, parentComponentPath)
      } else {
        const entry = {
          schema: tabOrPanelSchema,
          data,
          name: null,
          dataPath,
          itemDataPath: dataPath,
          componentPath: appendDataPath(parentComponentPath, name)
        }
        if (shouldWalk(entry) && !isPanelWithOwnData(tabOrPanelSchema)) {
          walkComponents(tabOrPanelSchema.fields, entry.componentPath)
        }
      }
    }
  }

  const components = isFunction(schema.fields)
    ? // Unnested components with `fields()` callbacks, e.g. sections:
      getItemFormSchema(
        schema,
        data,
        new SchemaContext(services, {
          schema,
          nested: false,
          data,
          dataPath,
          rootData
        })
      ).fields
    : schema.fields
  walkComponents(components, componentPath)
  // Walk the child sources like components of the form, unless they are:
  walkComponents(
    Object.fromEntries(
      childSourceSchemas
        .filter(({ name }) => !components?.[name])
        .map(child => [child.name, child])
    ),
    componentPath
  )
  walkTabOrPanelSchemas(schema.tabs, componentPath)
  walkTabOrPanelSchemas(schema.panels, componentPath)
}

// Walk the rendered components to the deepest one containing `dataPath`, e.g.
// `main/chapters/1` for `chapters/1` in the tab `main`. Of several components
// that display the same data, the first in schema order wins.
export function getComponentPathByDataPath(schema, data, dataPath, {
  dataPath: itemDataPath = '',
  componentPath = '',
  services = null,
  rootData = data
} = {}) {
  let deepestEntry = { dataPath: itemDataPath, componentPath }
  if (data) {
    walkComponentPaths(schema, data, {
      dataPath: itemDataPath,
      componentPath,
      services,
      rootData,
      // Only walk the rendered components that contain the value:
      shouldWalk: entry => (
        getRelativeDataPath(dataPath, entry.dataPath) !== null &&
        getSchemaValue('if', {
          type: Boolean,
          schema: entry.schema,
          context: SchemaContext.createForSchema(services, {
            ...entry,
            rootData
          }),
          default: true
        })
      ),
      visit: entry => {
        if (entry.dataPath.length > deepestEntry.dataPath.length) {
          deepestEntry = entry
        }
      }
    })
  }
  const relativeDataPath = getRelativeDataPath(dataPath, deepestEntry.dataPath)
  return relativeDataPath
    ? appendDataPath(deepestEntry.componentPath, relativeDataPath)
    : deepestEntry.componentPath
}

// Get the text of the value `name` of the item through the type of the
// component that edits it in the item's form, also in sections and tabs:
export function getItemDisplayValue(sourceSchema, item, name, {
  services,
  dataPath,
  context
}) {
  let schema = null
  walkData(getItemFormSchema(sourceSchema, item, context), item, {
    services,
    rootData: context.rootItem,
    // Leave out the items of nested sources:
    shouldWalk: entry => !getSourceType(entry.schema),
    visit: entry => {
      if (entry.name === name) {
        // Of several fields of the value, the first wins:
        schema ??= entry.node.fields[0]?.schema
      }
    }
  })
  const getDisplayValue = schema && getTypeDescriptor(schema)?.getDisplayValue
  return getDisplayValue
    ? getDisplayValue(
        SchemaContext.createForSchema(services, {
          schema,
          name,
          data: item,
          dataPath: appendDataPath(dataPath, name),
          rootData: context.rootItem
        })
      )
    : item[name]
}

export function getItemId(sourceSchema, item) {
  const id = item[sourceSchema.idKey || 'id']
  return id != null ? String(id) : undefined
}

// Lists of primitives have no items that could hold an order key:
export function hasItemsNumberedByOrderKey(source) {
  return !!source.orderKey && !source.itemAdapter
}

export function updateOrder(sourceSchema, list, offset = 0) {
  const { orderKey } = sourceSchema
  if (orderKey) {
    for (let i = 0; i < list.length; i++) {
      list[i][orderKey] = i + offset
    }
  }
  return list
}

export function getItemUid(sourceSchema, item) {
  // Pass ids through `getUid()` too, to associate them with the item in a weak
  // map, as `serializeData()` can filter out ids still used as component keys.
  return getUid(item, item => getItemId(sourceSchema, item))
}

// Copies refer to the related records outside of them by the labels of their
// options, which `toClipboard()` loads first:
function getRelatedLabels(entry, value, { services, rootData }) {
  const options = services.dataContext.model.getOptionsResolver(entry).value
  const context = SchemaContext.createForSchema(services, {
    ...entry,
    rootData
  })
  const toLabel = value => ({
    $label: getLabelForRelated(entry.schema, options ?? [], value, context)
  })
  return isArray(value) ? value.map(toLabel) : value && toLabel(value)
}

// Convert the value with the hook of its type first, then with the schema's:
export function convertValue(schema, hookName, value, createContext) {
  for (const convert of [
    getTypeDescriptor(schema)?.[hookName],
    schema[hookName]
  ]) {
    if (convert) {
      value = convert(createContext(value))
    }
  }
  return value
}

// Flags of type descriptors are booleans, or callbacks that return them:
function getDescriptorFlag(schema, key, context) {
  const flag = getTypeDescriptor(schema)?.[key]
  return isFunction(flag) ? flag(getContext(context)) : !!flag
}
