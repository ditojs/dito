import SchemaContext from '../../SchemaContext.js'
import { computed, toRaw } from 'vue'
import { isArray, isObject, isFunction } from '@ditojs/utils'
import { appendDataPath } from '../data.js'
import {
  getSourceType,
  getItemAdapter,
  getChildSourceSchemas,
  getOptionsDataSchema
} from './types.ts'
import {
  hasNestedData,
  isPanelWithOwnData,
  isSourceWithResource,
  isListSource
} from './structure.js'
import {
  hasFormSchema,
  hasMultipleFormSchemas,
  getFormSchemas,
  getItemFormSchema,
  getItemFormSchemaFromForms
} from './lookup.js'
import {
  shouldRenderSchema,
  getEditedValue,
  getDefaultValue,
  shouldSetDefaultValue,
  shouldExcludeValue,
  hasComputedValueSource,
  convertValue
} from './data.js'
import { getValidations, getValueValidationErrors } from './validation.js'
import { createPropertyNodes } from './properties.js'

// A value in the data of a form, with all the fields that edit it in form
// order, e.g. from several tabs. Each field comes with the unnested sections,
// tabs, panels and fields that contain it, which decide whether it's walked
// too. In the entries that the walk visits, the node holds the walked fields
// and answers for the value. Each aspect of it comes from the first field that
// defines it itself, else from the first one:
export class FieldNode {
  constructor(name, fields) {
    this.name = name
    this.fields = fields
    // Fields of the same value agree on its shape, the first one with items
    // tells it:
    const sourceField = fields.find(
      ({ schema }) => getSourceType(schema) || hasFormSchema(schema)
    )
    this.source = sourceField ? getSchemaSource(sourceField.schema) : null
  }

  // The node of the fields that the walk accepts, with their containers:
  getWalkedNode(entry, { isWalked, shouldSkipSourcesWithResource }) {
    const fields = this.fields.filter(
      field => (
        field.containers.every(isWalked) &&
        isWalked(field) &&
        !(shouldSkipSourcesWithResource && isSourceWithResource(field.schema))
      )
    )
    return fields.length > 0 ? new FieldNode(this.name, fields) : null
  }

  // Of several fields of the same value, the first with a computed value or
  // options gets the record of the data model:
  getRecordedValue() {
    const field = this.fields.find(
      ({ schema }) => (
        hasComputedValueSource(schema) || getOptionsDataSchema(schema)
      )
    )
    return field
      ? {
          schema: field.schema,
          form: { fields: { [this.name]: field.schema } }
        }
      : null
  }

  // The forms of the items in the value, of each field that holds them:
  getItemForms(entry) {
    return this.fields
      .filter(({ schema }) => hasFormSchema(schema))
      .map(({ schema }) => ({
        forms: getFormSchemas(schema, createContext(schema, entry)),
        childSourceSchemas: getChildSourceSchemas(schema)
      }))
  }

  // Run the checks of all fields, each message once:
  getValidationErrors(entry) {
    const errors = []
    for (const { schema } of this.fields) {
      const context = createContext(schema, entry)
      // Validate the value as displayed, like the components do:
      const value = getEditedValue(schema, entry.data[entry.name], context)
      const valueErrors = getValueValidationErrors(
        value,
        getValidations(context)
      )
      const isNewError = ({ message }) =>
        !errors.some(error => error.message === message)
      errors.push(...valueErrors.filter(isNewError))
    }
    return errors
  }

  hasMissingValue(entry, options) {
    return !!this.#getDefaultingField(entry, options)
  }

  // The default of the value if it's missing, else `undefined`, also for types
  // without values. The first field with its own default sets it:
  getDefaultValue(entry, options) {
    const field = this.#getDefaultingField(entry, options)
    return field
      ? getDefaultValue(field.schema, () => createContext(field.schema, entry))
      : undefined
  }

  #getDefaultingField(entry, options) {
    const { data, name } = entry
    const hasOwnDefault = ({ schema }) => schema.default !== undefined
    return [
      ...this.fields.filter(hasOwnDefault),
      ...this.fields.filter(field => !hasOwnDefault(field))
    ].find(({ schema }) =>
      shouldSetDefaultValue(
        schema,
        data,
        name,
        () => createContext(schema, entry),
        options
      )
    )
  }

  // Convert the stored value to the one that the components edit:
  deserialize(value, entry) {
    const { schema } = getFieldDefining(this.fields, 'deserializeValue')
    return convertValue(schema, 'deserializeValue', value, value =>
      createValueContext(schema, value, entry)
    )
  }

  // Convert the value to the one to send, or `undefined` to leave it out.
  // Convert before `exclude`, so `serializeValue()` can write other values
  // into `serializedItem`:
  serialize(value, entry) {
    // For `serializedItem` and `serializedRootItem`:
    const { serializedData, serializedRootData } = entry
    const createContext = (schema, value) =>
      createValueContext(schema, value, entry, {
        serializedData,
        serializedRootData
      })
    const { schema } = getFieldDefining(this.fields, 'serializeValue')
    const serialized = convertValue(schema, 'serializeValue', value, value =>
      createContext(schema, value)
    )
    const { schema: excludeSchema } = getFieldDefining(this.fields, 'exclude')
    return (
      serialized === undefined ||
      shouldExcludeValue(excludeSchema, () =>
        createContext(excludeSchema, serialized)
      )
    )
      ? undefined
      : serialized
  }

  isExcluded(entry) {
    const { schema } = getFieldDefining(this.fields, 'exclude')
    return shouldExcludeValue(schema, () => createContext(schema, entry))
  }
}

// The nodes of the schemas without `fields()` callbacks, computed so that the
// forms that these callbacks create get new nodes once they're set up. Forms
// with written `properties` have a node per property:
const nodesBySchema = new WeakMap()

// Walk `data` along the nodes of `schema`, the forms of the items and their
// child sources. `visit()` receives an entry for each node with the fields that
// `shouldWalk()` accepts, if `shouldVisit()` accepts it, before the items of
// its value are walked, and `after()` after them. Only `shouldWalk()` also
// decides for the fields that a field contains, e.g. of its panels, and it's
// only asked for fields. With `shouldSkipIrrelevant`, irrelevant values are
// left out, and `shouldWalk()` is only asked for relevant fields and
// containers.
// NOTE: Items with an item adapter are walked wrapped, and the wrapped value
// keeps the item's data path. The walk writes changed values back, unless it
// builds a copy in `serializedData`: then it walks the values that `visit()`
// sets in the copy, with their items already wrapped, and replaces them with
// copies of their items.
export function walkData(schema, data, {
  dataPath = null,
  services = null,
  rootData = data,
  serializedData = null,
  shouldWalk = () => true,
  shouldVisit = () => true,
  shouldSkipSourcesWithResource = false,
  shouldSkipIrrelevant = false,
  visit,
  after = null
}) {
  // The copy of the root data, if the walk builds one:
  const serializedRootData = serializedData
  const getDataPath = (dataPath, token) =>
    dataPath != null ? appendDataPath(dataPath, token) : null

  const walkNodes = (
    nodes,
    data,
    dataPath,
    serializedData,
    wrappedValueName = null
  ) => {
    const createEntry = (name, isNested) => ({
      data,
      name,
      dataPath:
        isNested && name !== wrappedValueName
          ? getDataPath(dataPath, name)
          : dataPath,
      // The data path of `data`, which wrapped values keep:
      itemDataPath: dataPath,
      serializedData,
      serializedRootData,
      services,
      rootData
    })
    // Ask once per field and container, as fields contain the fields of their
    // panels:
    const isWalkedByField = new Map()
    const isWalked = field => {
      if (!isWalkedByField.has(field)) {
        const { schema, name } = field
        const entry = { schema, ...createEntry(name, hasNestedData(schema)) }
        isWalkedByField.set(
          field,
          (!shouldSkipIrrelevant || isRelevant(entry)) && shouldWalk(entry)
        )
      }
      return isWalkedByField.get(field)
    }
    for (const node of nodes.values()) {
      const location = createEntry(node.name, true)
      const walkedNode = node.getWalkedNode(location, {
        isWalked,
        shouldSkipIrrelevant,
        shouldSkipSourcesWithResource
      })
      if (walkedNode) {
        const entry = { node: walkedNode, ...location }
        if (shouldVisit(entry)) {
          visit(entry)
          walkItems(entry)
          after?.(entry)
        }
      }
    }
  }

  const walkItems = entry => {
    const { node, data, name, dataPath, serializedData } = entry
    const { source } = node
    // Only read the values of sources with forms, or tracked walks would
    // depend on all values:
    const value = source?.hasForms ? (serializedData ?? data)[name] : null
    if (value != null) {
      const { itemAdapter } = source
      const sources = node.getItemForms(entry)
      const wrappedValueName = itemAdapter?.name ?? null
      // Return the copy of the item when building a copy:
      const walkItem = (value, index = null) => {
        // The values in the copy hold their items wrapped already:
        const item =
          itemAdapter && !serializedData ? itemAdapter.wrap(value) : value
        // Values that aren't objects hold no data of the forms, e.g. ones
        // that `computeValue()` converts to objects:
        if (isObject(item)) {
          const itemDataPath =
            index !== null ? getDataPath(dataPath, index) : dataPath
          const nodes = getItemNodes(sources, item, itemDataPath)
          if (nodes && serializedData) {
            const serializedItem = cloneItem(source, item)
            walkNodes(
              nodes,
              item,
              itemDataPath,
              serializedItem,
              wrappedValueName
            )
            return serializedItem
          } else if (nodes) {
            walkNodes(nodes, item, itemDataPath, null, wrappedValueName)
            const unwrapped = itemAdapter ? itemAdapter.unwrap(item) : value
            if (unwrapped !== value) {
              if (index !== null) {
                data[name][index] = unwrapped
              } else {
                data[name] = unwrapped
              }
            }
          } else if (serializedData) {
            // Items without a matching form, e.g. of unknown types, stay as
            // they are, as shallow copies in copies:
            return { ...item }
          }
        }
        return value
      }
      if (isArray(value)) {
        if (serializedData) {
          serializedData[name] = value.map(walkItem)
        } else {
          value.forEach(walkItem)
        }
      } else if (!source.isList) {
        // Lists only hold items in arrays. Apps may store them in other values
        // that `computeValue()` converts, e.g. objects by type:
        const item = walkItem(value)
        if (serializedData) {
          serializedData[name] = item
        }
      }
    }
  }

  // The nodes of the item in the forms of all its sources, with their child
  // sources as fields of the forms, unless they have fields of their name:
  const getItemNodes = (sources, item, dataPath) => {
    const forms = new Set()
    const childSourceSchemas = []
    for (const source of sources) {
      const form = getItemFormSchemaFromForms(source.forms, item)
      if (form && !forms.has(form)) {
        forms.add(form)
        childSourceSchemas.push(
          ...source.childSourceSchemas.filter(
            ({ name }) => !form.fields?.[name]
          )
        )
      }
    }
    const nodesList = [...forms].map(form =>
      getFieldNodes(form, item, dataPath)
    )
    return nodesList.length === 1 && childSourceSchemas.length === 0
      ? nodesList[0]
      : nodesList.length > 0
        ? mergeFieldNodes(nodesList, childSourceSchemas)
        : null
  }

  // The fields of `fields()` callbacks depend on the data, like when rendered:
  const getFields = (schema, data, dataPath) =>
    isFunction(schema.fields)
      ? getItemFormSchema(
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

  const getFieldNodes = (schema, data, dataPath) => {
    let nodes = nodesBySchema.get(toRaw(schema))
    if (!nodes) {
      nodes = computed(() => {
        if (schema.properties) {
          return createPropertyNodes(schema.properties)
        }
        let hasFieldsCallbacks = false
        const nodes = createFieldNodes(schema, schema => {
          hasFieldsCallbacks ||= isFunction(schema.fields)
          return schema.fields
        })
        return hasFieldsCallbacks ? null : nodes
      })
      nodesBySchema.set(toRaw(schema), nodes)
    }
    return (
      nodes.value ??
      createFieldNodes(schema, schema => getFields(schema, data, dataPath))
    )
  }

  walkNodes(
    getFieldNodes(schema, data, dataPath),
    data,
    dataPath,
    serializedData
  )
  return data
}

// Unnested sections contribute their fields to the nodes of their form, and so
// do tabs and panels, and nested panels hold their data like nested fields:
function createFieldNodes(schema, getFields) {
  const nodes = new Map()

  const addFields = (fields, containers) => {
    for (const [name, field] of Object.entries(fields || {})) {
      // The fields of panels with their own data don't edit the form's data:
      if (!isPanelWithOwnData(field)) {
        if (hasNestedData(field)) {
          const nodeField = { schema: field, name, containers }
          addFieldNode(nodes, nodeField)
          // Their panels display the data that contains them:
          addTabsOrPanels(field.panels, [...containers, nodeField])
        } else {
          addSchema(field, [...containers, { schema: field, name }])
        }
      }
    }
  }

  const addTabsOrPanels = (schemas, containers) => {
    for (const [name, schema] of Object.entries(schemas || {})) {
      if (hasNestedData(schema)) {
        addFields({ [name]: schema }, containers)
      } else if (!isPanelWithOwnData(schema)) {
        // Tabs and panels have no name in the data:
        addFields(schema.fields, [...containers, { schema, name: null }])
      }
    }
  }

  const addSchema = (schema, containers) => {
    addFields(getFields(schema), containers)
    addTabsOrPanels(schema.tabs, containers)
    addTabsOrPanels(schema.panels, containers)
  }

  addSchema(schema, [])
  return nodes
}

// A field is relevant unless it or a section, tab or panel that contains it is
// hidden, like when rendered, also nested sections whose fields are all hidden.
// An `if` that fails counts as shown:
function isRelevant(entry) {
  try {
    return shouldRenderSchema(entry.schema, createContext(entry.schema, entry))
  } catch (error) {
    console.error(error)
    return true
  }
}

// The same contexts as the rendered components get:
function createContext(schema, entry) {
  return SchemaContext.createForSchema(entry.services, { ...entry, schema })
}

// The contexts of the hooks that convert the value:
function createValueContext(schema, value, entry, values = null) {
  const { data, name, dataPath, itemDataPath, rootData, services } = entry
  return new SchemaContext(services, {
    schema,
    value,
    name,
    nested: true,
    data,
    dataPath,
    itemDataPath,
    rootData,
    ...values
  })
}

function getFieldDefining(fields, key) {
  return fields.find(({ schema }) => schema[key] !== undefined) ?? fields[0]
}

// Nodes describe their fields once complete, so add fields with new nodes:
function addFieldNode(nodes, field) {
  const fields = nodes.get(field.name)?.fields ?? []
  nodes.set(field.name, new FieldNode(field.name, [...fields, field]))
}

// The source of the items of a schema, in the shape that nodes describe it:
export function getSchemaSource(schema) {
  return {
    // Nested sections hold their items without being sources:
    isSource: !!getSourceType(schema),
    isList: isListSource(schema),
    // Sources of views have no forms of their own, and their items aren't
    // walked:
    hasForms: hasFormSchema(schema),
    idKey: schema.idKey || 'id',
    orderKey: schema.orderKey ?? null,
    // Items of several forms hold the name of their form in `type`:
    hasItemTypes: hasMultipleFormSchemas(schema),
    hasResource: isSourceWithResource(schema),
    itemAdapter: getItemAdapter(schema)
  }
}

// Copy what identifies the item, for its serialized values to be added to:
export function cloneItem(source, item) {
  const copy = {}
  const { idKey, orderKey, hasItemTypes } = source
  const id = item[idKey]
  if (id !== undefined) {
    copy[idKey] = id
  }
  if (hasItemTypes) {
    copy.type = item.type
  }
  if (orderKey) {
    copy[orderKey] = item[orderKey]
  }
  return copy
}

// Merge the nodes of the forms of an item into new nodes, with child sources:
function mergeFieldNodes(nodesList, childSourceSchemas) {
  const merged = new Map()
  for (const nodes of nodesList) {
    for (const { fields } of nodes.values()) {
      for (const field of fields) {
        addFieldNode(merged, field)
      }
    }
  }
  for (const child of childSourceSchemas) {
    addFieldNode(merged, { schema: child, name: child.name, containers: [] })
  }
  return merged
}
