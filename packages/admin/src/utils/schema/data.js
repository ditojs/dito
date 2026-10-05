import DitoContext from '../../DitoContext.js'
import { getUid } from '../uid.js'
import { SchemaGraph } from '../SchemaGraph.js'
import { appendDataPath, getRelativeDataPath } from '../data.js'
import { isMatchingType, convertType } from '../type.js'
import {
  isObject,
  isArray,
  isFunction,
  asArray,
  clone,
  getValueAtDataPath
} from '@ditojs/utils'
import { getTypeOptions, getSourceType } from './types.js'
import {
  someNestedSchemaComponent,
  hasNestedSchemaComponents,
  isPanelWithOwnData,
  isSourceWithResource,
  isNested
} from './structure.js'
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
  // For performance reasons, data-paths in `keyOrDataPath` can only be
  // provided in in array format here:
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
  // Any schema value handled through `getSchemaValue()` can provide
  // a function that's resolved when the value is evaluated:
  if (callback && isFunction(value)) {
    value = value(context)
  }
  // Now finally see if we can convert to the expect types.
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

export function shouldRenderSchema(schema, context) {
  return (
    getSchemaValue('if', {
      type: Boolean,
      schema,
      context,
      default: true
    }) && (
      !hasNestedSchemaComponents(schema) ||
      // The components of sources, e.g. lists with inlined components, are
      // rendered for each item, with the item's own context:
      !!getSourceType(schema) ||
      // Evaluate the components with their own contexts, like when rendered:
      someNestedSchemaComponent(schema, (component, name) =>
        shouldRenderSchema(
          component,
          context.createChildContext(component, name)
        )
      )
    )
  )
}

function getContext(context) {
  return isFunction(context) ? context() : context
}

export function getDefaultValue(schema, context) {
  // Support default values both on schema and on component level.
  // NOTE: At the time of creation, components may not be instantiated, (e.g. if
  // entries are created through nested forms, the parent form isn't mounted) so
  // we can't use `dataPath` to get to components, and the `defaultValue` from
  // there. That's why `defaultValue` is defined statically in the components:
  const defaultValue =
    schema.default !== undefined
      ? schema.default
      : getTypeOptions(schema)?.defaultValue
  return isFunction(defaultValue)
    ? defaultValue(getContext(context))
    : clone(defaultValue)
}

// Sets the value of the component described by `schema` and `name` in `data`
// to its default. Types without values, e.g. buttons, have no default, and
// don't get a key in the data, which would make the data differ from data
// without it, e.g. from items that `compute()` returns.
export function setDefaultValue(schema, data, name, context) {
  const value = getDefaultValue(schema, context)
  if (value !== undefined) {
    data[name] = value
  }
}

export function shouldExcludeValue(schema, context) {
  const excludeValue =
    schema.exclude !== undefined
      ? schema.exclude
      : getTypeOptions(schema)?.excludeValue
  return isFunction(excludeValue)
    ? excludeValue(getContext(context))
    : !!excludeValue
}

export function shouldIgnoreMissingValue(schema, context) {
  return !!getTypeOptions(schema)?.ignoreMissingValue?.(getContext(context))
}

// Returns whether the value of the component described by `schema` and `name`
// is missing in `data`: if there's no value, or if the value is `null` and
// the type treats that as missing, e.g. nested sections.
export function isMissingValue(schema, data, name, context) {
  // Only read the value if needed, so that callers that are tracked, e.g. the
  // walk of the data model's data, don't depend on all values.
  return (
    !(name in data) || (
      !!getTypeOptions(schema)?.treatNullAsMissing?.(getContext(context)) &&
      data[name] === null
    )
  )
}

/**
 * Returns whether the value of the component described by `schema` is
 * resolved from its data schema, `schema.data` or `schema.dataPath`, as for
 * the types with the `valueFromDataSchema` option, e.g. `computed`. See
 * `DataModel`.
 */
export function hasValueFromDataSchema(schema) {
  return (
    !!getTypeOptions(schema)?.valueFromDataSchema &&
    !!(schema.data || schema.dataPath)
  )
}

export function getMultipleValue(schema) {
  return schema.multiple ?? !!getTypeOptions(schema)?.defaultMultiple
}

/**
 * Returns whether the value of the component described by `schema` and `name`
 * is missing in `data` and needs its default, see `initializeData()`.
 * `shouldSetDefaultsOfComponentsWithCompute` decides for components with
 * `compute()`, which may derive their missing values instead.
 */
export function shouldSetDefaultValue(schema, data, name, context, {
  shouldSetDefaultsOfComponentsWithCompute = true
} = {}) {
  return (
    (shouldSetDefaultsOfComponentsWithCompute || !schema.compute) &&
    isMissingValue(schema, data, name, context) &&
    !shouldIgnoreMissingValue(schema, context)
  )
}

/**
 * Initializes `data` for the components of `schema`: Sets missing values to
 * their defaults, so they can be correctly watched for changes, and numbers
 * the items of lists by their order key, see `updateOrder()`, so that their
 * order is stored even if it never changes.
 */
export function initializeData(schema, data = {}, component, {
  dataPath = null,
  rootData = data,
  shouldProcess,
  shouldSkipSourcesWithResource = false,
  // Whether to also set the defaults of components with `compute()`. New data
  // starts with all defaults, which `compute()` can rely on. In data that was
  // loaded, `compute()` may derive missing values instead, and they fall back
  // to their defaults only if it doesn't return a value, see `computeValue()`.
  shouldSetDefaultsOfComponentsWithCompute = true
} = {}) {
  const options = { component, rootData }

  const before = ({ schema, data, name, dataPath }) => {
    const context = () =>
      new DitoContext(component, {
        schema,
        name,
        data,
        dataPath,
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

  return processSchemaData(schema, data, {
    dataPath,
    before,
    shouldProcess,
    shouldSkipSourcesWithResource,
    options
  })
}

/**
 * Returns the value of the component described by `schema` and `name` in
 * `data`: the result of `schema.compute()` if it returns a value, else the
 * value in `data`, or its default if it's missing. Never writes into `data`:
 * `DataModel` is the only caller and writes the computed values, including the
 * defaults of components with `compute()`. Other defaults are written when the
 * data is set up, see `initializeData()`, or when they go missing later. If
 * provided, `getOptions()` returns the options for `context.options`, called
 * only when they're read.
 */
export function computeValue(schema, data, name, dataPath, {
  component = null,
  rootData = component?.rootData,
  getOptions = null
} = {}) {
  const context = () =>
    // Pass a function, so that the `options` getter isn't evaluated when the
    // context is created.
    new DitoContext(component, () => {
      const properties = {
        schema,
        // Override value to prevent endless recursion through calling the
        // getter for `this.value` in `DitoContext`. Read it only when it's
        // used, so that `compute()` only depends on its own value if it reads
        // it, and writing the computed value doesn't call it again.
        get value() {
          return data[name]
        },
        name,
        data,
        dataPath,
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
  const { compute } = schema
  // Like the data model, only compute values of components that are shown
  // through their `if`, as `compute()` may rely on the same conditions, e.g.
  // `if: ({ item }) => item.preview` with `compute: ({ item }) =>
  // item.preview.name`.
  if (
    compute &&
    getSchemaValue('if', {
      type: Boolean,
      schema,
      context: getContext(context),
      default: true
    })
  ) {
    const value = compute(getContext(context))
    if (value !== undefined) {
      return value
    }
  }
  return getValueOrDefault(schema, data, name, context)
}

// Returns the value in `data`, or its default if it's missing. `context` can be
// a function that creates the context, called only when it's needed. Computed
// values are in `data` already, as `DataModel` writes them, see
// `computeValue()`.
export function getValueOrDefault(schema, data, name, context) {
  const shouldUseDefault = (
    isMissingValue(schema, data, name, context) &&
    !shouldIgnoreMissingValue(schema, context)
  )
  return shouldUseDefault ? getDefaultValue(schema, context) : data[name]
}

function cloneItem(sourceSchema, item, options) {
  if (options.schemaOnly) {
    const copy = {}
    const { idKey = 'id', orderKey } = sourceSchema
    const id = item[idKey]
    if (id !== undefined) {
      copy[idKey] = id
    }
    // Copy over type in case there are multiple forms to choose from.
    if (hasMultipleFormSchemas(sourceSchema)) {
      copy.type = item.type
    }
    if (orderKey) {
      copy[orderKey] = item[orderKey]
    }
    return copy
  } else {
    return { ...item }
  }
}

export function processData(schema, sourceSchema, data, dataPath, {
  component,
  rootData,
  schemaOnly, // whether to only include data covered by the schema, or all data
  target,
  // Whether to call the schema callbacks `process()`. Data that is compared
  // while it's edited, e.g. by `DataModel.isDirty`, isn't validated yet, which
  // the callbacks may rely on. Without them, the types still process the values
  // through `processValue()`, and the excluded values of components with
  // `process()` are kept, as `process()` may store them elsewhere through
  // `processedItem`. Computed values are in the data already, as `DataModel`
  // writes them, see `computeValue()`.
  shouldCallProcess = true
} = {}) {
  const options = { component, rootData, schemaOnly, target }
  const processedData = cloneItem(sourceSchema, data, options)
  const graph = new SchemaGraph()

  const before = ({ schema, data, name, dataPath, processedData }) => {
    let value = getValueOrDefault(
      schema,
      data,
      name,
      () =>
        DitoContext.createForSchema(component, {
          schema,
          name,
          data,
          dataPath,
          rootData: options.rootData
        })
    )
    // The schema expects the `wrapPrimitives` transformations to be present on
    // the data that it is applied on, so warp before and unwrap after.
    if (isArray(value)) {
      const { wrapPrimitives } = schema
      if (wrapPrimitives) {
        value = value.map(entry => ({
          [wrapPrimitives]: entry
        }))
      } else {
        // Always shallow-clone array values:
        value = [...value]
      }
    }
    processedData[name] = value
  }

  const after = ({ schema, data, name, dataPath, processedData }) => {
    const { wrapPrimitives, process } = schema
    let value = processedData[name]

    // NOTE: We don't cache this context, since `value` is changing.
    const context = () =>
      new DitoContext(component, {
        schema,
        value,
        name,
        data,
        dataPath,
        rootData: options.rootData,
        // Pass the already processed data to `process()`, so it can be modified
        // through `processedItem` from there.
        processedData
      })

    // First unwrap the wrapped primitives again, to bring the data back into
    // its native form. See `before()` for more details.
    if (wrapPrimitives && isArray(value)) {
      value = value.map(object => object[wrapPrimitives])
    }

    // Each component type can provide its own static `processValue()` method
    // to convert the data for storage.
    const processValue = getTypeOptions(schema)?.processValue
    if (processValue) {
      value = processValue(getContext(context), graph)
    }

    // Handle the user's `process()` callback next, if one is provided, so that
    // it can modify data in `processedData` even if it provides `exclude: true`
    if (process && shouldCallProcess) {
      value = process(getContext(context))
    }

    // Without calling `process()`, keep the excluded values that it may store
    // elsewhere, see `shouldCallProcess`:
    const shouldKeepExcludedValue = !!process && !shouldCallProcess
    if (!shouldKeepExcludedValue && shouldExcludeValue(schema, context)) {
      delete processedData[name]
    } else {
      processedData[name] = value
    }
  }

  processSchemaData(schema, data, {
    dataPath,
    processedData,
    before,
    after,
    options
  })

  return graph.process(sourceSchema, processedData, options)
}

/**
 * Walks `data` along the components of `schema`, including nested forms of
 * list and object items, calling `before()` and `after()` for each nested
 * component, e.g. to process the data into `processedData`. `shouldProcess()`
 * is called for all components, tabs and panels, and the ones for which it
 * returns `false` are skipped along with their content. The entries passed to
 * them contain the `componentPath` of the component, tab or panel, continuing
 * `componentPath` like `DitoMixin.componentPath` does.
 *
 * With `shouldSkipSourcesWithResource`, sources with their own resource are
 * skipped along with their items, which they load and save through their
 * resource, but not their panels, which display the data that contains them,
 * see `DitoContainer.panelEntries`.
 *
 * The primitive values of lists with `wrapPrimitives` are walked wrapped in
 * objects under the `wrapPrimitives` key, like the admin edits them, see
 * `SourceMixin`. `wrappedPrimitiveName` is that key while walking such an
 * object, and its component keeps the data path of the item, where the admin
 * maps errors of the value to. Values written into the objects don't reach
 * the data, e.g. defaults, as the primitive values themselves are the data.
 */
export function processSchemaData(schema, data, {
  dataPath = null,
  componentPath = '',
  processedData = null,
  wrappedPrimitiveName = null,
  before = null,
  after = null,
  shouldProcess = () => true,
  shouldSkipSourcesWithResource = false,
  options
}) {
  const walkOptions = {
    before,
    after,
    shouldProcess,
    shouldSkipSourcesWithResource,
    options
  }
  const getDataPath = (dataPath, token) =>
    dataPath != null
      ? appendDataPath(dataPath, token)
      : null

  const processComponents = (components, parentComponentPath) => {
    if (components) {
      for (const [name, componentSchema] of Object.entries(components)) {
        const isNestedComponent = isNested(componentSchema)
        const isWrappedPrimitive = name === wrappedPrimitiveName
        const componentDataPath =
          isNestedComponent && !isWrappedPrimitive
            ? getDataPath(dataPath, name)
            : dataPath
        const entry = {
          schema: componentSchema,
          data,
          name,
          dataPath: componentDataPath,
          componentPath: appendDataPath(parentComponentPath, name),
          processedData
        }
        if (!shouldProcess(entry)) {
          continue
        }
        if (
          shouldSkipSourcesWithResource &&
          isSourceWithResource(componentSchema)
        ) {
          processTabOrPanelSchemas(componentSchema.panels, entry.componentPath)
          continue
        }
        if (isPanelWithOwnData(componentSchema)) {
          // The components of panels with their own data don't edit `data`.
          continue
        }
        if (!isNestedComponent) {
          // Recursively process data on unnested components.
          processSchemaData(componentSchema, data, {
            ...walkOptions,
            dataPath,
            componentPath: entry.componentPath,
            processedData
          })
        } else {
          const { wrapPrimitives } = componentSchema
          const processItem = (item, index = null) => {
            // Data that isn't processed holds the primitive values themselves,
            // processed data holds them wrapped already, see `processData()`.
            if (wrapPrimitives && !isObject(item)) {
              item = { [wrapPrimitives]: item }
            }
            const itemDataPath =
              index !== null
                ? getDataPath(componentDataPath, index)
                : componentDataPath
            const itemComponentPath =
              index !== null
                ? appendDataPath(entry.componentPath, index)
                : entry.componentPath
            const context = new DitoContext(options.component, {
              schema: componentSchema,
              data,
              dataPath: componentDataPath,
              name,
              rootData: options.rootData
            })
            const getForms = (
              getTypeOptions(componentSchema)?.getFormSchemasForProcessing ||
              getFormSchemas
            )
            const forms = getForms(componentSchema, context)
            const form = getItemFormSchemaFromForms(forms, item)
            if (form) {
              const processedItem = processedData
                ? cloneItem(componentSchema, item, options)
                : null
              return processSchemaData(form, item, {
                ...walkOptions,
                dataPath: itemDataPath,
                componentPath: itemComponentPath,
                processedData: processedItem,
                wrappedPrimitiveName: wrapPrimitives ?? null
              })
            } else {
              // Items without a matching form, e.g. of an unknown type, are
              // passed through as shallow clones.
              return { ...item }
            }
          }

          before?.(entry)

          // Only read the values of sources with forms, so that callers that
          // are tracked, e.g. the walk of the data model's data, don't depend
          // on all values.
          if (hasFormSchema(componentSchema)) {
            let value = processedData ? processedData[name] : data[name]
            if (value != null) {
              // Recursively process data on nested form items.
              if (isArray(value)) {
                // Optimization: No need to collect values if not cloning!
                value = processedData
                  ? value.map(processItem)
                  : value.forEach(processItem)
              } else {
                value = processItem(value)
              }
              if (processedData) {
                processedData[name] = value
              }
            }
          }

          after?.(entry)
          // The panels of nested components display the data that contains
          // the components, like the ones of unnested components, see
          // `DitoContainer.panelEntries`.
          processTabOrPanelSchemas(componentSchema.panels, entry.componentPath)
        }
      }
    }
  }

  const processTabOrPanelSchemas = (schemas, parentComponentPath) => {
    // Tabs and panels add their names to component paths, not to data paths.
    for (const [name, tabOrPanelSchema] of Object.entries(schemas || {})) {
      const entry = {
        schema: tabOrPanelSchema,
        data,
        name: null,
        dataPath,
        componentPath: appendDataPath(parentComponentPath, name),
        processedData
      }
      // The components of panels with their own data don't edit `data`.
      if (shouldProcess(entry) && !isPanelWithOwnData(tabOrPanelSchema)) {
        processComponents(tabOrPanelSchema.components, entry.componentPath)
      }
    }
  }

  const components = isFunction(schema.components)
    ? // Unnested components with `components()` callbacks, e.g. sections:
      getItemFormSchema(
        schema,
        data,
        new DitoContext(options.component, {
          schema,
          data,
          dataPath,
          rootData: options.rootData
        })
      ).components
    : schema.components
  processComponents(components, componentPath)
  processTabOrPanelSchemas(schema.tabs, componentPath)
  processTabOrPanelSchemas(schema.panels, componentPath)

  return processedData || data
}

/**
 * Returns the component path of the value at `dataPath` in `data`, by walking
 * `data` along the components of `schema` to the deepest component that
 * contains the value, e.g. `main/chapters/1` for `chapters/1`, with the list
 * `chapters` in the tab `main`. The part of `dataPath` inside that component,
 * e.g. item indices, is appended to its component path. Of several components
 * that display the same data, the first in schema order is used.
 */
export function getComponentPathByDataPath(schema, data, dataPath, {
  componentPath = '',
  component = null,
  rootData = data
} = {}) {
  let deepestEntry = { dataPath: '', componentPath }
  if (data) {
    processSchemaData(schema, data, {
      dataPath: '',
      componentPath,
      // Only walk the components that contain the value at `dataPath`:
      shouldProcess: entry => (
        getRelativeDataPath(dataPath, entry.dataPath) !== null
      ),
      before: entry => {
        if (entry.dataPath.length > deepestEntry.dataPath.length) {
          deepestEntry = entry
        }
      },
      options: { component, rootData }
    })
  }
  const relativeDataPath = getRelativeDataPath(dataPath, deepestEntry.dataPath)
  return relativeDataPath
    ? appendDataPath(deepestEntry.componentPath, relativeDataPath)
    : deepestEntry.componentPath
}

export function getItemId(sourceSchema, item) {
  const id = item[sourceSchema.idKey || 'id']
  return id != null ? String(id) : undefined
}

// Returns whether the items of the list described by `schema` are numbered by
// its `orderKey`, see `updateOrder()`. Lists of primitives have no items that
// could hold an order key.
export function hasItemsNumberedByOrderKey(schema) {
  return !!schema.orderKey && !schema.wrapPrimitives
}

export function updateOrder(sourceSchema, list, paginationRange) {
  const { orderKey } = sourceSchema
  if (orderKey) {
    // Reorder the changed entries by their order key, taking pagination
    // offsets into account:
    const offset = paginationRange?.[0] || 0
    for (let i = 0; i < list.length; i++) {
      list[i][orderKey] = i + offset
    }
  }
  return list
}

export function getItemUid(sourceSchema, item) {
  // Try to use the item id as the uid, falling back on auto-generated ids, but
  // either way, pass through `getUid()` so that the ids are associated with the
  // item through a weak map, as the ids can be filtered out in `processData()`
  // while the components that use the uids as key are still visible.
  return getUid(item, item => getItemId(sourceSchema, item))
}
