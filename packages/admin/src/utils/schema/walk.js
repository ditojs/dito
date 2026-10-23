import SchemaContext from '../../SchemaContext.js'
import { computed, toRaw } from 'vue'
import { isArray, isObject, isFunction } from '@ditojs/utils'
import { appendDataPath } from '../data.js'
import { getUploadLimits } from '../upload.ts'
import {
  getTypeDescriptor,
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
  getItemFormSchemaFromForms,
  hasSubmitButton
} from './lookup.js'
import {
  shouldRenderSchema,
  callOrLog,
  getEditedValue,
  getDefaultValue,
  shouldSetDefaultValue,
  shouldExcludeValue,
  hasComputedValueSource,
  convertValue
} from './data.js'
import { getValidations, getValueValidationErrors } from './validation.js'
import {
  createPropertyNodes,
  getFieldPropertyNode,
  isPropertyPerEntry,
  mergePropertyNodes
} from './properties.js'

// A value of a form's data with the fields that edit it, in form order. Each
// aspect comes from the first field that defines it, else from the first one:
export class FieldNode {
  #propertyNode = null

  constructor(name, fields) {
    this.name = name
    this.fields = fields
    // Fields of the same value agree on its shape, the first one with items
    // tells it, and the first one with `relate` its relation:
    const sourceField = fields.find(
      ({ schema }) => getSourceType(schema) || hasFormSchema(schema)
    )
    this.source = sourceField ? getSchemaSource(sourceField.schema) : null
    const relationField = fields.find(({ schema }) => schema.relate)
    this.relation = relationField
      ? {
          schema: relationField.schema,
          hasOptions: !!getOptionsDataSchema(relationField.schema)
        }
      : null
  }

  // The node of the value with only its relevant fields, `null` without any:
  getRelevantNode(entry) {
    const fields = this.fields.filter(field => isRelevantField(field, entry))
    return fields.length === this.fields.length
      ? this
      : fields.length > 0
        ? new FieldNode(this.name, fields)
        : null
  }

  // The node of the value's property, merged from its fields, `null` if they
  // hold no value. Nodes with only their relevant fields merge per entry:
  getPropertyNode(entry) {
    const getNode = entry =>
      mergePropertyNodes(
        this.name,
        this.fields.map(({ schema }) =>
          getFieldPropertyNode(schema, this.name, entry)
        )
      )
    const { services } = entry
    if (
      this.fields.some(({ schema }) =>
        isPropertyPerEntry(schema, this.name, services)
      )
    ) {
      return getNode(entry)
    } else {
      // The cached properties of fields only depend on the services:
      this.#propertyNode ??= computed(() => getNode({ services }))
      return this.#propertyNode.value
    }
  }

  // Of several fields of the same value, the first with a computed value or
  // options gets the record of the data model:
  getRecordedSchema() {
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

  shouldSetDefaultValue(entry, options) {
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

  getValueOrDefault(entry) {
    return this.shouldSetDefaultValue(entry)
      ? this.getDefaultValue(entry)
      : entry.data[entry.name]
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
      createValueContext(schema, entry, { value })
    )
  }

  // Convert the value to the one to send, or `undefined` to leave it out.
  // Convert before `exclude`, so `serializeValue()` can write other values
  // into `serializedItem`:
  serialize(value, entry) {
    const { schema } = getFieldDefining(this.fields, 'serializeValue')
    const serialized = convertValue(schema, 'serializeValue', value, value =>
      createValueContext(schema, entry, { value })
    )
    const { schema: excludeSchema } = getFieldDefining(this.fields, 'exclude')
    return (
      serialized === undefined ||
      shouldExcludeValue(excludeSchema, () =>
        createValueContext(excludeSchema, entry, { value: serialized })
      )
    )
      ? undefined
      : serialized
  }

  isExcluded(entry) {
    const { schema } = getFieldDefining(this.fields, 'exclude')
    return shouldExcludeValue(schema, () => createContext(schema, entry))
  }

  // The limits of the files in the value, `null` if it holds no files:
  getUploadLimits(entry) {
    const field = this.fields.find(({ schema }) => schema.type === 'upload')
    return field
      ? getUploadLimits(field.schema, createContext(field.schema, entry))
      : null
  }

  // Of several fields of the value, the first one displays it:
  getDisplayValue(entry) {
    const { schema } = this.fields[0]
    const getDisplayValue = getTypeDescriptor(schema)?.getDisplayValue
    return getDisplayValue
      ? getDisplayValue(createContext(schema, entry))
      : entry.data[entry.name]
  }
}

// The nodes of the schemas without `fields()` callbacks, computed so that the
// forms that these callbacks create get new nodes once they're set up. Forms
// with written `properties` have a node per property:
const nodesBySchema = new WeakMap()

// Walk `data` along the nodes of `schema` and of the forms of the items, and
// visit each node that `shouldVisit()` accepts, before the items that
// `shouldWalk()` lets in, with `after()` after them. With
// `shouldSkipIrrelevant`, visited nodes hold only their relevant fields.
// NOTE: Items with an item adapter are walked wrapped, also an item of
// `sourceSchema` that the walk starts at. Walks that build a copy in
// `serializedData` walk the values that `visit()` sets in it.
export function walkData(schema, data, {
  dataPath = null,
  sourceSchema = null,
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

  const walkNodes = (
    nodes,
    data,
    dataPath,
    serializedData,
    wrappedValueName = null
  ) => {
    for (const node of nodes.values()) {
      const { name } = node
      const entry = {
        node,
        data,
        name,
        dataPath:
          name !== wrappedValueName ? getDataPath(dataPath, name) : dataPath,
        // The data path of `data`, which wrapped values keep:
        itemDataPath: dataPath,
        serializedData,
        serializedRootData,
        services,
        rootData
      }
      if (
        !(shouldSkipSourcesWithResource && node.source?.hasResource) &&
        shouldVisit(entry)
      ) {
        if (shouldSkipIrrelevant) {
          entry.node = node.getRelevantNode(entry)
        }
        if (entry.node) {
          visit(entry)
          if (shouldWalk(entry)) {
            walkItems(entry)
          }
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
  // sources as fields of the forms, unless they have fields or properties of
  // their name:
  const getItemNodes = (sources, item, dataPath) => {
    const forms = new Set()
    const childSourceSchemas = []
    for (const source of sources) {
      const form = getItemFormSchemaFromForms(source.forms, item)
      if (form && !forms.has(form)) {
        forms.add(form)
        childSourceSchemas.push(
          ...source.childSourceSchemas.filter(
            ({ name }) => !(form.fields ?? form.properties)?.[name]
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
    serializedData,
    getItemAdapter(sourceSchema)?.name
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
function isRelevantField(field, entry) {
  return [...field.containers, field].every(({ schema, name }) => {
    // Fields with panels contain the fields of their panels, at their own data
    // path:
    const dataPath =
      name === entry.name
        ? entry.dataPath
        : hasNestedData(schema)
          ? getDataPath(entry.itemDataPath, name)
          : entry.itemDataPath
    const context = createContext(schema, { ...entry, name, dataPath })
    return callOrLog(() => shouldRenderSchema(schema, context), true)
  })
}

// The same contexts as the rendered components get:
function createContext(schema, entry) {
  return SchemaContext.createForSchema(entry.services, { ...entry, schema })
}

// The contexts of the value, also of the hooks that convert it:
export function createValueContext(schema, entry, values = null) {
  const {
    data,
    name,
    dataPath,
    itemDataPath,
    rootData,
    serializedData,
    serializedRootData,
    services
  } = entry
  return new SchemaContext(services, {
    schema,
    name,
    nested: true,
    data,
    dataPath,
    itemDataPath,
    rootData,
    // The copies that walks build, while they build them:
    ...(serializedData && { serializedData, serializedRootData }),
    ...(values ?? {
      get value() {
        return data[name]
      }
    })
  })
}

// Walks without data paths have none in the data either:
function getDataPath(dataPath, token) {
  return dataPath != null ? appendDataPath(dataPath, token) : null
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
    isList: isListSource(schema),
    // Sources of views have no forms of their own, and their items aren't
    // walked:
    hasForms: hasFormSchema(schema),
    idKey: schema.idKey || 'id',
    orderKey: schema.orderKey ?? null,
    // Items of several forms hold the name of their form in `type`:
    hasItemTypes: hasMultipleFormSchemas(schema),
    hasResource: isSourceWithResource(schema),
    // Sources with a resource and a submit button save their edits on submit:
    hasSubmitButton: hasSubmitButton(schema.buttons),
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
