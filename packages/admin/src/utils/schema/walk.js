import SchemaContext from '../../SchemaContext.js'
import { computed, toRaw } from 'vue'
import { isArray, isObject, isFunction } from '@ditojs/utils'
import { appendDataPath } from '../data.js'
import { getItemAdapter, getChildSourceSchemas } from './types.ts'
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

// A value in the data of a form, with all the fields that edit it in form
// order, e.g. from several tabs. Each field comes with the unnested sections,
// tabs, panels and fields that contain it, which decide whether it's walked
// too:
class FieldNode {
  constructor(name) {
    this.name = name
    this.fields = []
  }
}

// The nodes of the schemas without `fields()` callbacks, computed so that the
// forms that these callbacks create get new nodes once they're set up:
const nodesBySchema = new WeakMap()

// Walk `data` along the nodes of `schema`, the forms of the items and their
// child sources. `visit()` receives the entries of each node's fields that
// `shouldWalk()` accepts, before the items of their value are walked, and
// `after()` after them.
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
  shouldSkipSourcesWithResource = false,
  visit,
  after = null
}) {
  const getDataPath = (dataPath, token) =>
    dataPath != null ? appendDataPath(dataPath, token) : null

  const walkNodes = (
    nodes,
    data,
    dataPath,
    serializedData,
    wrappedValueName = null
  ) => {
    const createEntry = (schema, name) => ({
      schema,
      data,
      name,
      dataPath:
        hasNestedData(schema) && name !== wrappedValueName
          ? getDataPath(dataPath, name)
          : dataPath,
      // The data path of `data`, which wrapped values keep:
      itemDataPath: dataPath,
      serializedData
    })
    // Ask once per field and container, as fields contain the fields of their
    // panels:
    const isWalkedByField = new Map()
    const isWalked = field => {
      if (!isWalkedByField.has(field)) {
        const { schema, name } = field
        isWalkedByField.set(field, shouldWalk(createEntry(schema, name)))
      }
      return isWalkedByField.get(field)
    }
    for (const { name, fields } of nodes.values()) {
      const entries = []
      for (const field of fields) {
        const { schema, containers } = field
        if (
          containers.every(isWalked) &&
          isWalked(field) &&
          !(shouldSkipSourcesWithResource && isSourceWithResource(schema))
        ) {
          entries.push(createEntry(schema, name))
        }
      }
      if (entries.length > 0) {
        visit(entries)
        walkItems(entries)
        after?.(entries)
      }
    }
  }

  const walkItems = entries => {
    const { data, name, dataPath, serializedData } = entries[0]
    const sourceEntries = entries.filter(({ schema }) => hasFormSchema(schema))
    // Only read the values of sources with forms, or tracked walks would
    // depend on all values:
    const value =
      sourceEntries.length > 0 ? (serializedData ?? data)[name] : null
    if (value != null) {
      // Fields of the same value agree on its shape, the first one tells it:
      const [{ schema: sourceSchema }] = sourceEntries
      const itemAdapter = getItemAdapter(sourceSchema)
      const sources = sourceEntries.map(entry => ({
        forms: getFormSchemas(
          entry.schema,
          SchemaContext.createForSchema(services, { ...entry, rootData })
        ),
        childSourceSchemas: getChildSourceSchemas(entry.schema)
      }))
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
            const serializedItem = cloneItem(sourceSchema, item)
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
      } else if (!isListSource(sourceSchema)) {
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

function addFieldNode(nodes, field) {
  let node = nodes.get(field.name)
  if (!node) {
    node = new FieldNode(field.name)
    nodes.set(field.name, node)
  }
  node.fields.push(field)
}

// Copy what identifies the item, for its serialized values to be added to:
export function cloneItem(sourceSchema, item) {
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
