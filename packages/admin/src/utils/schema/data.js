import DitoContext from '../../DitoContext.js'
import { getUid } from '../uid.js'
import { SchemaGraph } from '../SchemaGraph.js'
import { appendDataPath, getRelativeDataPath } from '../data.js'
import { isMatchingType, convertType } from '../type.js'
import {
  isArray,
  isFunction,
  asArray,
  clone,
  getValueAtDataPath
} from '@ditojs/utils'
import { getTypeOptions } from './types.js'
import {
  someNestedSchemaComponent,
  hasNestedSchemaComponents,
  isNested
} from './structure.js'
import {
  hasFormSchema,
  hasMultipleFormSchemas,
  getFormSchemas,
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
      someNestedSchemaComponent(schema, component =>
        shouldRenderSchema(component, context)
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

/**
 * Returns whether the value of the component described by `schema` is
 * resolved from its data schema, `schema.data` or `schema.dataPath`, as for
 * the types with the `valueFromDataSchema` option, e.g. `computed`. See
 * `FormModel`.
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

export function setDefaultValues(schema, data = {}, component, {
  dataPath = null,
  rootData = data,
  shouldProcess
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
    if (!(name in data) && !shouldIgnoreMissingValue(schema, context)) {
      data[name] = getDefaultValue(schema, context)
    }
  }

  // Sets up a data object that has keys with default values for all
  // form fields, so they can be correctly watched for changes.
  return processSchemaData(schema, data, {
    dataPath,
    before,
    shouldProcess,
    options
  })
}

/**
 * Returns the value of the component described by `schema` and `name` in
 * `data`: the result of `schema.compute()` if it returns a value, else the
 * value in `data`, or its default if it's missing. Never writes into `data`:
 * Computed values are written by `FormModel`, and defaults when the data is
 * set up, see `setDefaultValues()`.
 */
export function computeValue(schema, data, name, dataPath, {
  component = null,
  rootData = component?.rootData
} = {}) {
  const context = () =>
    new DitoContext(component, {
      schema,
      // Override value to prevent endless recursion through calling the
      // getter for `this.value` in `DitoContext`:
      value: data[name],
      name,
      data,
      dataPath,
      rootData
    })
  const { compute } = schema
  if (compute) {
    const value = compute(getContext(context))
    if (value !== undefined) {
      return value
    }
  }
  return name in data || shouldIgnoreMissingValue(schema, context)
    ? data[name]
    : getDefaultValue(schema, context)
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
  target
} = {}) {
  const options = { component, rootData, schemaOnly, target }
  const processedData = cloneItem(sourceSchema, data, options)
  const graph = new SchemaGraph()

  const before = ({ schema, data, name, dataPath, processedData }) => {
    let value = computeValue(schema, data, name, dataPath, options)
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
    if (process) {
      value = process(getContext(context))
    }

    if (shouldExcludeValue(schema, context)) {
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
 */
export function processSchemaData(schema, data, {
  dataPath = null,
  componentPath = '',
  processedData = null,
  before = null,
  after = null,
  shouldProcess = () => true,
  options
}) {
  const walkOptions = { before, after, shouldProcess, options }
  const getDataPath = (dataPath, token) =>
    dataPath != null
      ? appendDataPath(dataPath, token)
      : null

  const processComponents = (components, parentComponentPath) => {
    if (components) {
      for (const [name, componentSchema] of Object.entries(components)) {
        const isNestedComponent = isNested(componentSchema)
        const componentDataPath = isNestedComponent
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
        if (!isNestedComponent) {
          // Recursively process data on unnested components.
          processSchemaData(componentSchema, data, {
            ...walkOptions,
            dataPath,
            componentPath: entry.componentPath,
            processedData
          })
        } else {
          const processItem = (item, index = null) => {
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
                processedData: processedItem
              })
            } else {
              // Items without a matching form, e.g. of an unknown type, are
              // passed through as shallow clones.
              return { ...item }
            }
          }

          before?.(entry)

          let value = processedData ? processedData[name] : data[name]
          if (value != null && hasFormSchema(componentSchema)) {
            // Recursively process data on nested form items.
            if (isArray(value)) {
              // Optimization: No need to collect values if we're not cloning!
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

          after?.(entry)
        }
      }
    }
  }

  const processTabOrPanelSchemas = schemas => {
    // Tabs and panels add their names to component paths, not to data paths.
    for (const [name, tabOrPanelSchema] of Object.entries(schemas || {})) {
      const entry = {
        schema: tabOrPanelSchema,
        data,
        name: null,
        dataPath,
        componentPath: appendDataPath(componentPath, name),
        processedData
      }
      if (shouldProcess(entry)) {
        processComponents(tabOrPanelSchema.components, entry.componentPath)
      }
    }
  }

  processComponents(schema.components, componentPath)
  processTabOrPanelSchemas(schema.tabs)
  processTabOrPanelSchemas(schema.panels)

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
