import SchemaContext from '../../SchemaContext.js'
import { getUid } from '../uid.js'
import { SchemaGraph } from '../SchemaGraph.js'
import { getRelativeDataPath, getItemDataPath } from '../data.js'
import { isArray, isFunction, resolveDataPath } from '@ditojs/utils'
import { getSchemaValue } from './value.js'
import { getLabelForValue } from './options.ts'
import {
  walkData,
  cloneItem,
  getSchemaSource,
  getReferenceSchema
} from './walk.js'
import { getFormSchemas, getItemFormSchema } from './lookup.js'

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

// Set missing values to their defaults to watch them for changes, and number
// list items by their order key to store their order even if it never changes.
export function initializeData(schema, data = {}, services, {
  dataPath = null,
  rootData = data,
  shouldSkipSourcesWithResource = false,
  // New data starts with all defaults for `computeValue()` to rely on, but in
  // loaded data, `computeValue()` may derive missing values instead:
  shouldSetDefaultsOfComputedValues = true
} = {}) {
  const visit = entry => {
    const { node, data, name } = entry
    node.getPropertyNode(entry)?.setDefaultValue(entry, {
      shouldSetDefaultsOfComputedValues
    })
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
// Return `undefined` when nothing is computed, for the value to stay.
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
      context: context(),
      default: true
    })
  ) {
    return computeValue(context())
  }
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
  // Resolve the property of each value once, for `visit()` and `after()`:
  const propertyNodesByEntry = new WeakMap()

  const visit = entry => {
    const { node, data, name, serializedData } = entry
    const propertyNode = node.getPropertyNode(entry)
    propertyNodesByEntry.set(entry, propertyNode)
    // Save missing values, and `null` in values that aren't `nullable`, with
    // the default of their property:
    const value = propertyNode?.shouldSetDefaultValue(entry)
      ? propertyNode.getDefaultValue(entry)
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
    const { source, relation } = node
    const itemAdapter = source?.itemAdapter
    let value = serializedData[name]
    // Unwrap the items again, to bring the data back into its native form:
    if (itemAdapter && isArray(value)) {
      value = value.map(itemAdapter.unwrap)
    }
    // Register the sources and relations whose ids the graph serializes:
    let labels
    let referenceLabel = null
    if (source) {
      graph.addSource(dataPath, source)
    } else if (relation) {
      const { schema, hasOptions } = relation
      // Internally related data (`options.dataPath`) needs both the options
      // (for '#ref') and the value ('#id') serialized:
      const path = schema.options?.dataPath
      const relatedDataPath = path
        ? resolveDataPath(getItemDataPath(dataPath, true), path)
        : null
      graph.addRelation(dataPath, relatedDataPath, schema)
      if (
        target === 'clipboard' &&
        hasOptions &&
        !graph.isInternal(relatedDataPath)
      ) {
        labels = getRelatedLabels(
          { schema, data, name, dataPath, itemDataPath },
          value,
          options
        )
      }
    } else if (target === 'clipboard') {
      // Items that reference a record by their id hold its label instead:
      const schema = getReferenceSchema(entry)
      if (schema) {
        referenceLabel = getRelatedLabels(
          { schema, data, name, dataPath, itemDataPath },
          value,
          options
        )
      }
    }
    // Values that are excluded or that `serializeValue()` returns nothing for,
    // e.g. of virtual fields, leave out their key:
    value = propertyNodesByEntry.get(entry)?.serialize(value, entry)
    if (value === undefined) {
      delete serializedData[name]
    } else if (referenceLabel) {
      delete serializedData[name]
      Object.assign(serializedData, referenceLabel)
    } else {
      serializedData[name] = labels ?? value
    }
  }

  walkData(schema, data, {
    dataPath,
    services,
    rootData,
    sourceSchema,
    serializedData: serializedRootData,
    // Hidden values aren't sent:
    shouldSkipIrrelevant: true,
    visit,
    after
  })

  return graph.serialize(sourceSchema, serializedRootData, options)
}

// Return whether the value at `dataPath` isn't sent, as no node holds it or one
// that contains it is excluded:
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
  const excludedEntry = entries.findLast(
    entry => entry.node.getPropertyNode(entry)?.isExcluded(entry)
  )
  if (excludedEntry) {
    // Sources with their own resource send their data themselves:
    return !excludedEntry.node.source?.hasResource
  }
  const holder = entries.at(-1)
  if (!holder) {
    return true
  }
  // Of the items of lists and objects, only the values of their forms are sent:
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
    const propertyNode = node.getPropertyNode(entry)
    if (propertyNode && name in data) {
      const value = propertyNode.deserialize(data[name], entry)
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

// Return errors like the server, `{ [dataPath]: [{ message }] }`:
export function getDataValidationErrors(schema, data, {
  dataPath = '',
  services = null,
  rootData = data
} = {}) {
  let errors = null
  walkData(schema, data, {
    dataPath,
    services,
    rootData,
    // NOTE: Like rendering, this skips nested sections and panels whose fields
    // are all hidden, together with their own validations:
    shouldSkipIrrelevant: true,
    shouldSkipSourcesWithResource: true,
    visit: entry => {
      const valueErrors = (
        entry.node.getPropertyNode(entry)?.getValidationErrors(entry) ?? []
      )
      if (valueErrors.length > 0) {
        errors ||= {}
        errors[entry.dataPath] = valueErrors
      }
    }
  })
  return errors
}

// Get the text of the value `name` of the item from its node in the item's
// form, also in sections and tabs:
export function getItemDisplayValue(sourceSchema, item, name, {
  services,
  dataPath,
  context
}) {
  let valueEntry = null
  walkData(getItemFormSchema(sourceSchema, item, context), item, {
    dataPath,
    sourceSchema,
    services,
    rootData: context.rootItem,
    shouldSkipIrrelevant: true,
    // Only the values of the item itself:
    shouldWalk: () => false,
    // Tables display many items, so check only the fields of `name`:
    shouldVisit: entry => entry.name === name,
    visit: entry => {
      valueEntry = entry
    }
  })
  const propertyNode = valueEntry?.node.getPropertyNode(valueEntry)
  return propertyNode ? propertyNode.getDisplayValue(valueEntry) : item[name]
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

// Copies refer to the records outside of them by the labels of their options,
// which `toClipboard()` loads first:
function getRelatedLabels(entry, value, { services, rootData }) {
  const options =
    services.dataContext.model.fields.getOptionsResolver(entry).value
  const context = SchemaContext.createForSchema(services, {
    ...entry,
    rootData
  })
  const toLabel = value => ({
    $label: getLabelForValue(entry.schema, options ?? [], value, context)
  })
  return isArray(value) ? value.map(toLabel) : value && toLabel(value)
}
