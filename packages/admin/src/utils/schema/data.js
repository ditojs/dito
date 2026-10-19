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
  isSourceWithResource,
  isListSource,
  hasNestedData
} from './structure.js'
import { getLabelForRelated } from './options.ts'
import {
  hasFormSchema,
  hasMultipleFormSchemas,
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

export function getDefaultValue(schema, context) {
  // NOTE: Components may not be instantiated when items are created, e.g. in
  // nested forms, so the type descriptors define `defaultValue`:
  const defaultValue =
    schema.default !== undefined
      ? schema.default
      : getTypeDescriptor(schema)?.defaultValue
  return isFunction(defaultValue)
    ? toModelData(defaultValue(getContext(context)))
    : clone(defaultValue)
}

// Types without values, e.g. buttons, get no key, like in the data of items
// that `computeValue()` returns:
export function setDefaultValue(schema, data, name, context) {
  const value = getDefaultValue(schema, context)
  if (value !== undefined) {
    data[name] = value
  }
}

export function shouldExcludeValue(schema, context) {
  const exclude =
    schema.exclude !== undefined
      ? schema.exclude
      : getTypeDescriptor(schema)?.defaultExclude
  return isFunction(exclude) ? exclude(getContext(context)) : !!exclude
}

function shouldIgnoreMissingValue(schema, context) {
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
  shouldWalk,
  shouldSkipSourcesWithResource = false,
  // New data starts with all defaults for `computeValue()` to rely on, but in
  // loaded data, `computeValue()` may derive missing values instead:
  shouldSetDefaultsOfComponentsWithCompute = true
} = {}) {
  const options = { services, rootData }

  const before = ({ schema, data, name, dataPath, itemDataPath }) => {
    const context = () =>
      SchemaContext.createForSchema(services, {
        schema,
        name,
        data,
        dataPath,
        itemDataPath,
        rootData
      })
    const shouldSetDefault = shouldSetDefaultValue(
      schema,
      data,
      name,
      context,
      { shouldSetDefaultsOfComponentsWithCompute }
    )
    if (shouldSetDefault) {
      setDefaultValue(schema, data, name, context)
    }
    if (hasItemsNumberedByOrderKey(schema) && isArray(data[name])) {
      updateOrder(schema, data[name])
    }
  }

  return walkSchemaData(schema, data, {
    dataPath,
    before,
    shouldWalk,
    shouldSkipSourcesWithResource,
    options
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

// Copy what identifies the item, for its serialized values to be added to:
function cloneItem(sourceSchema, item) {
  const copy = {}
  const { idKey = 'id', orderKey } = sourceSchema
  const id = item[idKey]
  if (id !== undefined) {
    copy[idKey] = id
  }
  if (hasMultipleFormSchemas(sourceSchema)) {
    copy.type = item.type
  }
  if (orderKey) {
    copy[orderKey] = item[orderKey]
  }
  return copy
}

export function serializeData(schema, sourceSchema, data, dataPath, {
  services,
  rootData,
  target
} = {}) {
  const options = { services, rootData, target }
  // Data without a source, e.g. of dialogs and panels, has nothing to identify:
  const serializedRootData = sourceSchema ? cloneItem(sourceSchema, data) : {}
  const graph = new SchemaGraph(dataPath)

  const before = ({
    schema,
    data,
    name,
    dataPath,
    itemDataPath,
    serializedData
  }) => {
    const value = getValueOrDefault(
      schema,
      data,
      name,
      () =>
        SchemaContext.createForSchema(services, {
          schema,
          name,
          data,
          dataPath,
          itemDataPath,
          rootData: options.rootData
        })
    )
    // The forms of the items expect them wrapped by the item adapter of the
    // schema, so wrap before and unwrap after. Always shallow-clone arrays:
    const itemAdapter = getItemAdapter(schema)
    serializedData[name] = isArray(value)
      ? itemAdapter
        ? value.map(itemAdapter.wrap)
        : [...value]
      : value
  }

  const after = ({
    schema,
    data,
    name,
    dataPath,
    itemDataPath,
    serializedData
  }) => {
    const itemAdapter = getItemAdapter(schema)
    let value = serializedData[name]
    // Unwrap the items again, to bring the data back into its native form:
    if (itemAdapter && isArray(value)) {
      value = value.map(itemAdapter.unwrap)
    }
    // Register the sources and relations whose ids the graph serializes:
    let labels
    if (getSourceType(schema)) {
      graph.addSource(dataPath, schema)
    } else if (schema.relate) {
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
    const createContext = value =>
      new SchemaContext(services, {
        schema,
        value,
        name,
        nested: true,
        data,
        dataPath,
        itemDataPath,
        rootData: options.rootData,
        // For `serializedItem` and `serializedRootItem`:
        serializedData,
        serializedRootData
      })
    // Convert before `exclude`, so `serializeValue()` can write other values
    // into `serializedItem`. Values that it returns nothing for, e.g. of
    // virtual fields, leave out their key:
    value = convertValue(schema, 'serializeValue', value, createContext)
    if (
      value === undefined ||
      shouldExcludeValue(schema, () => createContext(value))
    ) {
      delete serializedData[name]
    } else {
      serializedData[name] = labels ?? value
    }
  }

  walkSchemaData(schema, data, {
    dataPath,
    serializedData: serializedRootData,
    before,
    after,
    options
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
  // Of several components of the same value, the first decides:
  const entriesByDataPath = new Map()
  walkSchemaData(schema, data, {
    dataPath: itemDataPath,
    // Only walk the components that contain the value:
    shouldWalk: entry => getRelativeDataPath(dataPath, entry.dataPath) !== null,
    before: entry => {
      if (!entriesByDataPath.has(entry.dataPath)) {
        entriesByDataPath.set(entry.dataPath, entry)
      }
    },
    options: { services, rootData }
  })
  const entries = [...entriesByDataPath.values()]
  const excludedEntry = entries.findLast(
    entry =>
      shouldExcludeValue(entry.schema, () =>
        SchemaContext.createForSchema(services, { ...entry, rootData })
      )
  )
  if (excludedEntry) {
    return !isSourceWithResource(excludedEntry.schema)
  }
  const holder = entries.at(-1)
  if (!holder) {
    return true
  }
  const relativeDataPath = getRelativeDataPath(dataPath, holder.dataPath)
  return (
    hasFormSchema(holder.schema) &&
    relativeDataPath !== '' &&
    !(isListSource(holder.schema) && /^\d+$/.test(relativeDataPath))
  )
}

// Convert the stored values of `data` in place to the values that the
// components edit. Values are converted before the items in them are walked:
export function deserializeData(schema, data, {
  services = null,
  dataPath = null,
  rootData = data,
  shouldWalk
} = {}) {
  const before = ({ schema, data, name, dataPath, itemDataPath }) => {
    if (name in data) {
      const createContext = value =>
        new SchemaContext(services, {
          schema,
          value,
          name,
          nested: true,
          data,
          dataPath,
          itemDataPath,
          rootData
        })
      const value = convertValue(
        schema,
        'deserializeValue',
        data[name],
        createContext
      )
      if (value !== data[name]) {
        data[name] = value
      }
    }
  }
  walkSchemaData(schema, data, {
    dataPath,
    before,
    shouldWalk,
    options: { services, rootData }
  })
  return data
}

// Walk `data` along the components of `schema`, the forms of items and their
// child sources, and call `before()` and `after()` for each nested component.
// NOTE: Items with an item adapter are walked wrapped, and the wrapped value
// keeps the item's data path. Walks in place write changed values back.
export function walkSchemaData(schema, data, {
  dataPath = null,
  componentPath = '',
  serializedData = null,
  wrappedValueName = null,
  childSourceSchemas = [],
  before = null,
  after = null,
  shouldWalk = () => true,
  shouldSkipSourcesWithResource = false,
  options
}) {
  const walkOptions = {
    before,
    after,
    shouldWalk,
    shouldSkipSourcesWithResource,
    options
  }
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
          componentPath: appendDataPath(parentComponentPath, name),
          serializedData
        }
        if (!shouldWalk(entry)) {
          continue
        }
        if (
          shouldSkipSourcesWithResource &&
          isSourceWithResource(componentSchema)
        ) {
          // Their panels display the data that contains them:
          walkTabOrPanelSchemas(componentSchema.panels, entry.componentPath)
          continue
        }
        if (isPanelWithOwnData(componentSchema)) {
          // The components of panels with their own data don't edit `data`.
          continue
        }
        if (!isNestedComponent) {
          walkSchemaData(componentSchema, data, {
            ...walkOptions,
            dataPath,
            componentPath: entry.componentPath,
            serializedData
          })
        } else {
          const itemAdapter = getItemAdapter(componentSchema)
          const walkItem = (item, index = null) => {
            // Serialized data holds the items wrapped already:
            const isWrapping = !!itemAdapter && !serializedData
            const value = item
            if (isWrapping) {
              item = itemAdapter.wrap(value)
            }
            if (!isObject(item)) {
              // Values that aren't objects hold no data of the form, e.g. ones
              // that `computeValue()` converts to objects:
              return item
            }
            const itemDataPath =
              index !== null
                ? getDataPath(componentDataPath, index)
                : componentDataPath
            const itemComponentPath =
              index !== null
                ? appendDataPath(entry.componentPath, index)
                : entry.componentPath
            const context = SchemaContext.createForSchema(options.services, {
              ...entry,
              rootData: options.rootData
            })
            const form = getItemFormSchemaFromForms(
              getFormSchemas(componentSchema, context),
              item
            )
            if (form) {
              const serializedItem = serializedData
                ? cloneItem(componentSchema, item)
                : null
              const result = walkSchemaData(form, item, {
                ...walkOptions,
                dataPath: itemDataPath,
                componentPath: itemComponentPath,
                serializedData: serializedItem,
                wrappedValueName: itemAdapter?.name ?? null,
                childSourceSchemas: getChildSourceSchemas(componentSchema)
              })
              const unwrapped = isWrapping ? itemAdapter.unwrap(item) : value
              if (unwrapped !== value) {
                if (index !== null) {
                  data[name][index] = unwrapped
                } else {
                  data[name] = unwrapped
                }
              }
              return result
            } else {
              // Pass through items without a matching form, e.g. unknown types:
              return { ...item }
            }
          }

          before?.(entry)

          // Only read the values of sources with forms, or tracked walks would
          // depend on all values:
          if (hasFormSchema(componentSchema)) {
            let value = serializedData ? serializedData[name] : data[name]
            if (value != null) {
              if (isArray(value)) {
                // Optimization: No need to collect values if not cloning!
                value = serializedData
                  ? value.map(walkItem)
                  : value.forEach(walkItem)
              } else if (!isListSource(componentSchema)) {
                // Lists only hold items in arrays. Apps may store them in other
                // values that `computeValue()` converts, e.g. objects by type:
                value = walkItem(value)
              }
              if (serializedData) {
                serializedData[name] = value
              }
            }
          }

          after?.(entry)
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
          componentPath: appendDataPath(parentComponentPath, name),
          serializedData
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
        new SchemaContext(options.services, {
          schema,
          nested: false,
          data,
          dataPath,
          rootData: options.rootData
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

  return serializedData || data
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
    walkSchemaData(schema, data, {
      dataPath: itemDataPath,
      componentPath,
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
      before: entry => {
        if (entry.dataPath.length > deepestEntry.dataPath.length) {
          deepestEntry = entry
        }
      },
      options: { services, rootData }
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
  walkSchemaData(getItemFormSchema(sourceSchema, item, context), item, {
    // Leave out the items of nested sources:
    shouldWalk: entry => !getSourceType(entry.schema),
    before: entry => {
      if (entry.name === name) {
        // Of several components of the value, the first wins:
        schema ??= entry.schema
      }
    },
    options: { services, rootData: context.rootItem }
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
export function hasItemsNumberedByOrderKey(schema) {
  return !!schema.orderKey && !getItemAdapter(schema)
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
function convertValue(schema, hookName, value, createContext) {
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
